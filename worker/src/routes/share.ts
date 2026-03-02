import { Hono } from 'hono'
import { SignJWT, jwtVerify } from 'jose'
import { Env, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { buildHashedKey } from '../utils'

const share = new Hono<{ Bindings: Env; Variables: Variables }>()

const MAX_SIZE = 100 * 1024 * 1024

// POST /api/share/create-upload-link（需要登录）
// 生成一个 24 小时有效的上传链接 token
share.post('/create-upload-link', authMiddleware, async (c) => {
  const secret = new TextEncoder().encode(c.env.JWT_SECRET)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const token = await new SignJWT({ type: 'upload-link' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)

  return c.json({ token, expiresAt: expiresAt.toISOString() })
})

// POST /api/share/upload?token=...（公开，无需登录）
// 使用上传 token 上传文件，存储到 uploads/{year}{month}/ 目录
share.post('/upload', async (c) => {
  const token = c.req.query('token')
  if (!token) {
    return c.json({ error: 'Token is required' }, 401)
  }

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    if (payload.type !== 'upload-link') {
      return c.json({ error: '链接无效' }, 401)
    }
  } catch {
    return c.json({ error: '链接已过期或无效' }, 401)
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400)
  }
  if (file.size === 0) {
    return c.json({ error: 'Empty file' }, 400)
  }
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large (max 100MB)' }, 413)
  }

  const key = await buildHashedKey('uploads/', file)

  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      source: 'share-link',
    },
  })

  return c.json({ success: true, key, name: file.name, size: file.size })
})

export default share

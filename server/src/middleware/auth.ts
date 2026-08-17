import { Context, Next } from 'hono'
import { jwtVerify } from 'jose'
import { Env, Variables } from '../types'

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  // 支持 Authorization header 或 URL query param（用于图片预览直链）
  const authHeader = c.req.header('Authorization')
  const queryToken = c.req.query('token')

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : queryToken

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    // 分享上传链接的 token 用同一把密钥签发，但用途不同（type: 'upload-link'，
    // 且不带 sub）。这里必须显式拒绝，否则任何拿到分享链接的人都能当管理员
    // 会话使用——列出/删除/下载全部文件，而不只是免登录上传那一项权限。
    if (typeof payload.sub !== 'string' || !payload.sub) {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }

    c.set('user', { sub: payload.sub })
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}

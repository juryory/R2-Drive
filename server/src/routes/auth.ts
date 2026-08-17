import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { Env, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'

const auth = new Hono<{ Bindings: Env; Variables: Variables }>()

// 时序安全的字符串比较，防止时序攻击
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  if (aBytes.length !== bBytes.length) {
    // 仍然执行比较以保持固定时间
    await crypto.subtle.digest('SHA-256', aBytes)
    return false
  }
  const aKey = await crypto.subtle.importKey('raw', aBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bKey = await crypto.subtle.importKey('raw', bBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const aSign = await crypto.subtle.sign('HMAC', aKey, enc.encode('compare'))
  const bSign = await crypto.subtle.sign('HMAC', bKey, enc.encode('compare'))
  const aArr = new Uint8Array(aSign)
  const bArr = new Uint8Array(bSign)
  let diff = 0
  for (let i = 0; i < aArr.length; i++) {
    diff |= (aArr[i] ?? 0) ^ (bArr[i] ?? 0)
  }
  return diff === 0
}

// POST /api/auth/login
auth.post('/login', async (c) => {
  let body: { username?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { username = '', password = '' } = body

  const usernameMatch = await timingSafeEqual(username, c.env.ADMIN_USERNAME)
  const passwordMatch = await timingSafeEqual(password, c.env.ADMIN_PASSWORD)

  if (!usernameMatch || !passwordMatch) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const secret = new TextEncoder().encode(c.env.JWT_SECRET)
  const token = await new SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  return c.json({ token, expiresIn: 7 * 24 * 60 * 60 })
})

// GET /api/auth/me — 验证 token 是否有效
auth.get('/me', authMiddleware, (c) => {
  return c.json({ user: c.get('user').sub })
})

export default auth

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
    c.set('user', { sub: payload.sub as string })
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}

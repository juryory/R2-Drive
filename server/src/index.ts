import { Hono } from 'hono'
import { Env, Variables } from './types'
import { CosError } from './storage/cos'
import authRoutes from './routes/auth'
import filesRoutes from './routes/files'
import shareRoutes from './routes/share'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// CORS 中间件
app.use('*', async (c, next) => {
  // 同源部署时 ALLOWED_ORIGINS 为空，此时不下发任何 CORS 头
  const allowedOrigins = (c.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = c.req.header('Origin') || ''

  if (origin && allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Access-Control-Allow-Credentials', 'true')
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    c.header('Access-Control-Max-Age', '86400')
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204)
  }

  await next()
})

app.route('/api/auth', authRoutes)
app.route('/api/files', filesRoutes)
app.route('/api/share', shareRoutes)

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  // COS 的配置错误和上游错误单独透出，否则排查时只能看到一句 500
  if (err instanceof CosError) {
    return c.json({ error: err.message }, err.status)
  }
  return c.json({ error: 'Internal server error' }, 500)
})

export default app

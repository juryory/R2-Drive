import { Hono } from 'hono'
import { Env, Variables } from './types'
import authRoutes from './routes/auth'
import filesRoutes from './routes/files'
import shareRoutes from './routes/share'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// CORS 中间件
app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim())
  const origin = c.req.header('Origin') || ''

  if (allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Access-Control-Allow-Credentials', 'true')
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    c.header('Access-Control-Max-Age', '86400')
  }

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204)
  }

  await next()
})

app.route('/api/auth', authRoutes)
app.route('/api/files', filesRoutes)
app.route('/api/share', shareRoutes)

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import 'dotenv/config'

import app from './index'
import { loadEnv, maxUploadBytes } from './env'

const env = loadEnv()

const port = Number(process.env['PORT'] ?? 3000)
// 默认只监听回环地址，由 nginx 反向代理对外提供服务。
// 需要直接对公网暴露时设 HOST=0.0.0.0（记得同时配好防火墙和 HTTPS）
const hostname = process.env['HOST'] ?? '127.0.0.1'

/**
 * 可选：由本进程直接托管前端静态文件。
 * 配了 nginx 的话不需要设 STATIC_DIR，交给 nginx 更高效。
 */
const staticDir = process.env['STATIC_DIR']

if (staticDir) {
  const absolute = path.resolve(staticDir)
  const indexHtml = path.join(absolute, 'index.html')

  if (!existsSync(indexHtml)) {
    throw new Error(`STATIC_DIR 下找不到 index.html：${indexHtml}\n请先在 frontend 目录执行 npm run build`)
  }

  // serveStatic 的 root 是相对于进程工作目录的
  const root = path.relative(process.cwd(), absolute) || '.'
  app.use('/*', serveStatic({ root }))

  // 前端用的是 BrowserRouter，未命中的非 API 路径一律回 index.html 交给前端路由
  app.notFound(async (c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Not found' }, 404)
    }
    return c.html(await readFile(indexHtml, 'utf8'))
  })
}

serve({ fetch: (request: Request) => app.fetch(request, env), port, hostname }, (info) => {
  console.log(`[cos-drive] 已启动 http://${hostname}:${info.port}`)
  console.log(`[cos-drive] 存储桶 ${env.COS_BUCKET} @ ${env.COS_REGION}`)
  console.log(`[cos-drive] 单文件上限 ${Math.floor(maxUploadBytes() / 1024 / 1024)}MB`)
  if (staticDir) console.log(`[cos-drive] 前端静态目录 ${path.resolve(staticDir)}`)
  if (!env.ALLOWED_ORIGINS) console.log('[cos-drive] 未配置 ALLOWED_ORIGINS，按同源部署处理')
})

// PM2 / systemd 重启时优雅退出
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`[cos-drive] 收到 ${signal}，退出`)
    process.exit(0)
  })
}

import { Hono } from 'hono'
import { Env, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { buildHashedKey } from '../utils'

const files = new Hono<{ Bindings: Env; Variables: Variables }>()

// 所有文件路由都需要鉴权
files.use('*', authMiddleware)

// GET /api/files?prefix=folder/path/
// 列出当前目录下的文件和子文件夹
files.get('/', async (c) => {
  const prefix = c.req.query('prefix') || ''

  const result = await c.env.BUCKET.list({
    prefix,
    delimiter: '/',
    limit: 1000,
  })

  const folders = result.delimitedPrefixes.map((p) => ({
    type: 'folder' as const,
    key: p,
    name: p.slice(prefix.length, -1), // 去掉前缀和末尾的 /
  }))

  const fileItems = result.objects
    .filter((obj) => obj.key !== `${prefix}.keep`) // 隐藏文件夹占位文件
    .map((obj) => ({
      type: 'file' as const,
      key: obj.key,
      name: obj.key.slice(prefix.length),
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
      contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
    }))

  return c.json({ folders, files: fileItems, prefix })
})

// POST /api/files/upload
// 上传文件（multipart/form-data）
files.post('/upload', async (c) => {
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file = formData.get('file') as File | null
  const prefix = (formData.get('prefix') as string | null) ?? ''

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400)
  }

  if (file.size === 0) {
    return c.json({ error: 'Empty file' }, 400)
  }

  // 100MB 限制（Workers 免费计划）
  const MAX_SIZE = 100 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large (max 100MB)' }, 413)
  }

  const key = `${prefix}${file.name}`

  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  })

  return c.json({ success: true, key, name: file.name, size: file.size })
})

// DELETE /api/files
// 删除文件或文件夹（文件夹会递归删除所有内容）
files.delete('/', async (c) => {
  let body: { keys?: string[] }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { keys = [] } = body

  if (!Array.isArray(keys) || keys.length === 0) {
    return c.json({ error: 'No keys provided' }, 400)
  }

  // 对于文件夹（key 以 / 结尾），递归列出并删除所有内容
  const keysToDelete: string[] = []

  for (const key of keys) {
    if (key.endsWith('/')) {
      // 文件夹：列出所有子文件
      let cursor: string | undefined
      do {
        const list = await c.env.BUCKET.list({
          prefix: key,
          limit: 1000,
          cursor,
        })
        for (const obj of list.objects) {
          keysToDelete.push(obj.key)
        }
        cursor = list.truncated ? list.cursor : undefined
      } while (cursor)
    } else {
      keysToDelete.push(key)
    }
  }

  if (keysToDelete.length > 0) {
    // R2 支持批量删除（最多 1000 个）
    const chunks: string[][] = []
    for (let i = 0; i < keysToDelete.length; i += 1000) {
      chunks.push(keysToDelete.slice(i, i + 1000))
    }
    await Promise.all(chunks.map((chunk) => c.env.BUCKET.delete(chunk)))
  }

  return c.json({ success: true, deleted: keysToDelete.length })
})

// POST /api/files/folder
// 创建文件夹（在 R2 中创建 .keep 占位文件）
files.post('/folder', async (c) => {
  let body: { path?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { path = '' } = body

  if (!path || !path.endsWith('/')) {
    return c.json({ error: 'Folder path must end with /' }, 400)
  }

  // 检查文件夹名是否合法
  const folderName = path.split('/').filter(Boolean).pop() ?? ''
  if (!folderName || folderName.includes('..')) {
    return c.json({ error: 'Invalid folder name' }, 400)
  }

  await c.env.BUCKET.put(`${path}.keep`, new Uint8Array(0), {
    httpMetadata: { contentType: 'text/plain' },
    customMetadata: { type: 'folder-placeholder' },
  })

  return c.json({ success: true, path })
})

// POST /api/files/rename
// 重命名 / 移动文件（复制 + 删除原文件）
files.post('/rename', async (c) => {
  let body: { oldKey?: string; newKey?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { oldKey, newKey } = body

  if (!oldKey || !newKey) {
    return c.json({ error: 'oldKey and newKey are required' }, 400)
  }

  if (oldKey === newKey) {
    return c.json({ error: 'Old and new keys are the same' }, 400)
  }

  const source = await c.env.BUCKET.get(oldKey)
  if (!source) {
    return c.json({ error: 'Source file not found' }, 404)
  }

  // R2 目前没有原生 rename，需要复制后删除
  await c.env.BUCKET.put(newKey, source.body, {
    httpMetadata: source.httpMetadata,
    customMetadata: source.customMetadata,
  })
  await c.env.BUCKET.delete(oldKey)

  return c.json({ success: true })
})

// GET /api/files/download?key=path/to/file
// 下载文件（以附件方式）
files.get('/download', async (c) => {
  const key = c.req.query('key')

  if (!key) {
    return c.json({ error: 'key is required' }, 400)
  }

  const object = await c.env.BUCKET.get(key)

  if (!object) {
    return c.json({ error: 'File not found' }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)

  const filename = key.split('/').pop() ?? 'download'
  headers.set(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  )
  headers.set('Content-Length', object.size.toString())

  return new Response(object.body, { headers })
})

// GET /api/files/preview?key=path/to/file
// 预览文件（inline，用于图片/视频等）
files.get('/preview', async (c) => {
  const key = c.req.query('key')

  if (!key) {
    return c.json({ error: 'key is required' }, 400)
  }

  const object = await c.env.BUCKET.get(key)

  if (!object) {
    return c.json({ error: 'File not found' }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('Cache-Control', 'private, max-age=3600')

  const filename = key.split('/').pop() ?? 'file'
  headers.set(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
  )

  return new Response(object.body, { headers })
})

// POST /api/files/quick-upload
// 简易上传：带哈希命名，存到 drive/{year}{month}/ 目录，永久保存
files.post('/quick-upload', async (c) => {
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
  const MAX_SIZE = 100 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large (max 100MB)' }, 413)
  }

  const key = await buildHashedKey('drive/', file)

  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      source: 'quick-upload',
    },
  })

  return c.json({ success: true, key, name: file.name, size: file.size })
})

// GET /api/files/all
// 列出所有文件（扁平列表，用于空间管理模式）
files.get('/all', async (c) => {
  const allFiles: Array<{
    type: 'file'
    key: string
    name: string
    size: number
    uploaded: string
    contentType: string
  }> = []
  let cursor: string | undefined

  do {
    const result = await c.env.BUCKET.list({ limit: 1000, cursor })
    for (const obj of result.objects) {
      if (!obj.key.endsWith('/.keep')) {
        allFiles.push({
          type: 'file',
          key: obj.key,
          name: obj.key.split('/').pop() ?? obj.key,
          size: obj.size,
          uploaded: obj.uploaded.toISOString(),
          contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
        })
      }
    }
    cursor = result.truncated ? result.cursor : undefined
  } while (cursor)

  return c.json({ files: allFiles })
})

// GET /api/files/stats
// 存储使用情况统计
files.get('/stats', async (c) => {
  let totalSize = 0
  let fileCount = 0
  let cursor: string | undefined

  do {
    const result = await c.env.BUCKET.list({ limit: 1000, cursor })
    for (const obj of result.objects) {
      // 排除文件夹占位文件
      if (!obj.key.endsWith('/.keep')) {
        totalSize += obj.size
        fileCount++
      }
    }
    cursor = result.truncated ? result.cursor : undefined
  } while (cursor)

  return c.json({ totalSize, fileCount })
})

export default files

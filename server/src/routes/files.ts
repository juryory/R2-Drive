import { Hono } from 'hono'
import { Env, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { buildHashedKey, guessContentType, buildContentDisposition } from '../utils'
import { getCos, CosClient, CosObject } from '../storage/cos'
import { maxUploadBytes } from '../env'

const files = new Hono<{ Bindings: Env; Variables: Variables }>()

// 所有文件路由都需要鉴权
files.use('*', authMiddleware)

// 由 MAX_UPLOAD_MB 环境变量控制，默认 200MB
const MAX_SIZE = maxUploadBytes()

/** 遍历所有分页，把匹配前缀的对象全部取出 */
async function listAll(cos: CosClient, prefix?: string): Promise<CosObject[]> {
  const objects: CosObject[] = []
  let marker: string | undefined

  do {
    const result = await cos.list({ prefix, marker, maxKeys: 1000 })
    objects.push(...result.objects)
    marker = result.nextMarker
  } while (marker)

  return objects
}

// GET /api/files?prefix=folder/path/
// 列出当前目录下的文件和子文件夹
files.get('/', async (c) => {
  const prefix = c.req.query('prefix') || ''
  const cos = getCos(c.env)

  const result = await cos.list({ prefix, delimiter: '/', maxKeys: 1000 })

  const folders = result.prefixes.map((p) => ({
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
      uploaded: obj.lastModified,
      contentType: guessContentType(obj.key),
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

  if (file.size > MAX_SIZE) {
    return c.json({ error: `文件过大（上限 ${Math.floor(MAX_SIZE / 1024 / 1024)}MB）` }, 413)
  }

  const key = `${prefix}${file.name}`

  await getCos(c.env).putObject(key, file, {
    contentType: file.type || 'application/octet-stream',
    meta: {
      originalname: file.name,
      uploadedat: new Date().toISOString(),
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

  const cos = getCos(c.env)

  // 对于文件夹（key 以 / 结尾），递归列出并删除所有内容
  const keysToDelete: string[] = []

  for (const key of keys) {
    if (key.endsWith('/')) {
      const objects = await listAll(cos, key)
      keysToDelete.push(...objects.map((obj) => obj.key))
    } else {
      keysToDelete.push(key)
    }
  }

  if (keysToDelete.length > 0) {
    await cos.deleteObjects(keysToDelete)
  }

  return c.json({ success: true, deleted: keysToDelete.length })
})

// POST /api/files/folder
// 创建文件夹（在 COS 中创建 .keep 占位文件）
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

  await getCos(c.env).putObject(`${path}.keep`, new Uint8Array(0), {
    contentType: 'text/plain',
    meta: { type: 'folder-placeholder' },
  })

  return c.json({ success: true, path })
})

// POST /api/files/rename
// 重命名 / 移动文件（服务端复制 + 删除原文件）
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

  const cos = getCos(c.env)

  if (!(await cos.objectExists(oldKey))) {
    return c.json({ error: 'Source file not found' }, 404)
  }

  // COS 没有原生 rename，用服务端复制后删除原对象
  // 复制在 COS 内部完成，文件内容不经过本服务器
  await cos.copyObject(oldKey, newKey)
  await cos.deleteObjects([oldKey])

  return c.json({ success: true })
})

/** download / preview 共用的取对象逻辑 */
async function serveObject(
  cos: CosClient,
  key: string,
  disposition: 'attachment' | 'inline'
): Promise<Response | null> {
  const object = await cos.getObject(key)
  if (!object) return null

  const headers = new Headers()
  headers.set('Content-Type', object.headers.get('Content-Type') ?? guessContentType(key))

  const contentLength = object.headers.get('Content-Length')
  if (contentLength) headers.set('Content-Length', contentLength)

  const etag = object.headers.get('ETag')
  if (etag) headers.set('ETag', etag)

  if (disposition === 'inline') {
    headers.set('Cache-Control', 'private, max-age=3600')
  }

  const filename = key.split('/').pop() ?? (disposition === 'attachment' ? 'download' : 'file')
  headers.set('Content-Disposition', buildContentDisposition(disposition, filename))

  return new Response(object.body, { headers })
}

// GET /api/files/download?key=path/to/file
// 下载文件（以附件方式）
files.get('/download', async (c) => {
  const key = c.req.query('key')

  if (!key) {
    return c.json({ error: 'key is required' }, 400)
  }

  const response = await serveObject(getCos(c.env), key, 'attachment')
  return response ?? c.json({ error: 'File not found' }, 404)
})

// GET /api/files/preview?key=path/to/file
// 预览文件（inline，用于图片/视频等）
files.get('/preview', async (c) => {
  const key = c.req.query('key')

  if (!key) {
    return c.json({ error: 'key is required' }, 400)
  }

  const response = await serveObject(getCos(c.env), key, 'inline')
  return response ?? c.json({ error: 'File not found' }, 404)
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
  if (file.size > MAX_SIZE) {
    return c.json({ error: `文件过大（上限 ${Math.floor(MAX_SIZE / 1024 / 1024)}MB）` }, 413)
  }

  const key = await buildHashedKey('drive/', file)

  await getCos(c.env).putObject(key, file, {
    contentType: file.type || 'application/octet-stream',
    meta: {
      originalname: file.name,
      uploadedat: new Date().toISOString(),
      source: 'quick-upload',
    },
  })

  return c.json({ success: true, key, name: file.name, size: file.size })
})

// GET /api/files/all
// 列出所有文件（扁平列表，用于空间管理模式）
files.get('/all', async (c) => {
  const objects = await listAll(getCos(c.env))

  const allFiles = objects
    .filter((obj) => !obj.key.endsWith('/.keep'))
    .map((obj) => ({
      type: 'file' as const,
      key: obj.key,
      name: obj.key.split('/').pop() ?? obj.key,
      size: obj.size,
      uploaded: obj.lastModified,
      contentType: guessContentType(obj.key),
    }))

  return c.json({ files: allFiles })
})

// GET /api/files/stats
// 存储使用情况统计
files.get('/stats', async (c) => {
  const objects = await listAll(getCos(c.env))

  let totalSize = 0
  let fileCount = 0

  for (const obj of objects) {
    // 排除文件夹占位文件
    if (!obj.key.endsWith('/.keep')) {
      totalSize += obj.size
      fileCount++
    }
  }

  return c.json({ totalSize, fileCount })
})

export default files

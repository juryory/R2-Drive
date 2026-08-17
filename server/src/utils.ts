/**
 * 计算文件内容的 SHA-256，返回前 8 位十六进制字符串
 * 用于生成唯一文件名，功能等价于 MD5 前缀
 */
async function fileHash8(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8)
}

/**
 * 构建带哈希的文件存储路径
 * 格式：{prefix}{year}{month}/{baseName}.{hash8}.{ext}
 */
export async function buildHashedKey(prefix: string, file: File): Promise<string> {
  const hash8 = await fileHash8(file)
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')

  const name = file.name
  const lastDot = name.lastIndexOf('.')
  const baseName = lastDot >= 0 ? name.slice(0, lastDot) : name
  const ext = lastDot >= 0 ? name.slice(lastDot + 1) : ''

  const fileName = ext ? `${baseName}.${hash8}.${ext}` : `${baseName}.${hash8}`
  return `${prefix}${year}${month}/${fileName}`
}

/**
 * 扩展名 → MIME 类型映射
 * COS 的列表接口（GET Bucket）不返回每个对象的 Content-Type，
 * 因此列表场景下按扩展名推断，够前端判断预览类型使用
 */
const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  flv: 'video/x-flv',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  ts: 'text/plain',
  yml: 'text/plain',
  yaml: 'text/plain',
  log: 'text/plain',
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function guessContentType(key: string): string {
  const name = key.split('/').pop() ?? key
  const lastDot = name.lastIndexOf('.')
  if (lastDot < 0) return 'application/octet-stream'

  const ext = name.slice(lastDot + 1).toLowerCase()
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

/**
 * 构建符合 RFC 6266 的 Content-Disposition 值
 *
 * 只写 filename*（RFC 5987 扩展写法，支持中文）不够：部分浏览器内置的
 * PDF 查看器等场景不认这个写法时会直接退回用 URL 路径取文件名，
 * 对预览接口（/api/files/preview?key=...）这意味着文件名会变成
 * URL 最后一段的字面量 "preview"。必须同时提供纯 ASCII 的 filename
 * 兜底，两者都写才是标准做法。
 */
export function buildContentDisposition(
  disposition: 'attachment' | 'inline',
  filename: string
): string {
  // 兜底名去掉控制字符（含换行，防止头注入）、非 ASCII 字符和引号/反斜杠
  const asciiFallback =
    filename
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || 'file'

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

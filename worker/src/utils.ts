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

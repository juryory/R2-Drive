/**
 * 腾讯云 COS 请求签名（q-sign-algorithm=sha1）
 * 文档：https://cloud.tencent.com/document/product/436/7778
 *
 * 全部基于 Web Crypto 实现，不依赖任何 COS SDK。
 */

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha1Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-1', encoder.encode(text)))
}

async function hmacSha1Hex(key: string, text: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(text)))
}

/**
 * RFC3986 编码。encodeURIComponent 会漏掉 !'()* 这几个字符，COS 要求一并编码
 */
export function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  )
}

/** 编码对象路径，保留 / 分隔符 */
export function encodePath(pathname: string): string {
  return pathname.split('/').map(encodeRfc3986).join('/')
}

/**
 * 把 header / query 映射转成签名所需的 "key 列表" 和 "key=value 串"
 * 键统一转小写并按字典序排序
 */
function buildSignParts(map: Record<string, string>): { list: string; str: string } {
  const entries = Object.entries(map)
    .map(([k, v]) => [k.toLowerCase(), v] as [string, string])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

  return {
    list: entries.map(([k]) => k).join(';'),
    str: entries.map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`).join('&'),
  }
}

export type SignOptions = {
  secretId: string
  secretKey: string
  method: string
  /** 未编码的对象路径，以 / 开头（签名用原始路径，URL 里才编码） */
  pathname: string
  query?: Record<string, string>
  /** 参与签名的请求头，必须与实际发出的请求头完全一致 */
  headers?: Record<string, string>
  /** 签名有效期（秒），默认 600 */
  expiresIn?: number
}

/** 生成 Authorization 头的值 */
export async function buildAuthorization(opts: SignOptions): Promise<string> {
  // 提前 60 秒生效，容忍机器之间的时钟偏差
  const startTime = Math.floor(Date.now() / 1000) - 60
  const endTime = startTime + (opts.expiresIn ?? 600)
  const keyTime = `${startTime};${endTime}`

  const signKey = await hmacSha1Hex(opts.secretKey, keyTime)
  const query = buildSignParts(opts.query ?? {})
  const headers = buildSignParts(opts.headers ?? {})

  const httpString = `${opts.method.toLowerCase()}\n${opts.pathname}\n${query.str}\n${headers.str}\n`
  const stringToSign = `sha1\n${keyTime}\n${await sha1Hex(httpString)}\n`
  const signature = await hmacSha1Hex(signKey, stringToSign)

  return [
    'q-sign-algorithm=sha1',
    `q-ak=${opts.secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headers.list}`,
    `q-url-param-list=${query.list}`,
    `q-signature=${signature}`,
  ].join('&')
}

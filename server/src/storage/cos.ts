/**
 * 腾讯云 COS 客户端（XML API）
 *
 * 只实现本项目用到的操作，接口形状刻意贴近原来的 R2 binding，
 * 方便路由层平移。所有请求都走 fetch，无需任何 Node SDK。
 */

import { createHash } from 'node:crypto'
import { Env } from '../types'
import { buildAuthorization, encodePath, encodeRfc3986 } from './sign'

export class CosError extends Error {
  constructor(
    message: string,
    public readonly status: 500 | 502 = 502
  ) {
    super(message)
    this.name = 'CosError'
  }
}

export type CosObject = {
  key: string
  size: number
  /** ISO 8601 时间字符串 */
  lastModified: string
  etag: string
}

export type CosListResult = {
  objects: CosObject[]
  /** delimiter 聚合出的「文件夹」前缀 */
  prefixes: string[]
  isTruncated: boolean
  /** 下一页的 marker，isTruncated 为 false 时是 undefined */
  nextMarker?: string
}

/** COS 单次批量删除上限 */
export const MAX_DELETE_BATCH = 1000

/**
 * 请求体类型。@types/node 没有暴露全局 BodyInit，
 * 这里按本项目实际用到的几种精确声明，免得为此引入整个 DOM lib
 */
type RequestBody = string | Uint8Array | Blob

// ---------------------------------------------------------------- XML 解析

const XML_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  '#39': "'",
}

function decodeXmlEntities(text: string): string {
  return text.replace(/&(lt|gt|amp|quot|apos|#39);/g, (_, entity: string) => XML_ENTITIES[entity] ?? _)
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&apos;'
      default:
        return '&quot;'
    }
  })
}

/** 取第一个 <tag>...</tag> 的内容 */
function tagValue(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  return match?.[1] === undefined ? undefined : decodeXmlEntities(match[1])
}

/** 取所有 <tag>...</tag> 的内容 */
function tagBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = []
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(xml)) !== null) {
    blocks.push(match[1] ?? '')
  }
  return blocks
}

/**
 * 列表接口带了 encoding-type=url，Key / Prefix 需要再解一次 URL 编码。
 * 遇到异常编码时退回原值，避免整个列表请求失败。
 */
function decodeListValue(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// ---------------------------------------------------------------- 客户端

export class CosClient {
  private readonly secretId: string
  private readonly secretKey: string
  /** 请求实际发往的主机名，同时作为签名里的 host */
  private readonly host: string
  /** 协议 + 主机名 */
  private readonly origin: string

  constructor(env: Env) {
    const missing = (
      ['COS_SECRET_ID', 'COS_SECRET_KEY', 'COS_BUCKET', 'COS_REGION'] as const
    ).filter((name) => !env[name])

    if (missing.length > 0) {
      throw new CosError(`COS 配置缺失：${missing.join(', ')}`, 500)
    }

    this.secretId = env.COS_SECRET_ID
    this.secretKey = env.COS_SECRET_KEY

    // 默认用公网域名（同地域服务器访问时腾讯云会自动解析到内网）。
    // COS_ENDPOINT 可覆盖为内网域名或自定义加速域名
    const endpoint = env.COS_ENDPOINT?.trim()
    if (endpoint) {
      const url = new URL(endpoint.includes('://') ? endpoint : `https://${endpoint}`)
      this.host = url.host
      this.origin = url.origin
    } else {
      // 存储桶名称必须带 APPID，例如 file-1250000000
      this.host = `${env.COS_BUCKET}.cos.${env.COS_REGION}.myqcloud.com`
      this.origin = `https://${this.host}`
    }
  }

  private async request(opts: {
    method: string
    /** 对象键，不带前导 / */
    key?: string
    query?: Record<string, string>
    headers?: Record<string, string>
    body?: RequestBody | null
    /** 这些状态码不视为错误，直接把 Response 交给调用方 */
    passthroughStatus?: number[]
  }): Promise<Response> {
    const pathname = `/${opts.key ?? ''}`
    const query = opts.query ?? {}
    const extraHeaders = opts.headers ?? {}

    // host 必须参与签名，但不能手动塞进 fetch —— 它由 URL 推导
    const authorization = await buildAuthorization({
      secretId: this.secretId,
      secretKey: this.secretKey,
      method: opts.method,
      pathname,
      query,
      headers: { host: this.host, ...extraHeaders },
    })

    // 手动拼 query string：URLSearchParams 会把空格编码成 +，与签名不一致
    const queryString = Object.entries(query)
      .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
      .join('&')
    const url = `${this.origin}${encodePath(pathname)}${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url, {
      method: opts.method,
      headers: { ...extraHeaders, Authorization: authorization },
      body: opts.body ?? null,
    })

    if (!response.ok && !opts.passthroughStatus?.includes(response.status)) {
      // COS 的错误详情在 XML body 里，取出来方便排查
      const detail = await response.text().catch(() => '')
      const code = tagValue(detail, 'Code')
      const message = tagValue(detail, 'Message')
      throw new CosError(
        `COS ${opts.method} ${pathname} 失败（HTTP ${response.status}）` +
          (code ? `：${code} - ${message ?? ''}` : '')
      )
    }

    return response
  }

  /** 列举对象。不传 delimiter 时会平铺返回所有层级 */
  async list(opts: {
    prefix?: string
    delimiter?: string
    marker?: string
    maxKeys?: number
  }): Promise<CosListResult> {
    const query: Record<string, string> = {
      'encoding-type': 'url',
      'max-keys': String(opts.maxKeys ?? 1000),
    }
    if (opts.prefix) query['prefix'] = opts.prefix
    if (opts.delimiter) query['delimiter'] = opts.delimiter
    if (opts.marker) query['marker'] = opts.marker

    const xml = await (await this.request({ method: 'GET', query })).text()

    const objects: CosObject[] = tagBlocks(xml, 'Contents').map((block) => ({
      key: decodeListValue(tagValue(block, 'Key') ?? ''),
      size: Number(tagValue(block, 'Size') ?? 0),
      lastModified: tagValue(block, 'LastModified') ?? new Date(0).toISOString(),
      etag: (tagValue(block, 'ETag') ?? '').replace(/"/g, ''),
    }))

    const prefixes = tagBlocks(xml, 'CommonPrefixes').map((block) =>
      decodeListValue(tagValue(block, 'Prefix') ?? '')
    )

    const isTruncated = tagValue(xml, 'IsTruncated') === 'true'
    // 带 delimiter 时 COS 会返回 NextMarker；不带时用本页最后一个 Key 续传
    const nextMarker = isTruncated
      ? decodeListValue(tagValue(xml, 'NextMarker') ?? '') || objects[objects.length - 1]?.key
      : undefined

    return { objects, prefixes, isTruncated, nextMarker: nextMarker || undefined }
  }

  /** 上传对象。meta 会写成 x-cos-meta-* 自定义头 */
  async putObject(
    key: string,
    body: RequestBody,
    opts: { contentType?: string; meta?: Record<string, string> } = {}
  ): Promise<void> {
    const headers: Record<string, string> = {
      'content-type': opts.contentType || 'application/octet-stream',
    }

    for (const [name, value] of Object.entries(opts.meta ?? {})) {
      // HTTP 头只能是 ASCII，中文文件名等需要编码后存放
      headers[`x-cos-meta-${name.toLowerCase()}`] = encodeRfc3986(value)
    }

    await this.request({ method: 'PUT', key, headers, body })
  }

  /** 下载对象，不存在时返回 null。Response.body 可直接透传给前端 */
  async getObject(key: string): Promise<Response | null> {
    const response = await this.request({
      method: 'GET',
      key,
      passthroughStatus: [404],
    })
    return response.status === 404 ? null : response
  }

  /** 判断对象是否存在 */
  async objectExists(key: string): Promise<boolean> {
    const response = await this.request({
      method: 'HEAD',
      key,
      passthroughStatus: [404],
    })
    return response.status !== 404
  }

  /** 服务端复制，用于重命名 / 移动，不消耗本机带宽 */
  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    await this.request({
      method: 'PUT',
      key: destKey,
      headers: {
        // 复制源要求是「域名 + 编码后的路径」，且不带协议头
        'x-cos-copy-source': `${this.host}${encodePath(`/${sourceKey}`)}`,
      },
    })
  }

  /** 批量删除，内部自动按 1000 个一批切分 */
  async deleteObjects(keys: string[]): Promise<void> {
    const batches: string[][] = []
    for (let i = 0; i < keys.length; i += MAX_DELETE_BATCH) {
      batches.push(keys.slice(i, i + MAX_DELETE_BATCH))
    }

    await Promise.all(batches.map((batch) => this.deleteBatch(batch)))
  }

  private async deleteBatch(keys: string[]): Promise<void> {
    const body =
      '<Delete><Quiet>true</Quiet>' +
      keys.map((key) => `<Object><Key>${escapeXml(key)}</Key></Object>`).join('') +
      '</Delete>'

    // COS 的批量删除强制要求 Content-MD5
    // 注意：Web Crypto 不支持 MD5，只能用 Node 的 crypto 模块
    const contentMd5 = createHash('md5').update(body, 'utf8').digest('base64')

    await this.request({
      method: 'POST',
      query: { delete: '' },
      headers: {
        'content-type': 'application/xml',
        'content-md5': contentMd5,
      },
      body,
    })
  }
}

/** 每个请求现建一个客户端，构造成本只是几个字符串拼接 */
export function getCos(env: Env): CosClient {
  return new CosClient(env)
}

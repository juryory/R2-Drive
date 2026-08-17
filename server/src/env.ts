import { Env } from './types'

/** 必填的环境变量 */
const REQUIRED = [
  'COS_BUCKET',
  'COS_REGION',
  'COS_SECRET_ID',
  'COS_SECRET_KEY',
  'JWT_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
] as const

/**
 * 从 process.env 读取配置并校验
 * 启动时就把问题暴露出来，避免跑起来之后每个请求才报错
 */
export function loadEnv(): Env {
  const missing = REQUIRED.filter((name) => !process.env[name])

  if (missing.length > 0) {
    throw new Error(
      `缺少必需的环境变量：${missing.join(', ')}\n` +
        `请检查 server/.env 文件，可参考 server/.env.example`
    )
  }

  if ((process.env['JWT_SECRET'] ?? '').length < 32) {
    throw new Error('JWT_SECRET 太短，请使用至少 32 位的随机字符串')
  }

  return {
    COS_BUCKET: process.env['COS_BUCKET']!,
    COS_REGION: process.env['COS_REGION']!,
    COS_SECRET_ID: process.env['COS_SECRET_ID']!,
    COS_SECRET_KEY: process.env['COS_SECRET_KEY']!,
    JWT_SECRET: process.env['JWT_SECRET']!,
    ADMIN_USERNAME: process.env['ADMIN_USERNAME']!,
    ADMIN_PASSWORD: process.env['ADMIN_PASSWORD']!,
    // 同源部署（前端和 API 同一个域名）时留空即可，不需要 CORS
    ALLOWED_ORIGINS: process.env['ALLOWED_ORIGINS'] ?? '',
    COS_ENDPOINT: process.env['COS_ENDPOINT'] ?? '',
  }
}

/** 单文件上传大小上限，单位 MB */
export function maxUploadBytes(): number {
  const mb = Number(process.env['MAX_UPLOAD_MB'] ?? 200)
  return (Number.isFinite(mb) && mb > 0 ? mb : 200) * 1024 * 1024
}

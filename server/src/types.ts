export type Env = {
  /** 存储桶名称，必须带 APPID，例如 file-1250000000 */
  COS_BUCKET: string
  /** 存储桶地域，例如 ap-guangzhou */
  COS_REGION: string
  COS_SECRET_ID: string
  COS_SECRET_KEY: string
  /** 可选：覆盖 COS 访问域名（内网域名 / 自定义域名），留空用公网默认域名 */
  COS_ENDPOINT?: string
  JWT_SECRET: string
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
  ALLOWED_ORIGINS: string
}

export type Variables = {
  user: { sub: string }
}

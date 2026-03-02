export type Env = {
  BUCKET: R2Bucket
  JWT_SECRET: string
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
  ALLOWED_ORIGINS: string
}

export type Variables = {
  user: { sub: string }
}

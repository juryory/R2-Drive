# R2 Drive

基于 Cloudflare R2 + Workers + React 构建的个人网盘/图床。无服务器，零运维，免费额度足够个人使用。

## 功能

- 文件上传 / 下载 / 在线预览（图片、视频、音频、PDF、文本）
- 文件夹管理（新建、重命名、删除）
- 拖拽上传 / 批量上传
- 文件搜索
- **简易上传**：一键上传，文件自动按 `drive/{年月}/` 归档并加哈希命名
- **分享上传链接**：生成 24 小时有效链接，无需登录即可上传，文件存入 `uploads/{年月}/`，1 个月后自动删除
- **空间管理模式**：展示全部文件并按大小 / 时间排序，方便批量清理
- 存储用量实时显示

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端 | Cloudflare Workers + [Hono](https://hono.dev/) + [jose](https://github.com/panva/jose)（JWT） |
| 前端 | React 18 + Vite + TailwindCSS |
| 存储 | Cloudflare R2 |
| 认证 | HS256 JWT，存于 localStorage |

## 目录结构

```
.
├── worker/          # Cloudflare Workers 后端
│   ├── src/
│   │   ├── index.ts          # 入口 + CORS 中间件
│   │   ├── types.ts          # 类型定义
│   │   ├── utils.ts          # 文件哈希 / 命名工具
│   │   ├── middleware/
│   │   │   └── auth.ts       # JWT 鉴权中间件
│   │   └── routes/
│   │       ├── auth.ts       # 登录 / 验证
│   │       ├── files.ts      # 文件增删改查 / 简易上传
│   │       └── share.ts      # 分享上传链接
│   └── wrangler.toml         # Worker 配置
└── frontend/        # React 前端
    ├── src/
    │   ├── pages/            # Login / Dashboard / UploadPage
    │   ├── components/       # UI 组件
    │   └── lib/
    │       └── api.ts        # 前端 API 封装
    └── .env.production       # 生产环境变量（Worker URL）
```

---

## 部署指南

### 前置要求

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)（`npm install -g wrangler`）
- Cloudflare 账号（免费即可）
- 已在 Cloudflare Dashboard 创建 R2 Bucket

### 第一步：克隆项目

```bash
git clone https://github.com/juryory/r2-drive.git
cd r2-drive
```

### 第二步：配置 Worker

#### 2.1 修改 `worker/wrangler.toml`

打开 `worker/wrangler.toml`，修改以下两处：

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "你的R2 Bucket名称"   # ← 改为你实际的 Bucket 名

[vars]
ALLOWED_ORIGINS = "http://localhost:5173,https://你的前端域名"  # ← 改为你的前端 URL
```

> `ALLOWED_ORIGINS` 支持多个域名，用英文逗号分隔。部署 Pages 后记得把 Pages 的 `*.pages.dev` 域名也加进去。

#### 2.2 安装依赖并登录 Cloudflare

```bash
cd worker
npm install
wrangler login   # 在浏览器中授权
```

#### 2.3 设置 Secrets（敏感信息，不写入代码）

```bash
wrangler secret put JWT_SECRET        # 填入一个随机长字符串（建议 32 位以上），用于签发 JWT
wrangler secret put ADMIN_USERNAME    # 填入管理员用户名
wrangler secret put ADMIN_PASSWORD    # 填入管理员密码
```

#### 2.4 部署 Worker

```bash
wrangler deploy
```

部署成功后会显示 Worker 的 URL，例如：

```
https://r2-drive-worker.你的子域.workers.dev
```

**记录这个 URL**，下一步会用到。

---

### 第三步：配置并部署前端

#### 3.1 修改 `frontend/.env.production`

```env
VITE_API_BASE=https://r2-drive-worker.你的子域.workers.dev
```

将值改为上一步得到的 Worker URL。

#### 3.2 安装依赖并构建

```bash
cd ../frontend
npm install
npm run build
```

#### 3.3 部署到 Cloudflare Pages

首次部署需要先创建项目：

```bash
wrangler pages project create r2-drive-frontend --production-branch main
wrangler pages deploy dist --project-name r2-drive-frontend
```

后续更新只需：

```bash
npm run build
wrangler pages deploy dist --project-name r2-drive-frontend
```

部署完成后会显示 Pages URL，例如 `https://r2-drive-frontend.pages.dev`。

---

### 第四步：更新 CORS 配置

将第三步得到的前端 URL 加入 `worker/wrangler.toml` 的 `ALLOWED_ORIGINS`，然后重新部署 Worker：

```bash
cd ../worker
wrangler deploy
```

---

### 第五步（可选）：配置 R2 生命周期规则

用于"分享上传链接"上传的文件自动在 1 个月后删除：

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2 → 选择你的 Bucket
2. 点击 **Settings** → **Object Lifecycle Rules** → **Add Rule**
3. 配置如下：
   - **Prefix**：`uploads/`
   - **Rule**：对象创建后 **30 天**删除

---

## 配置速查表

| 文件 / 命令 | 配置项 | 说明 |
|------------|--------|------|
| `worker/wrangler.toml` | `bucket_name` | R2 Bucket 名称 |
| `worker/wrangler.toml` | `ALLOWED_ORIGINS` | 允许跨域访问的前端域名（逗号分隔） |
| `wrangler secret put JWT_SECRET` | — | JWT 签名密钥，任意随机字符串 |
| `wrangler secret put ADMIN_USERNAME` | — | 管理员登录用户名 |
| `wrangler secret put ADMIN_PASSWORD` | — | 管理员登录密码 |
| `frontend/.env.production` | `VITE_API_BASE` | Worker 的完整 URL（`https://...workers.dev`） |

---

## 本地开发

```bash
# 启动 Worker（本地模拟 R2）
cd worker
npm install
wrangler dev

# 启动前端（另开一个终端，开发时代理到本地 Worker）
cd frontend
npm install
npm run dev
```

前端 `vite.config.ts` 已配置开发代理，`/api` 请求自动转发到 `http://localhost:8787`（wrangler dev 默认端口）。

---

## R2 免费额度参考

| 资源 | 免费额度 |
|------|---------|
| 存储 | 10 GB / 月 |
| A 类操作（写入、列表） | 100 万次 / 月 |
| B 类操作（读取） | 1000 万次 / 月 |

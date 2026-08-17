# COS Drive

基于 腾讯云 COS + Cloudflare Workers + React 构建的个人网盘/图床。无服务器，零运维。

> 本分支是 [R2 Drive](https://github.com/juryory/r2-drive) 的**腾讯云 COS 版本**：后端仍跑在 Cloudflare Workers 上，只是把存储从 Cloudflare R2 换成了腾讯云 COS。前端代码完全未改动。
> 需要 R2 版本请切到 `main` 分支。

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
| 存储 | 腾讯云 COS（XML API，sha1 签名） |
| 认证 | HS256 JWT，存于 localStorage |

## 目录结构

```
.
├── worker/          # Cloudflare Workers 后端
│   ├── src/
│   │   ├── index.ts          # 入口 + CORS 中间件
│   │   ├── types.ts          # 类型定义
│   │   ├── utils.ts          # 文件哈希 / 命名 / MIME 推断
│   │   ├── storage/
│   │   │   ├── sign.ts       # COS 请求签名（q-sign-algorithm=sha1）
│   │   │   └── cos.ts        # COS 客户端：列表/上传/下载/复制/批量删除
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

### 与 R2 版本的实现差异

| 能力 | R2 版本 | COS 版本 |
|------|---------|----------|
| 访问方式 | Workers 原生 binding（`env.BUCKET`） | HTTPS 调用 COS XML API，请求自行签名 |
| 凭据 | 无需密钥，绑定即用 | 需要腾讯云 `SecretId` / `SecretKey` |
| 重命名 | 读出文件流再写回 | COS 服务端复制（`x-cos-copy-source`），内容不经过 Worker |
| 列表的 Content-Type | 对象元数据里带 | COS 列表接口不返回，按扩展名推断（前端本来就有扩展名兜底） |
| 批量删除 | binding 支持一次 1000 个 | `POST ?delete`，同样一次 1000 个，超出自动分批 |
| 生命周期规则 | R2 控制台配置 | COS 控制台配置 |

签名实现（`worker/src/storage/sign.ts`）已与腾讯云官方 `cos-nodejs-sdk-v5` 的 `getAuth` 逐字节比对验证过，覆盖列表、上传、复制、批量删除等场景，包含中文键、空格和特殊字符。

---

## 部署指南

### 前置要求

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)（`npm install -g wrangler`）
- Cloudflare 账号（免费即可，仅用于跑 Worker 和托管前端）
- 腾讯云账号，且已创建 COS 存储桶

### 第一步：克隆项目

```bash
git clone -b claude/tencent-cos-version-update-gp79k5 https://github.com/juryory/r2-drive.git cos-drive
cd cos-drive
```

### 第二步：准备腾讯云 COS

#### 2.1 创建存储桶

在 [COS 控制台](https://console.cloud.tencent.com/cos/bucket) 创建存储桶，注意：

- **访问权限**选 **私有读写**（文件都通过 Worker 鉴权后代理，不需要公开）
- 记下**存储桶名称**（形如 `file-1250000000`，末尾的数字是你的 APPID，控制台列表里显示的就是完整名称）
- 记下**所属地域**（形如 `ap-guangzhou`）

#### 2.2 创建 API 密钥

打开 [访问管理 → API 密钥管理](https://console.cloud.tencent.com/cam/capi)，新建密钥，记下 `SecretId` 和 `SecretKey`。

> 建议不要用主账号密钥。更安全的做法是在[访问管理](https://console.cloud.tencent.com/cam/user)新建一个子用户，只授予这一个存储桶的读写权限，再用它的密钥。

#### 2.3 配置存储桶跨域访问（CORS）

本项目所有文件读写都由 Worker 代理，浏览器不直接访问 COS，**通常无需配置 CORS**。保持默认即可。

### 第三步：配置 Worker

#### 3.1 修改 `worker/wrangler.toml`

```toml
[vars]
COS_BUCKET = "file-1250000000"        # ← 改为你的存储桶名称（必须带 APPID）
COS_REGION = "ap-guangzhou"           # ← 改为你的存储桶地域
ALLOWED_ORIGINS = "http://localhost:5173,https://你的前端域名"  # ← 改为你的前端 URL
```

> `ALLOWED_ORIGINS` 支持多个域名，用英文逗号分隔。部署 Pages 后记得把 Pages 的 `*.pages.dev` 域名也加进去。

#### 3.2 安装依赖并登录 Cloudflare

```bash
cd worker
npm install
wrangler login   # 在浏览器中授权
```

#### 3.3 设置 Secrets（敏感信息，不写入代码）

```bash
wrangler secret put COS_SECRET_ID     # 填入腾讯云 SecretId
wrangler secret put COS_SECRET_KEY    # 填入腾讯云 SecretKey
wrangler secret put JWT_SECRET        # 填入一个随机长字符串（建议 32 位以上），用于签发 JWT
wrangler secret put ADMIN_USERNAME    # 填入管理员用户名
wrangler secret put ADMIN_PASSWORD    # 填入管理员密码
```

#### 3.4 部署 Worker

```bash
npm run typecheck   # 可选：先做一次类型检查
wrangler deploy
```

部署成功后会显示 Worker 的 URL，例如：

```
https://cos-drive-worker.你的子域.workers.dev
```

**记录这个 URL**，下一步会用到。

---

### 第四步：配置并部署前端

#### 4.1 创建 `frontend/.env.production`

```env
VITE_API_BASE=https://cos-drive-worker.你的子域.workers.dev
```

将值改为上一步得到的 Worker URL。

#### 4.2 安装依赖并构建

```bash
cd ../frontend
npm install
npm run build
```

#### 4.3 部署到 Cloudflare Pages

首次部署需要先创建项目：

```bash
wrangler pages project create cos-drive-frontend --production-branch main
wrangler pages deploy dist --project-name cos-drive-frontend
```

后续更新只需：

```bash
npm run build
wrangler pages deploy dist --project-name cos-drive-frontend
```

部署完成后会显示 Pages URL，例如 `https://cos-drive-frontend.pages.dev`。

---

### 第五步：更新 CORS 配置

将第四步得到的前端 URL 加入 `worker/wrangler.toml` 的 `ALLOWED_ORIGINS`，然后重新部署 Worker：

```bash
cd ../worker
wrangler deploy
```

---

### 第六步（可选）：配置 COS 生命周期规则

用于"分享上传链接"上传的文件自动在 1 个月后删除：

1. 打开 [COS 控制台](https://console.cloud.tencent.com/cos/bucket) → 选择你的存储桶
2. 点击 **基础配置** → **生命周期** → **添加规则**
3. 配置如下：
   - **适用范围**：按前缀，填 `uploads/`
   - **动作**：对象**修改时间** **30 天**后**删除对象**

---

## 配置速查表

| 文件 / 命令 | 配置项 | 说明 |
|------------|--------|------|
| `worker/wrangler.toml` | `COS_BUCKET` | COS 存储桶名称，必须带 APPID，如 `file-1250000000` |
| `worker/wrangler.toml` | `COS_REGION` | 存储桶地域，如 `ap-guangzhou` |
| `worker/wrangler.toml` | `ALLOWED_ORIGINS` | 允许跨域访问的前端域名（逗号分隔） |
| `wrangler secret put COS_SECRET_ID` | — | 腾讯云 API 密钥 SecretId |
| `wrangler secret put COS_SECRET_KEY` | — | 腾讯云 API 密钥 SecretKey |
| `wrangler secret put JWT_SECRET` | — | JWT 签名密钥，任意随机字符串 |
| `wrangler secret put ADMIN_USERNAME` | — | 管理员登录用户名 |
| `wrangler secret put ADMIN_PASSWORD` | — | 管理员登录密码 |
| `frontend/.env.production` | `VITE_API_BASE` | Worker 的完整 URL（`https://...workers.dev`） |

---

## 本地开发

```bash
# 启动 Worker
cd worker
npm install
wrangler dev

# 启动前端（另开一个终端，开发时代理到本地 Worker）
cd frontend
npm install
npm run dev
```

前端 `vite.config.ts` 已配置开发代理，`/api` 请求自动转发到 `http://localhost:8787`（wrangler dev 默认端口）。

> 与 R2 版本不同，本地开发**没有 COS 的本地模拟**，`wrangler dev` 会直接读写真实的 COS 存储桶。建议本地开发时另建一个测试桶。
>
> 本地开发需要把密钥写进 `worker/.dev.vars`（该文件已被 `.gitignore` 忽略）：
>
> ```env
> COS_SECRET_ID=你的SecretId
> COS_SECRET_KEY=你的SecretKey
> JWT_SECRET=本地随便一个长字符串
> ADMIN_USERNAME=admin
> ADMIN_PASSWORD=admin
> ```

---

## 已知限制

- **单文件上限 100MB**。文件经 Worker 中转，受 Cloudflare Workers 请求体大小限制。更大的文件需要改造成前端直传 COS（用预签名 URL），本项目暂未实现。
- **列表接口的 Content-Type 是按扩展名推断的**。COS 的 `GET Bucket` 接口不返回每个对象的 Content-Type；下载和预览走的是真实对象响应头，不受影响。
- **`/api/files/stats` 和 `/api/files/all` 会遍历整桶**。文件数量很多（数万级）时会变慢，属于原 R2 版本就有的行为。

## 费用参考

腾讯云 COS 没有像 R2 那样的永久免费额度，标准存储按量计费大致为：

| 资源 | 计费 |
|------|------|
| 标准存储容量 | 约 0.118 元 / GB / 月 |
| 读请求（GET 等） | 约 0.01 元 / 万次 |
| 写请求（PUT 等） | 约 0.01 元 / 万次 |
| 外网下行流量 | 约 0.5 元 / GB |

> 以上为撰写时的公开标价，仅供估算，实际以[腾讯云 COS 计费说明](https://cloud.tencent.com/document/product/436/16871)为准。新用户通常有免费资源包可领。
>
> 注意：文件由 Worker 代理下载，**下行流量走的是 COS 外网流量**，图床类高频访问场景要留意这项费用。

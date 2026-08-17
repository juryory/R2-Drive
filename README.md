# COS Drive

基于 腾讯云 COS + Node.js + React 构建的个人网盘/图床，部署在自己的 Linux 服务器上。

> 本分支是 [R2 Drive](https://github.com/juryory/r2-drive) 的**腾讯云版本**：存储用腾讯云 COS，后端改为跑在自己的服务器上（Node.js），不再依赖 Cloudflare。
> 需要原来的 Cloudflare R2 + Workers 版本请切到 `main` 分支。

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
| 后端 | Node.js 20+ + [Hono](https://hono.dev/) + [jose](https://github.com/panva/jose)（JWT） |
| 前端 | React 18 + Vite + TailwindCSS |
| 存储 | 腾讯云 COS（XML API，sha1 签名，无需 SDK） |
| 认证 | HS256 JWT，存于 localStorage |
| 进程管理 | PM2（宝塔「Node 项目管理器」底层即 PM2） |

## 目录结构

```
.
├── server/          # Node.js 后端
│   ├── src/
│   │   ├── server.ts         # 进程入口：读配置、静态托管、监听端口
│   │   ├── index.ts          # Hono 应用：路由挂载 + CORS
│   │   ├── env.ts            # 环境变量读取与校验
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
│   ├── .env.example          # 配置模板
│   └── ecosystem.config.cjs  # PM2 配置
└── frontend/        # React 前端（代码与 R2 版本完全一致，未做改动）
```

---

## 部署指南（宝塔面板）

前提：一台装了宝塔面板的 Linux 服务器。**强烈建议服务器和 COS 存储桶选同一地域**，这样两者之间走内网，流量不额外计费。

### 第一步：准备腾讯云 COS

#### 1.1 创建存储桶

在 [COS 控制台](https://console.cloud.tencent.com/cos/bucket) 创建存储桶：

- **访问权限**选 **私有读写**（所有文件都经后端鉴权后代理，不需要公开）
- 记下**存储桶名称**（形如 `file-1250000000`，末尾数字是 APPID，控制台显示的就是完整名称）
- **地域选和你服务器同一个地域**（例如服务器在广州就选 `ap-guangzhou`）

#### 1.2 创建 API 密钥

打开 [访问管理 → API 密钥管理](https://console.cloud.tencent.com/cam/capi) 新建密钥，记下 `SecretId` 和 `SecretKey`。

> 建议不要用主账号密钥。更安全的做法：在[访问管理](https://console.cloud.tencent.com/cam/user)新建子用户，只授予这一个存储桶的读写权限，用它的密钥。

### 第二步：在宝塔安装 Node.js

宝塔面板 → **软件商店** → 搜索并安装 **Node.js 版本管理器** → 安装 **Node 20 或更高版本**，并设为命令行默认版本。

### 第三步：拉取代码并构建

SSH 登录服务器（或用宝塔的「终端」）：

```bash
# 放到宝塔默认站点目录下
cd /www/wwwroot
git clone -b claude/tencent-cos-version-update-gp79k5 https://github.com/juryory/r2-drive.git cos-drive
cd cos-drive

# 构建后端
cd server
npm install
npm run build

# 构建前端
cd ../frontend
npm install
npm run build      # 产物在 frontend/dist
```

> 前端**不需要**配 `.env.production`。前后端同域名部署时，前端默认用相对路径请求 `/api`，无需额外配置。

### 第四步：填写后端配置

```bash
cd /www/wwwroot/cos-drive/server
cp .env.example .env
# 用宝塔文件管理器或 vim 编辑 .env
```

至少要填这几项：

```env
COS_BUCKET=file-1250000000        # 你的存储桶全名
COS_REGION=ap-guangzhou           # 和服务器同地域
COS_SECRET_ID=你的SecretId
COS_SECRET_KEY=你的SecretKey
JWT_SECRET=用 openssl rand -base64 48 生成
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你的密码
PORT=3000
```

> `.env` 已被 `.gitignore` 忽略，不会进版本库。注意给它收紧权限：`chmod 600 .env`

### 第五步：用宝塔的 Node 项目管理器启动

宝塔面板 → **网站** → **Node 项目** → **添加 Node 项目**：

| 字段 | 填写 |
|------|------|
| 项目目录 | `/www/wwwroot/cos-drive/server` |
| 启动选项 | `npm start`（或直接选 `dist/server.js`） |
| Node 版本 | 20 及以上 |
| 项目端口 | `3000`（与 `.env` 里的 `PORT` 一致） |
| 是否配置反代 | **否**（下一步手动配，因为还要托管前端） |

保存后启动，在项目日志里应该看到：

```
[cos-drive] 已启动 http://127.0.0.1:3000
[cos-drive] 存储桶 file-1250000000 @ ap-guangzhou
```

> 也可以不用面板，直接命令行 `pm2 start ecosystem.config.cjs` 启动。

### 第六步：建站点并配置 Nginx

宝塔面板 → **网站** → **添加站点**，域名填你的域名，PHP 版本选**纯静态**。

然后点站点 → **配置文件**，把 `server` 块里的内容改成下面这样（保留宝塔自己生成的 SSL、日志等配置）：

```nginx
# 前端静态文件
root /www/wwwroot/cos-drive/frontend/dist;
index index.html;

# 前端用的是 BrowserRouter，未命中的路径都交给 index.html
location / {
    try_files $uri $uri/ /index.html;
}

# API 反代到 Node 进程
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 上传大文件需要放开限制，并调长超时
    client_max_body_size 200m;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    # 上传/下载走流式，不要让 nginx 整个缓冲下来
    proxy_request_buffering off;
    proxy_buffering off;
}
```

> `client_max_body_size` 要 **≥** `.env` 里的 `MAX_UPLOAD_MB`，否则大文件会被 nginx 挡在外面（返回 413）。

保存后重载 nginx。

### 第七步：申请 HTTPS

宝塔面板 → 站点 → **SSL** → **Let's Encrypt** → 申请并开启**强制 HTTPS**。

登录态用的是 JWT，走明文 HTTP 会有被截获的风险，**务必开 HTTPS**。

### 第八步（可选）：配置 COS 生命周期规则

让"分享上传链接"上传的文件 1 个月后自动删除：

1. [COS 控制台](https://console.cloud.tencent.com/cos/bucket) → 选择存储桶
2. **基础配置** → **生命周期** → **添加规则**
3. **适用范围**填前缀 `uploads/`，动作设为对象**修改时间** **30 天**后**删除对象**

---

## 更新部署

```bash
cd /www/wwwroot/cos-drive
git pull

cd server && npm install && npm run build
cd ../frontend && npm install && npm run build

# 重启后端（宝塔 Node 项目管理器里点重启，或命令行）
pm2 restart cos-drive
```

---

## 配置速查表

`server/.env` 里的全部配置项：

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `COS_BUCKET` | 是 | 存储桶名称，必须带 APPID，如 `file-1250000000` |
| `COS_REGION` | 是 | 存储桶地域，如 `ap-guangzhou` |
| `COS_SECRET_ID` | 是 | 腾讯云 API 密钥 SecretId |
| `COS_SECRET_KEY` | 是 | 腾讯云 API 密钥 SecretKey |
| `JWT_SECRET` | 是 | JWT 签名密钥，至少 32 位随机字符串 |
| `ADMIN_USERNAME` | 是 | 管理员登录用户名 |
| `ADMIN_PASSWORD` | 是 | 管理员登录密码 |
| `PORT` | 否 | 监听端口，默认 `3000` |
| `HOST` | 否 | 监听地址，默认 `127.0.0.1`（只允许 nginx 访问） |
| `MAX_UPLOAD_MB` | 否 | 单文件上传上限，默认 `200` |
| `ALLOWED_ORIGINS` | 否 | 跨域白名单，同域名部署留空 |
| `COS_ENDPOINT` | 否 | 覆盖 COS 访问域名（内网域名 / 自定义域名） |
| `STATIC_DIR` | 否 | 由 Node 进程直接托管前端，用 nginx 时不要设 |

配置缺失或 `JWT_SECRET` 太短时进程会**启动即报错**并指出具体缺哪一项，不会带着错误配置跑起来。

---

## 本地开发

```bash
# 后端
cd server
npm install
cp .env.example .env    # 填好 COS 配置
npm run dev             # tsx watch，改代码自动重启

# 前端（另开终端）
cd frontend
npm install
npm run dev
```

前端 `vite.config.ts` 已配好代理，`/api` 请求自动转发到 `http://localhost:3000`。

> 本地开发没有 COS 模拟器，会直接读写真实存储桶，建议单独建一个测试桶。

---

## 不用宝塔面板的话

不依赖面板，用 PM2 直接跑：

```bash
cd server
npm install && npm run build
cp .env.example .env && vim .env
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup      # 开机自启
```

如果连 nginx 都不想配，可以让 Node 进程自己托管前端 —— 在 `.env` 里设：

```env
STATIC_DIR=../frontend/dist
HOST=0.0.0.0
PORT=80
```

这样单进程就能跑起来。但**生产环境仍建议前面挂 nginx**，好处是能做 HTTPS 终止、静态文件缓存和访问日志。

---

## 已知限制

- **上传会在内存中缓存整个文件**。上传走的是 multipart 表单，Node 侧会完整读入内存后再转发给 COS。`MAX_UPLOAD_MB` 请按服务器内存量力设置（2G 内存的机器建议不超过 200MB，且注意并发上传会叠加）。要支持 GB 级文件需要改造成前端直传 COS（预签名 URL）或分片上传，本项目暂未实现。
- **列表接口的 Content-Type 是按扩展名推断的**。COS 的 `GET Bucket` 接口不返回每个对象的 Content-Type；下载和预览用的是真实对象响应头，不受影响。
- **`/api/files/stats` 和 `/api/files/all` 会遍历整桶**。文件数达到数万级时会变慢，这是从 R2 版本延续下来的行为。
- **单管理员账号**，凭据来自环境变量，不支持多用户。

## 费用参考

服务器费用之外，COS 部分（同地域内网访问时）：

| 资源 | 计费 |
|------|------|
| 标准存储容量 | 约 0.118 元 / GB / 月 |
| 请求次数 | 约 0.01 元 / 万次 |
| **服务器 ↔ 同地域 COS 内网流量** | **免费** |
| 外网下行流量（跨地域或公网直连时） | 约 0.5 元 / GB |

> 关键点：**服务器和存储桶必须同地域**，否则会按 0.5 元/GB 计外网流量，成本会高出一个量级。
>
> 以上为撰写时的公开标价，仅供估算，实际以[腾讯云 COS 计费说明](https://cloud.tencent.com/document/product/436/16871)为准。

## 实现说明

COS 签名（`server/src/storage/sign.ts`）是按[腾讯云签名文档](https://cloud.tencent.com/document/product/436/7778)手写的，只用 Node 内置能力，不引入 COS SDK。签名结果已与官方 `cos-nodejs-sdk-v5` 的 `getAuth` 逐字节比对验证，覆盖列表、上传、复制、批量删除等场景，包含中文键、空格和 `!()` 等特殊字符。

几个实现要点：

- 重命名用 COS 服务端复制（`x-cos-copy-source`），文件内容不流经本服务器
- 批量删除走 `POST ?delete`，附 `Content-MD5`，超过 1000 个 key 自动分批
- 列表请求带 `encoding-type=url`，正确处理中文、空格和特殊字符的对象键
- 后端默认只监听 `127.0.0.1`，不会绕过 nginx 被公网直接访问

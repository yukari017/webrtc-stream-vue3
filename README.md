# WebRTC Stream Vue3

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)](https://vitejs.dev/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Enabled-orange)](https://webrtc.org/)

基于 WebRTC 的实时音视频通信系统，支持屏幕共享、摄像头推流和实时聊天。

## ✨ 功能特性

- 🖥️ **屏幕共享推流** - 支持 60/120/144 FPS，最高 1440p 分辨率
- 📹 **摄像头推流** - 支持多种摄像头设备，包括 OBS 虚拟摄像头
- 💬 **实时聊天** - 基于 WebRTC Data Channel 的低延迟通信
- 📊 **性能监控** - 比特率、分辨率、帧率、延迟、丢包率实时显示
- 🔄 **自动重连** - 移动端杀后台后自动恢复连接
- 🌙 **深色模式** - 支持深色主题

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Vue 3 |
| 构建工具 | Vite 5 |
| 语言 | TypeScript |
| 状态管理 | Pinia |
| 实时通信 | WebRTC |
| 信令服务 | WebSocket + HTTPS |

## 📁 项目结构

```
webrtc-stream-vue3/
├── client/                      # Vue 3 前端
│   ├── src/
│   │   ├── assets/             # 静态资源
│   │   │   └── css/            # 样式文件
│   │   ├── components/         # Vue 组件
│   │   │   ├── Chat/           # 聊天组件
│   │   │   └── common/         # 通用组件
│   │   ├── composables/        # Composables (WebRTC核心逻辑)
│   │   ├── router/             # 路由配置
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── styles/             # 全局样式
│   │   ├── types/              # TypeScript 类型定义
│   │   ├── utils/              # 工具函数
│   │   ├── views/              # 页面组件
│   │   ├── App.vue             # 根组件
│   │   └── main.ts             # 入口文件
│   ├── public/                 # 公共资源
│   │   └── fonts/              # 字体文件
│   ├── index.html
│   ├── vite.config.ts          # 构建配置
│   ├── tsconfig.json           # TypeScript 配置
│   └── package.json            # 前端依赖
├── server/                      # 信令服务器 (Node.js + TypeScript)
│   ├── src/
│   │   ├── index.ts            # 服务入口
│   │   ├── types/              # 类型定义
│   │   └── utils/              # 工具模块
│   │       ├── config.ts       # 配置管理
│   │       ├── logger.ts       # 日志工具
│   │       ├── messageHandler.ts # 消息处理
│   │       └── roomManager.ts  # 房间管理
│   ├── dist/                   # 编译输出
│   ├── package.json            # 后端依赖
│   └── tsconfig.json           # TypeScript 配置
├── README.md
├── LICENSE
├── .gitignore
├── .editorconfig               # 编辑器配置
└── package.json                # Monorepo 根配置
```

## 🚀 快速开始

### 环境要求
- Node.js 16+
- pnpm（推荐）或 npm

### 安装依赖

```bash
# 推荐使用 pnpm
pnpm install

# 或分别安装
cd client && pnpm install
cd ../server && pnpm install
```

### 启动服务

```bash
# 终端 1：启动信令服务器
pnpm dev:server

# 终端 2：启动前端开发服务器
pnpm dev:client
```

### 首次运行重要步骤 ⚠️

信令服务器使用 HTTPS（自签名证书），首次运行需要让浏览器信任证书：

1. 服务启动后，浏览器访问 `https://localhost:3001`
2. 看到"您的连接不是私密连接"警告，点击 **高级** → **继续前往 localhost（不安全）**
3. 然后访问前端页面 `http://localhost:3000`

> 如果跳过这一步，WebSocket 连接会失败，控制台报错 `ERR_CERT_AUTHORITY_INVALID`

### 访问应用

- 推流端: http://localhost:3000/
- 观看端: http://localhost:3000/viewer

### 生产构建

```bash
pnpm build
```

构建产物输出到 `server/public-dist/`。

## ⚙️ 配置说明

### 环境变量

前端通过环境变量配置信令服务器地址：

```bash
# 开发环境：client/.env.development（已配置，无需修改）
VITE_SIGNALING_SERVER_URL=wss://localhost:3001

# 生产环境：创建 client/.env.production
# 方式一：nginx 代理（推荐）
VITE_SIGNALING_SERVER_URL=wss://your-domain.com/ws

# 方式二：直连 Node.js
VITE_SIGNALING_SERVER_URL=wss://your-domain.com:3001
```

详细配置请参考 `client/.env.example`。

也可以创建 `.env.development.local` 覆盖本地配置（不会提交到 Git）。

### 默认推流设置

| 参数 | 默认值 |
|------|--------|
| 帧率 | 60 FPS |
| 分辨率 | 1440p (2560x1440) |
| 画质 | ultra |
| 共享音频 | 开启 |
| 共享光标 | 开启 |

### 帧率选项
`30` `60` `120` `144` FPS

### 分辨率选项
`720p` `1080p` `1440p` `4K`

## 📊 性能监控

| 指标 | 说明 |
|------|------|
| 比特率 | 视频传输速率 (kbps) |
| 分辨率 | 当前视频分辨率 |
| 帧率 | 当前 FPS |
| 延迟 | 往返延迟 (ms) |
| 丢包率 | 丢包百分比 |

## 🌐 浏览器兼容性

| 浏览器 | 版本 |
|--------|------|
| Chrome | 80+ ✅ |
| Firefox | 75+ ✅ |
| Safari | 14+ ✅ |
| Edge | 80+ ✅ |

## 🔒 安全说明

- 所有通信基于 WebRTC P2P 连接
- 信令服务器仅交换连接信息
- 支持 HTTPS + DTLS 加密传输

### 生成 SSL 证书（开发环境）

信令服务器需要 SSL 证书，开发环境可生成自签名证书：

```bash
cd server

# 使用 OpenSSL 生成（需要安装 OpenSSL）
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# 或使用 Windows PowerShell
$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "Cert:\LocalMachine\My"
$pwd = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath cert.pfx -Password $pwd
```

将生成的 `key.pem` 和 `cert.pem` 放在 `server/` 目录下。

## 🚀 生产环境部署

### 推荐架构

```
┌─────────────────────────────────────────────────────────┐
│                   Nginx (7777)                          │
│  静态文件 → 直接返回                                     │
│  WebSocket → proxy_pass → Node.js (localhost:3001)     │
│  API      → proxy_pass → Node.js (localhost:3001)      │
└─────────────────────────────────────────────────────────┘
```

### Nginx 配置示例

```nginx
server {
    listen 7777 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # 静态文件
    location / {
        root /var/www/webrtc-stream/dist;
        try_files $uri $uri/ /index.html;

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # SPA 路由
    location ~ ^/(viewer)$ {
        root /var/www/webrtc-stream/dist;
        try_files $uri /index.html;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass https://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # API 代理
    location ~ ^/(health|stats) {
        proxy_pass https://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 部署步骤

1. **配置环境变量**
   ```bash
   # 创建 client/.env.production
   VITE_SIGNALING_SERVER_URL=wss://your-domain.com/ws
   VITE_DEBUG=false
   ```

2. **构建前端**
   ```bash
   cd client && pnpm build
   ```
   构建产物在 `server/public-dist/`

3. **构建并启动后端服务**
   ```bash
   cd server
   pnpm install
   pnpm build
   pnpm start
   ```

4. **配置 Nginx** 并重启

### 自动部署（GitHub Actions）

本项目支持通过 GitHub Actions 自动部署。

1. **Fork 本仓库**

2. **配置 GitHub Secrets**
   
   在仓库设置中添加以下 Secrets：
   
   | Secret 名称 | 说明 |
   |------------|------|
   | `SERVER_HOST` | 服务器地址（如 `your-domain.com`） |
   | `SERVER_USER` | SSH 用户名 |
   | `SERVER_SSH_KEY` | SSH 私钥内容 |

3. **修改 deploy.yml 中的配置**
   
   编辑 `.github/workflows/deploy.yml`，修改：
   - 第 37 行：`VITE_SIGNALING_SERVER_URL=wss://your-domain.com:7777/ws`
   - 第 69 行：服务器上的 PATH 路径

4. **推送代码触发部署**
   ```bash
   git push origin main
   ```

## 📝 许可证

[MIT License](./LICENSE)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 提交规范

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构 |
| `test` | 测试相关 |
| `chore` | 构建/工具变动 |

示例：`feat: 添加深色模式支持`

---

**Author**: [yukari017](https://github.com/yukari017)

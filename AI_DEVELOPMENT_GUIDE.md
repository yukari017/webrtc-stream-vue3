# AI 开发指南

> 本文档专为 AI 辅助开发设计，提供项目核心信息、开发规范和常见操作指南。

## 项目概述

**WebRTC Stream Vue3** - 基于 WebRTC 的实时音视频通信系统，支持屏幕共享、摄像头推流和实时聊天。

### 核心功能
- 屏幕共享推流（60/120/144 FPS，最高 1440p）
- 摄像头推流（支持 OBS 虚拟摄像头）
- 实时聊天（WebRTC Data Channel）
- 性能监控（比特率、分辨率、帧率、延迟、丢包率）
- 自动重连（移动端杀后台恢复）
- 深色模式

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3 | 3.x |
| 构建工具 | Vite | 5.x |
| 语言 | TypeScript | 6.x |
| 状态管理 | Pinia | - |
| 实时通信 | WebRTC | - |
| 信令服务 | WebSocket + HTTPS | - |
| 包管理 | pnpm | - |

---

## 项目结构

```
webrtc-stream-vue3/
├── client/                          # Vue 3 前端
│   ├── src/
│   │   ├── assets/css/              # 样式文件
│   │   ├── components/
│   │   │   ├── Chat/                # 聊天组件
│   │   │   └── common/              # 通用组件
│   │   ├── composables/             # WebRTC 核心逻辑
│   │   │   ├── useWebRTC.ts         # WebRTC 连接管理
│   │   │   ├── useMediaStream.ts    # 媒体流管理
│   │   │   ├── useSignaling.ts      # 信令连接
│   │   │   └── useChat.ts           # 聊天功能
│   │   ├── router/                  # 路由配置
│   │   ├── stores/                  # Pinia 状态管理
│   │   ├── styles/                  # 全局样式
│   │   ├── types/                   # TypeScript 类型
│   │   ├── utils/
│   │   │   └── webrtc-utils.ts      # WebRTC 工具函数
│   │   ├── views/
│   │   │   ├── Home.vue             # 推流端
│   │   │   └── Viewer.vue           # 观看端
│   │   ├── App.vue
│   │   └── main.ts
│   ├── vite.config.ts
│   └── package.json
├── server/                          # Node.js 信令服务器
│   ├── src/
│   │   ├── index.ts                 # 服务入口
│   │   ├── types/
│   │   └── utils/
│   │       ├── config.ts            # 配置管理
│   │       ├── logger.ts            # 日志
│   │       ├── messageHandler.ts    # 消息处理
│   │       └── roomManager.ts       # 房间管理
│   └── package.json
├── .github/workflows/deploy.yml     # CI/CD 配置
├── README.md
├── CONTRIBUTING.md
└── package.json                     # Monorepo 根配置
```

---

## 核心模块说明

### 1. WebRTC 连接流程

```
推流端 (Home.vue)                    信令服务器                    观看端 (Viewer.vue)
     │                                  │                              │
     │ 1. 创建房间                      │                              │
     │ ─────────────────────────────>  │                              │
     │                                  │ 2. 加入房间                  │
     │                                  │ <─────────────────────────── │
     │                                  │                              │
     │ 3. SDP Offer                    │                              │
     │ <─────────────────────────────── │ ───────────────────────────> │
     │                                  │                              │
     │ 4. SDP Answer                   │                              │
     │ ───────────────────────────────> │ <─────────────────────────── │
     │                                  │                              │
     │ 5. ICE Candidates               │                              │
     │ <─────────────────────────────── │ ───────────────────────────> │
     │                                  │                              │
     │ 6. P2P 连接建立                  │                              │
     │ <════════════════════════════════════════════════════════════> │
```

### 2. 关键文件职责

| 文件 | 职责 |
|------|------|
| `client/src/utils/webrtc-utils.ts` | WebRTC 工具函数：编码选择、比特率计算、权限请求 |
| `client/src/utils/ui-utils.ts` | UI 工具函数：移动端检测、设备判断 |
| `client/src/utils/config.ts` | 配置管理：环境变量、服务器地址 |
| `client/src/composables/useWebRTC.ts` | WebRTC 连接管理：PeerConnection、ICE 候选 |
| `client/src/composables/useMediaStream.ts` | 媒体流管理：摄像头、屏幕共享、音频设备 |
| `client/src/composables/useSignaling.ts` | 信令连接：WebSocket 通信、房间管理 |
| `client/src/composables/useChat.ts` | 聊天功能：Data Channel 消息收发 |
| `client/src/views/Home.vue` | 推流端 UI 和逻辑 |
| `client/src/views/Viewer.vue` | 观看端 UI 和逻辑 |
| `server/src/utils/roomManager.ts` | 房间管理：创建、加入、离开 |
| `server/src/utils/messageHandler.ts` | WebSocket 消息路由 |

### 3. 环境变量

```bash
# client/.env.development
VITE_SIGNALING_SERVER_URL=wss://localhost:3001
VITE_DEBUG=true

# client/.env.production
VITE_SIGNALING_SERVER_URL=wss://your-domain.com/ws
VITE_DEBUG=false
```

---

## 开发规范

### 提交规范（Conventional Commits）

```
<type>(<scope>): <description>
```

**类型**：
- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档
- `style` - 代码格式
- `refactor` - 重构
- `perf` - 性能优化
- `test` - 测试
- `chore` - 构建/工具
- `ci` - CI/CD

**作用域**：
- `ui` - UI 组件/视图
- `chat` - 聊天功能
- `webrtc` - WebRTC 核心逻辑
- `store` - Pinia 状态管理
- `composables` - 组合式函数
- `utils` - 工具函数
- `server` - 信令服务器
- `config` - 配置文件
- `deps` - 依赖

**示例**：
```bash
feat(ui): 添加深色模式支持
fix(webrtc): 修复断线重连时 ICE 候选未刷新的问题
perf(store): 优化状态订阅避免不必要的重渲染
```

### 分支规范

| 分支 | 用途 |
|------|------|
| `main` | 生产分支，仅通过 PR 合入 |
| `develop` | 开发分支，日常开发 |
| `feature/*` | 功能分支 |
| `fix/*` | 修复分支 |
| `hotfix/*` | 紧急修复 |

### 代码风格

- **TypeScript**：严格模式，必须有类型注解
- **Vue 组件**：使用 `<script setup lang="ts">`
- **命名规范**：
  - 组件文件：PascalCase（`VideoPlayer.vue`）
  - composables：`use` 开头（`useWebRTC.ts`）
  - 常量：UPPER_SNAKE_CASE
  - 变量/函数：camelCase
- **样式**：遵循项目 CSS 变量和命名约定

---

## 常用命令

```bash
# 安装依赖
pnpm install

# 启动开发环境
pnpm dev:server   # 信令服务器 (localhost:3001)
pnpm dev:client   # 前端 (localhost:3000)

# 构建
pnpm build

# 类型检查
pnpm type-check
```

---

## 常见问题与解决方案

### 1. WebRTC 连接问题

**问题**：WebSocket 连接失败 `ERR_CERT_AUTHORITY_INVALID`

**解决**：首次运行需要信任自签名证书
1. 访问 `https://localhost:3001`
2. 点击"高级" → "继续前往"

### 2. 移动端权限问题

**问题**：移动端无法获取摄像头/麦克风

**解决**：
- 必须使用 HTTPS
- 先请求权限再获取设备列表（见 `requestAudioPermission`）

### 3. 屏幕共享问题

**问题**：Android 无法共享应用窗口

**解决**：`displaySurface` 设置为 `'any'`

### 4. 编码兼容性

**问题**：部分浏览器不支持 VP9/AV1

**解决**：使用 `getBestCodec()` 自动选择最佳编码

---

## 开发工作流

### 标准开发流程

```bash
# 1. 确保在 develop 分支
git switch develop

# 2. 拉取最新代码
git pull origin develop

# 3. 开发...

# 4. 提交（遵循提交规范）
git add .
git commit -m "feat(ui): 添加新功能"

# 5. 推送
git push origin develop

# 6. 创建 PR 到 main（使用 Squash Merge）
gh pr create --base main --head develop --title "feat: 功能描述"
```

### PR 合并后同步（重要！）

**⚠️ 关键步骤**：PR 合并到 main 后，必须立即同步到本地 develop 分支！

```bash
# PR 合并后，同步 develop 分支
git switch develop
git fetch origin main
git merge FETCH_HEAD --no-edit

# 推送到远程 develop（保持远程 develop 与 main 同步）
git push origin develop
```

**为什么重要？**
- GitHub PR 合并后，main 分支会产生新的 merge commit
- 如果不及时同步，本地 develop 会落后于 main
- 下次开发时会产生分叉历史，甚至冲突

**最佳实践**：
1. PR 合并后立即执行上述同步命令
2. 养成习惯：每次开始新功能开发前，先同步 main 到 develop
3. 保持 develop 始终基于 main 的最新状态

### Git 命令对照表

| 旧命令 | 新命令（推荐） | 说明 |
|--------|----------------|------|
| `git checkout <branch>` | `git switch <branch>` | 切换分支 |
| `git checkout -b <new>` | `git switch -c <new>` | 创建并切换分支 |
| `git checkout -- <file>` | `git restore <file>` | 恢复文件 |
| `git reset HEAD <file>` | `git restore --staged <file>` | 取消暂存 |

> **注意**：`git switch` 需要 Git 2.23+ 版本

### Git 操作注意事项

**⚠️ 避免以下高风险操作**：

| 错误操作 | 风险 | 正确做法 |
|----------|------|----------|
| `git rebase FETCH_HEAD` | FETCH_HEAD 是临时引用，可能导致仓库损坏 | 使用完整分支引用 `origin/develop` |
| `git reset --hard origin/xxx` | 分支引用不存在时会失败 | 先 `git fetch` 确保引用存在 |
| `git checkout --orphan` | 创建无历史分支，容易混乱 | 使用 `git switch -c` 创建正常分支 |
| 删除 `.git` 目录 | 丢失所有历史记录 | 仅作为最后手段 |

**✅ 安全操作流程**：

```bash
# 1. 初始化仓库
git init

# 2. 添加远程仓库
git remote add origin <url>

# 3. 获取远程分支
git fetch origin

# 4. 创建本地分支并跟踪远程分支
git switch -c develop origin/develop

# 5. 创建功能分支
git switch -c feature/xxx
```

**操作前检查清单**：
- [ ] `git status` - 检查工作区状态
- [ ] `git branch -a` - 检查分支列表
- [ ] `git log --oneline -5` - 检查提交历史
- [ ] 确认远程分支引用存在再操作

---

## 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                   Nginx (7777)                          │
│  静态文件 → 直接返回                                     │
│  WebSocket → proxy_pass → Node.js (localhost:3001)     │
│  API      → proxy_pass → Node.js (localhost:3001)      │
└─────────────────────────────────────────────────────────┘
```

### GitHub Actions 自动部署

**触发条件**：`main` 分支推送

**工作流程**：

```
Push to main
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  Job: build-and-deploy                                      │
│                                                             │
│  1. Checkout code                                           │
│       ↓                                                     │
│  2. Setup Node.js 24                                        │
│       ↓                                                     │
│  3. Install pnpm                                            │
│       ↓                                                     │
│  4. Install dependencies (pnpm install)                     │
│       ↓                                                     │
│  5. Build frontend (pnpm build)                             │
│       → Output: server/public-dist/                         │
│       ↓                                                     │
│  6. Build server (pnpm build)                               │
│       → Output: server/dist/                                │
│       ↓                                                     │
│  7. Deploy via SSH                                          │
│       - Copy files to ~/webrtc-stream/                      │
│       - pnpm install --prod                                 │
│       - Copy SSL certificates                               │
│       - pm2 restart webrtc-signaling                        │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
  部署完成 ✅
```

**所需 Secrets**：

| Secret 名称 | 说明 |
|------------|------|
| `SERVER_HOST` | 服务器地址 |
| `SERVER_USER` | SSH 用户名 |
| `SERVER_SSH_KEY` | SSH 私钥 |

**本地验证部署**：

```bash
# 查看 Actions 运行状态
gh run list --limit 5

# 查看特定运行详情
gh run view <run-id>

# 查看 Actions 日志
gh run watch
```

**手动触发部署**：

在 GitHub 仓库页面 → Actions → "Deploy to Server" → "Run workflow"

---

## 重要注意事项

1. **不要删除注释**：代码注释对 AI 理解项目很重要
2. **保持类型完整**：所有变量和函数必须有类型注解
3. **遵循现有模式**：新代码应与现有代码风格一致
4. **测试移动端**：WebRTC 功能需要在真实移动设备测试
5. **HTTPS 必须**：WebRTC 在非 HTTPS 环境下只能用于 localhost

---

## 联系方式

**Author**: [yukari017](https://github.com/yukari017)

**Repository**: https://github.com/yukari017/webrtc-stream-vue3

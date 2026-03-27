# 贡献指南

感谢你对 WebRTC Stream Vue3 项目的关注！本文档将帮助你快速参与项目开发。

## 📋 目录

- [开发流程](#-开发流程)
- [环境准备](#-环境准备)
- [分支管理](#-分支管理)
- [提交规范](#-提交规范)
- [Pull Request 规范](#-pull-request-规范)
- [Issue 规范](#-issue-规范)
- [代码风格](#-代码风格)

## 🔄 开发流程

1. **Fork** 本仓库
2. **克隆**到本地：`git clone https://github.com/<your-username>/webrtc-stream-vue3.git`
3. **创建分支**：基于 `develop` 创建功能分支
4. **开发**并提交代码
5. **推送**到你的 Fork 仓库
6. 创建 **Pull Request** 到 `develop` 分支

## 🛠️ 环境准备

```bash
# 安装依赖
pnpm install

# 启动开发环境（两个终端）
pnpm dev:server   # 信令服务器
pnpm dev:client   # 前端开发服务器
```

> ⚠️ 首次运行需要信任自签名证书，详见 [README.md](./README.md#首次运行重要步骤-)。

## 🌿 分支管理

```
main          ← 生产分支，始终保持可发布状态
  └─ develop  ← 开发分支，日常开发在此进行
       ├─ feature/xxx  ← 功能分支
       ├─ fix/xxx      ← 修复分支
       └─ hotfix/xxx   ← 紧急修复（从 main 拉出）
```

### 分支命名规范

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| 功能分支 | `feature/<简短描述>` | `feature/dark-mode` |
| 修复分支 | `fix/<简短描述>` | `fix/reconnect-ice` |
| 紧急修复 | `hotfix/<简短描述>` | `hotfix/crash-on-share` |

### 分支规则

- 所有开发在 `develop` 分支进行，**禁止直接向 `main` 推送代码**
- 功能/修复分支从 `develop` 创建，完成后通过 PR 合并回 `develop`
- `main` 分支仅接受从 `develop` 或 `hotfix/*` 来的 PR
- 合并后及时删除已完成的分支

## 📝 提交规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 格式

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 类型（type）

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（既非新功能也非 bug 修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具变动 |
| `ci` | CI/CD 配置变更 |

### 作用域（scope）

| scope | 说明 |
|-------|------|
| `ui` | 通用 UI 组件 / 视图层 |
| `chat` | 聊天相关组件和逻辑 |
| `webrtc` | WebRTC 连接、推流、观看核心逻辑 |
| `store` | Pinia 状态管理 |
| `composables` | Composables（组合式函数） |
| `utils` | 工具函数 |
| `server` | 信令服务器 |
| `config` | 配置文件（vite、tsconfig 等） |
| `deps` | 依赖升级 / 变更 |
| `ci` | CI/CD 配置 |

> 如果改动涉及多个 scope，选择影响最大的一个；如果无法归类，可以省略 scope。

### 提交信息要求

- 使用**现在时态**（"添加" 而非 "添加了"）
- 描述清晰，说明"做了什么"和"为什么做"
- 单次提交保持原子性，一个逻辑变更一个提交

### 示例

```bash
feat(ui): 添加深色模式支持
feat(chat): 支持发送图片消息
fix(webrtc): 修复断线重连时 ICE 候选未刷新的问题
fix(server): 修复房间满员后仍可加入的问题
perf(store): 优化状态订阅避免不必要的重渲染
refactor(composables): 抽离媒体设备管理逻辑到 useDeviceManager
docs(readme): 补充部署文档
test(webrtc): 添加连接超时场景的单元测试
chore(deps): 升级 Vue 至 3.5
ci(deploy): 优化 GitHub Actions 构建缓存
```

## 🔀 Pull Request 规范

### PR 标题

PR 标题遵循提交规范格式：`<type>(<scope>): <description>`

### PR 描述模板

```markdown
## 变更内容

简要描述本次 PR 做了什么。

## 变更类型

- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 性能优化 (perf)
- [ ] 文档 (docs)
- [ ] 其他

## 关联 Issue

Fixes #<issue-number>

## 测试

- [ ] 本地开发环境验证通过
- [ ] 类型检查通过 (`pnpm type-check`)
- [ ] 不影响现有功能

## 截图（如有 UI 变更）

（附上截图）
```

### 合并规则

- 至少需要 1 位维护者 Review 通过
- CI 检查全部通过
- 无未解决的合并冲突

## 🐛 Issue 规范

提交 Issue 时请尽量提供以下信息：

- **问题描述**：发生了什么，期望的行为是什么
- **复现步骤**：如何复现该问题
- **环境信息**：操作系统、浏览器版本、Node.js 版本
- **截图/日志**：相关截图或控制台错误日志

## 💻 代码风格

- **TypeScript**：严格模式，所有变量和函数必须有类型注解
- **Vue 组件**：使用 `<script setup lang="ts">` 语法
- **命名**：
  - 组件文件：PascalCase（如 `VideoPlayer.vue`）
  - composables：以 `use` 开头（如 `useWebRTC.ts`）
  - store：以 `use` 开头（如 `useRoomStore.ts`）
  - 常量：UPPER_SNAKE_CASE
  - 变量/函数：camelCase
- **样式**：遵循项目已有的 CSS 变量和命名约定

---

再次感谢你的贡献！如有任何疑问，欢迎在 Issue 中讨论。

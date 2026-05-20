# 开发指南

本文档面向参与 MeshKit 开源项目开发和打包的人。功能使用说明请看 [用户指南](./USER_GUIDE.md)，代码结构请看 [架构说明](./ARCHITECTURE.md)。

## 环境要求

- Node.js 18 或更高版本。
- pnpm 8 或更高版本。
- Git。
- 构建 Desktop 安装包时需要当前系统可用的 Electron Builder 依赖。
- Docker 部署测试需要 Docker 24 和 Docker Compose Plugin 2。

## 安装依赖

```bash
pnpm install
```

core 包被 Web 和 Desktop 依赖，首次运行或修改 core 后建议先构建：

```bash
pnpm --filter core build
```

## 常用开发命令

```bash
pnpm dev
```

`pnpm dev` 会通过 Turborepo 启动各包的开发任务。也可以按模块启动：

```bash
pnpm dev:signaling
pnpm dev:web
pnpm dev:desktop
```

常用检查和构建命令：

```bash
pnpm --filter web type-check
pnpm --filter web build
pnpm --filter desktop build:main
pnpm --filter desktop build:preload
pnpm --filter desktop build:renderer
pnpm --filter desktop build:web-share
pnpm --filter desktop type-check
```

Desktop 安装包：

```bash
pnpm --filter desktop release:win
pnpm --filter desktop release:mac
```

`release:win` 构建 Windows 安装包，`release:mac` 构建 macOS DMG/ZIP。macOS 包需要在 macOS 环境构建。

Docker 本地部署：

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f
```

## 开发顺序建议

修改共享逻辑时：

1. 先改 `packages/core`。
2. 执行 `pnpm --filter core build`。
3. 在 `packages/web` 验证浏览器端行为。
4. 在 `packages/desktop` 验证 Electron renderer 和本地服务行为。

修改纯 Web 页面时：

1. 修改 `packages/web/src`。
2. 执行 `pnpm --filter web type-check`。
3. 执行 `pnpm --filter desktop build:web-share`，确保 Desktop 内置共享页同步更新。

修改 Desktop 主进程时：

1. 修改 `packages/desktop/src/main` 或 `packages/desktop/src/preload`。
2. 执行 `pnpm --filter desktop build:main` 和 `pnpm --filter desktop build:preload`。
3. 启动 Desktop 验证窗口、IPC 和本地服务。

## 代码组织

```text
packages/core/src      尽量与运行环境无关的共享逻辑
packages/web/src       Web 页面、组件、hooks、状态和工具
packages/desktop/src   Electron main、preload、renderer
apps/signaling/src     signaling server
docs/                  文档
```

保持边界清晰：

- 不把 Electron API 放进 core。
- 不把浏览器 UI 状态放进 signaling。
- 不让 signaling 保存文件内容。
- 共享类型优先放在 core。

## Git 提交建议

如果一次开发包含很多变化，建议分批提交：

```bash
git status --short
git add README.md docs/
git commit -m "docs: refresh MeshKit documentation"

git add packages/web/public packages/desktop/build
git commit -m "chore: update MeshKit app icons"

git add packages/web/src packages/desktop/src
git commit -m "feat: add MeshKit brand icon to app headers"
```

也可以用交互式暂存精确挑选代码块：

```bash
git add -p
git diff --cached
git commit -m "feat: describe the change"
```

提交前不要把本机凭据提交进去，例如 `.codex/auth.json`、`.ssh/config`、`.env`、私钥文件等。

## 调试

### WebRTC

- 浏览器中打开 `chrome://webrtc-internals` 查看连接状态。
- 确认 signaling 地址、PeerJS 地址、端口和防火墙。
- 取件码页面可以使用“刷新 RTC”重新建立连接。

### Web

- 使用浏览器 DevTools 查看 console、network 和 storage。
- 如果页面拿不到最新 core 逻辑，先重新构建 core。

### Desktop

- 使用 `pnpm dev:desktop` 启动桌面端。
- 主进程日志在终端中查看。
- renderer 可以打开 Chromium DevTools 查看页面日志。
- 如果共享网页不是最新，执行 `pnpm --filter desktop build:web-share`。
- macOS 上系统 AirPlay Receiver 可能占用 `7000`，内置服务会从默认端口开始自动寻找可用端口。

### Docker

- `docker compose ps` 查看容器状态。
- `docker compose logs -f signaling` 查看 signaling 日志。
- `docker compose logs -f web` 查看 Web 静态站点日志。
- `/healthz` 可以检查容器内部服务是否正常。

## 回归检查清单

发布或合并前建议至少检查：

- 点对点文件发送、接收、取消、完成。
- 取件码创建、加入、二维码、邀请链接、刷新 RTC。
- 便签墙创建、加入、密码、分享、房主销毁。
- 加密聊天创建、加入、密码、分享、房主销毁。
- Desktop 在 Windows 和 macOS 上导入邀请链接和跳转。
- Web 与 Desktop 的 MeshKit 图标、标题和 favicon。
- Docker `web` 和 `signaling` 容器健康检查。

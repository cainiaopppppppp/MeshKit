# 版本发布说明

[English](./en/VERSION_RELEASE.md) | 简体中文

本文档记录 MeshKit 当前版本变化，以及后续发布时建议执行的检查清单。

## 当前版本

- 项目版本：`1.1.0`
- 适用范围：root、core、web、desktop、signaling、Docker 镜像
- 本次变化：统一 MeshKit 图标、补齐分享体验、整理文件传输和房间协作流程

## 1.1.0 重点更新

### 品牌和视觉

- Web 与 Desktop 使用统一的 MeshKit 图标。
- Web favicon、apple touch icon、Desktop 构建图标保持一致。
- Desktop 窗口标题更新为 MeshKit Desktop。
- Desktop 支持 Windows 和 macOS 打包发布。
- 主要页面的窄屏和移动端布局经过整理。

### 分享能力

- 文件传输、便签墙、加密聊天均支持邀请链接。
- 分享弹层支持二维码展示和二维码下载。
- 支持系统分享能力的设备可以调用系统分享。
- Desktop 可以导入 Web 端分享的完整邀请链接。
- Desktop 导入后会自动跳转到对应功能页。

### 文件传输

- 点对点传输支持接收方确认文件列表。
- 点对点传输支持接收方保存后标记完成。
- 点对点传输支持发送方取消发送。
- 取件码模式支持 6 位取件码、邀请链接和二维码。
- 取件码模式支持接收完成确认。
- 取件码模式在发送方取消后会提醒接收方。
- 活跃传输期间页面会限制离开，降低中断概率。
- 取件码页面提供“刷新 RTC”入口。

### 便签墙和加密聊天

- 支持最近房间。
- 支持房主信息展示。
- 只有房主可以销毁房间。
- 房间销毁后，其他成员会收到提醒并退出。
- 分享入口统一为链接、二维码和二维码下载。

### Docker

- `web` 和 `signaling` 镜像版本统一为 `1.1.0`。
- Compose 默认暴露 Web、WebSocket 和 PeerJS 端口。
- Web 和 signaling 均包含健康检查。

## 发布前检查

### 版本号

确认以下文件版本号一致：

- `package.json`
- `packages/core/package.json`
- `packages/web/package.json`
- `packages/desktop/package.json`
- `apps/signaling/package.json`
- `docker-compose.yml`

### 图标资源

确认以下资源已同步：

- `packages/web/public/meshkit-icon.png`
- `packages/web/public/favicon.png`
- `packages/web/public/favicon.ico`
- `packages/web/public/apple-touch-icon.png`
- `packages/desktop/src/renderer/assets/meshkit-icon.png`
- `packages/desktop/src/renderer/public/meshkit-icon.png`
- `packages/desktop/src/renderer/public/favicon.ico`
- `packages/desktop/build/icon.png`
- `packages/desktop/build/icon.ico`
- `packages/desktop/build/icon.icns`，如果发布 macOS 包

### 推荐命令

```bash
pnpm --filter core build
pnpm --filter web type-check
pnpm --filter web build
pnpm --filter desktop build:main
pnpm --filter desktop build:preload
pnpm --filter desktop build:renderer
pnpm --filter desktop build:web-share
pnpm --filter desktop type-check
```

Docker：

```bash
docker compose config
docker compose up -d --build
docker compose ps
```

Desktop 安装包：

```bash
pnpm --filter desktop release:win
pnpm --filter desktop release:mac
```

`release:win` 生成 Windows NSIS/Portable，`release:mac` 生成 macOS DMG/ZIP。macOS 包需要在 macOS 环境构建。

## 手动回归清单

文件传输：

- 点对点发送、接收、取消、完成。
- 多文件传输和单文件传输。
- 取件码生成、输入、邀请链接、二维码。
- 发送方取消后，接收方收到提醒。
- RTC 异常时刷新 RTC。

便签墙：

- 创建和加入房间。
- 房间密码校验。
- 便签新增、编辑、删除和同步。
- 分享链接和二维码。
- 非房主不可销毁房间。
- 房主销毁后成员退出。

加密聊天：

- 创建和加入房间。
- 房间密码校验。
- 消息发送和接收。
- 分享链接和二维码。
- 非房主不可销毁房间。
- 房主销毁后成员退出。

Desktop：

- Windows 安装包可以启动并进入共享中心。
- macOS DMG/ZIP 可以启动并进入共享中心。
- 首屏品牌图标显示。
- 导入取件码邀请链接。
- 导入便签墙邀请链接。
- 导入加密聊天邀请链接。
- 本地共享服务可被局域网设备访问。
- macOS 上默认 `7000` 被系统占用时，会自动使用后续可用端口。

Docker：

- Web 页面可访问。
- signaling `/healthz` 正常。
- PeerJS `/healthz` 正常。
- 局域网设备使用宿主机 IP 能访问 Web。

## 建议提交拆分

如果一次性改动较多，建议按主题提交：

```bash
git add README.md docs/
git commit -m "docs: refresh MeshKit 1.1.0 documentation"

git add packages/web/public packages/desktop/build packages/desktop/src/renderer/public
git commit -m "chore: update MeshKit icons"

git add packages/web/src packages/desktop/src
git commit -m "feat: align MeshKit app branding"
```

提交前建议检查：

```bash
git status --short
git diff --cached
```

不要提交本机凭据、SSH 配置、API token、`.env` 或个人缓存文件。

## 发布说明模板

```markdown
## MeshKit 1.1.0

### 新增
- 统一 Web 和 Desktop 的 MeshKit 品牌图标。
- 文件传输、便签墙、加密聊天支持邀请链接和二维码。
- Desktop 支持 Windows/macOS，支持导入邀请链接并跳转到对应页面。

### 改进
- 补齐点对点和取件码传输的确认、取消和完成流程。
- 优化移动端与窄屏布局。
- 更新 Docker 镜像和健康检查配置。

### 注意
- 邀请链接请只分享给可信的人。
- 局域网部署需要放行 Web、WebSocket 和 PeerJS 端口。
```

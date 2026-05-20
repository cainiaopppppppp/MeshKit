# MeshKit

MeshKit 是一个开源的局域网 P2P 小工具项目，当前版本为 `1.1.0`。它包含文件传输、便签墙、加密聊天和 Desktop 本地共享入口，方便在电脑、手机和浏览器之间临时传文件或协作。

![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-18-blue)
![Electron](https://img.shields.io/badge/Electron-28-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

> 图片占位：`docs/images/desktop-home.png`
>
> 图片占位：`docs/images/file-transfer.png`
>
> 图片占位：`docs/images/share-qr.png`

## 功能概览

- 文件传输：支持点对点传输、取件码、多文件队列、二维码分享、接收确认和发送取消。
- 便签墙：支持多人实时同步、房间密码、最近房间、分享链接、二维码和房主销毁。
- 加密聊天：支持房间密码、最近房间、邀请链接、二维码、房主销毁和销毁提醒。
- Desktop：内置信令服务和浏览器分享页，只安装桌面端也能在局域网内发起共享。
- Docker：提供 Web 静态站点和独立 signaling 服务的容器化部署。

详细说明见 [功能介绍](./docs/功能介绍.md)。

## 快速开始

```bash
pnpm install
pnpm --filter core build
pnpm dev
```

常用启动方式：

```bash
pnpm dev:web
pnpm dev:desktop
pnpm dev:signaling
```

Windows 安装包：

```bash
pnpm --filter desktop release:win
```

产物在 `packages/desktop/release`。

Docker 部署：

```bash
docker compose up -d --build
```

默认访问：

- Web：`http://localhost:3000`
- WebSocket：`ws://localhost:7000/ws`
- PeerJS：`http://localhost:8000/peerjs`

## 文档

- [使用说明](./docs/使用说明.md)
- [功能介绍](./docs/功能介绍.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [开发指南](./docs/DEVELOPMENT.md)
- [Docker 部署](./docs/DOCKER_DEPLOYMENT.md)
- [版本发布](./docs/VERSION_RELEASE.md)
- [API 参考](./docs/API.md)

## 注意事项

- 活跃文件传输期间，发送方和接收方都应留在当前页面。
- 邀请链接可能包含连接参数、取件码或房间信息，只建议发给可信的人。
- Desktop 共享中心会在本机启动局域网服务，请确认防火墙允许对应端口访问。

## License

MIT

[![Star History Chart](https://api.star-history.com/svg?repos=cainiaopppppppp/MeshKit&type=Date)](https://star-history.com/#cainiaopppppppp/MeshKit&Date)

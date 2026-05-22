# MeshKit - Secure P2P Collaboration Suite

**Language / 语言**: [简体中文](./README.md) | English

<div align="center">

**A decentralized P2P collaboration platform based on WebRTC**

**End-to-end encryption** • **File transfer** • **Notes collaboration** • **Encrypted chat**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-blue)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-28.0-blue)](https://www.electronjs.org/)
[![Security](https://img.shields.io/badge/Security-E2EE-green)](https://en.wikipedia.org/wiki/End-to-end_encryption)

</div>

---

## Overview

MeshKit is an open-source LAN-first P2P utility suite. The current version is `1.1.0`. It provides file transfer, Notes Wall, encrypted chat, and a Desktop local sharing hub, making it easy to temporarily transfer files or collaborate across computers, phones, and browsers.

## Screenshots

<p align="center">
  <img src="docs/images/filetransfer.png" alt="Peer-to-peer file transfer" width="46%">
  <img src="docs/images/filetransfer3.png" alt="Pickup-code receiving" width="46%">
</p>

<p align="center">
  <img src="docs/images/noteswall2.png" alt="Notes Wall" width="46%">
  <img src="docs/images/chat2.png" alt="Encrypted chat" width="46%">
</p>

More screenshots for file transfer, pickup codes, Notes Wall, and encrypted chat are available in [Feature Overview](./docs/en/FEATURE_OVERVIEW.md).

## Features

- File transfer: peer-to-peer transfer, pickup codes, multi-file queues, QR sharing, receive confirmation, and send cancellation.
- Notes Wall: real-time multi-user sync, room passwords, recent rooms, share links, QR codes, and owner-only room destruction.
- Encrypted chat: room passwords, recent rooms, invite links, QR codes, owner-only room destruction, and destruction notifications.
- Desktop: built-in signaling service and browser share page, so a Desktop-only install can start LAN sharing.
- Docker: containerized Web static site and standalone signaling service.

See [Feature Overview](./docs/en/FEATURE_OVERVIEW.md) for details.

## Quick Start

```bash
pnpm install
pnpm --filter core build
pnpm dev
```

Common development commands:

```bash
pnpm dev:web
pnpm dev:desktop
pnpm dev:signaling
```

Desktop installers:

```bash
pnpm --filter desktop release:win
pnpm --filter desktop release:mac
```

Build artifacts are written to `packages/desktop/release`.

Docker deployment:

```bash
docker compose up -d --build
```

Default endpoints:

- Web: `http://localhost:3000`
- WebSocket: `ws://localhost:7000/ws`
- PeerJS: `http://localhost:8000/peerjs`

## Documentation

Chinese documentation:

- [README](./README.md)
- [使用说明](./docs/使用说明.md)
- [功能介绍](./docs/功能介绍.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [开发指南](./docs/DEVELOPMENT.md)
- [Docker 部署](./docs/DOCKER_DEPLOYMENT.md)
- [版本发布](./docs/VERSION_RELEASE.md)
- [API 参考](./docs/API.md)

English documentation:

- [Quick Start](./docs/en/QUICK_START.md)
- [Feature Overview](./docs/en/FEATURE_OVERVIEW.md)
- [User Guide](./docs/en/USER_GUIDE.md)
- [Architecture](./docs/en/ARCHITECTURE.md)
- [Development Guide](./docs/en/DEVELOPMENT.md)
- [Docker Deployment](./docs/en/DOCKER_DEPLOYMENT.md)
- [Version Release](./docs/en/VERSION_RELEASE.md)
- [API Reference](./docs/en/API.md)

## Notes

- During active file transfers, both sender and receiver should stay on the current page.
- Invite links may contain connection parameters, pickup codes, or room information. Share them only with trusted people.
- Desktop Share Hub supports Windows and macOS. It starts LAN services locally, so make sure the firewall allows the required ports.
- Phones, tablets, and computers can interoperate.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

## Acknowledgements

- [PeerJS](https://peerjs.com/) - WebRTC wrapper
- [Yjs](https://yjs.dev/) - CRDT collaborative editing
- [libsodium](https://libsodium.gitbook.io/) - cryptography library
- [React](https://reactjs.org/) - UI framework
- [Electron](https://www.electronjs.org/) - desktop application framework

---

<div align="center">

**Made for seamless P2P collaboration**

[GitHub](https://github.com/cainiaopppppppp/MeshKit) • [Issues](https://github.com/cainiaopppppppp/MeshKit/issues) • [Discussions](https://github.com/cainiaopppppppp/MeshKit/discussions)

[![Star History Chart](https://api.star-history.com/svg?repos=cainiaopppppppp/MeshKit&type=Date)](https://star-history.com/#cainiaopppppppp/MeshKit&Date)

</div>

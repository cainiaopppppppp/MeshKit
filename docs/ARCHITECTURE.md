# MeshKit 架构说明

[English](./en/ARCHITECTURE.md) | 简体中文

MeshKit 是一个基于 WebRTC 的开源 P2P 工具项目，当前版本为 1.1.0。仓库采用 pnpm workspace 管理，Web、Desktop 和 signaling 服务共享一部分核心逻辑。

## 总览

```text
packages/web        packages/desktop
React + Vite        Electron + React
      |                    |
      +---------+----------+
                |
          packages/core
       P2P / file transfer
                |
                v
apps/signaling: WebSocket + PeerJS
                |
                v
       WebRTC DataChannel
       Browser to Browser
```

signaling 服务负责设备发现、房间状态和 WebRTC 连接协商。文件内容、便签同步数据和聊天消息尽量通过设备之间的 WebRTC 通道传输，不由 signaling 服务长期保存。

## 仓库结构

```text
apps/
  signaling/             WebSocket + PeerJS signaling 服务
packages/
  core/                  P2P、文件传输、共享类型和工具
  web/                   浏览器端应用
  desktop/               Electron 桌面端应用
docs/                    使用和开发文档
docker-compose.yml       Web + signaling 容器编排
```

## 主要模块

### packages/core

核心包提供跨端共享能力：

- PeerJS/WebRTC 连接管理。
- 文件分片、队列、进度和取消状态。
- 设备标识、传输消息类型和通用工具。
- Web 与 Desktop 复用的类型定义。

核心包尽量保持运行环境无关，浏览器或 Electron 特有逻辑放在对应应用层处理。

### packages/web

Web 应用负责界面和浏览器运行时能力：

- 文件传输页面，包括点对点和取件码模式。
- 便签墙页面，使用 Yjs 和 y-webrtc 同步。
- 加密聊天页面。
- 分享弹层、二维码、邀请链接、移动端适配。
- favicon 和 MeshKit 品牌图标。

### packages/desktop

Desktop 应用基于 Electron，当前支持 Windows 和 macOS：

- main 进程负责窗口、本地服务和系统能力。
- preload 提供受控的 IPC 桥接。
- renderer 提供桌面端界面，并复用部分 Web 端能力。
- build 目录保存 Electron Builder 需要的图标和打包资源。
- Desktop 可以导入 Web 端生成的邀请链接并跳转到对应页面。

### apps/signaling

signaling 服务是轻量 Node 服务：

- WebSocket 用于设备发现和房间消息。
- PeerJS server 用于 WebRTC 协商。
- `/healthz` 用于健康检查。
- 定时清理过期设备和房间状态。

## 运行时流程

### 设备发现

1. 客户端启动后连接 signaling。
2. 客户端注册设备信息和 Peer ID。
3. signaling 广播在线设备列表。
4. 发送方选择目标设备后发起连接。

### 点对点文件传输

1. 发送方选择文件和目标设备。
2. 双方通过 PeerJS 建立 WebRTC DataChannel。
3. 发送方发送文件元数据和分片。
4. 接收方组合文件并提供保存入口。
5. 接收方标记完成，发送方结束本次传输。

### 取件码传输

1. 发送方创建取件房间和 6 位取件码。
2. 发送方分享取件码、邀请链接或二维码。
3. 接收方加入房间并建立 RTC 连接。
4. 接收方逐个保存文件。
5. 任一方取消或完成后，页面同步对应状态。

### 便签墙和加密聊天

1. 使用者创建或加入房间。
2. 房间密码用于进入校验。
3. 房间状态通过 signaling 和本地状态管理维护。
4. 便签内容使用 Yjs/y-webrtc 同步。
5. 房主销毁房间时，成员收到通知并退出。

## 数据和存储

- 文件内容不写入 signaling 服务。
- Web 端常用 localStorage、IndexedDB 或内存状态保存本地偏好、最近房间和协作缓存。
- Desktop 端可使用 Electron 主进程和本地文件系统能力管理本地服务状态。
- 邀请链接可能包含房间、连接和分享参数，应视为敏感信息。

## 端口

默认开发和部署端口：

| 服务 | 默认端口 | 用途 |
| --- | --- | --- |
| Web | 3000 | 浏览器访问入口 |
| WebSocket | 7000 | 设备发现和房间消息 |
| PeerJS | 8000 | WebRTC 协商 |

Desktop 内置服务会优先使用默认端口；如果本机端口已被占用，会自动尝试后续可用端口。macOS 的 AirPlay Receiver 常占用 `7000`，因此实际 WebSocket 端口以 Desktop 共享中心显示为准。局域网访问时需要确认防火墙放行对应端口。

## 使用边界

MeshKit 更适合认识的人之间临时使用，例如同一局域网内传文件、记便签或聊天。

- WebRTC 自带传输层加密。
- 房间密码用于控制进入门槛。
- signaling 不保存文件内容。
- 邀请链接不要公开发布到不受控环境。
- 当前版本不提供账号、审计或复杂权限系统。

## 扩展方向

后续扩展可以沿现有边界推进：

- 在 core 中扩展新的传输消息类型。
- 在 Web 中增加新的协作页面。
- 在 Desktop 中增加系统托盘、自动更新或更完整的本地服务管理。
- 在 signaling 中增加更细的房间生命周期和部署观测能力。

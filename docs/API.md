# API 参考

[English](./en/API.md) | 简体中文

本文档记录 `@meshkit/core` 当前对 Web 和 Desktop 暴露的主要入口。core 包偏底层，日常功能开发一般先从 Web 页面或 Desktop renderer 调用这些入口和 manager 单例。

## 导入

```typescript
import {
  initCore,
  connectSignaling,
  refreshP2PPeer,
  updateDeviceName,
  cleanup,
  eventBus,
  p2pManager,
  deviceManager,
  fileTransferManager,
  roomManager,
  signalingClient,
} from '@meshkit/core';
```

## 生命周期

### initCore

初始化设备、P2P manager、设备管理和房间管理。

```typescript
async function initCore(
  deviceId?: string,
  deviceName?: string
): Promise<{ deviceId: string; deviceName: string }>;
```

如果传入的 `deviceId` 已被占用，core 会自动生成新的设备 ID 并重新初始化 Peer。

### connectSignaling

连接 signaling 服务。

```typescript
function connectSignaling(url: string): void;
```

调用前必须先执行 `initCore()`。

```typescript
const device = await initCore();
connectSignaling('ws://localhost:7000/ws');
```

### refreshP2PPeer

刷新 PeerJS 实例，适合 RTC 状态异常时重新建连。

```typescript
async function refreshP2PPeer(): Promise<void>;
```

### updateDeviceName

更新当前设备名，并同步到 signaling。

```typescript
function updateDeviceName(newName: string): string;
```

### cleanup

清理文件传输、P2P 连接、signaling 连接和设备选择状态。

```typescript
function cleanup(): void;
```

## Manager 单例

### p2pManager

负责 PeerJS 和 WebRTC DataConnection。

常见职责：

- 初始化 Peer。
- 连接目标设备。
- 监听连接打开、关闭、错误和数据消息。
- 销毁或刷新 Peer。

### deviceManager

负责当前设备和在线设备列表。

常见职责：

- 生成设备 ID 和设备名。
- 保存当前设备信息。
- 更新在线设备列表。
- 选择或清空目标设备。

### fileTransferManager

负责文件传输生命周期。

常见职责：

- 单文件和多文件队列传输。
- 接收文件列表请求。
- 接收方选择文件。
- 发送方取消传输。
- 接收方标记完成。
- 进度、速度、完成、失败等事件派发。

### roomManager

负责取件码房间和成员状态。

常见职责：

- 创建房间。
- 加入房间。
- 离开房间。
- 更新房间文件列表。
- 更新成员传输状态。
- 处理房间销毁。

### signalingClient

负责 WebSocket 连接。

常见职责：

- 注册设备。
- 发送和接收 signaling 消息。
- 心跳和重连。
- 房间消息转发。

## 事件

core 使用 `eventBus` 广播运行时事件。事件类型定义在 `packages/core/src/types/index.ts` 的 `EventMap` 中。

示例：

```typescript
eventBus.on('signaling:device-list', ({ devices }) => {
  console.log(devices);
});

eventBus.on('transfer:progress', (progress) => {
  console.log(progress.progress);
});
```

常用事件：

| 事件 | 说明 |
| --- | --- |
| `signaling:connected` | signaling 已连接 |
| `signaling:device-list` | 在线设备列表更新 |
| `p2p:connection:open` | P2P 连接打开 |
| `p2p:connection:error` | P2P 连接错误 |
| `transfer:file-list-received` | 收到多文件列表 |
| `transfer:progress` | 文件传输进度更新 |
| `transfer:completed` | 传输完成 |
| `transfer:cancelled` | 传输取消 |
| `transfer:receiver-completed` | 接收方标记完成 |
| `room:created` | 房间创建成功 |
| `room:joined` | 加入房间成功 |
| `room:dissolved` | 房间被销毁 |

## 主要类型

### Device

```typescript
interface Device {
  id: string;
  name: string;
  timestamp: number;
  lastSeen?: number;
}
```

### FileMetadata

```typescript
interface FileMetadata {
  name: string;
  size: number;
  type: string;
  totalChunks?: number;
  index?: number;
  passwordProtected?: boolean;
  encrypted?: boolean;
  encryptionMethod?: string;
}
```

### Room

```typescript
interface Room {
  id: string;
  name: string;
  hostId: string;
  members: RoomMember[];
  createdAt: number;
  fileInfo?: FileMetadata;
  fileList?: FileMetadata[];
  isMultiFile?: boolean;
  status: 'waiting' | 'transferring' | 'completed' | 'dissolved';
  hasPassword?: boolean;
}
```

### TransferProgress

```typescript
interface TransferProgress {
  direction: 'send' | 'receive';
  progress: number;
  transferred: number;
  total: number;
  speed: number;
  remaining: number;
  speedMB: string;
  remainingTime: string;
}
```

## 使用顺序

一个典型 Web 页面启动流程：

```typescript
const { deviceId, deviceName } = await initCore();
connectSignaling('ws://localhost:7000/ws');

eventBus.on('signaling:device-list', ({ devices }) => {
  // 更新 UI 中的在线设备列表
});
```

页面卸载或应用退出时：

```typescript
cleanup();
```

## 注意

- manager 单例中有较多运行时状态，测试时要注意清理。
- signaling URL、PeerJS host 和端口需要与部署环境一致。
- 文件内容不通过 signaling 保存，接收方必须在传输完成后主动保存。
- 邀请链接中的连接参数应视为敏感信息。

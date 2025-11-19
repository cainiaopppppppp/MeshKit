# API 文档

`@meshkit/core` 包的 API 参考文档。

## 初始化

### initCore()

初始化核心模块。

```typescript
async function initCore(
 deviceId?: string,
 deviceName?: string
): Promise<{ deviceId: string; deviceName: string }>
```

**参数：**
- `deviceId` (可选): 设备ID，不提供则自动生成
- `deviceName` (可选): 设备名称，不提供则自动生成

**返回：**
- `deviceId`: 设备ID
- `deviceName`: 设备名称

**示例：**
```typescript
const { deviceId, deviceName } = await initCore();
console.log(`设备: ${deviceName} (${deviceId})`);
```

### connectSignaling()

连接信令服务器。

```typescript
function connectSignaling(url: string): void
```

**参数：**
- `url`: 信令服务器 WebSocket URL

**示例：**
```typescript
connectSignaling('ws://localhost:7000/ws');
```

## 文件传输

### fileTransferManager

文件传输管理器实例。

#### selectFile()

选择要发送的文件。

```typescript
selectFile(file: File): void
```

#### sendFile()

发送文件到目标设备。

```typescript
async sendFile(targetDeviceId: string): Promise<void>
```

#### downloadFile()

下载接收到的文件。

```typescript
downloadFile(): void
```

#### getDownloadInfo()

获取下载文件信息。

```typescript
getDownloadInfo(): { blob: Blob; filename: string } | null
```

**示例：**
```typescript
// 发送文件
const file = document.getElementById('fileInput').files[0];
fileTransferManager.selectFile(file);
await fileTransferManager.sendFile(targetDeviceId);

// 下载文件
const info = fileTransferManager.getDownloadInfo();
if (info) {
 fileTransferManager.downloadFile();
}
```

## 设备管理

### deviceManager

设备管理器实例。

#### getDevices()

获取所有在线设备。

```typescript
getDevices(): Device[]
```

#### selectDevice()

选择目标设备。

```typescript
selectDevice(deviceId: string): void
```

#### getMyDevice()

获取本设备信息。

```typescript
getMyDevice(): Device | null
```

**类型定义：**
```typescript
interface Device {
 id: string;
 name: string;
 isOnline: boolean;
 lastSeen: number;
}
```

**示例：**
```typescript
const devices = deviceManager.getDevices();
const myDevice = deviceManager.getMyDevice();
```

## 事件总线

### eventBus

全局事件总线。

#### on()

监听事件。

```typescript
on(event: string, handler: Function): void
```

#### off()

取消监听。

```typescript
off(event: string, handler: Function): void
```

### 可用事件

#### 连接事件

```typescript
// 信令服务器连接
eventBus.on('signaling:connected', () => void);
eventBus.on('signaling:disconnected', () => void);
```

#### 设备事件

```typescript
// 设备列表更新
eventBus.on('device:list-updated', ({ devices }: { devices: Device[] }) => void);
```

#### 传输事件

```typescript
// 传输准备中
eventBus.on('transfer:preparing', ({ direction }: { direction: 'send' | 'receive' }) => void);

// 传输开始
eventBus.on('transfer:started', ({ direction }: { direction: 'send' | 'receive' }) => void);

// 传输进度
eventBus.on('transfer:progress', (progress: TransferProgress) => void);

// 传输完成
eventBus.on('transfer:completed', ({ direction }: { direction: 'send' | 'receive' }) => void);

// 传输错误
eventBus.on('transfer:error', (error: Error) => void);
```

**TransferProgress 类型：**
```typescript
interface TransferProgress {
 progress: number; // 百分比 (0-100)
 loaded: number; // 已传输字节数
 total: number; // 总字节数
 speedMB: number; // 速度 (MB/s)
 remainingSeconds: number; // 剩余秒数
}
```

## 配置

### config

全局配置对象。

#### get()

获取配置项。

```typescript
get<K extends keyof P2PConfig>(key: K): P2PConfig[K]
```

#### set()

设置配置项。

```typescript
set<K extends keyof P2PConfig>(key: K, value: P2PConfig[K]): void
```

**配置项：**
```typescript
interface P2PConfig {
 peerjs: {
 host: string;
 port: number;
 path: string;
 debug: number;
 };
 signalingServer?: {
 host: string;
 wsPort: number;
 peerPort: number;
 };
 transfer: {
 chunkSize: number; // 默认 1MB
 sendDelay: number; // 默认 1ms
 timeout: number; // 默认 300秒
 };
}
```

**示例：**
```typescript
// 获取配置
const chunkSize = config.get('transfer').chunkSize;

// 设置配置
config.set('signalingServer', {
 host: '192.168.1.100',
 wsPort: 7000,
 peerPort: 8000
});
```

## 类型定义

```typescript
// 设备信息
interface Device {
 id: string;
 name: string;
 isOnline: boolean;
 lastSeen: number;
}

// 传输进度
interface TransferProgress {
 progress: number;
 loaded: number;
 total: number;
 speedMB: number;
 remainingSeconds: number;
}

// P2P 配置
interface P2PConfig {
 peerjs: {
 host: string;
 port: number;
 path: string;
 debug: number;
 };
 signalingServer?: {
 host: string;
 wsPort: number;
 peerPort: number;
 };
 transfer: {
 chunkSize: number;
 sendDelay: number;
 timeout: number;
 };
}

// 文件队列项
interface FileQueueItem {
 file: File;
 status: 'pending' | 'transferring' | 'completed' | 'failed';
 progress: number;
 error?: string;
}
```

## 完整示例

### 文件传输

```typescript
import {
 initCore,
 connectSignaling,
 fileTransferManager,
 deviceManager,
 eventBus
} from '@meshkit/core';

// 初始化
const { deviceId } = await initCore();
connectSignaling('ws://localhost:7000/ws');

// 监听设备
eventBus.on('device:list-updated', ({ devices }) => {
 console.log('在线设备:', devices);
});

// 监听进度
eventBus.on('transfer:progress', (progress) => {
 console.log(`进度: ${progress.progress}%`);
 console.log(`速度: ${progress.speedMB} MB/s`);
});

// 发送文件
const file = document.getElementById('fileInput').files[0];
fileTransferManager.selectFile(file);
await fileTransferManager.sendFile(targetDeviceId);

// 接收文件
eventBus.on('transfer:completed', ({ direction }) => {
 if (direction === 'receive') {
 fileTransferManager.downloadFile();
 }
});
```

---

更多信息：
- [功能详解](./FEATURES.md)
- [开发指南](./DEVELOPMENT.md)
- [GitHub Issues](https://github.com/cainiaopppppppp/MeshKit/issues)

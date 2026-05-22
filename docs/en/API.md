# API Reference

[简体中文](../API.md) | English

This document records the main entry points currently exposed by `@meshkit/core` to Web and Desktop. The core package is relatively low-level; day-to-day feature work usually starts from Web pages or the Desktop renderer and calls these entry points or manager singletons.

## Import

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

## Lifecycle

### initCore

Initializes the device, P2P manager, device manager, and room manager.

```typescript
async function initCore(
  deviceId?: string,
  deviceName?: string
): Promise<{ deviceId: string; deviceName: string }>;
```

If the provided `deviceId` is already occupied, core automatically generates a new device ID and reinitializes Peer.

### connectSignaling

Connects to the signaling service.

```typescript
function connectSignaling(url: string): void;
```

Call `initCore()` before using it.

```typescript
const device = await initCore();
connectSignaling('ws://localhost:7000/ws');
```

### refreshP2PPeer

Refreshes the PeerJS instance. Use it when RTC state is abnormal and the peer connection needs to be rebuilt.

```typescript
async function refreshP2PPeer(): Promise<void>;
```

### updateDeviceName

Updates the current device name and syncs it to signaling.

```typescript
function updateDeviceName(newName: string): string;
```

### cleanup

Cleans file transfer state, P2P connections, signaling connections, and selected device state.

```typescript
function cleanup(): void;
```

## Manager Singletons

### p2pManager

Handles PeerJS and WebRTC `DataConnection`.

Common responsibilities:

- Initialize Peer.
- Connect to a target device.
- Listen for connection open, close, error, and data messages.
- Destroy or refresh Peer.

### deviceManager

Handles the current device and online device list.

Common responsibilities:

- Generate device IDs and device names.
- Save current device information.
- Update the online device list.
- Select or clear the target device.

### fileTransferManager

Handles the file transfer lifecycle.

Common responsibilities:

- Single-file and multi-file queue transfer.
- Receive file-list requests.
- Let receivers select files.
- Let senders cancel transfer.
- Let receivers mark completion.
- Dispatch progress, speed, completion, failure, and related events.

### roomManager

Handles pickup-code rooms and member state.

Common responsibilities:

- Create rooms.
- Join rooms.
- Leave rooms.
- Update room file lists.
- Update member transfer state.
- Handle room destruction.

### signalingClient

Handles WebSocket connections.

Common responsibilities:

- Register devices.
- Send and receive signaling messages.
- Heartbeats and reconnects.
- Forward room messages.

## Events

Core uses `eventBus` to broadcast runtime events. Event types are defined in `EventMap` in `packages/core/src/types/index.ts`.

Example:

```typescript
eventBus.on('signaling:device-list', ({ devices }) => {
  console.log(devices);
});

eventBus.on('transfer:progress', (progress) => {
  console.log(progress.progress);
});
```

Common events:

| Event | Description |
| --- | --- |
| `signaling:connected` | Signaling connected |
| `signaling:device-list` | Online device list updated |
| `p2p:connection:open` | P2P connection opened |
| `p2p:connection:error` | P2P connection error |
| `transfer:file-list-received` | Multi-file list received |
| `transfer:progress` | File transfer progress updated |
| `transfer:completed` | Transfer completed |
| `transfer:cancelled` | Transfer cancelled |
| `transfer:receiver-completed` | Receiver marked completion |
| `room:created` | Room created |
| `room:joined` | Room joined |
| `room:dissolved` | Room destroyed |

## Main Types

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

## Typical Usage Order

Typical Web page startup flow:

```typescript
const { deviceId, deviceName } = await initCore();
connectSignaling('ws://localhost:7000/ws');

eventBus.on('signaling:device-list', ({ devices }) => {
  // Update the online device list in UI.
});
```

On page unload or app exit:

```typescript
cleanup();
```

## Notes

- Manager singletons contain runtime state; tests should clean up carefully.
- Signaling URL, PeerJS host, and ports must match the deployment environment.
- File contents are not stored by signaling; receivers must save files after transfer completes.
- Connection parameters in invite links should be treated as sensitive information.

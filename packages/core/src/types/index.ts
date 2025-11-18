/**
 * 核心类型定义
 */

export interface Device {
  id: string;
  name: string;
  timestamp: number;
  lastSeen?: number;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  totalChunks?: number;
  index?: number; // 文件在队列中的索引（用于房间模式同步）
}

/**
 * 文件队列项状态
 */
export type FileQueueStatus = 'pending' | 'transferring' | 'completed' | 'skipped' | 'failed';

/**
 * 文件队列项
 */
export interface FileQueueItem {
  file: File;
  index: number;
  metadata: FileMetadata;
  status: FileQueueStatus;
  progress: number;
  selected: boolean; // 是否被接收方选中
  error?: string;
  receivedBlob?: Blob; // 接收方：接收到的文件blob
}

/**
 * 房间成员
 */
export interface RoomMember {
  deviceId: string;
  deviceName: string;
  role: 'host' | 'member';
  status: 'waiting' | 'receiving' | 'completed' | 'failed';
  joinedAt: number;
  progress?: number; // 传输进度 0-100
}

/**
 * 传输房间
 */
export interface Room {
  id: string; // 6位房间号
  name: string; // 房间名称
  hostId: string; // 创建者设备ID
  members: RoomMember[]; // 成员列表（包含创建者）
  createdAt: number;
  fileInfo?: FileMetadata; // 待传输的文件信息（单文件模式）
  fileList?: FileMetadata[]; // 待传输的文件列表（多文件模式）
  isMultiFile?: boolean; // 是否为多文件模式
  status: 'waiting' | 'transferring' | 'completed';
  hasPassword?: boolean; // 是否有密码保护（服务器告知客户端，但不传输真实密码）
}

export interface TransferProgress {
  direction: 'send' | 'receive';
  progress: number;
  transferred: number;
  total: number;
  speed: number;
  remaining: number;
  speedMB: string;
  remainingTime: string;
}

export interface P2PConfig {
  webrtc: {
    iceServers: RTCIceServer[];
    config?: RTCConfiguration;
  };
  peerjs?: {
    host?: string;
    port?: number;
    path?: string;
    debug?: number;
  };
  transfer: {
    chunkSize: number;
    sendDelay: number;
    maxRetries: number;
    retryDelay: number;
    timeout: number;
  };
  signaling: {
    reconnectDelay: number;
    heartbeatInterval: number;
    maxReconnectAttempts: number;
  };
  features: {
    multipleFiles: boolean;
    encryption: boolean;
    compression: boolean;
    chat: boolean;
    clipboard: boolean;
  };
}

export interface SignalingMessage {
  type: 'register' | 'device-list' | 'offer' | 'answer' | 'ice-candidate' | 'heartbeat'
      | 'create-room' | 'join-room' | 'leave-room' | 'room-update' | 'update-member-status' | 'start-broadcast' | 'room-error'
      | 'update-room-files' | 'request-file' | 'file-request';
  deviceId?: string;
  deviceName?: string;
  devices?: Device[];
  target?: string;
  from?: string;
  data?: any;
  // 房间相关字段
  roomId?: string;
  room?: Room;
  error?: string;
  status?: 'waiting' | 'receiving' | 'completed' | 'failed';
  progress?: number;
  password?: string; // 房间密码（仅用于创建/加入房间时传输，永不存储在 Room 对象中）
  // 文件相关字段
  fileList?: FileMetadata[];
  fileIndex?: number;
  requesterId?: string; // 文件请求者的设备ID
}

export interface ChunkData {
  type: 'metadata' | 'chunk' | 'complete' | 'ack' | 'file-list' | 'file-selection' | 'start-file' | 'queue-complete';
  name?: string;
  size?: number;
  mimeType?: string;
  totalChunks?: number;
  index?: number;
  data?: ArrayBuffer;
  // ACK相关字段
  ackIndex?: number; // 确认的chunk索引
  // 多文件传输字段
  files?: FileMetadata[]; // 文件列表
  totalSize?: number; // 总大小
  selectedIndexes?: number[]; // 选中的文件索引
  fileIndex?: number; // 当前文件索引
  queueIndex?: number; // 队列中的索引
}

export type TransferDirection = 'send' | 'receive';
export type TransferStatus = 'idle' | 'connecting' | 'transferring' | 'completed' | 'error';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface EventMap {
  // Signaling events
  'signaling:connected': void;
  'signaling:disconnected': void;
  'signaling:error': { error: Error };
  'signaling:device-list': { devices: Device[] };
  'signaling:message': { message: SignalingMessage };

  // P2P events
  'p2p:initialized': { deviceId: string };
  'p2p:ready': { deviceId: string };
  'p2p:connection:open': { peer: string; direction: 'incoming' | 'outgoing' };
  'p2p:connection:close': { peer: string };
  'p2p:connection:error': { peer: string; error: Error };
  'p2p:connection:data': { peer: string; data: any };

  // Device events
  'device:list-updated': { devices: Device[] };
  'device:selected': { deviceId: string; device: Device };
  'device:selection-cleared': void;

  // Transfer events
  'transfer:file-selected': FileMetadata;
  'transfer:preparing': { direction: TransferDirection; file: FileMetadata };
  'transfer:started': { direction: TransferDirection; file: FileMetadata };
  'transfer:progress': TransferProgress;
  'transfer:broadcast-progress': { memberProgress: Record<string, number>; avgProgress: number };
  'transfer:completed': { direction: TransferDirection; duration: number; avgSpeed: number };
  'transfer:error': { error: Error; direction: TransferDirection };
  'transfer:cancelled': { direction: TransferDirection };
  'transfer:downloaded': { filename: string; size: number };
  'transfer:download-blocked': { reason: string };
  'transfer:download-started': { filename: string; streaming: boolean };

  // 文件队列事件
  'transfer:queue-updated': { queue: FileQueueItem[]; direction: 'send' | 'receive' | null };
  'transfer:file-list-received': { files: FileMetadata[]; totalSize: number };
  'transfer:file-item-started': { fileIndex: number; file: FileMetadata };
  'transfer:file-item-completed': { fileIndex: number; file: FileMetadata; blob?: Blob };
  'transfer:file-item-failed': { fileIndex: number; file: FileMetadata; error: Error };
  'transfer:queue-completed': { totalFiles: number; successCount: number; failedCount: number };

  // Room events
  'room:created': { room: Room };
  'room:joined': { room: Room };
  'room:left': void;
  'room:updated': { room: Room };
  'room:member-joined': { member: RoomMember };
  'room:member-left': { deviceId: string };
  'room:broadcast-started': { fileInfo: FileMetadata };
  'room:member-progress': { deviceId: string; progress: number };
  'room:error': { error: string };
  'room:file-request': { deviceId: string; fileIndex: number };
}

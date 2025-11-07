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
  type: 'register' | 'device-list' | 'offer' | 'answer' | 'ice-candidate' | 'heartbeat';
  deviceId?: string;
  deviceName?: string;
  devices?: Device[];
  target?: string;
  from?: string;
  data?: any;
}

export interface ChunkData {
  type: 'metadata' | 'chunk' | 'complete';
  name?: string;
  size?: number;
  mimeType?: string;
  totalChunks?: number;
  index?: number;
  data?: ArrayBuffer;
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
  'transfer:completed': { direction: TransferDirection; duration: number; avgSpeed: number };
  'transfer:error': { error: Error; direction: TransferDirection };
  'transfer:cancelled': { direction: TransferDirection };
  'transfer:downloaded': { filename: string; size: number };
}

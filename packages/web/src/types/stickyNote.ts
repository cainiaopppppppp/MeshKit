/**
 * 便签墙 - 类型定义
 */

export interface StickyNote {
  id: string;
  content: string;
  color: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface Room {
  id: string;
  name: string;
  isEncrypted: boolean;
  encryptionMethod?: 'AES-256-CBC' | 'AES-256-GCM' | 'TripleDES' | 'Rabbit' | 'RC4';
  createdAt: number;
  lastAccessed: number;
}

export interface UserInfo {
  id: string;
  name: string;
  color: string;
}

export interface RoomConfig {
  roomId: string;
  password?: string;
  enableEncryption: boolean;
  encryptionMethod?: 'AES-256-CBC' | 'AES-256-GCM' | 'TripleDES' | 'Rabbit' | 'RC4';
}

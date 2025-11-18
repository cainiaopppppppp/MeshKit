/**
 * 加密聊天相关类型定义 - 房间群聊模式
 */

import type { EncryptionMethod } from '../utils/ChatCrypto';

/**
 * 用户密钥对
 */
export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  publicKeyHex: string; // 公钥的十六进制表示，作为用户 ID
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string;
  userId: string; // 发送者的用户ID
  userName: string; // 发送者昵称
  content: string; // 消息内容（已解密）
  timestamp: number;
  selfDestruct?: number; // 阅后即焚时间（毫秒）
  color?: string; // 用户颜色（用于UI显示）
}

/**
 * 加密消息传输格式（P2P传输）
 */
export interface EncryptedMessage {
  type: 'encrypted_message';
  messageId: string;
  userId: string; // 发送者用户ID
  userName: string; // 发送者昵称
  encrypted: string; // 加密后的消息
  timestamp: number;
  selfDestruct?: number; // 阅后即焚时间（毫秒）
  color?: string; // 用户颜色
}

/**
 * 聊天室用户信息
 */
export interface ChatUser {
  id: string; // 用户ID
  name: string; // 昵称
  color: string; // 用户颜色
  publicKey: Uint8Array; // 公钥（兼容性保留，对称加密不使用）
  joinedAt: number;
}

/**
 * 聊天室配置
 */
export interface ChatRoomConfig {
  roomId: string;
  password?: string; // 房间密码（可选）
  enableEncryption: boolean; // 是否启用加密
  encryptionMethod: EncryptionMethod; // 加密算法
}

/**
 * 聊天室存储数据结构
 */
export interface ChatRoomStorage {
  roomId: string;
  keyPair: {
    publicKey: string; // Base64
    privateKey: string; // Base64
    publicKeyHex: string;
  };
  passwordHash?: string; // 房间密码哈希（如果设置了密码）
  encryptionMethod: EncryptionMethod; // 加密算法
  myName: string;
  myColor: string;
  messages: ChatMessage[];
  users: ChatUser[];
  createdAt: number;
  expiresAt: number; // 24小时后过期
}

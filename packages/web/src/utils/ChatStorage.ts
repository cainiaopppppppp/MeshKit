/**
 * 加密聊天存储服务 - 房间群聊模式
 * 使用 localStorage 存储聊天数据
 */

import { chatCrypto } from './ChatCrypto';
import {
  KeyPair,
  ChatMessage,
  ChatUser,
  ChatRoomStorage,
} from '../types/chat';

class ChatStorageManager {
  private readonly STORAGE_PREFIX = 'encrypted_chat_room_';
  private readonly DESTROYED_ROOM_PREFIX = 'encrypted_chat_destroyed_room_';
  private readonly USER_NAME_KEY = 'encrypted_chat_user_name';
  private readonly USER_COLOR_KEY = 'encrypted_chat_user_color';
  private readonly ROOM_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24小时

  /**
   * 初始化存储
   */
  async init(): Promise<void> {
    await chatCrypto.init();
    this.cleanupExpiredRooms();
    console.log('[ChatStorage] Initialized');
  }

  /**
   * 清理过期的房间
   */
  private cleanupExpiredRooms(): void {
    const now = Date.now();
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith(this.STORAGE_PREFIX)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const roomData: ChatRoomStorage = JSON.parse(data);
            if (roomData.expiresAt && roomData.expiresAt < now) {
              // 房间已过期，删除
              localStorage.removeItem(key);
              console.log('[ChatStorage] Cleaned up expired room:', roomData.roomId);
            }
          }
        } catch (error) {
          console.error('[ChatStorage] Failed to parse room data:', error);
        }
      }
    });

    keys.forEach((key) => {
      if (!key.startsWith(this.DESTROYED_ROOM_PREFIX)) {
        return;
      }

      const raw = localStorage.getItem(key);
      const destroyedAt = raw ? Number.parseInt(raw, 10) : Number.NaN;
      if (!Number.isFinite(destroyedAt) || now - destroyedAt > this.ROOM_EXPIRATION_TIME) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * 获取房间存储key
   */
  private getRoomKey(roomId: string): string {
    return `${this.STORAGE_PREFIX}${roomId}`;
  }

  private getDestroyedRoomKey(roomId: string): string {
    return `${this.DESTROYED_ROOM_PREFIX}${roomId}`;
  }

  isRoomDestroyed(roomId: string): boolean {
    const raw = localStorage.getItem(this.getDestroyedRoomKey(roomId));
    if (!raw) {
      return false;
    }

    const destroyedAt = Number.parseInt(raw, 10);
    if (!Number.isFinite(destroyedAt) || Date.now() - destroyedAt > this.ROOM_EXPIRATION_TIME) {
      localStorage.removeItem(this.getDestroyedRoomKey(roomId));
      return false;
    }

    return true;
  }

  clearDestroyedRoomMarker(roomId: string): void {
    localStorage.removeItem(this.getDestroyedRoomKey(roomId));
  }

  /**
   * 获取房间数据（不进行密码验证）
   */
  getRoom(roomId: string): ChatRoomStorage | null {
    if (this.isRoomDestroyed(roomId)) {
      return null;
    }

    const roomKey = this.getRoomKey(roomId);
    const existingData = localStorage.getItem(roomKey);
    if (existingData) {
      return JSON.parse(existingData);
    }
    return null;
  }

  /**
   * 创建或加入房间
   */
  createOrJoinRoom(roomId: string, name: string, color: string, password?: string, encryptionMethod?: string): ChatRoomStorage {
    if (this.isRoomDestroyed(roomId)) {
      throw new Error('这个房间已被销毁，无法再次进入。');
    }

    const roomKey = this.getRoomKey(roomId);
    const existingData = localStorage.getItem(roomKey);
    const now = Date.now();

    if (existingData) {
      // 加入现有房间
      const roomData: ChatRoomStorage = JSON.parse(existingData);

      // 兼容旧数据：如果没有 encryptionMethod，设置默认值
      if (!roomData.encryptionMethod) {
        roomData.encryptionMethod = 'AES-256-CBC';
        console.log('[ChatStorage] Migrated old room data to use AES-256-CBC encryption');
      }

      // 如果房间有密码保护，需要验证密码
      if (roomData.passwordHash) {
        if (!password) {
          throw new Error(`房间 ${roomId} 已存在并设置了密码保护。\n\n请勾选"启用密码保护"并输入正确的密码。\n\n如果忘记密码，可以清除浏览器数据或使用不同的房间码。`);
        }
        const inputPasswordHash = chatCrypto.hashPassword(password);
        if (inputPasswordHash !== roomData.passwordHash) {
          throw new Error(`密码错误！\n\n房间 ${roomId} 已存在并设置了密码保护。\n请输入正确的密码。\n\n如果忘记密码，可以清除浏览器数据或使用不同的房间码。`);
        }
      }

      // 更新用户信息
      roomData.myName = name;
      roomData.myColor = color;
      roomData.savedPassword = password || roomData.savedPassword;
      roomData.lastAccessed = now;

      localStorage.setItem(roomKey, JSON.stringify(roomData));
      console.log(`[ChatStorage] Joined existing room with encryption: ${roomData.encryptionMethod}`);
      return roomData;
    } else {
      // 创建新房间
      const keyPair = chatCrypto.generateKeyPair();

      const roomData: ChatRoomStorage = {
        roomId,
        keyPair: {
          publicKey: chatCrypto.toBase64(keyPair.publicKey),
          privateKey: chatCrypto.toBase64(keyPair.privateKey),
          publicKeyHex: keyPair.publicKeyHex,
        },
        ownerUserId: keyPair.publicKeyHex,
        ownerName: name,
        isOwner: true,
        passwordHash: password ? chatCrypto.hashPassword(password) : undefined,
        savedPassword: password || undefined,
        encryptionMethod: (encryptionMethod as any) || 'AES-256-CBC',
        myName: name,
        myColor: color,
        messages: [],
        users: [],
        createdAt: now,
        lastAccessed: now,
        expiresAt: now + this.ROOM_EXPIRATION_TIME,
      };

      localStorage.setItem(roomKey, JSON.stringify(roomData));
      console.log(`[ChatStorage] Created new room with encryption: ${roomData.encryptionMethod}`);
      return roomData;
    }
  }

  /**
   * 获取房间数据
   */
  getRoomData(roomId: string): ChatRoomStorage | null {
    if (this.isRoomDestroyed(roomId)) {
      localStorage.removeItem(this.getRoomKey(roomId));
      return null;
    }

    const roomKey = this.getRoomKey(roomId);
    const data = localStorage.getItem(roomKey);

    if (!data) return null;

    try {
      const roomData: ChatRoomStorage = JSON.parse(data);
      if (!roomData.lastAccessed) {
        roomData.lastAccessed = roomData.createdAt || Date.now();
      }

      // 检查是否过期
      if (roomData.expiresAt && roomData.expiresAt < Date.now()) {
        localStorage.removeItem(roomKey);
        return null;
      }

      return roomData;
    } catch (error) {
      console.error('[ChatStorage] Failed to parse room data:', error);
      return null;
    }
  }

  /**
   * 获取房间的密钥对
   */
  getRoomKeyPair(roomId: string): KeyPair | null {
    const roomData = this.getRoomData(roomId);
    if (!roomData) return null;

    return {
      publicKey: chatCrypto.fromBase64(roomData.keyPair.publicKey),
      privateKey: chatCrypto.fromBase64(roomData.keyPair.privateKey),
      publicKeyHex: roomData.keyPair.publicKeyHex,
    };
  }

  /**
   * 添加消息到房间
   */
  addMessage(roomId: string, message: ChatMessage): void {
    const roomData = this.getRoomData(roomId);
    if (!roomData) return;

    roomData.messages.push(message);
    roomData.lastAccessed = Date.now();

    const roomKey = this.getRoomKey(roomId);
    localStorage.setItem(roomKey, JSON.stringify(roomData));
  }

  /**
   * 获取房间消息
   */
  getMessages(roomId: string): ChatMessage[] {
    const roomData = this.getRoomData(roomId);
    return roomData?.messages || [];
  }

  /**
   * 删除消息（用于阅后即焚）
   */
  deleteMessage(roomId: string, messageId: string): void {
    const roomData = this.getRoomData(roomId);
    if (!roomData) return;

    roomData.messages = roomData.messages.filter(m => m.id !== messageId);
    roomData.lastAccessed = Date.now();

    const roomKey = this.getRoomKey(roomId);
    localStorage.setItem(roomKey, JSON.stringify(roomData));
  }

  /**
   * 更新房间用户列表
   */
  updateUsers(roomId: string, users: ChatUser[]): void {
    const roomData = this.getRoomData(roomId);
    if (!roomData) return;

    roomData.users = users;
    roomData.lastAccessed = Date.now();

    const roomKey = this.getRoomKey(roomId);
    localStorage.setItem(roomKey, JSON.stringify(roomData));
  }

  touchRoom(roomId: string): void {
    const roomData = this.getRoomData(roomId);
    if (!roomData) return;

    roomData.lastAccessed = Date.now();
    localStorage.setItem(this.getRoomKey(roomId), JSON.stringify(roomData));
  }

  updateRoomOwner(roomId: string, ownerUserId: string, ownerName?: string): void {
    const roomData = this.getRoomData(roomId);
    if (!roomData) return;

    roomData.ownerUserId = ownerUserId;
    roomData.ownerName = ownerName || roomData.ownerName;
    roomData.isOwner = roomData.keyPair.publicKeyHex === ownerUserId;
    roomData.lastAccessed = Date.now();

    localStorage.setItem(this.getRoomKey(roomId), JSON.stringify(roomData));
  }

  getRecentRooms(limit = 6): ChatRoomStorage[] {
    const now = Date.now();

    return Object.keys(localStorage)
      .filter((key) => key.startsWith(this.STORAGE_PREFIX))
      .map((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) {
            return null;
          }

          const roomData = JSON.parse(raw) as ChatRoomStorage;
          if (this.isRoomDestroyed(roomData.roomId)) {
            localStorage.removeItem(key);
            return null;
          }

          if (roomData.expiresAt && roomData.expiresAt < now) {
            localStorage.removeItem(key);
            return null;
          }

          return {
            ...roomData,
            isOwner: roomData.ownerUserId
              ? roomData.ownerUserId === roomData.keyPair.publicKeyHex
              : Boolean(roomData.isOwner),
            lastAccessed: roomData.lastAccessed || roomData.createdAt || now,
          } as ChatRoomStorage;
        } catch (error) {
          console.error('[ChatStorage] Failed to parse recent room data:', error);
          return null;
        }
      })
      .filter((room): room is ChatRoomStorage => Boolean(room))
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, limit);
  }

  /**
   * 获取房间用户列表
   */
  getUsers(roomId: string): ChatUser[] {
    const roomData = this.getRoomData(roomId);
    return roomData?.users || [];
  }

  /**
   * 销毁房间（无痕删除）
   */
  clearRoomData(roomId: string): void {
    const roomKey = this.getRoomKey(roomId);
    localStorage.removeItem(roomKey);
  }

  destroyRoom(roomId: string, destroyedAt = Date.now()): void {
    localStorage.setItem(this.getDestroyedRoomKey(roomId), String(destroyedAt));
    this.clearRoomData(roomId);
    console.log('[ChatStorage] Room destroyed:', roomId);
  }

  /**
   * 获取或创建用户名
   */
  getOrCreateUserName(): string {
    const saved = localStorage.getItem(this.USER_NAME_KEY);
    if (saved) return saved;

    const randomName = `用户${Math.random().toString(36).substring(2, 6)}`;
    localStorage.setItem(this.USER_NAME_KEY, randomName);
    return randomName;
  }

  /**
   * 保存用户名
   */
  saveUserName(name: string): void {
    localStorage.setItem(this.USER_NAME_KEY, name);
  }

  /**
   * 获取或创建用户颜色
   */
  getOrCreateUserColor(): string {
    const saved = localStorage.getItem(this.USER_COLOR_KEY);
    if (saved) return saved;

    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    localStorage.setItem(this.USER_COLOR_KEY, randomColor);
    return randomColor;
  }

  /**
   * 保存用户颜色
   */
  saveUserColor(color: string): void {
    localStorage.setItem(this.USER_COLOR_KEY, color);
  }

  /**
   * 获取房间剩余时间（毫秒）
   */
  getRoomRemainingTime(roomId: string): number | null {
    const roomData = this.getRoomData(roomId);
    if (!roomData) return null;

    const remaining = roomData.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }
}

// 导出单例
export const chatStorage = new ChatStorageManager();

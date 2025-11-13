/**
 * 加密聊天室 - 房间群聊模式
 * 使用 Yjs + WebRTC 实现 P2P 端到端加密的多人聊天
 * 使用 crypto-js 进行对称加密（和便利墙一样）
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { eventBus } from '@meshkit/core';
import { chatCrypto, type EncryptionMethod } from '../utils/ChatCrypto';
import { chatStorage } from '../utils/ChatStorage';
import {
  KeyPair,
  ChatMessage,
  ChatUser,
  EncryptedMessage,
  ChatRoomConfig,
} from '../types/chat';

export class ChatRoom {
  private roomId: string = '';
  private myKeyPair: KeyPair | null = null;
  private myName: string = '';
  private myColor: string = '';
  private myUserId: string = '';
  private roomPassword: string = ''; // 房间密码（用于加密）
  private encryptionMethod: EncryptionMethod = 'AES-256-CBC'; // 加密算法

  // Yjs 文档和 Provider
  private ydoc: Y.Doc | null = null;
  private provider: WebrtcProvider | null = null;
  private yMessages: Y.Array<any> | null = null;
  private yUsers: Y.Map<any> | null = null;
  private yRoomAuth: Y.Map<any> | null = null; // 房间密码验证

  // 回调函数
  private onMessageReceived?: (message: ChatMessage) => void;
  private onUserJoined?: (user: ChatUser) => void;
  // @ts-expect-error - TODO: Implement user leave detection via WebRTC peer events
  private onUserLeft?: (userId: string) => void;
  private onUsersChanged?: (users: ChatUser[], totalCount: number) => void; // 用户列表变化（包括自己）
  private onConnectionChange?: (connected: boolean) => void;
  private onRoomExpiring?: (remainingTime: number) => void;
  private onRoomDestroyed?: () => void;

  // 自毁消息定时器
  private selfDestructTimers: Map<string, NodeJS.Timeout> = new Map();

  // 房间过期检查定时器
  private expirationCheckInterval: NodeJS.Timeout | null = null;

  /**
   * 初始化并加入房间
   */
  async joinRoom(
    config: ChatRoomConfig,
    name: string,
    color: string,
    callbacks?: {
      onMessageReceived?: (message: ChatMessage) => void;
      onUserJoined?: (user: ChatUser) => void;
      onUserLeft?: (userId: string) => void;
      onUsersChanged?: (users: ChatUser[], totalCount: number) => void;
      onConnectionChange?: (connected: boolean) => void;
      onRoomExpiring?: (remainingTime: number) => void;
      onRoomDestroyed?: () => void;
    }
  ): Promise<void> {
    // 初始化加密
    await chatCrypto.init();
    await chatStorage.init();

    this.roomId = config.roomId;
    this.myName = name;
    this.myColor = color;
    this.roomPassword = config.password || '';
    this.encryptionMethod = config.encryptionMethod;

    // 保存用户偏好
    chatStorage.saveUserName(name);
    chatStorage.saveUserColor(color);

    // 创建或加入房间（带密码验证）
    const roomData = chatStorage.createOrJoinRoom(
      this.roomId,
      name,
      color,
      config.password,
      config.encryptionMethod
    );
    this.myKeyPair = {
      publicKey: chatCrypto.fromBase64(roomData.keyPair.publicKey),
      privateKey: chatCrypto.fromBase64(roomData.keyPair.privateKey),
      publicKeyHex: roomData.keyPair.publicKeyHex,
    };
    this.myUserId = this.myKeyPair.publicKeyHex;

    // 使用已有房间的加密算法（如果加入已有房间）
    this.encryptionMethod = roomData.encryptionMethod;

    // 如果没有密码，使用房间ID作为密码（弱加密，但总比明文好）
    if (!this.roomPassword) {
      this.roomPassword = this.roomId;
      console.log('[ChatRoom] Using room ID as password (weak encryption)');
    }

    console.log(`[ChatRoom] Using encryption method: ${this.encryptionMethod}`);

    // 设置回调
    if (callbacks) {
      this.onMessageReceived = callbacks.onMessageReceived;
      this.onUserJoined = callbacks.onUserJoined;
      this.onUserLeft = callbacks.onUserLeft;
      this.onUsersChanged = callbacks.onUsersChanged;
      this.onConnectionChange = callbacks.onConnectionChange;
      this.onRoomExpiring = callbacks.onRoomExpiring;
      this.onRoomDestroyed = callbacks.onRoomDestroyed;
    }

    // 创建 Yjs 文档
    this.ydoc = new Y.Doc();

    // 创建 WebRTC Provider（使用本地信令服务器）
    const localIP = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
    const signalingUrl = `ws://${localIP}:7000/ws`;

    console.log('[ChatRoom] Using signaling server:', signalingUrl);

    this.provider = new WebrtcProvider(this.roomId, this.ydoc, {
      signaling: [signalingUrl],
      maxConns: 20,
      filterBcConns: false,
    });

    // 获取共享数据结构
    this.yMessages = this.ydoc.getArray('messages');
    this.yUsers = this.ydoc.getMap('users');
    this.yRoomAuth = this.ydoc.getMap('roomAuth');

    // 等待初始同步完成（最多等待 2 秒）
    // 等待 Yjs 文档从其他 peers 获取数据
    console.log('[ChatRoom] Waiting for initial sync...');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[ChatRoom] Sync wait completed (timeout)');
        resolve();
      }, 2000);

      // 监听 ydoc 的 update 事件（表示接收到远程数据）
      let receivedUpdate = false;
      const updateHandler = () => {
        if (!receivedUpdate) {
          receivedUpdate = true;
          console.log('[ChatRoom] Received initial data from peers');
          clearTimeout(timeout);
          // 等待额外 200ms 确保所有数据都接收到
          setTimeout(() => resolve(), 200);
        }
      };

      this.ydoc?.on('update', updateHandler);

      // 如果没有其他 peers，立即继续
      setTimeout(() => {
        const peersCount = this.provider?.awareness?.states?.size || 0;
        if (peersCount <= 1 && !receivedUpdate) {
          console.log('[ChatRoom] No other peers detected, continuing immediately');
          this.ydoc?.off('update', updateHandler);
          clearTimeout(timeout);
          resolve();
        }
      }, 500);
    });

    // 密码验证：检查房间是否已有密码验证令牌
    const existingAuthToken = this.yRoomAuth.get('token') as string | undefined;
    const existingMethod = this.yRoomAuth.get('method') as EncryptionMethod | undefined;

    console.log('[ChatRoom] Auth token exists:', !!existingAuthToken, 'Password provided:', !!config.password);

    if (existingAuthToken && existingMethod) {
      // 房间已存在密码令牌，必须验证密码
      if (!config.password) {
        await this.leaveRoom();
        throw new Error(`房间已设置密码保护！\n\n请勾选"启用密码保护"并输入正确的密码。`);
      }

      try {
        const decrypted = chatCrypto.decrypt(existingAuthToken, this.roomPassword, existingMethod);
        if (decrypted !== 'ROOM_AUTH_TOKEN') {
          throw new Error('Invalid auth token');
        }
        console.log('[ChatRoom] Password verified successfully');
        // 使用房间已有的加密方法
        this.encryptionMethod = existingMethod;
      } catch (error) {
        console.error('[ChatRoom] Password verification failed:', error);
        // 密码错误，断开连接
        await this.leaveRoom();
        throw new Error(`密码错误！\n\n房间已存在，请输入正确的密码。`);
      }
    } else if (config.password) {
      // 房间不存在验证令牌，且用户设置了密码，创建验证令牌
      try {
        const authToken = chatCrypto.encrypt('ROOM_AUTH_TOKEN', this.roomPassword, this.encryptionMethod);
        this.yRoomAuth.set('token', authToken);
        this.yRoomAuth.set('method', this.encryptionMethod);
        console.log('[ChatRoom] Created password verification token');
      } catch (error) {
        console.error('[ChatRoom] Failed to create auth token:', error);
        await this.leaveRoom();
        throw new Error('创建密码验证令牌失败');
      }
    } else {
      // 房间没有密码令牌，用户也没输入密码
      // 检查本地 localStorage 是否要求密码（兼容旧数据）
      const localRoomData = chatStorage.getRoom(this.roomId);
      if (localRoomData?.passwordHash) {
        await this.leaveRoom();
        throw new Error(`本地房间数据需要密码！\n\n请勾选"启用密码保护"并输入密码。`);
      }
      console.log('[ChatRoom] No password protection for this room');
    }

    // 添加当前用户
    this.yUsers.set(this.myUserId, {
      id: this.myUserId,
      name: this.myName,
      color: this.myColor,
      joinedAt: Date.now(),
    });

    // 监听消息变化
    this.yMessages.observe((event) => {
      event.changes.added.forEach((item) => {
        item.content.getContent().forEach((msg: any) => {
          this.handleIncomingMessage(msg);
        });
      });
    });

    // 监听用户变化
    this.yUsers.observe(() => {
      this.handleUsersChange();
    });

    // 监听连接状态
    this.provider.on('status', (event: any) => {
      console.log('[ChatRoom] Connection status:', event);
      if (this.onConnectionChange) {
        this.onConnectionChange(event.status === 'connected');
      }
    });

    this.provider.on('peers', (event: any) => {
      console.log('[ChatRoom] Peers changed:', event);
      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }
    });

    // 开始房间过期检查
    this.startExpirationCheck();

    // 加载历史消息并设置自毁定时器
    const history = chatStorage.getMessages(this.roomId);
    const now = Date.now();

    // 过滤并清理已过期的消息
    const expiredMessageIds: string[] = [];
    history.forEach((msg) => {
      if (msg.selfDestruct) {
        const elapsed = now - msg.timestamp;
        const remaining = msg.selfDestruct - elapsed;

        if (remaining > 0) {
          // 消息未过期，设置剩余时间的定时器
          this.scheduleSelfDestruct(msg.id, remaining);
        } else {
          // 消息已过期，记录ID待删除
          expiredMessageIds.push(msg.id);
        }
      }
    });

    // 删除已过期的消息
    expiredMessageIds.forEach(msgId => {
      chatStorage.deleteMessage(this.roomId, msgId);
    });

    if (expiredMessageIds.length > 0) {
      console.log(`[ChatRoom] Cleaned up ${expiredMessageIds.length} expired messages`);
    }

    console.log('[ChatRoom] Joined room:', this.roomId);
    console.log('[ChatRoom] My User ID:', this.myUserId);
  }

  /**
   * 处理接收到的消息
   */
  private handleIncomingMessage(data: any): void {
    if (!this.roomPassword) return;

    // 跳过自己发送的消息（已经在本地添加了）
    if (data.userId === this.myUserId) return;

    try {
      // 这是加密消息
      if (data.type === 'encrypted_message') {
        const encryptedMsg = data as EncryptedMessage;

        // 检查消息是否已过期（阅后即焚）
        if (encryptedMsg.selfDestruct) {
          const elapsed = Date.now() - encryptedMsg.timestamp;
          if (elapsed >= encryptedMsg.selfDestruct) {
            console.log('[ChatRoom] Message already expired, skipping:', encryptedMsg.messageId);
            return; // 消息已过期，不显示
          }
        }

        // 使用密码解密消息（群聊）
        let decryptedContent: string;
        try {
          decryptedContent = chatCrypto.decrypt(
            encryptedMsg.encrypted,
            this.roomPassword,
            this.encryptionMethod
          );
        } catch (decryptError) {
          console.warn('[ChatRoom] Failed to decrypt message, skipping (may be old encryption format):', decryptError);
          return; // 跳过无法解密的旧格式消息
        }

        // 创建消息对象
        const message: ChatMessage = {
          id: encryptedMsg.messageId,
          userId: encryptedMsg.userId,
          userName: encryptedMsg.userName,
          content: decryptedContent,
          timestamp: encryptedMsg.timestamp,
          selfDestruct: encryptedMsg.selfDestruct,
          color: encryptedMsg.color,
        };

        // 保存到本地存储
        chatStorage.addMessage(this.roomId, message);

        // 触发回调
        if (this.onMessageReceived) {
          this.onMessageReceived(message);
        }

        // 设置自毁定时器（剩余时间）
        if (message.selfDestruct) {
          const elapsed = Date.now() - message.timestamp;
          const remaining = message.selfDestruct - elapsed;
          if (remaining > 0) {
            this.scheduleSelfDestruct(message.id, remaining);
          }
        }

        console.log('[ChatRoom] Received message from:', encryptedMsg.userName);
      }
    } catch (error) {
      console.error('[ChatRoom] Failed to handle incoming message:', error);
    }
  }

  /**
   * 处理用户列表变化
   */
  private handleUsersChange(): void {
    if (!this.yUsers) return;

    const users: ChatUser[] = [];
    this.yUsers.forEach((userData, userId) => {
      // 跳过自己
      if (userId === this.myUserId) return;

      try {
        users.push({
          id: userId,
          name: userData.name,
          color: userData.color,
          publicKey: chatCrypto.hexToBytes(userId), // 兼容性保留，不实际使用
          joinedAt: userData.joinedAt,
        });
      } catch (error) {
        console.error('[ChatRoom] Failed to parse user:', error);
      }
    });

    // 更新本地存储
    chatStorage.updateUsers(this.roomId, users);

    // 触发新的回调：传递完整用户列表和总人数（包括自己）
    if (this.onUsersChanged) {
      const totalCount = users.length + 1; // +1 包括自己
      this.onUsersChanged(users, totalCount);
    }

    // 保留旧的回调以兼容性（逐个通知新用户加入）
    users.forEach((user) => {
      if (this.onUserJoined) {
        this.onUserJoined(user);
      }
    });
  }

  /**
   * 发送消息
   */
  async sendMessage(content: string, selfDestruct?: number): Promise<ChatMessage> {
    if (!this.myKeyPair) {
      throw new Error('Key pair not initialized');
    }

    if (!this.yMessages) {
      throw new Error('Chat room not initialized');
    }

    if (!this.roomPassword) {
      throw new Error('Room password not initialized');
    }

    try {
      // 创建消息ID
      const messageId = chatCrypto.generateRandomId();
      const timestamp = Date.now();

      // 使用密码加密消息（群聊）
      const encrypted = chatCrypto.encrypt(content, this.roomPassword, this.encryptionMethod);

      const encryptedMsg: EncryptedMessage = {
        type: 'encrypted_message',
        messageId,
        userId: this.myUserId,
        userName: this.myName,
        encrypted,
        timestamp,
        selfDestruct,
        color: this.myColor,
      };

      // 通过 Yjs 广播消息
      this.yMessages.push([encryptedMsg]);

      // 创建本地消息
      const message: ChatMessage = {
        id: messageId,
        userId: this.myUserId,
        userName: this.myName,
        content,
        timestamp,
        selfDestruct,
        color: this.myColor,
      };

      // 保存到本地存储
      chatStorage.addMessage(this.roomId, message);

      // 设置自毁定时器
      if (selfDestruct) {
        this.scheduleSelfDestruct(messageId, selfDestruct);
      }

      console.log('[ChatRoom] Message sent and broadcasted');

      return message;
    } catch (error) {
      console.error('[ChatRoom] Failed to send message:', error);
      throw new Error('Failed to send message');
    }
  }

  /**
   * 安排消息自毁
   */
  private scheduleSelfDestruct(messageId: string, delay: number): void {
    // 清除已存在的定时器
    if (this.selfDestructTimers.has(messageId)) {
      clearTimeout(this.selfDestructTimers.get(messageId)!);
    }

    // 设置新定时器
    const timer = setTimeout(() => {
      chatStorage.deleteMessage(this.roomId, messageId);
      this.selfDestructTimers.delete(messageId);
      console.log('[ChatRoom] Message self-destructed:', messageId);

      // 触发消息删除事件
      eventBus.emit('chat:message:deleted', { contactId: this.roomId, messageId });
    }, delay);

    this.selfDestructTimers.set(messageId, timer);
  }

  /**
   * 开始房间过期检查
   */
  private startExpirationCheck(): void {
    // 每分钟检查一次
    this.expirationCheckInterval = setInterval(() => {
      const remaining = chatStorage.getRoomRemainingTime(this.roomId);

      if (remaining === null) {
        // 房间不存在或已过期
        this.handleRoomExpired();
        return;
      }

      if (remaining === 0) {
        // 房间已过期
        this.handleRoomExpired();
        return;
      }

      // 提醒房间即将过期（小于1小时时提醒）
      if (remaining < 60 * 60 * 1000 && this.onRoomExpiring) {
        this.onRoomExpiring(remaining);
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 处理房间过期
   */
  private handleRoomExpired(): void {
    console.log('[ChatRoom] Room expired');

    // 清除定时器
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
      this.expirationCheckInterval = null;
    }

    // 销毁房间
    chatStorage.destroyRoom(this.roomId);

    // 触发回调
    if (this.onRoomDestroyed) {
      this.onRoomDestroyed();
    }
  }

  /**
   * 获取我的用户ID
   */
  getMyUserId(): string {
    return this.myUserId;
  }

  /**
   * 获取我的名称
   */
  getMyName(): string {
    return this.myName;
  }

  /**
   * 获取房间 ID
   */
  getRoomId(): string {
    return this.roomId;
  }

  /**
   * 获取房间消息（自动过滤并删除已过期消息）
   */
  getMessages(): ChatMessage[] {
    const messages = chatStorage.getMessages(this.roomId);
    const now = Date.now();

    // 过滤掉已过期的消息，并真正删除
    const expiredMessageIds: string[] = [];
    const validMessages = messages.filter(msg => {
      if (msg.selfDestruct) {
        const elapsed = now - msg.timestamp;
        if (elapsed >= msg.selfDestruct) {
          expiredMessageIds.push(msg.id);
          return false; // 过期，不显示
        }
      }
      return true; // 未过期或无自毁时间，保留
    });

    // 真正删除已过期的消息
    if (expiredMessageIds.length > 0) {
      expiredMessageIds.forEach(msgId => {
        chatStorage.deleteMessage(this.roomId, msgId);
      });
      console.log(`[ChatRoom] Cleaned up ${expiredMessageIds.length} expired messages from storage`);
    }

    return validMessages;
  }

  /**
   * 获取房间用户列表
   */
  getUsers(): ChatUser[] {
    return chatStorage.getUsers(this.roomId);
  }

  /**
   * 获取房间剩余时间
   */
  getRemainingTime(): number | null {
    return chatStorage.getRoomRemainingTime(this.roomId);
  }

  /**
   * 离开房间
   */
  async leaveRoom(): Promise<void> {
    // 清除所有自毁定时器
    this.selfDestructTimers.forEach((timer) => clearTimeout(timer));
    this.selfDestructTimers.clear();

    // 清除过期检查定时器
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
      this.expirationCheckInterval = null;
    }

    // 从用户列表中移除自己
    if (this.yUsers && this.myUserId) {
      this.yUsers.delete(this.myUserId);
    }

    // 断开 WebRTC 连接
    if (this.provider) {
      this.provider.disconnect();
      this.provider.destroy();
      this.provider = null;
    }

    // 销毁 Yjs 文档
    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }

    this.roomId = '';
    this.yMessages = null;
    this.yUsers = null;
    this.yRoomAuth = null;

    console.log('[ChatRoom] Left room');
  }

  /**
   * 销毁房间（主动销毁，无痕删除）
   */
  async destroyRoom(): Promise<void> {
    chatStorage.destroyRoom(this.roomId);
    await this.leaveRoom();
    console.log('[ChatRoom] Room destroyed');
  }
}

// 导出单例
export const chatRoom = new ChatRoom();

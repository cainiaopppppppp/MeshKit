/**
 * 便签墙 - P2P 房间管理 (基于 Yjs + WebRTC)
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import type { StickyNote, UserInfo, RoomConfig } from '../types/stickyNote';
import { encryptionHelper, type EncryptionMethod } from '../utils/Encryption';

export class StickyNotesRoom {
  private ydoc: Y.Doc | null = null;
  private provider: WebrtcProvider | null = null;
  private yNotes: Y.Map<any> | null = null;
  private yUsers: Y.Map<any> | null = null;
  private yMeta: Y.Map<any> | null = null; // 房间元数据
  private roomId: string = '';
  private userId: string = '';
  private userName: string = '';
  private userColor: string = '';
  private password: string = '';
  private enableEncryption: boolean = false;
  private encryptionMethod: EncryptionMethod = 'AES-256-CBC';
  private isPasswordVerified: boolean = false;
  private expirationCheckInterval: NodeJS.Timeout | null = null;

  // 房间有效期配置（24小时，单位：毫秒）
  private static readonly ROOM_EXPIRATION_TIME = 24 * 60 * 60 * 1000;

  // 回调函数
  private onNotesChange?: (notes: StickyNote[]) => void;
  private onUsersChange?: (users: UserInfo[]) => void;
  private onConnectionChange?: (connected: boolean, peerCount: number) => void;
  private onRoomDestroyed?: () => void;
  private onRoomExpiring?: (remainingTime: number) => void;

  /**
   * 创建或加入房间
   */
  async joinRoom(config: RoomConfig, callbacks?: {
    onNotesChange?: (notes: StickyNote[]) => void;
    onUsersChange?: (users: UserInfo[]) => void;
    onConnectionChange?: (connected: boolean, peerCount: number) => void;
    onRoomDestroyed?: () => void;
    onRoomExpiring?: (remainingTime: number) => void;
  }) {
    this.roomId = config.roomId;
    this.password = config.password || '';
    this.enableEncryption = config.enableEncryption;
    this.encryptionMethod = config.encryptionMethod || 'AES-256-CBC';

    // 生成用户信息
    this.userId = this.generateUserId();
    this.userName = this.generateUserName();
    this.userColor = encryptionHelper.generateRandomColor();

    // 设置回调
    if (callbacks) {
      this.onNotesChange = callbacks.onNotesChange;
      this.onUsersChange = callbacks.onUsersChange;
      this.onConnectionChange = callbacks.onConnectionChange;
      this.onRoomDestroyed = callbacks.onRoomDestroyed;
      this.onRoomExpiring = callbacks.onRoomExpiring;
    }

    // 创建 Yjs 文档
    this.ydoc = new Y.Doc();

    // 创建 WebRTC Provider
    // 使用本地信令服务器
    try {
      // 获取本地 IP 地址（从现有的 P2P 配置中）
      const localIP = window.location.hostname === 'localhost' ? 'localhost' : '10.201.153.15';
      const signalingUrl = `ws://${localIP}:7000/ws`;

      console.log('[StickyNotesRoom] Using local signaling server:', signalingUrl);

      this.provider = new WebrtcProvider(this.roomId, this.ydoc, {
        signaling: [signalingUrl],
        maxConns: 20,
        filterBcConns: false,
      });
    } catch (error) {
      console.error('[StickyNotesRoom] Failed to create WebRTC provider:', error);
      throw new Error('无法创建 P2P 连接，请确保信令服务器正在运行 (端口 7000)');
    }

    // 获取共享数据结构
    this.yNotes = this.ydoc.getMap('notes');
    this.yUsers = this.ydoc.getMap('users');
    this.yMeta = this.ydoc.getMap('meta');

    // 等待初始同步完成（最多等待 2 秒）
    // 等待 Yjs 文档从其他 peers 获取数据
    console.log('[StickyNotesRoom] Waiting for initial sync...');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[StickyNotesRoom] Sync wait completed (timeout)');
        resolve();
      }, 2000);

      // 监听 ydoc 的 update 事件（表示接收到远程数据）
      let receivedUpdate = false;
      const updateHandler = () => {
        if (!receivedUpdate) {
          receivedUpdate = true;
          console.log('[StickyNotesRoom] Received initial data from peers');
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
          console.log('[StickyNotesRoom] No other peers detected, continuing immediately');
          this.ydoc?.off('update', updateHandler);
          clearTimeout(timeout);
          resolve();
        }
      }, 500);
    });

    // 处理加密房间的密码验证（在添加用户之前）
    // 必须先检查房间是否已是加密房间
    await this.handlePasswordVerification();

    // 密码验证通过后，添加当前用户
    this.yUsers.set(this.userId, {
      id: this.userId,
      name: this.userName,
      color: this.userColor,
    });

    // 监听房间元数据变化
    this.yMeta.observe(() => {
      const isDestroyed = this.yMeta?.get('destroyed');
      if (isDestroyed && this.onRoomDestroyed) {
        this.onRoomDestroyed();
      }
    });

    // 监听便签变化
    this.yNotes.observe(() => {
      this.handleNotesChange();
    });

    // 监听用户变化
    this.yUsers.observe(() => {
      this.handleUsersChange();
    });

    // 监听连接状态
    this.provider.on('status', (event: any) => {
      console.log('[StickyNotesRoom] Connection status:', event);
      if (this.onConnectionChange) {
        this.onConnectionChange(
          event.status === 'connected',
          this.provider?.room?.webrtcConns?.size || 0
        );
      }
    });

    this.provider.on('peers', (event: any) => {
      console.log('[StickyNotesRoom] Peers changed:', event);
      if (this.onConnectionChange) {
        // peers 数量 = WebRTC 连接数 + 1 (自己)
        const peerCount = (this.provider?.room?.webrtcConns?.size || 0) + 1;
        this.onConnectionChange(true, peerCount);
      }
    });

    // 从本地加载便签
    await this.loadLocalNotes();

    // 初始化房间过期检查
    await this.initializeRoomExpiration();

    console.log('[StickyNotesRoom] Joined room:', this.roomId);
  }

  /**
   * 离开房间
   */
  async leaveRoom() {
    // 移除当前用户
    if (this.yUsers && this.userId) {
      this.yUsers.delete(this.userId);
    }

    // 保存到本地
    await this.saveToLocal();

    // 清理过期检查定时器
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
      this.expirationCheckInterval = null;
    }

    // 销毁连接
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }

    console.log('[StickyNotesRoom] Left room:', this.roomId);
  }

  /**
   * 添加便签
   */
  async addNote(note: Omit<StickyNote, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) {
    if (!this.yNotes) return;

    const newNote: StickyNote = {
      ...note,
      id: this.generateNoteId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: this.userId,
    };

    // 如果启用加密，加密便签内容
    if (this.enableEncryption && this.password && newNote.content) {
      try {
        newNote.content = await encryptionHelper.encrypt(
          newNote.content,
          this.password,
          this.encryptionMethod
        );
      } catch (error) {
        console.error('[StickyNotesRoom] Failed to encrypt note:', error);
        throw new Error('加密便签失败');
      }
    }

    this.yNotes.set(newNote.id, newNote);
  }

  /**
   * 更新便签
   */
  async updateNote(noteId: string, updates: Partial<StickyNote>) {
    if (!this.yNotes || !this.ydoc) return;

    const note = this.yNotes.get(noteId);
    if (!note) return;

    // 如果启用加密且更新了内容，加密新内容
    if (this.enableEncryption && this.password && updates.content) {
      try {
        updates.content = await encryptionHelper.encrypt(
          updates.content,
          this.password,
          this.encryptionMethod
        );
      } catch (error) {
        console.error('[StickyNotesRoom] Failed to encrypt note update:', error);
        throw new Error('加密便签失败');
      }
    }

    // 使用 Yjs transaction 确保原子更新
    this.ydoc.transact(() => {
      const updatedNote = {
        ...note,
        ...updates,
        updatedAt: Date.now(),
      };

      this.yNotes!.set(noteId, updatedNote);
    });
  }

  /**
   * 删除便签
   */
  deleteNote(noteId: string) {
    if (!this.yNotes) return;
    this.yNotes.delete(noteId);
  }

  /**
   * 处理密码验证
   */
  private async handlePasswordVerification() {
    if (!this.yMeta) return;

    const existingToken = this.yMeta.get('passwordVerificationToken');
    const existingMethod = this.yMeta.get('encryptionMethod') as EncryptionMethod | undefined;

    console.log('[StickyNotesRoom] Auth token exists:', !!existingToken, 'Password provided:', !!this.password);

    if (existingToken && existingMethod) {
      // 房间已存在验证token，说明这是一个加密房间
      console.log('[StickyNotesRoom] Detected encrypted room, verifying password...');

      // 房间已设置密码，用户必须提供密码
      if (!this.password) {
        // 用户没有输入密码，拒绝加入
        await this.leaveRoom();
        throw new Error('房间已设置密码保护！\n\n请勾选"启用端到端加密"并输入正确的密码。');
      }

      // 验证密码
      this.isPasswordVerified = await encryptionHelper.verifyPassword(
        existingToken,
        this.password,
        existingMethod
      );

      if (!this.isPasswordVerified) {
        // 密码验证失败，拒绝加入
        console.error('[StickyNotesRoom] Password verification failed!');
        await this.leaveRoom();
        throw new Error('密码错误！\n\n房间已存在，请输入正确的密码。');
      }

      console.log('[StickyNotesRoom] Password verified successfully');

      // 更新为房间的加密设置
      this.enableEncryption = true;
      this.encryptionMethod = existingMethod;
    } else if (this.enableEncryption && this.password) {
      // 新房间且用户启用了加密，创建验证token
      console.log('[StickyNotesRoom] Creating password verification token...');
      try {
        const token = await encryptionHelper.createVerificationToken(
          this.password,
          this.encryptionMethod
        );
        this.yMeta.set('passwordVerificationToken', token);
        this.yMeta.set('encryptionMethod', this.encryptionMethod);
        this.isPasswordVerified = true;
        console.log('[StickyNotesRoom] Password verification token created');
      } catch (error) {
        console.error('[StickyNotesRoom] Failed to create auth token:', error);
        await this.leaveRoom();
        throw new Error('创建密码验证令牌失败');
      }
    } else {
      // 非加密房间
      this.isPasswordVerified = true;
      console.log('[StickyNotesRoom] No password protection for this room');
    }
  }

  /**
   * 初始化房间过期检查
   */
  private async initializeRoomExpiration() {
    if (!this.yMeta) return;

    // 检查房间是否已有创建时间
    const existingCreatedAt = this.yMeta.get('createdAt');

    if (!existingCreatedAt) {
      // 新房间，记录创建时间
      const now = Date.now();
      this.yMeta.set('createdAt', now);
      console.log('[StickyNotesRoom] Room created at:', new Date(now).toISOString());
    } else {
      console.log('[StickyNotesRoom] Existing room created at:', new Date(existingCreatedAt).toISOString());
    }

    // 启动过期检查定时器（每分钟检查一次）
    this.expirationCheckInterval = setInterval(() => {
      this.checkRoomExpiration();
    }, 60 * 1000);

    // 立即检查一次
    this.checkRoomExpiration();
  }

  /**
   * 检查房间是否过期
   */
  private checkRoomExpiration() {
    if (!this.yMeta) return;

    const createdAt = this.yMeta.get('createdAt');
    if (!createdAt) return;

    const now = Date.now();
    const elapsed = now - createdAt;
    const remaining = StickyNotesRoom.ROOM_EXPIRATION_TIME - elapsed;

    if (remaining <= 0) {
      // 房间已过期，自动销毁
      console.log('[StickyNotesRoom] Room has expired, auto-destroying...');
      this.destroyRoom().catch(err => {
        console.error('[StickyNotesRoom] Failed to auto-destroy expired room:', err);
      });
    } else {
      // 通知剩余时间
      if (this.onRoomExpiring) {
        this.onRoomExpiring(remaining);
      }
    }
  }

  /**
   * 销毁房间
   * @param verifyPassword 用于二次验证的密码（加密房间必需）
   */
  async destroyRoom(verifyPassword?: string) {
    if (!this.yNotes || !this.yMeta || !this.ydoc) return;

    // 检查是否是加密房间
    const existingToken = this.yMeta.get('passwordVerificationToken');
    const existingMethod = this.yMeta.get('encryptionMethod') as EncryptionMethod | undefined;

    if (existingToken && existingMethod) {
      // 这是加密房间，必须验证密码
      if (!verifyPassword) {
        throw new Error('这是加密房间，需要输入密码才能销毁');
      }

      // 验证密码
      const isValid = await encryptionHelper.verifyPassword(
        existingToken,
        verifyPassword,
        existingMethod
      );

      if (!isValid) {
        throw new Error('密码错误，无法销毁房间');
      }
    }

    // 使用 Yjs transaction 确保原子操作
    this.ydoc.transact(() => {
      // 删除所有便签
      const noteIds: string[] = [];
      this.yNotes!.forEach((_, key) => {
        noteIds.push(key);
      });
      noteIds.forEach(id => {
        this.yNotes!.delete(id);
      });

      // 设置房间销毁标记
      this.yMeta!.set('destroyed', true);
      this.yMeta!.set('destroyedAt', Date.now());
    });
  }

  /**
   * 获取所有便签
   */
  async getAllNotes(): Promise<StickyNote[]> {
    if (!this.yNotes) return [];

    const notes: StickyNote[] = [];
    this.yNotes.forEach((note) => {
      notes.push(note);
    });

    // 如果启用加密，解密所有便签内容
    if (this.enableEncryption && this.password) {
      return await this.decryptNotes(notes);
    }

    return notes;
  }

  /**
   * 获取所有在线用户
   */
  getAllUsers(): UserInfo[] {
    if (!this.yUsers) return [];

    const users: UserInfo[] = [];
    this.yUsers.forEach((user) => {
      users.push(user);
    });

    return users;
  }

  /**
   * 解密便签列表
   */
  private async decryptNotes(notes: StickyNote[]): Promise<StickyNote[]> {
    const decryptedNotes: StickyNote[] = [];

    for (const note of notes) {
      try {
        // 只解密有内容的便签
        if (note.content) {
          // 检测内容是否已加密（简单检测：是否包含base64字符或|分隔符）
          const looksEncrypted = /^[A-Za-z0-9+/=|]+$/.test(note.content.trim());

          if (looksEncrypted) {
            const decryptedContent = await encryptionHelper.decrypt(
              note.content,
              this.password,
              this.encryptionMethod
            );
            decryptedNotes.push({
              ...note,
              content: decryptedContent,
            });
          } else {
            // 看起来不是加密的，直接显示
            decryptedNotes.push(note);
          }
        } else {
          decryptedNotes.push(note);
        }
      } catch (error) {
        console.error('[StickyNotesRoom] Failed to decrypt note:', note.id, error);
        // 解密失败时，显示错误提示而不是加密文本
        decryptedNotes.push({
          ...note,
          content: '⚠️ 解密失败（密码错误或数据损坏）',
        });
      }
    }

    return decryptedNotes;
  }

  /**
   * 处理便签变化
   */
  private async handleNotesChange() {
    if (this.onNotesChange) {
      const notes = await this.getAllNotes();
      this.onNotesChange(notes);
    }

    // 保存到本地
    await this.saveToLocal();
  }

  /**
   * 处理用户变化
   */
  private handleUsersChange() {
    if (this.onUsersChange) {
      const users = this.getAllUsers();
      this.onUsersChange(users);
    }
  }

  /**
   * 从本地加载便签
   * 暂时禁用，避免不同房间的便签混淆
   * Yjs 会自动管理文档状态并通过 WebRTC 同步
   */
  private async loadLocalNotes() {
    // 不加载本地便签，完全依赖 Yjs 的 P2P 同步
  }

  /**
   * 保存到本地
   * 暂时禁用，避免不同房间的便签混淆
   * Yjs 会处理文档的持久化
   */
  private async saveToLocal() {
    // 不保存到本地，完全依赖 Yjs 的 P2P 同步
  }

  /**
   * 生成用户 ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成用户名
   */
  private generateUserName(): string {
    // 优先从 localStorage 读取
    const savedName = localStorage.getItem('sticky_notes_user_name');
    if (savedName) {
      return savedName;
    }

    const adjectives = ['快乐的', '聪明的', '勇敢的', '可爱的', '友善的'];
    const nouns = ['猫咪', '狗狗', '兔子', '熊猫', '企鹅'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}`;
  }

  /**
   * 更新用户名
   */
  updateUserName(newName: string) {
    if (!this.yUsers || !this.userId) return;

    this.userName = newName;
    // 保存到 localStorage
    localStorage.setItem('sticky_notes_user_name', newName);

    // 更新 Yjs 中的用户信息
    this.yUsers.set(this.userId, {
      id: this.userId,
      name: this.userName,
      color: this.userColor,
    });
  }

  /**
   * 生成便签 ID
   */
  private generateNoteId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取房间信息
   */
  getRoomInfo() {
    return {
      roomId: this.roomId,
      userId: this.userId,
      userName: this.userName,
      userColor: this.userColor,
      isEncrypted: this.enableEncryption,
      encryptionMethod: this.encryptionMethod,
      isExistingEncryptedRoom: !!(this.yMeta?.get('passwordVerificationToken')),
      peerCount: this.provider?.room?.webrtcConns?.size || 0,
    };
  }
}

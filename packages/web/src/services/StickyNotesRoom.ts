/**
 * 便签墙 - P2P 房间管理 (基于 Yjs + WebRTC)
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import type { StickyNote, UserInfo, RoomConfig } from '../types/stickyNote';
import { notesStorage } from '../utils/NotesStorage';
import { encryptionHelper } from '../utils/Encryption';

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

  // 回调函数
  private onNotesChange?: (notes: StickyNote[]) => void;
  private onUsersChange?: (users: UserInfo[]) => void;
  private onConnectionChange?: (connected: boolean, peerCount: number) => void;
  private onRoomDestroyed?: () => void;

  /**
   * 创建或加入房间
   */
  async joinRoom(config: RoomConfig, callbacks?: {
    onNotesChange?: (notes: StickyNote[]) => void;
    onUsersChange?: (users: UserInfo[]) => void;
    onConnectionChange?: (connected: boolean, peerCount: number) => void;
    onRoomDestroyed?: () => void;
  }) {
    this.roomId = config.roomId;
    this.password = config.password || '';
    this.enableEncryption = config.enableEncryption;

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

    // 添加当前用户
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

    this.yNotes.set(newNote.id, newNote);
  }

  /**
   * 更新便签
   */
  async updateNote(noteId: string, updates: Partial<StickyNote>) {
    if (!this.yNotes || !this.ydoc) return;

    const note = this.yNotes.get(noteId);
    if (!note) return;

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
   * 销毁房间
   */
  destroyRoom() {
    if (!this.yNotes || !this.yMeta || !this.ydoc) return;

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
      peerCount: this.provider?.room?.webrtcConns?.size || 0,
    };
  }
}

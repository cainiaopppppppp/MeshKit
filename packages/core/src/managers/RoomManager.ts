/**
 * RoomManager - 房间管理器
 * 处理房间创建、加入、离开等逻辑
 */
import { eventBus } from '../utils/EventBus';
import { signalingClient } from '../services/SignalingClient';
import type { Room, RoomMember, FileMetadata } from '../types';

export class RoomManager {
  private currentRoom: Room | null = null;
  private myDeviceId: string | null = null;
  private myDeviceName: string | null = null;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * 初始化（设置设备信息）
   */
  init(deviceId: string, deviceName: string) {
    this.myDeviceId = deviceId;
    this.myDeviceName = deviceName;
    console.log('[RoomManager] Initialized:', { deviceId, deviceName });
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听信令消息中的房间更新
    eventBus.on('signaling:message', ({ message }: any) => {
      switch (message.type) {
        case 'room-update':
          this.handleRoomUpdate(message.room);
          break;
        case 'room-error':
          this.handleRoomError(message.error);
          break;
        case 'file-request':
          this.handleFileRequest(message.fileIndex, message.requesterId);
          break;
      }
    });
  }

  /**
   * 创建房间（发送方）
   * 支持单文件和多文件模式
   * @param password 可选的房间密码
   */
  async createRoom(fileInfo: FileMetadata, fileList?: FileMetadata[], password?: string): Promise<Room> {
    if (!this.myDeviceId || !this.myDeviceName) {
      throw new Error('设备未初始化');
    }

    // 确保总是有fileList，即使是单文件模式
    const actualFileList = fileList && fileList.length > 0 ? fileList : [fileInfo];
    const isMultiFile = actualFileList.length > 1;
    console.log('[RoomManager] 创建房间...', isMultiFile ? `多文件模式 (${actualFileList.length} 个文件)` : '单文件模式', fileInfo, password ? '🔒 有密码保护' : '');

    // 发送创建房间请求到信令服务器
    signalingClient.send({
      type: 'create-room',
      deviceId: this.myDeviceId!,
      deviceName: this.myDeviceName!,
      data: {
        fileInfo,
        fileList: actualFileList,
        isMultiFile,
        password: password || undefined  // 传递密码（如果有）
      }
    });

    // 等待房间创建成功（通过room-update事件）
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('创建房间超时'));
      }, 5000);

      const handler = (data: { room: Room }) => {
        clearTimeout(timeout);
        eventBus.off('room:created', handler);
        resolve(data.room);
      };

      eventBus.on('room:created', handler);
    });
  }

  /**
   * 加入房间（接收方）
   * @param password 可选的房间密码
   */
  async joinRoom(roomId: string, password?: string): Promise<Room> {
    if (!this.myDeviceId || !this.myDeviceName) {
      throw new Error('设备未初始化');
    }

    console.log('[RoomManager] 加入房间:', roomId, password ? '🔒 有密码' : '');

    // 发送加入房间请求
    signalingClient.send({
      type: 'join-room',
      deviceId: this.myDeviceId!,
      deviceName: this.myDeviceName!,
      roomId: roomId,
      password: password || undefined  // 传递密码（如果有）
    });

    // 等待加入成功
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('加入房间超时'));
      }, 5000);

      const handler = (data: { room: Room }) => {
        clearTimeout(timeout);
        eventBus.off('room:joined', handler);
        eventBus.off('room:error', errorHandler);
        resolve(data.room);
      };

      const errorHandler = (data: { error: string }) => {
        clearTimeout(timeout);
        eventBus.off('room:joined', handler);
        eventBus.off('room:error', errorHandler);
        reject(new Error(data.error));
      };

      eventBus.on('room:joined', handler);
      eventBus.on('room:error', errorHandler);
    });
  }

  /**
   * 离开房间
   */
  leaveRoom(): void {
    if (!this.currentRoom || !this.myDeviceId) {
      return;
    }

    console.log('[RoomManager] 离开房间:', this.currentRoom.id);

    signalingClient.send({
      type: 'leave-room',
      deviceId: this.myDeviceId,
      roomId: this.currentRoom.id
    });

    this.currentRoom = null;
    eventBus.emit('room:left', undefined);
  }

  /**
   * 开始群发传输（仅主持人）
   */
  startBroadcast(): void {
    if (!this.currentRoom) {
      throw new Error('未在房间中');
    }

    if (this.currentRoom.hostId !== this.myDeviceId) {
      throw new Error('只有主持人可以开始传输');
    }

    console.log('[RoomManager] 开始群发传输');

    signalingClient.send({
      type: 'start-broadcast',
      deviceId: this.myDeviceId,
      roomId: this.currentRoom.id
    });
  }

  /**
   * 处理房间更新
   */
  private handleRoomUpdate(room: Room): void {
    console.log('[RoomManager] 房间更新:', room);

    const isNewRoom = !this.currentRoom;

    this.currentRoom = room;

    if (isNewRoom) {
      // 新创建或加入房间
      if (room.hostId === this.myDeviceId) {
        eventBus.emit('room:created', { room });
      } else {
        // 接收方加入房间：立即建立与房主的P2P连接
        console.log('[RoomManager] 接收方加入房间，准备建立P2P连接...');
        eventBus.emit('room:joined', { room });

        // 延迟一小段时间确保事件处理完成，然后建立P2P连接
        setTimeout(() => {
          this.establishHostConnection(room.hostId);
        }, 100);
      }
    } else {
      // 房间状态更新
      eventBus.emit('room:updated', { room });
    }
  }

  /**
   * 请求房间中的文件（接收方使用）
   */
  requestFile(fileIndex: number): void {
    if (!this.currentRoom) {
      console.error('[RoomManager] Not in a room');
      return;
    }

    if (this.currentRoom.hostId === this.myDeviceId) {
      console.error('[RoomManager] Host cannot request files from itself');
      return;
    }

    console.log('[RoomManager] Requesting file from host:', fileIndex);

    // 向房主发送文件请求
    signalingClient.send({
      type: 'file-request',
      roomId: this.currentRoom.id,
      fileIndex,
      requesterId: this.myDeviceId ?? undefined,
    });
  }

  /**
   * 处理文件请求（发送方使用）
   */
  private handleFileRequest(fileIndex: number, requesterId: string): void {
    if (!this.isHost()) {
      console.warn('[RoomManager] Only host can handle file requests');
      return;
    }

    console.log('[RoomManager] Handling file request:', { fileIndex, requesterId });

    // 导入FileTransferManager并发送指定的文件
    import('./FileTransferManager').then(({ fileTransferManager }) => {
      fileTransferManager.sendSingleFileFromQueue(fileIndex, requesterId);
    }).catch(error => {
      console.error('[RoomManager] Failed to send requested file:', error);
    });
  }

  /**
   * 建立与房主的P2P连接（接收方专用）
   */
  private establishHostConnection(hostId: string): void {
    if (!this.myDeviceId) {
      console.error('[RoomManager] Cannot establish connection: device not initialized');
      return;
    }

    console.log('[RoomManager] 建立与房主的P2P连接:', hostId);

    // 导入p2pManager并建立连接
    import('./P2PManager').then(({ p2pManager }) => {
      // 建立用于文件传输的连接
      p2pManager.connect(hostId, {
        type: 'room-member',
        deviceName: this.myDeviceName || 'Unknown'
      });
      console.log('[RoomManager] P2P连接请求已发送');
    }).catch(error => {
      console.error('[RoomManager] 建立P2P连接失败:', error);
    });
  }

  /**
   * 处理房间错误
   */
  private handleRoomError(error: string): void {
    console.error('[RoomManager] 房间错误:', error);
    eventBus.emit('room:error', { error });
  }


  /**
   * 获取当前房间
   */
  getCurrentRoom(): Room | null {
    return this.currentRoom;
  }

  /**
   * 是否是主持人
   */
  isHost(): boolean {
    return this.currentRoom?.hostId === this.myDeviceId;
  }

  /**
   * 获取房间成员（除了自己）
   */
  getOtherMembers(): RoomMember[] {
    if (!this.currentRoom) {
      return [];
    }

    return this.currentRoom.members.filter(
      m => m.deviceId !== this.myDeviceId
    );
  }

  /**
   * 获取房间所有成员的设备ID列表（除了自己）
   */
  getMemberDeviceIds(): string[] {
    return this.getOtherMembers().map(m => m.deviceId);
  }

  /**
   * 更新房间文件列表（发送方添加/删除文件）
   */
  updateRoomFiles(fileList: FileMetadata[]): void {
    if (!this.currentRoom) {
      throw new Error('未在房间中');
    }

    if (this.currentRoom.hostId !== this.myDeviceId) {
      throw new Error('只有主持人可以更新文件列表');
    }

    console.log('[RoomManager] 更新房间文件列表:', fileList.length, '个文件');

    // 更新本地房间状态
    this.currentRoom.fileList = fileList;
    this.currentRoom.isMultiFile = fileList.length > 1;

    // 通知服务器更新房间文件列表
    signalingClient.send({
      type: 'update-room-files',
      roomId: this.currentRoom.id,
      fileList
    });

    // 触发 room:updated 事件，让 React 状态更新
    eventBus.emit('room:updated', { room: this.currentRoom });
  }

  /**
   * 更新成员状态（接收方调用，通知房主传输状态）
   */
  updateMemberStatus(status: 'waiting' | 'receiving' | 'completed' | 'failed', progress?: number): void {
    if (!this.currentRoom || !this.myDeviceId) {
      return;
    }

    console.log('[RoomManager] 更新成员状态:', status, progress);

    // 发送状态更新到信令服务器
    signalingClient.send({
      type: 'update-member-status',
      roomId: this.currentRoom.id,
      deviceId: this.myDeviceId,
      status,
      progress
    });
  }

}

// 导出单例
export const roomManager = new RoomManager();

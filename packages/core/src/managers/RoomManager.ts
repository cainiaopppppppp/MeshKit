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
      }
    });
  }

  /**
   * 创建房间（发送方）
   * 支持单文件和多文件模式
   */
  async createRoom(fileInfo: FileMetadata, fileList?: FileMetadata[]): Promise<Room> {
    if (!this.myDeviceId || !this.myDeviceName) {
      throw new Error('设备未初始化');
    }

    const isMultiFile = fileList && fileList.length > 1;
    console.log('[RoomManager] 创建房间...', isMultiFile ? `多文件模式 (${fileList.length} 个文件)` : '单文件模式', fileInfo);

    // 发送创建房间请求到信令服务器
    signalingClient.send({
      type: 'create-room',
      deviceId: this.myDeviceId!,
      deviceName: this.myDeviceName!,
      data: {
        fileInfo,
        fileList: isMultiFile ? fileList : undefined,
        isMultiFile
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
   */
  async joinRoom(roomId: string): Promise<Room> {
    if (!this.myDeviceId || !this.myDeviceName) {
      throw new Error('设备未初始化');
    }

    console.log('[RoomManager] 加入房间:', roomId);

    // 发送加入房间请求
    signalingClient.send({
      type: 'join-room',
      deviceId: this.myDeviceId!,
      deviceName: this.myDeviceName!,
      roomId: roomId
    });

    // 等待加入成功
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('加入房间超时'));
      }, 5000);

      const handler = (data: { room: Room }) => {
        clearTimeout(timeout);
        eventBus.off('room:joined', handler);
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
        eventBus.emit('room:joined', { room });
      }
    } else {
      // 房间状态更新
      eventBus.emit('room:updated', { room });
    }

    // 检查是否有新成员加入
    // TODO: 比较成员列表，触发member-joined事件
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
}

// 导出单例
export const roomManager = new RoomManager();

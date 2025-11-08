/**
 * Zustand Store - 应用状态管理
 */
import { create } from 'zustand';
import type { Device, FileMetadata, TransferProgress, Room, RoomMember, FileQueueItem } from '@meshkit/core';

interface AppState {
  // 连接状态
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // 设备信息
  myDeviceId: string | null;
  myDeviceName: string | null;
  setMyDevice: (id: string, name: string) => void;

  // 设备列表
  devices: Device[];
  setDevices: (devices: Device[]) => void;

  // 选中的设备
  selectedDeviceId: string | null;
  selectDevice: (deviceId: string | null) => void;

  // 当前文件（单文件模式）
  currentFile: FileMetadata | null;
  setCurrentFile: (file: FileMetadata | null) => void;

  // 文件队列（多文件模式）
  fileQueue: FileQueueItem[];
  isQueueMode: boolean;
  queueDirection: 'send' | 'receive' | null; // 队列方向：用于区分发送和接收队列
  setFileQueue: (queue: FileQueueItem[]) => void;
  setQueueMode: (isQueue: boolean) => void;
  setQueueDirection: (direction: 'send' | 'receive' | null) => void;

  // 传输状态
  isTransferring: boolean;
  transferDirection: 'send' | 'receive' | null;
  transferProgress: TransferProgress | null;
  setTransferring: (transferring: boolean, direction?: 'send' | 'receive') => void;
  setTransferProgress: (progress: TransferProgress | null) => void;

  // 下载信息
  hasDownload: boolean;
  downloadFilename: string;
  isStreamingDownload: boolean; // 是否正在使用流式下载
  setDownload: (has: boolean, filename?: string) => void;
  setStreamingDownload: (streaming: boolean, filename?: string) => void;

  // 当前模式：点对点 or 房间模式
  transferMode: 'p2p' | 'room';
  setTransferMode: (mode: 'p2p' | 'room') => void;

  // 旧的mode字段（发送/接收）
  mode: 'send' | 'receive';
  setMode: (mode: 'send' | 'receive') => void;

  // 房间状态
  currentRoom: Room | null;
  setCurrentRoom: (room: Room | null) => void;
  updateRoomMembers: (members: RoomMember[]) => void;
  updateMemberProgress: (deviceId: string, progress: number) => void;

  // 广播传输进度（房间模式下每个成员的进度）
  broadcastProgress: Record<string, number>; // deviceId -> progress
  setBroadcastProgress: (progress: Record<string, number>) => void;

  // 重置
  reset: () => void;
  resetRoom: () => void; // 重置房间状态
}

export const useAppStore = create<AppState>((set) => ({
  // 初始状态
  isConnected: false,
  myDeviceId: null,
  myDeviceName: null,
  devices: [],
  selectedDeviceId: null,
  currentFile: null,
  fileQueue: [],
  isQueueMode: false,
  queueDirection: null,
  isTransferring: false,
  transferDirection: null,
  transferProgress: null,
  hasDownload: false,
  downloadFilename: '',
  isStreamingDownload: false,
  transferMode: 'p2p',
  mode: 'send',
  currentRoom: null,
  broadcastProgress: {},

  // Actions
  setConnected: (connected) => set({ isConnected: connected }),

  setMyDevice: (id, name) =>
    set({ myDeviceId: id, myDeviceName: name }),

  setDevices: (devices) => set({ devices }),

  selectDevice: (deviceId) => set({ selectedDeviceId: deviceId }),

  setCurrentFile: (file) => set({ currentFile: file }),

  setFileQueue: (queue) => set({ fileQueue: queue }),

  setQueueMode: (isQueue) => set({ isQueueMode: isQueue }),

  setQueueDirection: (direction) => set({ queueDirection: direction }),

  setTransferring: (transferring, direction) =>
    set({
      isTransferring: transferring,
      transferDirection: direction || null,
    }),

  setTransferProgress: (progress) =>
    set({ transferProgress: progress }),

  setDownload: (has, filename = '') =>
    set({ hasDownload: has, downloadFilename: filename }),

  setStreamingDownload: (streaming, filename = '') =>
    set({ isStreamingDownload: streaming, downloadFilename: filename }),

  setTransferMode: (mode) => set({ transferMode: mode }),

  setMode: (mode) => set({ mode }),

  // 房间相关actions
  setCurrentRoom: (room) => set({ currentRoom: room }),

  updateRoomMembers: (members) =>
    set((state) => ({
      currentRoom: state.currentRoom
        ? { ...state.currentRoom, members }
        : null,
    })),

  updateMemberProgress: (deviceId, progress) =>
    set((state) => {
      if (!state.currentRoom) return state;

      const updatedMembers = state.currentRoom.members.map((member) =>
        member.deviceId === deviceId
          ? { ...member, progress }
          : member
      );

      return {
        currentRoom: {
          ...state.currentRoom,
          members: updatedMembers,
        },
      };
    }),

  setBroadcastProgress: (progress) =>
    set({ broadcastProgress: progress }),

  reset: () =>
    set({
      currentFile: null,
      fileQueue: [],
      isQueueMode: false,
      queueDirection: null,
      isTransferring: false,
      transferDirection: null,
      transferProgress: null,
      hasDownload: false,
      downloadFilename: '',
      isStreamingDownload: false,
      selectedDeviceId: null,
    }),

  resetRoom: () =>
    set({
      currentRoom: null,
      broadcastProgress: {},
      transferMode: 'p2p',
    }),
}));

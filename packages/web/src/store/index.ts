/**
 * Zustand Store - 应用状态管理
 */
import { create } from 'zustand';
import type { Device, FileMetadata, TransferProgress } from '@meshkit/core';

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

  // 当前文件
  currentFile: FileMetadata | null;
  setCurrentFile: (file: FileMetadata | null) => void;

  // 传输状态
  isTransferring: boolean;
  transferDirection: 'send' | 'receive' | null;
  transferProgress: TransferProgress | null;
  setTransferring: (transferring: boolean, direction?: 'send' | 'receive') => void;
  setTransferProgress: (progress: TransferProgress | null) => void;

  // 下载信息
  hasDownload: boolean;
  downloadFilename: string;
  setDownload: (has: boolean, filename?: string) => void;

  // 当前模式
  mode: 'send' | 'receive';
  setMode: (mode: 'send' | 'receive') => void;

  // 重置
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // 初始状态
  isConnected: false,
  myDeviceId: null,
  myDeviceName: null,
  devices: [],
  selectedDeviceId: null,
  currentFile: null,
  isTransferring: false,
  transferDirection: null,
  transferProgress: null,
  hasDownload: false,
  downloadFilename: '',
  mode: 'send',

  // Actions
  setConnected: (connected) => set({ isConnected: connected }),

  setMyDevice: (id, name) =>
    set({ myDeviceId: id, myDeviceName: name }),

  setDevices: (devices) => set({ devices }),

  selectDevice: (deviceId) => set({ selectedDeviceId: deviceId }),

  setCurrentFile: (file) => set({ currentFile: file }),

  setTransferring: (transferring, direction) =>
    set({
      isTransferring: transferring,
      transferDirection: direction || null,
    }),

  setTransferProgress: (progress) =>
    set({ transferProgress: progress }),

  setDownload: (has, filename = '') =>
    set({ hasDownload: has, downloadFilename: filename }),

  setMode: (mode) => set({ mode }),

  reset: () =>
    set({
      currentFile: null,
      isTransferring: false,
      transferDirection: null,
      transferProgress: null,
      hasDownload: false,
      downloadFilename: '',
      selectedDeviceId: null,
    }),
}));

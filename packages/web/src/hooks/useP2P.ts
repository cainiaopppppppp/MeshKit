/**
 * useP2P - P2P功能Hook
 */
import { useEffect } from 'react';
import {
  initCore,
  connectSignaling,
  eventBus,
  fileTransferManager,
} from '@meshkit/core';
import { useAppStore } from '../store';

const SIGNALING_URL = `ws://${window.location.hostname}:8000`;

// localStorage keys
const STORAGE_KEYS = {
  DEVICE_ID: 'meshkit_device_id',
  DEVICE_NAME: 'meshkit_device_name',
};

/**
 * 从 localStorage 获取持久化的设备信息
 */
function getPersistedDeviceInfo(): { deviceId?: string; deviceName?: string } {
  try {
    const deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID) || undefined;
    const deviceName = localStorage.getItem(STORAGE_KEYS.DEVICE_NAME) || undefined;
    return { deviceId, deviceName };
  } catch (error) {
    console.warn('[useP2P] Failed to read from localStorage:', error);
    return {};
  }
}

/**
 * 持久化设备信息到 localStorage
 */
function persistDeviceInfo(deviceId: string, deviceName: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    localStorage.setItem(STORAGE_KEYS.DEVICE_NAME, deviceName);
    console.log('[useP2P] Device info persisted:', { deviceId, deviceName });
  } catch (error) {
    console.warn('[useP2P] Failed to persist device info:', error);
  }
}

export function useP2P() {
  const {
    setConnected,
    setMyDevice,
    setDevices,
    setTransferring,
    setTransferProgress,
    setDownload,
    reset,
    isTransferring,
  } = useAppStore();

  useEffect(() => {
    // 初始化
    const initialize = async () => {
      try {
        // 尝试从 localStorage 读取已保存的设备信息
        const persisted = getPersistedDeviceInfo();
        console.log('[useP2P] Persisted device info:', persisted);

        // 初始化核心模块（如果有持久化的信息就使用它）
        const { deviceId, deviceName } = await initCore(
          persisted.deviceId,
          persisted.deviceName
        );

        // 如果是新生成的设备信息，保存到 localStorage
        if (!persisted.deviceId || !persisted.deviceName) {
          persistDeviceInfo(deviceId, deviceName);
        }

        setMyDevice(deviceId, deviceName);

        // 连接信令服务器
        connectSignaling(SIGNALING_URL);
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };

    initialize();

    // 设置事件监听
    const unsubscribe = setupEventListeners();

    // 清理
    return () => {
      unsubscribe();
    };
  }, [setConnected, setMyDevice, setDevices, setTransferring, setTransferProgress, setDownload, reset]);

  // 防止传输过程中刷新页面
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isTransferring) {
        e.preventDefault();
        // Chrome 需要设置 returnValue
        e.returnValue = '文件正在传输中，确定要离开吗？传输将会中断。';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isTransferring]);

  function setupEventListeners() {
    // 信令连接
    const onConnected = () => setConnected(true);
    const onDisconnected = () => setConnected(false);

    // 设备列表
    const onDeviceListUpdated = ({ devices }: { devices: any[] }) => {
      setDevices(devices);
    };

    // 传输事件
    const onTransferPreparing = ({ direction }: { direction: 'send' | 'receive' }) => {
      // 立即显示"准备中"状态（即时反馈）
      setTransferring(true, direction);
      console.log('[useP2P] Transfer preparing:', direction);
    };

    const onTransferStarted = ({ direction }: { direction: 'send' | 'receive' }) => {
      setTransferring(true, direction);
      console.log('[useP2P] Transfer started:', direction);
    };

    const onTransferProgress = (progress: any) => {
      setTransferProgress(progress);
    };

    const onTransferCompleted = () => {
      const downloadInfo = fileTransferManager.getDownloadInfo();
      if (downloadInfo) {
        setDownload(true, downloadInfo.filename);
      }
      setTransferring(false);
    };

    const onTransferError = () => {
      setTransferring(false);
      reset();
    };

    // 订阅事件
    eventBus.on('signaling:connected', onConnected);
    eventBus.on('signaling:disconnected', onDisconnected);
    eventBus.on('device:list-updated', onDeviceListUpdated);
    eventBus.on('transfer:preparing', onTransferPreparing);
    eventBus.on('transfer:started', onTransferStarted);
    eventBus.on('transfer:progress', onTransferProgress);
    eventBus.on('transfer:completed', onTransferCompleted);
    eventBus.on('transfer:error', onTransferError);

    // 返回清理函数
    return () => {
      eventBus.off('signaling:connected', onConnected);
      eventBus.off('signaling:disconnected', onDisconnected);
      eventBus.off('device:list-updated', onDeviceListUpdated);
      eventBus.off('transfer:preparing', onTransferPreparing);
      eventBus.off('transfer:started', onTransferStarted);
      eventBus.off('transfer:progress', onTransferProgress);
      eventBus.off('transfer:completed', onTransferCompleted);
      eventBus.off('transfer:error', onTransferError);
    };
  }
}

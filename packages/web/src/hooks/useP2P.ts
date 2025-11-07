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

export function useP2P() {
  const {
    setConnected,
    setMyDevice,
    setDevices,
    setTransferring,
    setTransferProgress,
    setDownload,
    reset,
  } = useAppStore();

  useEffect(() => {
    // 初始化
    const initialize = async () => {
      try {
        const { deviceId, deviceName } = await initCore();
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

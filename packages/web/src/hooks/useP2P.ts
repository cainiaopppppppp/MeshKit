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
import { fileStorage } from '../utils/FileStorage';

const SIGNALING_URL = `ws://${window.location.hostname}:7000/ws`;

// localStorage keys
const STORAGE_KEYS = {
  DEVICE_ID: 'meshkit_device_id',
  DEVICE_NAME: 'meshkit_device_name',
  LAST_FILE_ID: 'meshkit_last_file_id',
  RECEIVED_FILE_IDS: 'meshkit_received_file_ids', // 存储多个文件ID的数组
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

/**
 * 恢复上次接收的文件
 * 需要在组件加载后调用，以便可以设置状态
 */
let restoredFileInfo: { blob: Blob; filename: string } | null = null;

async function restoreLastReceivedFile(): Promise<void> {
  try {
    const lastFileId = localStorage.getItem(STORAGE_KEYS.LAST_FILE_ID);
    if (!lastFileId) {
      console.log('[useP2P] No file to restore');
      return;
    }

    const storedFile = await fileStorage.getFile(lastFileId);
    if (!storedFile) {
      console.log('[useP2P] Stored file not found:', lastFileId);
      localStorage.removeItem(STORAGE_KEYS.LAST_FILE_ID);
      return;
    }

    // 保存恢复的文件信息，稍后在组件中设置
    restoredFileInfo = {
      blob: storedFile.blob,
      filename: storedFile.filename,
    };

    console.log('[useP2P] File restored from IndexedDB:', storedFile.filename);
  } catch (error) {
    console.error('[useP2P] Failed to restore file:', error);
  }
}

/**
 * 保存接收到的文件
 */
async function saveReceivedFile(file: File): Promise<void> {
  try {
    const fileId = await fileStorage.saveFile(file);

    // 保存单个文件ID（向后兼容）
    localStorage.setItem(STORAGE_KEYS.LAST_FILE_ID, fileId);

    // 添加到文件ID数组
    try {
      const existingIds = localStorage.getItem(STORAGE_KEYS.RECEIVED_FILE_IDS);
      const fileIds: string[] = existingIds ? JSON.parse(existingIds) : [];
      if (!fileIds.includes(fileId)) {
        fileIds.push(fileId);
        localStorage.setItem(STORAGE_KEYS.RECEIVED_FILE_IDS, JSON.stringify(fileIds));
      }
    } catch (error) {
      console.warn('[useP2P] Failed to update file IDs array:', error);
    }

    console.log('[useP2P] File saved to IndexedDB:', file.name, fileId);
  } catch (error) {
    console.error('[useP2P] Failed to save file:', error);
  }
}

/**
 * 显示接收成功提醒
 */
function showReceiveSuccessNotification(filename: string): void {
  // 检测是否支持通知API
  if ('Notification' in window && Notification.permission === 'granted') {
    // 已授权，直接显示通知
    new Notification('✅ 文件接收完成！', {
      body: `${filename} 已接收完成，文件已开始下载`,
      icon: '/favicon.ico',
      tag: 'file-receive-success',
    });
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    // 未授权，请求权限
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification('✅ 文件接收完成！', {
          body: `${filename} 已接收完成，文件已开始下载`,
          icon: '/favicon.ico',
          tag: 'file-receive-success',
        });
      }
    });
  }

  // 同时播放系统提示音（如果可用）
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjB3ytjLkAcBaLnt56RZFApDo+Xyu2wfBT2Ky+/7hTcJFG7B6+2ocSEEKHvL797HiQgCQ4/T4O7GejwHE1O59+2kaRkFNHvD79+tkCcJD2TK7u+ylSUDK3vG6+isgCUKGWi65uqldRUHJH');
    audio.volume = 0.3; // 降低音量
    audio.play().catch(() => {
      // 播放失败不影响功能
    });
  } catch {
    // 音频播放失败不影响功能
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
    setStreamingDownload,
    setFileQueue,
    setQueueMode,
    setQueueDirection,
    reset,
    isTransferring,
  } = useAppStore();

  useEffect(() => {
    // 初始化
    const initialize = async () => {
      try {
        // 初始化文件存储
        await fileStorage.init();
        console.log('[useP2P] File storage initialized');

        // 尝试恢复上次接收的文件
        await restoreLastReceivedFile();

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

        // 清理7天前的旧文件
        fileStorage.cleanupOldFiles(7).catch(console.error);

        // 如果恢复了文件，设置下载状态
        if (restoredFileInfo) {
          setDownload(true, restoredFileInfo.filename);
          console.log('[useP2P] Restored file download ready:', restoredFileInfo.filename);
        }
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

  // 处理页面可见性变化（锁屏、切换标签页）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[useP2P] Page hidden (locked/backgrounded)');
        // 页面进入后台，WebRTC 和 WebSocket 连接可能会被暂停
        // 信令服务器的心跳机制会自动处理重连
      } else {
        console.log('[useP2P] Page visible (unlocked/foregrounded)');
        // 页面恢复前台，延迟检查连接状态
        setTimeout(() => {
          const status = (window as any).signalingClient?.getStatus();
          if (status && !status.connected) {
            console.warn('[useP2P] Connection lost, attempting to reconnect...');
            // 信令客户端会自动重连，我们只需要等待
          }
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
      // 清除之前的下载状态（开始新传输）
      setDownload(false, '');
      setStreamingDownload(false, '');
      // 立即显示"准备中"状态（即时反馈）
      setTransferring(true, direction);
      console.log('[useP2P] Transfer preparing:', direction);
    };

    const onTransferStarted = ({ direction }: { direction: 'send' | 'receive' }) => {
      // 清除之前的下载状态（开始新传输）
      setDownload(false, '');
      setStreamingDownload(false, '');
      setTransferring(true, direction);
      console.log('[useP2P] Transfer started:', direction);
    };

    const onTransferProgress = (progress: any) => {
      setTransferProgress(progress);
    };

    const onTransferCompleted = async ({ direction }: { direction: 'send' | 'receive' }) => {
      console.log('[useP2P] Transfer completed:', direction);

      if (direction === 'receive') {
        const downloadInfo = fileTransferManager.getDownloadInfo();
        if (downloadInfo) {
          console.log('[useP2P] Download info:', {
            filename: downloadInfo.filename,
            size: downloadInfo.blob.size,
            sizeMB: (downloadInfo.blob.size / 1024 / 1024).toFixed(2) + ' MB',
          });

          // 先设置下载状态（确保UI立即显示）
          setDownload(true, downloadInfo.filename);
          console.log('[useP2P] Download state set, UI should show download button');

          // 显示接收成功提醒
          showReceiveSuccessNotification(downloadInfo.filename);

          // 对于大文件（>500MB），不保存到IndexedDB（避免内存问题）
          const sizeMB = downloadInfo.blob.size / 1024 / 1024;
          const MAX_STORAGE_SIZE_MB = 500;

          if (sizeMB <= MAX_STORAGE_SIZE_MB) {
            // 保存文件到 IndexedDB（页面刷新后仍可下载）
            try {
              const file = new File([downloadInfo.blob], downloadInfo.filename, {
                type: downloadInfo.blob.type || 'application/octet-stream',
              });
              await saveReceivedFile(file);
              console.log('[useP2P] File saved to IndexedDB');
            } catch (error) {
              console.error('[useP2P] Failed to save received file to IndexedDB:', error);
              // 保存失败不影响下载功能
            }
          } else {
            console.log(`[useP2P] File too large (${sizeMB.toFixed(2)} MB), skipping IndexedDB storage`);
            console.log('[useP2P] Note: File will be lost after page refresh');
          }
        } else {
          console.error('[useP2P] No download info available!');
        }
      }

      setTransferring(false);
    };

    const onTransferError = () => {
      setTransferring(false);
      reset();
    };

    const onDownloadStarted = ({ filename, streaming }: { filename: string; streaming: boolean }) => {
      console.log('[useP2P] Download started:', { filename, streaming });
      if (streaming) {
        setStreamingDownload(true, filename);
      }
    };

    // 文件队列事件
    const onQueueUpdated = ({ queue, direction }: any) => {
      console.log('[useP2P] File queue updated:', queue, 'direction:', direction);
      setFileQueue(queue);
      setQueueDirection(direction);
      // 如果队列不为空，启用队列模式
      if (queue.length > 0) {
        setQueueMode(true);
      } else {
        setQueueMode(false);
      }
    };

    const onFileListReceived = ({ files, totalSize }: any) => {
      console.log('[useP2P] File list received:', files.length, 'files,', totalSize, 'bytes');
      setQueueMode(true);
    };

    const onFileItemStarted = ({ fileIndex, file }: any) => {
      console.log('[useP2P] File item started:', fileIndex, file.name);
    };

    const onFileItemCompleted = async ({ fileIndex, file, blob }: any) => {
      console.log('[useP2P] File item completed:', fileIndex, file.name);

      // 使用事件传递的blob（而不是getDownloadInfo，避免被覆盖）
      if (blob) {
        console.log('[useP2P] Saving queue file to IndexedDB:', file.name);

        try {
          const sizeMB = blob.size / 1024 / 1024;
          const MAX_STORAGE_SIZE_MB = 500;

          if (sizeMB <= MAX_STORAGE_SIZE_MB) {
            const fileBlob = new File([blob], file.name, {
              type: blob.type || 'application/octet-stream',
            });
            await saveReceivedFile(fileBlob);
            console.log('[useP2P] Queue file saved to IndexedDB:', file.name);
          } else {
            console.log(`[useP2P] File too large (${sizeMB.toFixed(2)} MB), skipping IndexedDB storage`);
          }
        } catch (error) {
          console.error('[useP2P] Failed to save queue file:', error);
        }
      } else {
        console.warn('[useP2P] No blob in file-item-completed event');
      }
    };

    const onFileItemFailed = ({ fileIndex, file, error }: any) => {
      console.error('[useP2P] File item failed:', fileIndex, file.name, error);
    };

    const onQueueCompleted = ({ totalFiles, successCount, failedCount }: any) => {
      console.log('[useP2P] Queue transfer completed:', {
        totalFiles,
        successCount,
        failedCount,
      });

      // 显示完成提醒
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('✅ 多文件传输完成！', {
          body: `成功: ${successCount}/${totalFiles} 个文件`,
          icon: '/favicon.ico',
          tag: 'queue-complete',
        });
      }

      // 设置下载状态，显示下载完成界面
      if (successCount > 0) {
        setDownload(true, `${successCount} 个文件`);
        console.log('[useP2P] Queue download complete, UI should show download section');
      }

      setTransferring(false);
      // 队列模式保持开启，显示最终结果
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
    eventBus.on('transfer:download-started', onDownloadStarted);
    eventBus.on('transfer:queue-updated', onQueueUpdated);
    eventBus.on('transfer:file-list-received', onFileListReceived);
    eventBus.on('transfer:file-item-started', onFileItemStarted);
    eventBus.on('transfer:file-item-completed', onFileItemCompleted);
    eventBus.on('transfer:file-item-failed', onFileItemFailed);
    eventBus.on('transfer:queue-completed', onQueueCompleted);

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
      eventBus.off('transfer:download-started', onDownloadStarted);
      eventBus.off('transfer:queue-updated', onQueueUpdated);
      eventBus.off('transfer:file-list-received', onFileListReceived);
      eventBus.off('transfer:file-item-started', onFileItemStarted);
      eventBus.off('transfer:file-item-completed', onFileItemCompleted);
      eventBus.off('transfer:file-item-failed', onFileItemFailed);
      eventBus.off('transfer:queue-completed', onQueueCompleted);
    };
  }
}

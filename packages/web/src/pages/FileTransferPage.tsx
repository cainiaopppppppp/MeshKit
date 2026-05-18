/**
 * 文件传输页面 - 从原 App.tsx 提取
 */

import { useState, useEffect } from 'react';
import { useP2P } from '../hooks/useP2P';
import { useAppStore } from '../store';
import {
  deviceManager,
  fileTransferManager,
  eventBus,
  updateDeviceName,
  EncryptionMethod,
  FileEncryptionHelper,
  deviceBlockManager,
  connectSignaling,
  signalingClient,
  config,
  type BlockedDevice,
  type FileQueueItem,
} from '@meshkit/core';
import { fileStorage } from '../utils/FileStorage';
import { RoomModeSelector } from '../components/RoomModeSelector';
import { RoomContainer } from '../components/RoomContainer';
import { FileSelector } from '../components/FileSelector';
import { FileQueue } from '../components/FileQueue';
import { DeviceNameEditor } from '../components/DeviceNameEditor';
import { PasswordDialog } from '../components/PasswordDialog';
import { ReceiveRequestDialog } from '../components/ReceiveRequestDialog';
import { FileListRequestDialog } from '../components/FileListRequestDialog';
import { PasswordInputDialog } from '../components/PasswordInputDialog';
import { BlockedDevicesList } from '../components/BlockedDevicesList';
import { DeviceKindIcon, FileTypeIcon, InfoIcon, TransferInboxIcon, getDisplayDeviceName } from '../components/FileTransferIcons';
import { ExperienceCard, ExperienceHero, ExperiencePage } from '../components/ExperienceShell';
import { parseShareInvitePayloadFromUrl } from '../utils/signalingConfig';

// 播放通知提示音
const playNotificationSound = () => {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjOM0fPTgjMGHm7A7+OZSA0PVqzn77BdGAk+ltryxnMnBS2Hy/LaiTcIGWe77+WeTBEMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQYzjNHz04IzBh5uwO/jmUgND1as5++wXRgJPpba8sZzJwUthsvy2ok3CBlnuu/lnkwRDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Failed to play sound:', e));
  } catch (e) {
    console.log('Sound not supported:', e);
  }
};

// 显示浏览器通知
const showBrowserNotification = (senderName: string, fileName: string, fileSize: number) => {
  if (!('Notification' in window)) {
    return;
  }

  const formatFileSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  if (Notification.permission === 'granted') {
    new Notification('收到文件传输请求', {
      body: `${senderName} 想要发送文件：${fileName} (${formatFileSize(fileSize)})`,
      icon: '/favicon.png',
      tag: 'file-transfer',
      requireInteraction: true,
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('收到文件传输请求', {
          body: `${senderName} 想要发送文件：${fileName} (${formatFileSize(fileSize)})`,
          icon: '/favicon.png',
          tag: 'file-transfer',
          requireInteraction: true,
        });
      }
    });
  }
};

function WifiSignalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <path d="M12 20h.01" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function FileTransferPage() {
  useP2P();

  const {
    isConnected,
    myDeviceId,
    myDeviceName,
    devices,
    selectedDeviceId,
    currentFile,
    isTransferring,
    transferProgress,
    hasDownload,
    downloadFilename,
    isStreamingDownload,
    mode,
    transferMode,
    fileQueue,
    isQueueMode,
    queueDirection,
    p2pSessionState,
    setMode,
    setTransferMode,
    setP2PSessionState,
    selectDevice,
    setCurrentFile,
    setMyDevice,
    resetRoom,
  } = useAppStore();

  const [dragOver, setDragOver] = useState(false);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [pendingFileList, setPendingFileList] = useState<{
    files: any[];
    totalSize: number;
    passwordProtected?: boolean;
    encrypted?: boolean;
    encryptionMethod?: string;
    verificationToken?: string;
  } | null>(null);
  const [showFileListRequestDialog, setShowFileListRequestDialog] = useState(false);
  const [pendingFileListRequest, setPendingFileListRequest] = useState<{
    senderName: string;
    senderDeviceId: string;
    fileCount: number;
    totalSize: number;
    passwordProtected?: boolean;
    encrypted?: boolean;
    encryptionMethod?: string;
    verificationToken?: string;
  } | null>(null);
  const [showDeviceNameEditor, setShowDeviceNameEditor] = useState(false);
  const [showQueuePasswordDialog, setShowQueuePasswordDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingSendDeviceId, setPendingSendDeviceId] = useState<string | null>(null);
  const [showReceiveRequestDialog, setShowReceiveRequestDialog] = useState(false);
  const [showPasswordInputDialog, setShowPasswordInputDialog] = useState(false);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [pendingReceiveFile, setPendingReceiveFile] = useState<{
    senderName: string;
    senderDeviceId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    passwordProtected: boolean;
    encrypted?: boolean;
    encryptionMethod?: string;
    verificationToken?: string;
  } | null>(null);
  const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([]);
  // const [transferEncryptionConfig, setTransferEncryptionConfig] = useState<{
  //   password: string | null;
  //   enableEncryption: boolean;
  //   encryptionMethod: EncryptionMethod;
  // } | null>(null);

  // 处理文件选择（支持单文件和多文件）
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 先清空之前的选择
    fileTransferManager.fullReset();
    setCurrentFile(null);

    if (files.length === 1) {
      // 单文件模式
      const file = files[0];
      console.log('[App] Single file selected:', file.name, file.size);
      const success = await fileTransferManager.selectFile(file);
      if (success) {
        setCurrentFile({
          name: file.name,
          size: file.size,
          type: file.type,
        });
      } else {
        console.error('[App] File validation failed');
        e.target.value = '';
      }
    } else {
      // 多文件模式
      console.log('[App] Multiple files selected:', files.length);
      const filesArray = Array.from(files);
      const success = await fileTransferManager.selectFiles(filesArray);
      if (!success) {
        console.error('[App] Files validation failed');
        e.target.value = '';
      }
    }
  };

  // 处理拖拽
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // 先清空之前的选择
    fileTransferManager.fullReset();
    setCurrentFile(null);

    if (files.length === 1) {
      // 单文件模式
      const file = files[0];
      console.log('[App] Single file dropped:', file.name, file.size);
      const success = await fileTransferManager.selectFile(file);
      if (success) {
        setCurrentFile({
          name: file.name,
          size: file.size,
          type: file.type,
        });
      } else {
        console.error('[App] File validation failed');
      }
    } else {
      // 多文件模式
      console.log('[App] Multiple files dropped:', files.length);
      const filesArray = Array.from(files);
      await fileTransferManager.selectFiles(filesArray);
    }
  };

  // 移除队列中的文件
  const handleRemoveFile = (index: number) => {
    if (!isQueueMode && currentFile) {
      fileTransferManager.fullReset();
      setCurrentFile(null);
      return;
    }

    fileTransferManager.removeFileFromQueue(index);
  };

  // 添加更多文件
  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);

    if (isQueueMode || fileQueue.length > 0) {
      // 已有队列，继续添加
      await fileTransferManager.appendFiles(filesArray);
    } else if (currentFile) {
      // 已有单文件，转换为队列模式
      const currentFileObj = fileTransferManager.getCurrentFile();
      if (currentFileObj) {
        await fileTransferManager.selectFiles([currentFileObj, ...filesArray]);
        setCurrentFile(null);
      }
    } else {
      // 没有文件，新建选择
      if (filesArray.length === 1) {
        const file = filesArray[0];
        const success = await fileTransferManager.selectFile(file);
        if (success) {
          setCurrentFile({
            name: file.name,
            size: file.size,
            type: file.type,
          });
        }
      } else {
        await fileTransferManager.selectFiles(filesArray);
      }
    }

    // 清空input
    e.target.value = '';
  };

  // 清空所有文件
  const handleClearAll = () => {
    fileTransferManager.clearFileQueue();
    setCurrentFile(null);
    setP2PSessionState('idle');
  };

  // 发送文件（支持单文件和多文件）
  const handleSendFile = async () => {
    if (!selectedDeviceId) return;

    // 检查连接状态
    if (!isConnected) {
      alert('未连接到信令服务器\n\n请检查：\n1. 信令服务器是否正常运行\n2. 网络连接是否正常\n3. 刷新页面重试');
      return;
    }

    // 显示密码对话框，让用户选择是否加密
    setPendingSendDeviceId(selectedDeviceId);
    setShowPasswordDialog(true);
  };

  // 处理密码对话框确认
  const handlePasswordConfirm = async (options: {
    password: string | null;
    enableEncryption: boolean;
    encryptionMethod: EncryptionMethod;
  }) => {
    setShowPasswordDialog(false);

    if (!pendingSendDeviceId) return;

    try {
      if (isQueueMode) {
        // 多文件模式：发送文件列表（包含加密配置）
        console.log('[App] Sending queue with encryption:', options);
        const success = await fileTransferManager.sendFileList(pendingSendDeviceId, {
          password: options.password,
          enableEncryption: options.enableEncryption,
          encryptionMethod: options.encryptionMethod,
        });
        if (success) {
          setP2PSessionState('sending');
        }
        if (!success) {
          alert('发送失败\n\n可能原因：\n1. 信令服务器连接断开\n2. 目标设备离线\n3. 网络连接问题\n\n建议：刷新页面重试');
        }
      } else {
        // 单文件模式：将加密配置传递给 FileTransferManager
        await fileTransferManager.sendFile(pendingSendDeviceId, {
          password: options.password,
          enableEncryption: options.enableEncryption,
          encryptionMethod: options.encryptionMethod,
        });
      }
    } catch (error) {
      console.error('[App] Send file error:', error);
      alert('发送失败：' + (error as Error).message);
    } finally {
      setPendingSendDeviceId(null);
    }
  };

  // 处理密码对话框取消
  const handlePasswordCancel = () => {
    setShowPasswordDialog(false);
    setPendingSendDeviceId(null);
  };

  // 第一步：处理用户点击接受（显示第一个对话框后）
  const handleReceiveRequestAccept = () => {
    if (!pendingReceiveFile) return;

    // 关闭第一个对话框
    setShowReceiveRequestDialog(false);

    // 如果有密码保护或加密，显示密码输入对话框
    if (pendingReceiveFile.passwordProtected || pendingReceiveFile.encrypted) {
      setShowPasswordInputDialog(true);
    } else {
      // 没有密码，直接开始传输
      startReceiving(null);
    }
  };

  // 第一步：处理用户点击拒绝
  const handleReceiveRequestReject = () => {
    setShowReceiveRequestDialog(false);
    setPendingReceiveFile(null);
    setP2PSessionState('idle');

    // 拒绝接收
    console.log('[App] File transfer rejected by user');
    fileTransferManager.rejectReceive();
  };

  // 第一步：处理用户点击拒绝并屏蔽
  const handleReceiveRequestRejectAndBlock = (durationMs: number) => {
    if (!pendingReceiveFile) return;

    // 屏蔽设备
    deviceBlockManager.blockDevice(
      pendingReceiveFile.senderDeviceId,
      pendingReceiveFile.senderName,
      durationMs
    );

    // 更新屏蔽列表
    setBlockedDevices(deviceBlockManager.getBlockedDevices());

    // 拒绝接收
    setShowReceiveRequestDialog(false);
    setPendingReceiveFile(null);
    setP2PSessionState('idle');
    fileTransferManager.rejectReceive();

    const minutes = Math.ceil(durationMs / 1000 / 60);
    console.log(`[App] Device ${pendingReceiveFile.senderName} blocked for ${minutes} minutes`);
    alert(`已屏蔽设备 ${pendingReceiveFile.senderName}，时长 ${minutes} 分钟`);
  };

  // 解除屏蔽设备
  const handleUnblockDevice = (deviceId: string) => {
    deviceBlockManager.unblockDevice(deviceId);
    setBlockedDevices(deviceBlockManager.getBlockedDevices());
    console.log(`[App] Device ${deviceId} unblocked`);
  };

  // 第二步：处理密码输入
  const handlePasswordInput = async (password: string) => {
    if (!pendingReceiveFile) return;

    // 验证密码
    if (pendingReceiveFile.verificationToken && pendingReceiveFile.encryptionMethod) {
      try {
        const encryptionHelper = new FileEncryptionHelper();
        const isValid = await encryptionHelper.verifyPassword(
          pendingReceiveFile.verificationToken,
          password,
          pendingReceiveFile.encryptionMethod as EncryptionMethod
        );

        if (!isValid) {
          alert('密码错误\n\n请输入正确的密码');
          return; // 不关闭对话框，让用户重新输入
        }
        console.log('[App] Password verified successfully');
      } catch (error) {
        console.error('[App] Password verification error:', error);
        alert('密码验证失败\n\n请重试');
        return;
      }
    }

    // 密码验证通过，关闭对话框，开始传输
    setShowPasswordInputDialog(false);
    startReceiving(password);
  };

  // 第二步：处理取消密码输入
  const handlePasswordInputCancel = () => {
    setShowPasswordInputDialog(false);
    setPendingReceiveFile(null);
    setP2PSessionState('idle');

    // 取消接收
    console.log('[App] Password input cancelled, rejecting transfer');
    fileTransferManager.rejectReceive();
  };

  // 开始接收文件
  const startReceiving = async (password: string | null) => {
    setTransferMode('p2p');
    setMode('receive');
    setP2PSessionState('receiving');

    // 设置解密密码
    if (password) {
      console.log('[App] Starting receive with password for decryption');
      fileTransferManager.setReceivePassword(password);
    } else {
      console.log('[App] Starting receive without password');
      fileTransferManager.setReceivePassword(null);
    }

    // 确认接收，开始传输
    await fileTransferManager.confirmReceive();

    // 清空状态
    setPendingReceiveFile(null);
  };

  // 处理接收到的文件列表
  const handleFileListReceived = (
    files: any[],
    totalSize: number,
    senderDeviceId?: string,
    senderDeviceName?: string,
    encryptionInfo?: {
      passwordProtected?: boolean;
      encrypted?: boolean;
      encryptionMethod?: string;
      verificationToken?: string;
    }
  ) => {
    // 保存完整的文件列表数据
    const fileListData = {
      files,
      totalSize,
      ...encryptionInfo,
    };
    setPendingFileList(fileListData);

    // 使用发送者设备名，如果没有则尝试从设备列表查找，最后使用默认值
    let senderName = senderDeviceName || '未知设备';
    if (!senderDeviceName && senderDeviceId) {
      const senderDevice = devices.find(d => d.id === senderDeviceId);
      if (senderDevice) {
        senderName = senderDevice.name;
      }
    }

    // 检查设备是否被屏蔽
    if (senderDeviceId && deviceBlockManager.isBlocked(senderDeviceId)) {
      const remainingTime = deviceBlockManager.getRemainingTime(senderDeviceId);
      console.log(`[FileTransferPage] Auto-rejected: device ${senderName} is blocked (${remainingTime}s remaining)`);

      // 自动拒绝
      fileTransferManager.rejectFileList();

      // 显示通知
      alert(`已自动拒绝来自 ${senderName} 的文件列表\n该设备已被屏蔽，剩余时间: ${Math.ceil(remainingTime / 60)} 分钟`);
      return;
    }

    // 保存请求信息用于确认对话框
    setPendingFileListRequest({
      senderName,
      senderDeviceId: senderDeviceId || '',
      fileCount: files.length,
      totalSize,
      ...encryptionInfo,
    });

    // 显示确认对话框
    setShowFileListRequestDialog(true);

    // 播放提示音和显示浏览器通知
    playNotificationSound();
    showBrowserNotification(senderName, `${files.length} 个文件`, totalSize);
  };

  // 接受文件列表
  const handleFileListAccept = () => {
    setShowFileListRequestDialog(false);
    setTransferMode('p2p');
    setMode('receive');
    setP2PSessionState('receiving');

    if (!pendingFileList) return;

    // 如果有密码保护，显示密码输入对话框
    if (pendingFileList.passwordProtected) {
      console.log('[App] Queue is password protected, showing password dialog');
      setShowQueuePasswordDialog(true);
    } else {
      // 没有密码，直接显示文件选择器
      setShowFileSelector(true);
    }
  };

  // 拒绝文件列表
  const handleFileListReject = () => {
    setShowFileListRequestDialog(false);
    setPendingFileListRequest(null);
    setPendingFileList(null);
    setP2PSessionState('idle');

    // 调用后端拒绝方法
    fileTransferManager.rejectFileList();
  };

  // 拒绝并屏蔽设备
  const handleFileListRejectAndBlock = (durationMs: number) => {
    if (!pendingFileListRequest?.senderDeviceId) return;

    deviceBlockManager.blockDevice(
      pendingFileListRequest.senderDeviceId,
      pendingFileListRequest.senderName,
      durationMs
    );
    setBlockedDevices(deviceBlockManager.getBlockedDevices());

    setShowFileListRequestDialog(false);
    setPendingFileListRequest(null);
    setPendingFileList(null);
    setP2PSessionState('idle');

    // 调用后端拒绝方法
    fileTransferManager.rejectFileList();
  };

  // 处理队列密码验证
  const handleQueuePasswordInput = async (password: string) => {
    if (!pendingFileList) return;

    // 验证密码
    if (pendingFileList.verificationToken && pendingFileList.encryptionMethod) {
      try {
        const encryptionHelper = new FileEncryptionHelper();
        const isValid = await encryptionHelper.verifyPassword(
          pendingFileList.verificationToken,
          password,
          pendingFileList.encryptionMethod as EncryptionMethod
        );

        if (!isValid) {
          alert('密码错误，请重试');
          return; // 保持对话框打开
        }

        console.log('[App] Queue password verified successfully');

        // 保存密码到 FileTransferManager
        fileTransferManager.setReceivePassword(password);

        // 关闭密码对话框，显示文件选择器
        setShowQueuePasswordDialog(false);
        setShowFileSelector(true);
      } catch (error) {
        console.error('[App] Password verification failed:', error);
        alert('密码验证失败：' + (error as Error).message);
      }
    }
  };

  // 处理队列密码对话框取消
  const handleQueuePasswordCancel = () => {
    setShowQueuePasswordDialog(false);
    setPendingFileList(null);
    setP2PSessionState('idle');
    fileTransferManager.fullReset();
  };

  // 确认接收文件选择
  const handleFileSelectionConfirm = async (selectedIndexes: number[]) => {
    setShowFileSelector(false);
    await fileTransferManager.sendFileSelection(selectedIndexes);
    setPendingFileList(null);
  };

  // 取消文件选择
  const handleFileSelectionCancel = () => {
    setShowFileSelector(false);
    setPendingFileList(null);
    setP2PSessionState('idle');
    fileTransferManager.fullReset();
  };

  // 下载文件
  const handleDownload = async () => {
    // 先尝试从内存中下载（刚接收完的文件）
    const downloadInfo = fileTransferManager.getDownloadInfo();
    if (downloadInfo) {
      fileTransferManager.downloadFile();
      return;
    }

    // 如果内存中没有，从 IndexedDB 加载
    try {
      const lastFileId = localStorage.getItem('meshkit_last_file_id');
      if (!lastFileId) {
        console.error('[App] No file to download');
        alert('没有可下载的文件');
        return;
      }

      const storedFile = await fileStorage.getFile(lastFileId);
      if (!storedFile) {
        console.error('[App] File not found in storage');
        alert('文件未找到，可能已被清理');
        return;
      }

      // 创建下载链接
      const url = URL.createObjectURL(storedFile.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = storedFile.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[App] File downloaded from IndexedDB:', storedFile.filename);
    } catch (error) {
      console.error('[App] Failed to download file:', error);
      alert('下载失败：' + (error as Error).message);
    }
  };

  // 下载特定文件（用于多文件队列）
  const handleDownloadFile = async (filename: string) => {
    try {
      // 优先从 fileQueue 的 receivedBlob 获取（支持大文件）
      const queueItem = fileQueue.find(item => item.metadata.name === filename);

      if (queueItem?.receivedBlob) {
        console.log('[App] Downloading file from queue receivedBlob:', filename);

        // 创建下载链接
        const url = URL.createObjectURL(queueItem.receivedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[App] File downloaded from queue:', filename);
        return;
      }

      // 如果 queue 中没有，尝试从 IndexedDB 获取（小文件）
      console.log('[App] Trying to download file from IndexedDB:', filename);
      const files = await fileStorage.getAllFiles();
      const file = files.find(f => f.filename === filename);

      if (!file) {
        alert(`文件 ${filename} 未找到`);
        return;
      }

      // 创建下载链接
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[App] File downloaded from IndexedDB:', filename);
    } catch (error) {
      console.error('[App] Failed to download file:', error);
      alert('下载失败：' + (error as Error).message);
    }
  };

  const handleDownloadQueueFile = async (fileIndex: number, filename: string) => {
    const success = fileTransferManager.downloadFileByIndex(fileIndex);
    if (!success) {
      await handleDownloadFile(filename);
    }
  };

  const handleMarkP2PReceiveCompleted = () => {
    const success = (fileTransferManager as typeof fileTransferManager & {
      confirmP2PReceiveCompleted: () => boolean;
    }).confirmP2PReceiveCompleted();
    if (!success) {
      alert('当前还没有可确认完成的接收文件');
      return;
    }

    setP2PSessionState('idle');
    window.alert('已标记为已完成，发送方现在可以结束本次点对点传输了。');
  };

  const handleCancelP2PSend = () => {
    const confirmMessage = p2pSessionState === 'waiting_receiver_complete'
      ? '接收方还没有点击“标记为已完成”。\n\n确定要取消本次发送并离开当前状态吗？'
      : p2pSessionState === 'sending'
        ? '对方还没有确认接收。\n\n确定要取消本次发送吗？'
        : '文件正在传输中，取消后本次点对点传输会立即中断。\n\n确定要取消发送吗？';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    (fileTransferManager as typeof fileTransferManager & {
      cancelP2PSend: (message?: string) => void;
    }).cancelP2PSend();
  };

  // 选择设备
  const handleSelectDevice = (deviceId: string) => {
    if (selectedDeviceId === deviceId) {
      deviceManager.clearSelection();
      selectDevice(null);
      return;
    }

    deviceManager.selectDevice(deviceId);
    selectDevice(deviceId);
  };

  const handleRefreshDevices = () => {
    if (isRefreshingDevices) return;

    setIsRefreshingDevices(true);
    deviceManager.clearSelection();
    selectDevice(null);

    try {
      signalingClient.disconnect();
      const signalingURL = config.getSignalingURL();
      window.setTimeout(() => {
        try {
          connectSignaling(signalingURL);
        } catch (error) {
          console.error('[FileTransferPage] Failed to refresh devices:', error);
          setIsRefreshingDevices(false);
        }
      }, 120);
    } catch (error) {
      console.error('[FileTransferPage] Failed to restart signaling connection:', error);
      setIsRefreshingDevices(false);
    }
  };

  // 更新设备名
  const handleUpdateDeviceName = (newName: string) => {
    try {
      const updatedName = updateDeviceName(newName);

      // 更新localStorage
      localStorage.setItem('meshkit_device_name', updatedName);

      // 更新store
      const deviceId = localStorage.getItem('meshkit_device_id') || '';
      setMyDevice(deviceId, updatedName);

      setShowDeviceNameEditor(false);
    } catch (error) {
      console.error('[App] Failed to update device name:', error);
      alert('更新设备名失败：' + (error as Error).message);
    }
  };

  const formatFileSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  // 监听文件列表接收事件
  useEffect(() => {
    const handleFileListEvent = ({
      files,
      totalSize,
      senderDeviceId,
      senderDeviceName,
      passwordProtected,
      encrypted,
      encryptionMethod,
      verificationToken,
    }: any) => {
      handleFileListReceived(files, totalSize, senderDeviceId, senderDeviceName, {
        passwordProtected,
        encrypted,
        encryptionMethod,
        verificationToken,
      });
    };

    eventBus.on('transfer:file-list-received', handleFileListEvent);

    return () => {
      eventBus.off('transfer:file-list-received', handleFileListEvent);
    };
  }, [devices]);

  const displayedMyDeviceName = getDisplayDeviceName(myDeviceName || '');

  // 加载被屏蔽设备列表
  useEffect(() => {
    const updateBlockedDevices = () => {
      setBlockedDevices(deviceBlockManager.getBlockedDevices());
    };

    updateBlockedDevices();
    const interval = setInterval(updateBlockedDevices, 5000); // 每5秒更新一次

    return () => clearInterval(interval);
  }, []);

  // 监听接收文件请求事件
  useEffect(() => {
    const handleReceiveRequest = ({
      file,
      senderDeviceId,
      senderDeviceName,
    }: {
      file: any;
      senderDeviceId?: string;
      senderDeviceName?: string;
    }) => {
      // 使用发送者设备名，如果没有则尝试从设备列表查找，最后使用默认值
      let senderName = senderDeviceName || '未知设备';
      if (!senderDeviceName && senderDeviceId) {
        const senderDevice = devices.find(d => d.id === senderDeviceId);
        if (senderDevice) {
          senderName = senderDevice.name;
        }
      }

      // 检查设备是否被屏蔽
      if (senderDeviceId && deviceBlockManager.isBlocked(senderDeviceId)) {
        const remainingTime = deviceBlockManager.getRemainingTime(senderDeviceId);
        console.log(`[FileTransferPage] Auto-rejected: device ${senderName} is blocked (${remainingTime}s remaining)`);

        // 自动拒绝
        fileTransferManager.rejectReceive();

        // 显示通知
        alert(`已自动拒绝来自 ${senderName} 的文件传输请求\n该设备已被屏蔽，剩余时间: ${Math.ceil(remainingTime / 60)} 分钟`);
        return;
      }

      const pendingFile = {
        senderName,
        senderDeviceId: senderDeviceId || '',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        passwordProtected: file.passwordProtected || false,
        encrypted: file.encrypted || false,
        encryptionMethod: file.encryptionMethod,
        verificationToken: file.verificationToken,
      };

      setPendingReceiveFile(pendingFile);
      setShowReceiveRequestDialog(true);

      // 播放提示音或显示通知
      playNotificationSound();
      showBrowserNotification(senderName, file.name, file.size);
    };

    eventBus.on('transfer:receive-request', handleReceiveRequest);

    return () => {
      eventBus.off('transfer:receive-request', handleReceiveRequest);
    };
  }, [devices]);

  // 监听传输被拒绝事件
  useEffect(() => {
    const handleTransferRejected = ({ direction, message }: { direction: string; message?: string }) => {
      setP2PSessionState('idle');

      if (direction === 'send') {
        // 发送方：接收方拒绝了传输
        const displayMessage = message || '接收方拒绝了文件传输';
        alert(`${displayMessage}\n\n您可以重新发送文件。`);
        console.log('[FileTransferPage] Transfer rejected:', displayMessage);
      }
    };

    eventBus.on('transfer:rejected', handleTransferRejected);

    return () => {
      eventBus.off('transfer:rejected', handleTransferRejected);
    };
  }, [setP2PSessionState]);

  useEffect(() => {
    const handleTransferCancelled = ({
      direction,
      message,
    }: {
      direction: 'send' | 'receive';
      message?: string;
    }) => {
      setP2PSessionState('idle');

      if (direction === 'receive') {
        const displayMessage = message || '发送方已取消本次传输';
        alert(`${displayMessage}\n\n您可以离开当前页面；已经接收完成的文件仍可继续保存。`);
        return;
      }

      alert(message || '已取消发送，本次点对点传输已结束。');
    };

    eventBus.on('transfer:cancelled', handleTransferCancelled);

    return () => {
      eventBus.off('transfer:cancelled', handleTransferCancelled);
    };
  }, [setP2PSessionState]);

  useEffect(() => {
    const handleRoomDissolved = ({
      room,
      message,
      initiatedByHost,
    }: {
      room: { hostId: string };
      message: string;
      initiatedByHost: boolean;
    }) => {
      resetRoom();
      setTransferMode('room');
      setMode('receive');

      if (initiatedByHost && room.hostId !== myDeviceId) {
        alert(`${message}\n\n请让房主重新生成取件码后再加入。`);
        return;
      }

      alert(message);
    };

    (eventBus as any).on('room:dissolved', handleRoomDissolved);

    return () => {
      (eventBus as any).off('room:dissolved', handleRoomDissolved);
    };
  }, [myDeviceId, resetRoom, setMode, setTransferMode]);

  const uiReadyFileCount = isQueueMode ? fileQueue.length : currentFile ? 1 : 0;
  const uiActiveFlowLabel = transferMode === 'room'
    ? (mode === 'send' ? '取件码分享' : '取件码加入')
    : (mode === 'send' ? '点对点发送' : '点对点接收');
  const uiModeSummaryLabel = transferMode === 'room'
    ? (mode === 'send' ? '取件码' : '输入取件码')
    : '点对点';
  const uiShowSendQueue = isQueueMode && queueDirection === 'send' && fileQueue.length > 0;
  const uiShowReceiveQueue = isQueueMode && queueDirection === 'receive' && fileQueue.length > 0;
  const uiDisplaySendQueue: FileQueueItem[] = uiShowSendQueue
    ? fileQueue
    : currentFile
      ? [{
          file: new File([], currentFile.name, { type: currentFile.type }),
          index: 0,
          metadata: {
            name: currentFile.name,
            size: currentFile.size,
            type: currentFile.type,
          },
          status: 'pending',
          progress: 0,
          selected: true,
        }]
      : [];
  const uiSelectedReceiveFiles = fileQueue.filter(item => item.selected);
  const uiSelectedReceiveTotalSize = uiSelectedReceiveFiles.reduce((sum, item) => sum + item.metadata.size, 0);
  const uiAllReceiveFilesCompleted = uiSelectedReceiveFiles.length > 0
    && uiSelectedReceiveFiles.every((item) => item.status === 'completed' || !!item.receivedBlob);
  const uiCanMarkP2PReceiveCompleted = (p2pSessionState === 'received_waiting_complete' || p2pSessionState === 'receiving')
    && ((uiShowReceiveQueue && uiAllReceiveFilesCompleted) || (!uiShowReceiveQueue && hasDownload));
  const uiSingleDownloadInfo = hasDownload ? fileTransferManager.getDownloadInfo() : null;
  const uiCanSendFile = uiDisplaySendQueue.length > 0 && !!selectedDeviceId && !isTransferring;

  useEffect(() => {
    if (!isRefreshingDevices) return;

    const finishRefresh = () => setIsRefreshingDevices(false);
    const fallbackTimer = window.setTimeout(() => {
      setIsRefreshingDevices(false);
    }, 2500);

    eventBus.on('device:list-updated', finishRefresh);
    eventBus.on('signaling:error', finishRefresh);

    return () => {
      window.clearTimeout(fallbackTimer);
      eventBus.off('device:list-updated', finishRefresh);
      eventBus.off('signaling:error', finishRefresh);
    };
  }, [isRefreshingDevices]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const sharedPickup = parseShareInvitePayloadFromUrl(window.location.href)?.pickup;
    if (!sharedPickup?.code) {
      return;
    }

    setTransferMode('room');
    setMode('receive');
  }, [setMode, setTransferMode]);

  return (
    <ExperiencePage>
      <ExperienceHero
        eyebrow="MeshKit Transfer"
        title="文件传输"
        description="点对点发送文件或通过取件码分享，所有传输端到端加密。"
      >
        <div className="overflow-hidden rounded-[14px] border border-[#e8ecf2] bg-white shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
          <div className="grid grid-cols-3 divide-x divide-[#e8ecf2]">
            <div className="flex items-center gap-3 px-4 py-4 md:px-5">
              <span className={`h-2.5 w-2.5 rounded-full ${
                isConnected
                  ? 'bg-[#10b981] shadow-[0_0_0_4px_rgba(16,185,129,0.16)]'
                  : 'bg-[#ef4444] shadow-[0_0_0_4px_rgba(239,68,68,0.14)]'
              }`} />
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8e95b2]">连接</div>
                <div className="text-[13px] font-semibold text-[#1a1f36]">{isConnected ? '已连接' : '未连接'}</div>
              </div>
            </div>
            <div className="px-4 py-4 md:px-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8e95b2]">模式</div>
              <div className="text-[13px] font-semibold text-[#1a1f36]">{uiModeSummaryLabel}</div>
            </div>
            <div className="px-4 py-4 md:px-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8e95b2]">就绪文件</div>
              <div className="text-[13px] font-semibold text-[#1a1f36]">{uiReadyFileCount}</div>
            </div>
          </div>
        </div>
      </ExperienceHero>

      {showDeviceNameEditor && (
        <DeviceNameEditor
          currentName={myDeviceName || ''}
          onSave={handleUpdateDeviceName}
          onCancel={() => setShowDeviceNameEditor(false)}
        />
      )}
      {showPasswordDialog && <PasswordDialog onConfirm={handlePasswordConfirm} onCancel={handlePasswordCancel} />}
      {showReceiveRequestDialog && pendingReceiveFile && (
        <ReceiveRequestDialog
          senderName={pendingReceiveFile.senderName}
          fileName={pendingReceiveFile.fileName}
          fileSize={pendingReceiveFile.fileSize}
          fileType={pendingReceiveFile.fileType}
          passwordProtected={pendingReceiveFile.passwordProtected}
          encrypted={pendingReceiveFile.encrypted}
          encryptionMethod={pendingReceiveFile.encryptionMethod}
          onAccept={handleReceiveRequestAccept}
          onReject={handleReceiveRequestReject}
          onRejectAndBlock={handleReceiveRequestRejectAndBlock}
        />
      )}
      {showFileListRequestDialog && pendingFileListRequest && (
        <FileListRequestDialog
          senderName={pendingFileListRequest.senderName}
          fileCount={pendingFileListRequest.fileCount}
          totalSize={pendingFileListRequest.totalSize}
          passwordProtected={pendingFileListRequest.passwordProtected || false}
          encrypted={pendingFileListRequest.encrypted}
          encryptionMethod={pendingFileListRequest.encryptionMethod}
          onAccept={handleFileListAccept}
          onReject={handleFileListReject}
          onRejectAndBlock={handleFileListRejectAndBlock}
        />
      )}
      {showPasswordInputDialog && pendingReceiveFile && (
        <PasswordInputDialog fileName={pendingReceiveFile.fileName} onConfirm={handlePasswordInput} onCancel={handlePasswordInputCancel} />
      )}
      {showQueuePasswordDialog && pendingFileList && (
        <PasswordInputDialog fileName={`${pendingFileList.files.length} 个文件`} onConfirm={handleQueuePasswordInput} onCancel={handleQueuePasswordCancel} />
      )}

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <ExperienceCard className="p-6">
            <div className="mb-4">
              <div className="text-[13px] font-semibold text-[#1a1f36]">我的设备</div>
              <div className="mt-1 text-xs text-[#8e95b2]">对方将看到此名称</div>
            </div>
            <div className="flex items-center gap-3 rounded-[12px] border border-[#f0f3f8] bg-[#f8fafd] px-4 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#e8f0ff] text-[#1a6dff]">
                <DeviceKindIcon deviceName={myDeviceName || ''} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#1a1f36]">{displayedMyDeviceName || '未知设备'}</span>
              <button onClick={() => setShowDeviceNameEditor(true)} className="rounded-[8px] p-2 text-[#8e95b2] transition hover:bg-white hover:text-[#1a6dff]" title="编辑设备名称">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          </ExperienceCard>

          <ExperienceCard className="p-6">
            <div className="mb-4">
              <div className="text-[13px] font-semibold text-[#1a1f36]">网络状态</div>
              <div className="mt-1 text-xs text-[#8e95b2]">发现 {devices.length} 台设备</div>
            </div>
            <div className={`flex items-center gap-3 rounded-[12px] border px-4 py-4 ${isConnected ? 'border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.05)]' : 'border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.05)]'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${isConnected ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981]' : 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]'}`}>
                <WifiSignalIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className={`text-[13px] font-medium ${isConnected ? 'text-[#059669]' : 'text-[#ef4444]'}`}>
                  {isConnected ? '已连接' : '等待连接'}
                </div>
                <div className="mt-1 text-xs text-[#8e95b2]">{uiActiveFlowLabel}</div>
              </div>
            </div>
          </ExperienceCard>
        </div>

        <ExperienceCard className="p-3">
          <RoomModeSelector />
        </ExperienceCard>

        {transferMode === 'p2p' && mode === 'send' && (
          <div className="space-y-4">
            {uiDisplaySendQueue.length === 0 && (
              <ExperienceCard className="p-0">
                <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => document.getElementById('transfer-file-input')?.click()} className={`cursor-pointer rounded-[14px] border-2 border-dashed px-6 py-14 text-center transition ${dragOver ? 'border-[#1a6dff] bg-[#e8f0ff]' : 'border-[#e8ecf2] bg-[#f8fafd] hover:border-[#c9d9ff] hover:bg-[#f4f8ff]'}`}>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[#e8f0ff] text-[#1a6dff]">
                    <TransferInboxIcon className="h-6 w-6" />
                  </div>
                  <div className="text-[15px] font-semibold text-[#1a1f36]">选择文件</div>
                  <div className="mt-2 text-[12px] text-[#8e95b2]">点击或拖拽文件到此处</div>
                  <input id="transfer-file-input" type="file" multiple onChange={handleFileSelect} className="hidden" />
                </div>
              </ExperienceCard>
            )}

            {uiDisplaySendQueue.length > 0 && (
              <ExperienceCard className="p-5">
                <FileQueue queue={uiDisplaySendQueue} isSender={true} onRemove={handleRemoveFile} />
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => document.getElementById('transfer-file-input')?.click()} className="flex-1 rounded-full border border-[#bfd6ff] bg-white px-4 py-3 text-[13px] font-semibold text-[#4f5d87] transition hover:border-[#1a6dff] hover:text-[#1a6dff]">更换文件</button>
                  <button onClick={() => document.getElementById('transfer-add-files-input')?.click()} className="flex-1 rounded-full bg-[#1a6dff] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#0a4fc9]">添加文件</button>
                  <button onClick={handleClearAll} className="flex-1 rounded-full bg-[#e11d48] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#be123c]">清空</button>
                </div>
              </ExperienceCard>
            )}

            <input id="transfer-file-input" type="file" multiple onChange={handleFileSelect} className="hidden" />
            <input id="transfer-add-files-input" type="file" multiple onChange={handleAddFiles} className="hidden" />

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[15px] font-semibold text-[#1a1f36]">选择设备</div>
                <button
                  onClick={handleRefreshDevices}
                  disabled={isRefreshingDevices}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d8e5ff] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1a6dff] transition hover:border-[#1a6dff] hover:bg-[#f4f8ff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshIcon className={`h-3.5 w-3.5 ${isRefreshingDevices ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingDevices ? '刷新中...' : '刷新设备'}</span>
                </button>
              </div>
              {devices.length === 0 ? (
                <ExperienceCard className="border-dashed bg-[#f8fafd] py-10 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-[#8e95b2]">
                    <WifiSignalIcon className="h-6 w-6" />
                  </div>
                  <div className="text-[14px] font-semibold text-[#4f5d87]">
                    {isRefreshingDevices ? '正在搜索设备...' : '未发现其他设备'}
                  </div>
                  <div className="mt-2 text-[12px] text-[#8e95b2]">
                    {isRefreshingDevices ? '请稍候，正在重新检测可连接设备' : '请确保其他设备也打开了此页面'}
                  </div>
                </ExperienceCard>
              ) : (
                <div className="space-y-3">
                  {devices.map((device) => {
                    const selected = selectedDeviceId === device.id;
                    return (
                      <ExperienceCard
                        key={device.id}
                        className={`cursor-pointer p-4 transition ${
                          selected
                            ? 'border-[#1a6dff] bg-[#f4f8ff] shadow-[0_10px_28px_rgba(26,109,255,0.18)] ring-2 ring-[#d8e5ff]'
                            : 'hover:border-[#cdd8eb] hover:bg-[#fbfcff]'
                        }`}
                      >
                        <button
                          onClick={() => handleSelectDevice(device.id)}
                          className="flex w-full items-center gap-3 text-left"
                          aria-pressed={selected}
                        >
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border ${selected ? 'border-[#bfd6ff] bg-[#e8f0ff] text-[#1a6dff]' : 'border-[#eef2f8] bg-[#f8fafd] text-[#5e6687]'}`}>
                            <DeviceKindIcon deviceName={device.name} className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-semibold text-[#1a1f36]">{getDisplayDeviceName(device.name)}</div>
                            <div className={`mt-1 text-[12px] ${selected ? 'text-[#1a6dff]' : 'text-[#8e95b2]'}`}>
                              {selected ? '已选中，再点一次可取消' : '设备在线，点击选择'}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                              selected
                                ? 'bg-[#1a6dff] text-white'
                                : 'bg-[#f3f6fb] text-[#8e95b2]'
                            }`}
                          >
                            {selected ? '已选中' : '可选'}
                          </span>
                        </button>
                      </ExperienceCard>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={handleSendFile} disabled={!uiCanSendFile} className="w-full rounded-[14px] bg-[#1a6dff] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(26,109,255,0.28)] transition hover:bg-[#0a4fc9] disabled:cursor-not-allowed disabled:opacity-50">
              {uiDisplaySendQueue.length > 1 ? `发送 ${uiDisplaySendQueue.length} 个文件` : '发送文件'}
            </button>

            {p2pSessionState === 'sending' && !isTransferring && (
              <ExperienceCard className="border-[#d8e5ff] bg-[#f5f9ff] p-5">
                <div className="text-[15px] font-semibold text-[#1a1f36]">等待对方确认接收</div>
                <div className="mt-2 text-[13px] leading-7 text-[#5e6687]">
                  文件请求已经发出，请保持当前页面开启。对方选择要接收的文件后，会自动开始点对点传输。
                </div>
              </ExperienceCard>
            )}

            {p2pSessionState === 'waiting_receiver_complete' && (
              <ExperienceCard className="border-[#d8e5ff] bg-[#f5f9ff] p-5">
                <div className="text-[15px] font-semibold text-[#1a1f36]">等待接收方确认完成</div>
                <div className="mt-2 text-[13px] leading-7 text-[#5e6687]">
                  文件已经传输完成，请继续留在当前页面，等待接收方点击“标记为已完成”。
                </div>
              </ExperienceCard>
            )}

            {isTransferring && transferProgress && transferProgress.direction === 'send' && (
              <ExperienceCard className="p-5">
                <div className="mb-3 flex items-center justify-between text-[12px] text-[#5e6687]">
                  <span className="font-semibold text-[#1a1f36]">{transferProgress.progress.toFixed(1)}%</span>
                  <span>{transferProgress.speedMB} MB/s</span>
                  <span>剩余 {transferProgress.remainingTime}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-[#e8ecf2]">
                  <div className="h-3 rounded-full bg-[#1a6dff] transition-all" style={{ width: `${transferProgress.progress}%` }} />
                </div>
              </ExperienceCard>
            )}

            {(isTransferring || p2pSessionState === 'sending' || p2pSessionState === 'waiting_receiver_complete') && (
              <button
                onClick={handleCancelP2PSend}
                className="w-full rounded-[14px] border border-[rgba(239,68,68,0.28)] bg-white px-6 py-4 text-[15px] font-semibold text-[#ef4444] transition hover:bg-[rgba(239,68,68,0.04)]"
              >
                取消发送
              </button>
            )}
          </div>
        )}

        {transferMode === 'p2p' && mode === 'receive' && (
          <div className="space-y-4">
            {showFileSelector && pendingFileList && (
              <ExperienceCard className="overflow-hidden border-none bg-transparent p-0 shadow-none hover:shadow-none">
                <FileSelector files={pendingFileList.files} totalSize={pendingFileList.totalSize} onConfirm={handleFileSelectionConfirm} onCancel={handleFileSelectionCancel} />
              </ExperienceCard>
            )}
            {!isTransferring && !hasDownload && !showFileSelector && !uiShowReceiveQueue && (
              <ExperienceCard className="border-dashed bg-[#f8fafd] py-12 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-[#8e95b2]">
                  <WifiSignalIcon className="h-6 w-6" />
                </div>
                <div className="text-[14px] font-semibold text-[#4f5d87]">等待接收文件</div>
                <div className="mt-2 text-[12px] text-[#8e95b2]">保持此页面开启，对方发送后会自动弹出确认</div>
              </ExperienceCard>
            )}
            {isTransferring && transferProgress && transferProgress.direction === 'receive' && (
              <ExperienceCard className="p-5">
                <div className="text-center">
                  <div className="text-[15px] font-semibold text-[#1a1f36]">正在接收...</div>
                  {isStreamingDownload && <div className="mt-1 text-[12px] text-[#8e95b2]">大文件正在边传输边下载</div>}
                </div>
                <div className="mt-4 mb-3 flex items-center justify-between text-[12px] text-[#5e6687]">
                  <span className="font-semibold text-[#1a1f36]">{transferProgress.progress.toFixed(1)}%</span>
                  <span>{transferProgress.speedMB} MB/s</span>
                  <span>剩余 {transferProgress.remainingTime}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-[#e8ecf2]">
                  <div className="h-3 rounded-full bg-[#1a6dff] transition-all" style={{ width: `${transferProgress.progress}%` }} />
                </div>
              </ExperienceCard>
            )}
            {uiShowReceiveQueue && !showFileSelector && (
              <>
                <ExperienceCard className="overflow-hidden p-0">
                  <div className="border-b border-[#edf2fb] px-5 py-4">
                    <div className="text-[16px] font-semibold text-[#1a1f36]">{`可下载文件 (${uiSelectedReceiveFiles.length})`}</div>
                  </div>

                  <div className="space-y-3 p-5">
                    {uiSelectedReceiveFiles.length > 0 ? uiSelectedReceiveFiles.map((item) => {
                      const isCompleted = item.status === 'completed' || !!item.receivedBlob;
                      const isTransferringItem = item.status === 'transferring';
                      const isFailed = item.status === 'failed';
                      const metaText = isTransferringItem
                        ? `${formatFileSize(item.metadata.size)} · 接收中 ${item.progress.toFixed(1)}%`
                        : isCompleted
                          ? `${formatFileSize(item.metadata.size)} · 已可保存`
                          : isFailed
                            ? `${formatFileSize(item.metadata.size)} · 接收失败`
                            : `${formatFileSize(item.metadata.size)} · 等待发送`;

                      return (
                        <div
                          key={`${item.index}-${item.metadata.name}`}
                          className="rounded-[14px] border border-[#edf2fb] bg-[#f8fafd] px-4 py-4"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#e8f0ff] text-[#1a6dff]">
                              <FileTypeIcon type={item.metadata.type} className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[15px] font-semibold text-[#1a1f36]">{item.metadata.name}</div>
                              <div className="mt-1 text-[12px] text-[#8e95b2]">{metaText}</div>
                            </div>
                            {isCompleted ? (
                              <button
                                onClick={() => void handleDownloadQueueFile(item.index, item.metadata.name)}
                                className="shrink-0 rounded-[12px] bg-[#1a6dff] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#0a4fc9]"
                              >
                                保存文件
                              </button>
                            ) : (
                              <span className={`shrink-0 rounded-[12px] px-4 py-2 text-[12px] font-semibold ${
                                isFailed
                                  ? 'bg-[rgba(239,68,68,0.1)] text-[#dc2626]'
                                  : isTransferringItem
                                    ? 'bg-[#e8f0ff] text-[#1a6dff]'
                                    : 'bg-white text-[#8e95b2]'
                              }`}>
                                {isFailed ? '接收失败' : isTransferringItem ? '接收中' : '等待发送'}
                              </span>
                            )}
                          </div>

                          {(isTransferringItem || isCompleted) && (
                            <div className="mt-3">
                              <div className="mb-1 flex items-center justify-between text-[11px] text-[#8e95b2]">
                                <span className={isCompleted ? 'font-medium text-[#10b981]' : 'font-medium text-[#1a6dff]'}>
                                  {isCompleted ? '已接收完成' : '正在接收'}
                                </span>
                                <span>{isCompleted ? '100%' : `${item.progress.toFixed(1)}%`}</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-[#e8ecf2]">
                                <div
                                  className={`h-2 rounded-full transition-all ${isCompleted ? 'bg-[#10b981]' : 'bg-[#1a6dff]'}`}
                                  style={{ width: `${isCompleted ? 100 : item.progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }) : (
                      <div className="rounded-[14px] border border-dashed border-[#d7e3f5] bg-[#f8fafd] px-5 py-8 text-center">
                        <div className="text-[14px] font-semibold text-[#4f5d87]">等待你选择要接收的文件</div>
                        <div className="mt-2 text-[12px] text-[#8e95b2]">选择完成后，发送方会按顺序自动开始传输</div>
                      </div>
                    )}
                  </div>
                </ExperienceCard>

                <ExperienceCard className="overflow-hidden p-0">
                  <div className="border-b border-[#edf2fb] px-5 py-4">
                    <div className="text-[16px] font-semibold text-[#1a1f36]">接收摘要</div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[#edf2fb] bg-[#f8fafd]">
                    <div className="px-5 py-4 text-center">
                      <div className="text-[24px] font-semibold leading-none text-[#1a1f36]">{uiSelectedReceiveFiles.length}</div>
                      <div className="mt-2 text-[12px] text-[#8e95b2]">文件数</div>
                    </div>
                    <div className="px-5 py-4 text-center">
                      <div className="text-[24px] font-semibold leading-none text-[#1a1f36]">{formatFileSize(uiSelectedReceiveTotalSize)}</div>
                      <div className="mt-2 text-[12px] text-[#8e95b2]">总大小</div>
                    </div>
                  </div>
                </ExperienceCard>
              </>
            )}

            {hasDownload && !uiShowReceiveQueue && (
              <ExperienceCard className="overflow-hidden p-0">
                <div className="border-b border-[#edf2fb] px-5 py-4">
                  <div className="text-[16px] font-semibold text-[#1a1f36]">已接收文件</div>
                </div>
                <div className="p-5">
                  <div className="rounded-[14px] border border-[#edf2fb] bg-[#f8fafd] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#e8f0ff] text-[#1a6dff]">
                        <FileTypeIcon type={uiSingleDownloadInfo?.blob.type || 'application/octet-stream'} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold text-[#1a1f36]">{downloadFilename}</div>
                        <div className="mt-1 text-[12px] text-[#8e95b2]">
                          {uiSingleDownloadInfo ? `${formatFileSize(uiSingleDownloadInfo.blob.size)} · 已可保存` : '已接收完成'}
                        </div>
                      </div>
                      <button
                        onClick={handleDownload}
                        className="shrink-0 rounded-[12px] bg-[#1a6dff] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#0a4fc9]"
                      >
                        保存文件
                      </button>
                    </div>
                  </div>
                </div>
              </ExperienceCard>
            )}

            {uiCanMarkP2PReceiveCompleted && (
              <button
                onClick={handleMarkP2PReceiveCompleted}
                className="w-full rounded-[14px] bg-[#1a6dff] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(26,109,255,0.24)] transition hover:bg-[#0a4fc9]"
              >
                标记为已完成
              </button>
            )}

            {(uiShowReceiveQueue || hasDownload) && !showFileSelector && (
              <ExperienceCard className="border-[#edf2fb] bg-[#f8fafd] p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#8e95b2]">
                    <InfoIcon className="h-4 w-4" />
                  </span>
                  <div className="space-y-2 text-[13px] leading-6 text-[#8e95b2]">
                    <div>文件会按你选择的顺序依次传输，完成后可以逐个保存</div>
                    <div>全部接收完成后，请点击“标记为已完成”通知发送方</div>
                    <div>传输期间请保持发送方和接收方都停留在当前页面</div>
                  </div>
                </div>
              </ExperienceCard>
            )}
          </div>
        )}

        {transferMode === 'room' && <RoomContainer showModeTabs={false} />}

        <BlockedDevicesList blockedDevices={blockedDevices} onUnblock={handleUnblockDevice} />

        <div className="pt-4 text-center">
          <p className="text-xs text-[#8e95b2]">MeshKit · P2P 协作工具套件</p>
        </div>
      </div>
    </ExperiencePage>
  );
}

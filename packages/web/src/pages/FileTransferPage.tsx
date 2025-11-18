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
  type BlockedDevice,
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
      icon: '/favicon.ico',
      tag: 'file-transfer',
      requireInteraction: true,
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('收到文件传输请求', {
          body: `${senderName} 想要发送文件：${fileName} (${formatFileSize(fileSize)})`,
          icon: '/favicon.ico',
          tag: 'file-transfer',
          requireInteraction: true,
        });
      }
    });
  }
};

export function FileTransferPage() {
  useP2P();

  const {
    isConnected,
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
    setMode,
    selectDevice,
    setCurrentFile,
    setMyDevice,
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
  };

  // 发送文件（支持单文件和多文件）
  const handleSendFile = async () => {
    if (!selectedDeviceId) return;

    // 检查连接状态
    if (!isConnected) {
      alert('⚠️ 未连接到信令服务器\n\n请检查：\n1. 信令服务器是否正常运行\n2. 网络连接是否正常\n3. 刷新页面重试');
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
        if (!success) {
          alert('❌ 发送失败\n\n可能原因：\n1. 信令服务器连接断开\n2. 目标设备离线\n3. 网络连接问题\n\n建议：刷新页面重试');
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
      alert('❌ 发送失败：' + (error as Error).message);
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
          alert('❌ 密码错误\n\n请输入正确的密码');
          return; // 不关闭对话框，让用户重新输入
        }
        console.log('[App] Password verified successfully');
      } catch (error) {
        console.error('[App] Password verification error:', error);
        alert('❌ 密码验证失败\n\n请重试');
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

    // 取消接收
    console.log('[App] Password input cancelled, rejecting transfer');
    fileTransferManager.rejectReceive();
  };

  // 开始接收文件
  const startReceiving = async (password: string | null) => {
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
          alert('❌ 密码错误，请重试');
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
        alert('❌ 密码验证失败：' + (error as Error).message);
      }
    }
  };

  // 处理队列密码对话框取消
  const handleQueuePasswordCancel = () => {
    setShowQueuePasswordDialog(false);
    setPendingFileList(null);
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

  // 选择设备
  const handleSelectDevice = (deviceId: string) => {
    deviceManager.selectDevice(deviceId);
    selectDevice(deviceId);
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
      if (direction === 'send') {
        // 发送方：接收方拒绝了传输
        const displayMessage = message || '接收方拒绝了文件传输';
        alert(`❌ ${displayMessage}\n\n您可以重新发送文件。`);
        console.log('[FileTransferPage] Transfer rejected:', displayMessage);
      }
    };

    eventBus.on('transfer:rejected', handleTransferRejected);

    return () => {
      eventBus.off('transfer:rejected', handleTransferRejected);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8">

        {/* 连接状态 */}
        <div className={`text-center py-2.5 rounded-lg mb-6 text-sm font-medium ${
          isConnected ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {isConnected ? '● 已连接' : '○ 未连接'}
        </div>

        {/* 设备名称 */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={myDeviceName || ''}
              readOnly
              className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none"
              placeholder="设备名称"
            />
            <button
              onClick={() => setShowDeviceNameEditor(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="编辑设备名"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>

        {/* 设备名编辑对话框 */}
        {showDeviceNameEditor && (
          <DeviceNameEditor
            currentName={myDeviceName || ''}
            onSave={handleUpdateDeviceName}
            onCancel={() => setShowDeviceNameEditor(false)}
          />
        )}

        {/* 屏蔽设备列表 */}
        <BlockedDevicesList
          blockedDevices={blockedDevices}
          onUnblock={handleUnblockDevice}
        />

        {/* 密码对话框 */}
        {showPasswordDialog && (
          <PasswordDialog
            onConfirm={handlePasswordConfirm}
            onCancel={handlePasswordCancel}
          />
        )}

        {/* 第一步：接收请求对话框（单文件） */}
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

        {/* 第一步：文件列表接收请求对话框（多文件） */}
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

        {/* 第二步：密码输入对话框（单文件） */}
        {showPasswordInputDialog && pendingReceiveFile && (
          <PasswordInputDialog
            fileName={pendingReceiveFile.fileName}
            onConfirm={handlePasswordInput}
            onCancel={handlePasswordInputCancel}
          />
        )}

        {/* 队列密码输入对话框（多文件） */}
        {showQueuePasswordDialog && pendingFileList && (
          <PasswordInputDialog
            fileName={`${pendingFileList.files.length} 个文件`}
            onConfirm={handleQueuePasswordInput}
            onCancel={handleQueuePasswordCancel}
          />
        )}

        {/* 传输模式选择器 */}
        <div className="mb-6">
          <RoomModeSelector />
        </div>

        {/* 点对点模式 */}
        {transferMode === 'p2p' && (
          <div>
            {/* 发送/接收选择 */}
            <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setMode('send')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all text-sm ${
                  mode === 'send'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                发送
              </button>
              <button
                onClick={() => setMode('receive')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all text-sm ${
                  mode === 'receive'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                接收
              </button>
            </div>

            {/* 点对点发送模式 */}
            {mode === 'send' && (
              <>
                {/* 文件选择区域 - 仅在没有文件时显示 */}
                {!currentFile && !isQueueMode && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('fileInput')?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all mb-4 ${
                      dragOver
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-lg font-medium text-gray-700 mb-1">选择文件</p>
                    <p className="text-sm text-gray-500">点击或拖拽文件到此处</p>
                    <input
                      id="fileInput"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}

                {/* 单文件信息 */}
                {!isQueueMode && currentFile && (
                  <div className="bg-gray-50 border border-gray-200 p-4 mb-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-1">{currentFile.name}</p>
                    <p className="text-sm text-gray-600">{formatFileSize(currentFile.size)}</p>
                  </div>
                )}

                {/* 文件队列（仅显示发送队列） */}
                {isQueueMode && fileQueue.length > 0 && queueDirection === 'send' && (
                  <div className="mb-4">
                    <FileQueue queue={fileQueue} isSender={true} onRemove={handleRemoveFile} />
                  </div>
                )}

                {/* 文件操作按钮 */}
                {(currentFile || (isQueueMode && queueDirection === 'send')) && (
                  <div className="flex gap-2 mb-4">
                    {/* 更换文件按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('fileInput')?.click();
                      }}
                      className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all border border-gray-300"
                    >
                      更换文件
                    </button>
                    <input
                      id="fileInput"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {/* 添加文件按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('p2p-add-files-input')?.click();
                      }}
                      className="flex-1 py-2 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all"
                    >
                      添加文件
                    </button>
                    <input
                      type="file"
                      multiple
                      onChange={handleAddFiles}
                      className="hidden"
                      id="p2p-add-files-input"
                    />

                    {/* 清空按钮 */}
                    <button
                      onClick={handleClearAll}
                      className="flex-1 py-2 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all"
                    >
                      清空
                    </button>
                  </div>
                )}

                {/* 设备列表 */}
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-3">选择设备</h3>
                  {devices.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm">未发现其他设备</p>
                      <p className="text-xs text-gray-400 mt-1">请确保其他设备也打开了此页面</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {devices.map((device) => (
                        <div
                          key={device.id}
                          onClick={() => handleSelectDevice(device.id)}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedDeviceId === device.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <span className="font-medium text-gray-900">{device.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 发送按钮 */}
                <button
                  onClick={handleSendFile}
                  disabled={(!currentFile && !(isQueueMode && queueDirection === 'send')) || !selectedDeviceId || isTransferring}
                  className="w-full py-3 bg-blue-500 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all"
                >
                  {isQueueMode && queueDirection === 'send' ? `发送 ${fileQueue.length} 个文件` : '发送文件'}
                </button>

                {/* 发送进度 */}
                {isTransferring && transferProgress && transferProgress.direction === 'send' && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span className="font-medium">{transferProgress.progress.toFixed(1)}%</span>
                      <span>{transferProgress.speedMB} MB/s</span>
                      <span>剩余 {transferProgress.remainingTime}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-secondary-500 h-3 rounded-full transition-all"
                        style={{ width: `${transferProgress.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 点对点接收模式 */}
            {mode === 'receive' && (
              <div>
                {/* 文件选择器（接收多文件时） */}
                {showFileSelector && pendingFileList && (
                  <FileSelector
                    files={pendingFileList.files}
                    totalSize={pendingFileList.totalSize}
                    onConfirm={handleFileSelectionConfirm}
                    onCancel={handleFileSelectionCancel}
                  />
                )}

                {/* 文件队列（接收中，仅显示接收队列） */}
                {isQueueMode && !showFileSelector && fileQueue.length > 0 && queueDirection === 'receive' && (
                  <div className="mb-4">
                    <FileQueue queue={fileQueue} isSender={false} />
                  </div>
                )}

                {!isTransferring && !hasDownload && !showFileSelector && !(isQueueMode && queueDirection === 'receive') && (
                  <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-600 font-medium">等待接收文件</p>
                    <p className="text-sm text-gray-400 mt-1">设备已在线</p>
                  </div>
                )}

                {/* 接收进度 */}
                {isTransferring && transferProgress && transferProgress.direction === 'receive' && (
                  <div>
                    <div className="text-center mb-4">
                      <p className="text-base font-medium text-gray-900">正在接收...</p>
                      {isStreamingDownload && (
                        <p className="text-sm text-gray-600 mt-1">流式下载中</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span className="font-medium">{transferProgress.progress.toFixed(1)}%</span>
                      <span>{transferProgress.speedMB} MB/s</span>
                      <span>剩余 {transferProgress.remainingTime}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full transition-all"
                        style={{ width: `${transferProgress.progress}%` }}
                      />
                    </div>
                    {isStreamingDownload && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-600">大文件正在边传输边下载</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 下载 - 多文件完成 */}
                {hasDownload && isQueueMode && queueDirection === 'receive' && fileQueue.length > 0 && (
                  <div className="bg-green-50 border border-green-200 p-5 rounded-lg">
                    <h2 className="text-lg font-medium text-gray-900 mb-3">接收完成</h2>
                    <div className="bg-white rounded-lg p-4 mb-3 max-h-60 overflow-y-auto border border-gray-200">
                      <p className="font-medium text-gray-700 mb-2 text-sm">已接收的文件：</p>
                      {fileQueue.filter(item => item.status === 'completed').map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{item.metadata.name}</div>
                            <div className="text-xs text-gray-500">{formatFileSize(item.metadata.size)}</div>
                          </div>
                          <button
                            onClick={() => handleDownloadFile(item.metadata.name)}
                            className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-all whitespace-nowrap"
                          >
                            下载
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 下载 - 单文件完成 */}
                {hasDownload && (!isQueueMode || queueDirection !== 'receive') && (
                  <div className="bg-green-50 border border-green-200 p-5 rounded-lg text-center">
                    <h2 className="text-lg font-medium text-gray-900 mb-2">接收完成</h2>
                    <p className="text-sm text-gray-700 mb-3">{downloadFilename}</p>
                    <button
                      onClick={handleDownload}
                      className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-all"
                    >
                      下载文件
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 取件码模式 */}
        {transferMode === 'room' && (
          <RoomContainer />
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">MeshKit · P2P 协作工具套件</p>
        </div>
      </div>
    </div>
  );
}

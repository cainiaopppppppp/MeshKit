/**
 * useRoom Hook - 房间功能封装
 */
import { useEffect, useCallback, useState } from 'react';
import { eventBus, roomManager, fileTransferManager, type Room, type FileMetadata } from '@meshkit/core';
import { useAppStore } from '../store';

export function useRoom() {
  const {
    currentRoom,
    setCurrentRoom,
    updateRoomMembers,
    setBroadcastProgress,
    updateMemberProgress,
    resetRoom,
    isQueueMode,
    fileQueue,
    setP2pConnected,
  } = useAppStore();

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 创建房间（支持单文件和多文件队列）
   * @param password 可选的房间密码
   */
  const createRoom = useCallback(async (file: File, password?: string): Promise<Room | null> => {
    setIsCreating(true);
    setError(null);

    try {
      let fileInfo: FileMetadata;
      let fileList: FileMetadata[] | undefined;

      if (isQueueMode && fileQueue.length > 0) {
        // 队列模式：文件已经被selectFiles选择了，不需要再次选择
        // 使用第一个文件的信息创建房间，并传递完整的文件列表（包含索引）
        const firstFile = fileQueue[0];
        fileInfo = firstFile.metadata;
        fileList = fileQueue.map(item => ({
          ...item.metadata,
          index: item.index, // 保留文件在队列中的索引
        }));
        console.log('[useRoom] Creating room in queue mode:', fileQueue.length, 'files');
      } else {
        // 单文件模式：选择文件（Room模式跳过验证，避免大文件阻塞）
        const success = await fileTransferManager.selectFile(file, true); // skipValidation=true
        if (!success) {
          throw new Error('文件选择失败');
        }

        fileInfo = {
          name: file.name,
          size: file.size,
          type: file.type,
        };
      }

      // 创建房间（传递文件列表和密码）
      const room = await roomManager.createRoom(fileInfo, fileList, password);
      setCurrentRoom(room);

      console.log('[useRoom] Room created:', room);
      return room;
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('[useRoom] Failed to create room:', errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [setCurrentRoom, isQueueMode, fileQueue]);

  /**
   * 加入房间
   * @param password 可选的房间密码
   */
  const joinRoom = useCallback(async (roomId: string, password?: string): Promise<Room | null> => {
    setIsJoining(true);
    setError(null);

    try {
      const room = await roomManager.joinRoom(roomId, password);
      setCurrentRoom(room);

      console.log('[useRoom] Joined room:', room);
      return room;
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('[useRoom] Failed to join room:', errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsJoining(false);
    }
  }, [setCurrentRoom]);

  /**
   * 离开房间
   */
  const leaveRoom = useCallback(() => {
    roomManager.leaveRoom();
    // 清理文件传输状态
    fileTransferManager.fullReset();
    resetRoom();
    setError(null);
  }, [resetRoom]);

  /**
   * 开始广播文件（房主）
   */
  const startBroadcast = useCallback(async (): Promise<boolean> => {
    if (!currentRoom) {
      setError('当前没有房间');
      return false;
    }

    const memberDeviceIds = roomManager.getMemberDeviceIds();
    if (memberDeviceIds.length === 0) {
      setError('房间内没有其他成员');
      return false;
    }

    try {
      const success = await fileTransferManager.sendFileToRoom(memberDeviceIds);
      return success;
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('[useRoom] Failed to start broadcast:', errorMsg);
      setError(errorMsg);
      return false;
    }
  }, [currentRoom]);

  /**
   * 监听房间事件
   */
  useEffect(() => {
    // 房间更新
    const handleRoomUpdate = ({ room }: { room: Room }) => {
      setCurrentRoom(room);
      updateRoomMembers(room.members);

      // 接收方：初始化或更新文件队列
      if (!roomManager.isHost() && room.fileList && room.fileList.length > 0) {
        const currentQueue = fileTransferManager.getQueueSummary();

        // 比较文件列表是否变化（通过序列化比较）
        const currentFileList = fileTransferManager.getFileQueue()?.map(item => ({
          name: item.metadata.name,
          size: item.metadata.size,
          index: item.index,
        })) || [];

        const newFileList = room.fileList.map(metadata => ({
          name: metadata.name,
          size: metadata.size,
          index: metadata.index,
        }));

        const fileListChanged = JSON.stringify(currentFileList) !== JSON.stringify(newFileList);

        // 如果队列未初始化，或文件列表发生变化，则更新队列
        if (!currentQueue || currentQueue.totalFiles === 0 || fileListChanged) {
          console.log('[useRoom] Updating receive queue for receiver:', room.fileList.length, 'files', fileListChanged ? '(changed)' : '(initial)');
          fileTransferManager.createReceiveQueue(room.fileList);
        }
      }
    };

    // 房间错误
    const handleRoomError = ({ error }: { error: string }) => {
      console.error('[useRoom] Room error:', error);
      setError(error);
    };

    // P2P连接建立
    const handleP2PConnected = ({ peer, direction }: { peer: string; direction: string }) => {
      console.log('[useRoom] P2P connection established:', peer, direction);
      setP2pConnected(true);
    };

    // P2P连接关闭
    const handleP2PDisconnected = ({ peer }: { peer: string }) => {
      console.log('[useRoom] P2P connection closed:', peer);
      setP2pConnected(false);
    };

    // 成员加入
    const handleMemberJoined = () => {
      // 房间更新事件会处理成员列表
      console.log('[useRoom] Member joined');
    };

    // 成员离开
    const handleMemberLeft = () => {
      console.log('[useRoom] Member left');
    };

    // 广播进度
    const handleBroadcastProgress = ({
      memberProgress
    }: {
      memberProgress: Record<string, number>;
      avgProgress: number;
    }) => {
      setBroadcastProgress(memberProgress);

      // 更新每个成员的进度
      Object.entries(memberProgress).forEach(([deviceId, progress]) => {
        updateMemberProgress(deviceId, progress);
      });
    };

    // 接收方：队列传输完成后更新状态
    const handleQueueCompleted = ({ totalFiles, successCount, failedCount }: { totalFiles: number; successCount: number; failedCount: number }) => {
      console.log('[useRoom] Queue transfer completed:', { totalFiles, successCount, failedCount });

      // 如果是接收方且在房间中，更新成员状态为completed
      if (!roomManager.isHost() && currentRoom) {
        const status = failedCount > 0 ? 'failed' : 'completed';
        roomManager.updateMemberStatus(status, 100);
        console.log('[useRoom] Updated member status to:', status);
      }
    };

    // 接收方：文件传输开始时更新状态为receiving
    const handleFileItemStarted = ({ fileIndex }: { fileIndex: number }) => {
      if (!roomManager.isHost() && currentRoom) {
        roomManager.updateMemberStatus('receiving', 0);
        console.log('[useRoom] File item started:', fileIndex, '- Updated member status to: receiving');
      }
    };

    // 接收方：单个文件完成后检查是否所有文件都完成
    const handleFileItemCompleted = ({ fileIndex, file }: { fileIndex: number; file: any }) => {
      if (!roomManager.isHost() && currentRoom) {
        console.log('[useRoom] File item completed:', fileIndex, file.name);

        // 检查是否所有选中的文件都已完成
        const queue = fileTransferManager.getFileQueue();
        const selectedFiles = queue.filter(item => item.selected);
        const completedFiles = selectedFiles.filter(item => item.status === 'completed');

        console.log('[useRoom] Checking completion:', completedFiles.length, '/', selectedFiles.length);

        // 如果所有选中的文件都完成了，更新状态为completed
        if (completedFiles.length === selectedFiles.length && selectedFiles.length > 0) {
          console.log('[useRoom] All files completed, updating status to completed');
          roomManager.updateMemberStatus('completed', 100);
        } else {
          // 否则更新进度
          const progress = selectedFiles.length > 0 ? (completedFiles.length / selectedFiles.length) * 100 : 0;
          roomManager.updateMemberStatus('receiving', progress);
        }
      }
    };

    eventBus.on('room:updated', handleRoomUpdate);
    eventBus.on('room:error', handleRoomError);
    eventBus.on('p2p:connection:open', handleP2PConnected);
    eventBus.on('p2p:connection:close', handleP2PDisconnected);
    eventBus.on('room:member-joined', handleMemberJoined);
    eventBus.on('room:member-left', handleMemberLeft);
    eventBus.on('transfer:broadcast-progress', handleBroadcastProgress);
    eventBus.on('transfer:queue-completed', handleQueueCompleted);
    eventBus.on('transfer:file-item-started', handleFileItemStarted);
    eventBus.on('transfer:file-item-completed', handleFileItemCompleted);

    return () => {
      eventBus.off('room:updated', handleRoomUpdate);
      eventBus.off('room:error', handleRoomError);
      eventBus.off('p2p:connection:open', handleP2PConnected);
      eventBus.off('p2p:connection:close', handleP2PDisconnected);
      eventBus.off('room:member-joined', handleMemberJoined);
      eventBus.off('room:member-left', handleMemberLeft);
      eventBus.off('transfer:broadcast-progress', handleBroadcastProgress);
      eventBus.off('transfer:queue-completed', handleQueueCompleted);
      eventBus.off('transfer:file-item-started', handleFileItemStarted);
      eventBus.off('transfer:file-item-completed', handleFileItemCompleted);
    };
  }, [currentRoom, setCurrentRoom, updateRoomMembers, setBroadcastProgress, updateMemberProgress, setP2pConnected]);

  /**
   * 判断是否是房主
   */
  const isHost = useCallback(() => {
    return roomManager.isHost();
  }, []);

  /**
   * 获取其他成员
   */
  const getOtherMembers = useCallback(() => {
    return roomManager.getOtherMembers();
  }, []);

  /**
   * 更新房间文件列表（房主：添加/删除文件）
   */
  const updateRoomFiles = useCallback((fileList: FileMetadata[]) => {
    try {
      roomManager.updateRoomFiles(fileList);
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('[useRoom] Failed to update room files:', errorMsg);
      setError(errorMsg);
    }
  }, []);

  /**
   * 请求文件（接收方：点击开始传输）
   */
  const requestFile = useCallback((fileIndex: number) => {
    try {
      roomManager.requestFile(fileIndex);
      console.log('[useRoom] Requested file:', fileIndex);
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('[useRoom] Failed to request file:', errorMsg);
      setError(errorMsg);
    }
  }, []);

  /**
   * 标记为已完成（接收方：手动标记完成，不需要下载所有文件）
   */
  const markAsCompleted = useCallback(() => {
    if (roomManager.isHost()) {
      console.warn('[useRoom] Host cannot mark as completed');
      return;
    }

    try {
      roomManager.updateMemberStatus('completed', 100);
      console.log('[useRoom] Marked as completed by user');
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('[useRoom] Failed to mark as completed:', errorMsg);
      setError(errorMsg);
    }
  }, []);

  return {
    currentRoom,
    isCreating,
    isJoining,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startBroadcast,
    isHost,
    getOtherMembers,
    updateRoomFiles,
    requestFile,
    markAsCompleted,
  };
}

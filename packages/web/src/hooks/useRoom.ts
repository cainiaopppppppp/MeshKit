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
  } = useAppStore();

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 创建房间
   */
  const createRoom = useCallback(async (file: File): Promise<Room | null> => {
    setIsCreating(true);
    setError(null);

    try {
      // 先选择文件
      const success = await fileTransferManager.selectFile(file);
      if (!success) {
        throw new Error('文件选择失败');
      }

      const fileInfo: FileMetadata = {
        name: file.name,
        size: file.size,
        type: file.type,
      };

      // 创建房间
      const room = await roomManager.createRoom(fileInfo);
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
  }, [setCurrentRoom]);

  /**
   * 加入房间
   */
  const joinRoom = useCallback(async (roomId: string): Promise<Room | null> => {
    setIsJoining(true);
    setError(null);

    try {
      const room = await roomManager.joinRoom(roomId);
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
    };

    // 房间错误
    const handleRoomError = ({ error }: { error: string }) => {
      console.error('[useRoom] Room error:', error);
      setError(error);
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

    eventBus.on('room:updated', handleRoomUpdate);
    eventBus.on('room:error', handleRoomError);
    eventBus.on('room:member-joined', handleMemberJoined);
    eventBus.on('room:member-left', handleMemberLeft);
    eventBus.on('transfer:broadcast-progress', handleBroadcastProgress);

    return () => {
      eventBus.off('room:updated', handleRoomUpdate);
      eventBus.off('room:error', handleRoomError);
      eventBus.off('room:member-joined', handleMemberJoined);
      eventBus.off('room:member-left', handleMemberLeft);
      eventBus.off('transfer:broadcast-progress', handleBroadcastProgress);
    };
  }, [setCurrentRoom, updateRoomMembers, setBroadcastProgress, updateMemberProgress]);

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
  };
}

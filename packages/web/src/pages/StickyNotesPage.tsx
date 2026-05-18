import { useState, useEffect, useRef } from 'react';
import { PasswordConfirmDialog } from '../components/PasswordConfirmDialog';
import { ShareLinkDialog } from '../components/ShareLinkDialog';
import { StickyNoteCard } from '../components/StickyNoteCard';
import { ExperienceBadge } from '../components/ExperienceShell';
import { useAppChrome } from '../contexts/AppChromeContext';
import { StickyNotesRoom } from '../services/StickyNotesRoom';
import type { StickyNote, UserInfo, RoomConfig, Room as StickyRoom } from '../types/stickyNote';
import { ENCRYPTION_METHODS, type EncryptionMethod } from '../utils/Encryption';
import { getShareableWebUrl, parseShareInvitePayloadFromUrl } from '../utils/signalingConfig';
import { notesStorage } from '../utils/NotesStorage';

export function StickyNotesPage() {
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('sticky_notes_user_name') || '';
  });
  const [enableEncryption, setEnableEncryption] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [, setPeerCount] = useState(0);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempUserName, setTempUserName] = useState('');
  const [customColor, setCustomColor] = useState('#FFE6E6');
  const [encryptionMethod, setEncryptionMethod] = useState<EncryptionMethod>('AES-256-CBC');
  const [roomExpiresIn, setRoomExpiresIn] = useState<number | null>(null);
  const [showDestroyPasswordDialog, setShowDestroyPasswordDialog] = useState(false);
  const [isSharingRoom, setIsSharingRoom] = useState(false);
  const [isSystemSharingRoom, setIsSystemSharingRoom] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isRefreshingRoom, setIsRefreshingRoom] = useState(false);
  const [recentRooms, setRecentRooms] = useState<StickyRoom[]>([]);
  const [recentRoomActionId, setRecentRoomActionId] = useState<string | null>(null);
  const [isDestroyingAllRecentRooms, setIsDestroyingAllRecentRooms] = useState(false);
  const [isCanvasLocked, setIsCanvasLocked] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return localStorage.getItem('sticky_notes_canvas_locked') === '1';
  });
  const [isCanvasTouchPending, setIsCanvasTouchPending] = useState(false);

  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const canvasTouchHoldTimer = useRef<number | null>(null);
  const canvasTouchStartPoint = useRef<{ x: number; y: number } | null>(null);

  const [canvasScale, setCanvasScale] = useState(1);

  const roomRef = useRef<StickyNotesRoom | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const colorPickerButtonRef = useRef<HTMLButtonElement>(null);
  const colorPickerPanelRef = useRef<HTMLDivElement>(null);
  const previousNoteIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedNotesRef = useRef(false);
  const isDestroyingCurrentRoomRef = useRef(false);
  const { setBrandHeaderHidden } = useAppChrome();

  const clearCanvasTouchHold = () => {
    if (canvasTouchHoldTimer.current !== null) {
      window.clearTimeout(canvasTouchHoldTimer.current);
      canvasTouchHoldTimer.current = null;
    }

    canvasTouchStartPoint.current = null;
    setIsCanvasTouchPending(false);
  };

  const refreshRecentRooms = async () => {
    const now = Date.now();
    const rooms = await notesStorage.getAllRooms();
    setRecentRooms(
      rooms
        .filter((room) => (!room.expiresAt || room.expiresAt > now) && !notesStorage.isRoomDestroyed(room.id))
        .sort((a, b) => b.lastAccessed - a.lastAccessed)
        .slice(0, 6),
    );
  };

  const updateColorPickerPosition = () => {
    const button = colorPickerButtonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const panelWidth = 220;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - panelWidth - viewportPadding,
    );

    setColorPickerPosition({
      top: rect.bottom + 10,
      left,
    });
  };

  const focusNoteInViewport = (note: StickyNote) => {
    const wall = wallRef.current;
    if (!wall) {
      return;
    }

    const rect = wall.getBoundingClientRect();
    const nextOffsetX = rect.width / 2 - (note.position.x + note.size.width / 2) * canvasScale;
    const nextOffsetY = rect.height / 2 - (note.position.y + note.size.height / 2) * canvasScale;

    setCanvasOffset({
      x: Math.round(nextOffsetX),
      y: Math.round(nextOffsetY),
    });
  };

  const handleLocateLatestNote = () => {
    if (notes.length === 0) {
      return;
    }

    const latestNote = [...notes].sort((a, b) => {
      const aTime = Math.max(a.updatedAt, a.createdAt);
      const bTime = Math.max(b.updatedAt, b.createdAt);
      return bTime - aTime;
    })[0];

    if (latestNote) {
      focusNoteInViewport(latestNote);
    }
  };

  const generateRandomUserName = () => {
    const randomName = `匿名用户_${Math.random().toString(36).substring(2, 6)}`;
    setUserName(randomName);
  };

  const colors = [
    '#FFE6E6', // 浅红
    '#E6F3FF',
    '#FFF9E6',
    '#E6FFE6',
    '#F3E6FF',
    '#FFE6F3',
    '#E6FFFF',
    '#FFEEE6',
  ];

  const copyTextWithFallback = async (text: string, successMessage?: string): Promise<boolean> => {
    if (!text.trim()) {
      return false;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        if (successMessage) {
          alert(successMessage);
        }
        return true;
      }
    } catch (error: any) {
      console.warn('Clipboard API copy failed:', error);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const copied = document.execCommand('copy');
      if (!copied) {
        throw new Error('copy failed');
      }
      if (successMessage) {
        alert(successMessage);
      }
      return true;
    } catch (error: any) {
      console.error('Fallback copy failed:', error);
      window.prompt('请手动复制以下内容', text);
      return false;
    } finally {
      if (textarea.parentNode === document.body) {
        document.body.removeChild(textarea);
      }
    }
  };

  const joinStickyRoom = async (config: RoomConfig, preferredUserName?: string) => {
    if (!config.roomId.trim()) {
      alert('请输入房间码');
      return false;
    }

    if (config.enableEncryption && !config.password?.trim()) {
      alert('启用加密时必须设置密码');
      return false;
    }

    if (config.enableEncryption && (config.password?.trim().length ?? 0) < 4) {
      alert('密码至少需要 4 个字符');
      return false;
    }

    try {
      notesStorage.clearDestroyedRoomMarker(config.roomId.trim());

      const nextUserName = preferredUserName?.trim() || userName.trim();

      if (nextUserName) {
        localStorage.setItem('sticky_notes_user_name', nextUserName);
        if (nextUserName !== userName) {
          setUserName(nextUserName);
        }
      }

      if (roomRef.current) {
        await roomRef.current.leaveRoom();
        roomRef.current = null;
      }

      const room = new StickyNotesRoom();
      roomRef.current = room;

      await room.joinRoom(
        {
          ...config,
          roomId: config.roomId.trim(),
          password: config.password?.trim() || '',
        },
        {
          onNotesChange: (updatedNotes) => {
            setNotes(updatedNotes);
          },
          onUsersChange: (updatedUsers) => {
            setUsers(updatedUsers);
            setPeerCount(Math.max(updatedUsers.length, 1));
          },
          onConnectionChange: (connected, count) => {
            setIsConnected(connected);
            setPeerCount(count);
          },
          onRoomDestroyed: handleRoomDestroyed,
          onRoomExpiring: (remainingTime) => {
            setRoomExpiresIn(remainingTime);
          },
        },
      );

      setIsInRoom(true);
      const info = room.getRoomInfo();
      setRoomInfo(info);

      if (info.isExistingEncryptedRoom && info.encryptionMethod) {
        setEncryptionMethod(info.encryptionMethod);
        console.log('[StickyNotesPage] Joined existing encrypted room, using algorithm:', info.encryptionMethod);
      }

      const initialNotes = await room.getAllNotes();
      setNotes(initialNotes);
      const initialUsers = room.getAllUsers();
      setUsers(initialUsers);
      setPeerCount(Math.max(initialUsers.length, 1));
      await refreshRecentRooms();
      return true;
    } catch (error) {
      console.error('[StickyNotesPage] Failed to join room:', error);
      const errorMessage = error instanceof Error ? error.message : '加入房间失败';
      alert(errorMessage);
      if (roomRef.current) {
        roomRef.current = null;
      }
      return false;
    }
  };

  const handleJoinRoom = async () => {
    if (enableEncryption && password !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }

    await joinStickyRoom(
      {
        roomId: roomId.trim(),
        password: password.trim(),
        enableEncryption,
        encryptionMethod,
      },
      userName.trim(),
    );
    return;

    if (!roomId.trim()) {
      alert('请输入房间码');
      return;
    }

    if (enableEncryption && !password.trim()) {
      alert('启用加密时必须设置密码');
      return;
    }

    if (enableEncryption && password.length < 4) {
      alert('密码至少需要 4 个字符');
      return;
    }

    if (enableEncryption && password !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }

    try {
      if (userName.trim()) {
        localStorage.setItem('sticky_notes_user_name', userName.trim());
      }

      const config: RoomConfig = {
        roomId: roomId.trim(),
        password: password.trim(),
        enableEncryption,
        encryptionMethod,
      };

      const room = new StickyNotesRoom();
      roomRef.current = room;

      await room.joinRoom(config, {
        onNotesChange: (updatedNotes) => {
          setNotes(updatedNotes);
        },
        onUsersChange: (updatedUsers) => {
          setUsers(updatedUsers);
        },
        onConnectionChange: (connected, count) => {
          setIsConnected(connected);
          setPeerCount(count);
        },
        onRoomDestroyed: handleRoomDestroyed,
        onRoomExpiring: (remainingTime) => {
          setRoomExpiresIn(remainingTime);
        },
      });

      setIsInRoom(true);
      const info = room.getRoomInfo();
      setRoomInfo(info);

      if (info.isExistingEncryptedRoom && info.encryptionMethod) {
        setEncryptionMethod(info.encryptionMethod);
        console.log('[StickyNotesPage] Joined existing encrypted room, using algorithm:', info.encryptionMethod);
      }

      const initialNotes = await room.getAllNotes();
      setNotes(initialNotes);
      setUsers(room.getAllUsers());

      setPeerCount(1);
      await refreshRecentRooms();
    } catch (error: any) {
      console.error('[StickyNotesPage] Failed to join room:', error);
      const errorMessage = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '加入房间失败')
        : '加入房间失败';
      alert(errorMessage);
      if (roomRef.current) {
        roomRef.current = null;
      }
    }
  };

  const handleRefreshRoom = async () => {
    const activeRoomId = roomInfo?.roomId || roomId.trim();
    if (!activeRoomId) {
      alert('请先创建或加入房间');
      return;
    }

    setIsRefreshingRoom(true);

    try {
      if (roomRef.current) {
        await roomRef.current.leaveRoom();
        roomRef.current = null;
      }

      const nextRoom = new StickyNotesRoom();
      roomRef.current = nextRoom;

      await nextRoom.joinRoom(
        {
          roomId: activeRoomId,
          password: password.trim(),
          enableEncryption: roomInfo?.isEncrypted || enableEncryption,
          encryptionMethod: (roomInfo?.encryptionMethod || encryptionMethod) as EncryptionMethod,
        },
        {
          onNotesChange: (updatedNotes) => {
            setNotes(updatedNotes);
          },
          onUsersChange: (updatedUsers) => {
            setUsers(updatedUsers);
            setPeerCount(Math.max(updatedUsers.length, 1));
          },
          onConnectionChange: (connected, count) => {
            setIsConnected(connected);
            setPeerCount(count);
          },
          onRoomDestroyed: handleRoomDestroyed,
          onRoomExpiring: (remainingTime) => {
            setRoomExpiresIn(remainingTime);
          },
        },
      );

      const nextInfo = nextRoom.getRoomInfo();
      setRoomInfo(nextInfo);
      setNotes(await nextRoom.getAllNotes());
      const refreshedUsers = nextRoom.getAllUsers();
      setUsers(refreshedUsers);
      setPeerCount(Math.max(refreshedUsers.length, 1));
      setIsConnected(true);
      await refreshRecentRooms();
    } catch (error) {
      console.error('[StickyNotesPage] Failed to refresh room:', error);
      alert(error instanceof Error ? error.message : '刷新房间失败');
    } finally {
      setIsRefreshingRoom(false);
    }
  };

  const handleLeaveRoom = async () => {
    isDestroyingCurrentRoomRef.current = false;

    if (roomRef.current) {
      await roomRef.current.leaveRoom();
      roomRef.current = null;
    }
    setIsInRoom(false);
    setNotes([]);
    setUsers([]);
    setRoomInfo(null);
    setShowDestroyPasswordDialog(false);
    setShowShareDialog(false);
    setShareUrl('');
    setShowColorPicker(false);
    setIsDraggingCanvas(false);
    clearCanvasTouchHold();
    await refreshRecentRooms();
  };

  const handleDestroyedRoomExit = () => {
    const message = isDestroyingCurrentRoomRef.current
      ? '房间已销毁。'
      : '房主已销毁这个便签墙房间，你已退出当前房间。';

    isDestroyingCurrentRoomRef.current = false;
    alert(message);
    void handleLeaveRoom();
  };

  const handleRoomDestroyed = () => {
    handleDestroyedRoomExit();
    return;

    const message = isDestroyingCurrentRoomRef.current
      ? '房间已销毁。'
      : '房主已销毁这个便签墙房间，你已退出当前房间。';

    isDestroyingCurrentRoomRef.current = false;
    alert(message);
    void handleLeaveRoom();
  };

  const destroyCurrentRoom = async (verifyPassword?: string) => {
    if (!roomRef.current) return;

    try {
      isDestroyingCurrentRoomRef.current = true;
      await roomRef.current.destroyRoom(verifyPassword);
      setShowDestroyPasswordDialog(false);
    } catch (error) {
      isDestroyingCurrentRoomRef.current = false;
      alert((error as Error).message || 'Failed to destroy room');
    }
  };

  const handleDestroyRoom = async () => {
    if (!roomRef.current) return;

    if (!confirm('确定要销毁这个房间吗？\n\n销毁后所有便签、成员和本地缓存都会被清空。')) {
      return;
    }

    if (roomInfo?.isEncrypted) {
      setShowDestroyPasswordDialog(true);
      return;
    }

    await destroyCurrentRoom();
  };

  const handleDestroyRoomConfirm = async (verifyPassword: string) => {
    await destroyCurrentRoom(verifyPassword);
  };

  const handleDestroyRoomCancel = () => {
    setShowDestroyPasswordDialog(false);
  };

  const handleAddNote = async (color: string) => {
    if (!roomRef.current) return;

    const wall = wallRef.current;
    if (!wall) return;

    const rect = wall.getBoundingClientRect();

    const noteWidth = 250;
    const noteHeight = 200;
    const visibleCenterX = (-canvasOffset.x + rect.width / 2) / canvasScale;
    const visibleCenterY = (-canvasOffset.y + rect.height / 2) / canvasScale;
    const jitterX = Math.round((Math.random() - 0.5) * 80);
    const jitterY = Math.round((Math.random() - 0.5) * 56);
    const nextX = Math.max(24, Math.round(visibleCenterX - noteWidth / 2 + jitterX));
    const nextY = Math.max(24, Math.round(visibleCenterY - noteHeight / 2 + jitterY));

    await roomRef.current.addNote({
      content: '',
      color,
      position: { x: nextX, y: nextY },
      size: { width: noteWidth, height: noteHeight },
    });

    setShowColorPicker(false);
  };

  const handleUpdateNote = async (noteId: string, updates: Partial<StickyNote>) => {
    if (!roomRef.current) return;
    await roomRef.current.updateNote(noteId, updates);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!roomRef.current) return;
    roomRef.current.deleteNote(noteId);
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    setRoomId(id);
  };

  const handleStartEditName = () => {
    setTempUserName(roomInfo?.userName || '');
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const newName = tempUserName.trim() || '匿名用户';
    if (roomRef.current) {
      roomRef.current.updateUserName(newName);
      setRoomInfo({ ...roomInfo, userName: newName });
    }
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.sticky-note-card') || isCanvasLocked) {
      return;
    }

    if (e.pointerType === 'touch') {
      clearCanvasTouchHold();
      canvasTouchStartPoint.current = { x: e.clientX, y: e.clientY };
      setIsCanvasTouchPending(true);

      canvasTouchHoldTimer.current = window.setTimeout(() => {
        if (!canvasTouchStartPoint.current) {
          return;
        }

        dragStartPos.current = { ...canvasTouchStartPoint.current };
        dragStartOffset.current = { ...canvasOffset };
        setIsDraggingCanvas(true);
        setIsCanvasTouchPending(false);
        canvasTouchStartPoint.current = null;
        canvasTouchHoldTimer.current = null;
      }, 180);

      return;
    }

    setIsDraggingCanvas(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartOffset.current = { ...canvasOffset };
    e.preventDefault();
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (canvasTouchStartPoint.current && !isDraggingCanvas) {
      const deltaX = e.clientX - canvasTouchStartPoint.current.x;
      const deltaY = e.clientY - canvasTouchStartPoint.current.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > 10) {
        clearCanvasTouchHold();
      }
      return;
    }

    if (!isDraggingCanvas) return;

    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;

    setCanvasOffset({
      x: dragStartOffset.current.x + deltaX,
      y: dragStartOffset.current.y + deltaY,
    });
  };

  const handleCanvasPointerUp = () => {
    setIsDraggingCanvas(false);
    clearCanvasTouchHold();
  };

  const formatRemainingTime = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return '已过期';
    }
  };

  const copyRoomId = async () => {
    const activeRoomId = roomInfo?.roomId || roomId.trim();

    if (!activeRoomId) {
      alert('请先创建或加入房间');
      return;
    }

    await copyTextWithFallback(activeRoomId, '房间码已复制到剪贴板');
  };

  const shareRoom = async () => {
    const activeRoomId = roomInfo?.roomId || roomId.trim();

    if (!activeRoomId) {
      alert('请先创建或加入房间');
      return;
    }

    setIsSharingRoom(true);

    try {
      const shareable = await getShareableWebUrl('/sticky-notes', {
        stickyNotes: {
          roomId: activeRoomId,
          encrypted: roomInfo?.isEncrypted || enableEncryption,
          encryptionMethod: roomInfo?.encryptionMethod || encryptionMethod,
          password: password.trim() || undefined,
        },
      });

      setShareUrl(shareable.url);
      setShowShareDialog(true);
    } catch (error) {
      console.error('分享房间失败:', error);
      alert('分享房间失败，请稍后重试');
    } finally {
      setIsSharingRoom(false);
    }
  };

  const handleCopyShareLink = async (): Promise<boolean> => {
    if (!shareUrl) {
      return false;
    }

    return copyTextWithFallback(shareUrl);
  };

  const handleNativeShare = async () => {
    const activeRoomId = roomInfo?.roomId || roomId.trim();

    if (!shareUrl || !navigator.share || !activeRoomId) {
      return;
    }

    setIsSystemSharingRoom(true);

    try {
      await navigator.share({
        title: 'MeshKit 便签墙',
        text: '加入便签墙房间 ' + activeRoomId,
        url: shareUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.warn('Web Share API failed:', error);
      alert('系统分享失败，请改用复制链接或扫码分享。');
    } finally {
      setIsSystemSharingRoom(false);
    }
  };

  const applyRecentRoom = (room: StickyRoom) => {
    setRoomId(room.id);
    setEnableEncryption(room.isEncrypted);
    setEncryptionMethod(room.encryptionMethod || 'AES-256-CBC');
    if (room.lastUserName && !userName.trim()) {
      setUserName(room.lastUserName);
    }
    const nextPassword = room.savedPassword || '';
    setPassword(nextPassword);
    setConfirmPassword(nextPassword);
  };

  const handleEnterRecentRoom = async (room: StickyRoom) => {
    if (notesStorage.isRoomDestroyed(room.id)) {
      await refreshRecentRooms();
      alert('这个房间已被销毁，无法再次进入。');
      return;
    }

    const nextPassword = room.savedPassword?.trim() || '';
    const nextUserName = userName.trim() || room.lastUserName || '';

    if (room.isEncrypted && !nextPassword) {
      applyRecentRoom(room);
      alert('已帮你回填最近房间信息，请输入密码后直接加入。');
      return;
    }

    setRecentRoomActionId(room.id);
    setRoomId(room.id);
    setEnableEncryption(room.isEncrypted);
    setEncryptionMethod(room.encryptionMethod || 'AES-256-CBC');
    setPassword(nextPassword);
    setConfirmPassword(nextPassword);

    try {
      await joinStickyRoom(
        {
          roomId: room.id,
          password: nextPassword,
          enableEncryption: room.isEncrypted,
          encryptionMethod: room.encryptionMethod || 'AES-256-CBC',
        },
        nextUserName,
      );
    } finally {
      setRecentRoomActionId(null);
    }
  };

  const handleDestroyRecentRoom = async (room: StickyRoom) => {
    if (!room.isOwner) {
      return;
    }

    if (!confirm('确定要直接销毁这个最近房间吗？\n\n销毁后所有成员和便签都会被清空。')) {
      return;
    }

    const savedPassword = room.savedPassword?.trim() || '';
    const verifyPassword = room.isEncrypted
      ? (savedPassword || window.prompt('请输入房间密码，用于直接销毁这个房间')?.trim() || '')
      : undefined;

    if (room.isEncrypted && !verifyPassword) {
      return;
    }

    setRecentRoomActionId(room.id);

    try {
      const tempRoom = new StickyNotesRoom();

      try {
        await tempRoom.joinRoom(
          {
            roomId: room.id,
            password: verifyPassword,
            enableEncryption: room.isEncrypted,
            encryptionMethod: room.encryptionMethod || 'AES-256-CBC',
          },
          {},
        );

        await tempRoom.destroyRoom(verifyPassword);
      } finally {
        await tempRoom.leaveRoom().catch(() => undefined);
      }

      await refreshRecentRooms();
      alert('房间已销毁，并从本地列表中移除。');
    } catch (error) {
      console.error('[StickyNotesPage] Failed to destroy recent room:', error);
      alert(error instanceof Error ? error.message : '销毁房间失败');
    } finally {
      setRecentRoomActionId(null);
    }
  };

  const handleDestroyAllRecentRooms = async () => {
    const ownedRooms = recentRooms.filter((room) => room.isOwner);

    if (ownedRooms.length === 0) {
      alert('最近房间里还没有可销毁的房间。');
      return;
    }

    if (
      !confirm(
        `确定要一键销毁 ${ownedRooms.length} 个房间吗？\n\n销毁后所有成员和便签都会被清空。`,
      )
    ) {
      return;
    }

    setIsDestroyingAllRecentRooms(true);

    let destroyedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      for (const room of ownedRooms) {
        const savedPassword = room.savedPassword?.trim() || '';

        if (room.isEncrypted && !savedPassword) {
          skippedCount += 1;
          continue;
        }

        const tempRoom = new StickyNotesRoom();

        try {
          await tempRoom.joinRoom(
            {
              roomId: room.id,
              password: savedPassword || undefined,
              enableEncryption: room.isEncrypted,
              encryptionMethod: room.encryptionMethod || 'AES-256-CBC',
            },
            {},
          );

          await tempRoom.destroyRoom(savedPassword || undefined);
          destroyedCount += 1;
        } catch (error) {
          failedCount += 1;
          console.error('[StickyNotesPage] Failed to destroy room in batch:', room.id, error);
        } finally {
          await tempRoom.leaveRoom().catch(() => undefined);
        }
      }

      await refreshRecentRooms();
    } finally {
      setIsDestroyingAllRecentRooms(false);
    }

    if (destroyedCount === 0 && skippedCount > 0 && failedCount === 0) {
      alert('还没有成功销毁任何房间。部分加密房间缺少已保存的密码，请先进入房间后再重试。');
      return;
    }

    const summary: string[] = [];

    if (destroyedCount > 0) {
      summary.push(`已销毁 ${destroyedCount} 个房间`);
    }
    if (skippedCount > 0) {
      summary.push(`跳过 ${skippedCount} 个缺少密码的加密房间`);
    }
    if (failedCount > 0) {
      summary.push(`失败 ${failedCount} 个`);
    }

    alert(`${summary.join('，')}。`);
  };


  const handleToggleCanvasLock = () => {
    setIsCanvasLocked((prev) => !prev);
    setIsDraggingCanvas(false);
    clearCanvasTouchHold();
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const shareInvite = parseShareInvitePayloadFromUrl(window.location.href);
    const currentUrl = new URL(window.location.href);
    const sharedRoomId = shareInvite?.stickyNotes?.roomId || currentUrl.searchParams.get('stickyRoomId');
    const sharedEncrypted = shareInvite?.stickyNotes?.encrypted ? '1' : currentUrl.searchParams.get('stickyEncrypted');
    const sharedMethod = shareInvite?.stickyNotes?.encryptionMethod || currentUrl.searchParams.get('stickyEncryptionMethod');
    const sharedPassword = shareInvite?.stickyNotes?.password;
    let hasSharedParams = false;

    if (sharedRoomId) {
      setRoomId(sharedRoomId);
      hasSharedParams = true;
    }

    if (sharedEncrypted === '1') {
      setEnableEncryption(true);
      hasSharedParams = true;
    }

    if (sharedMethod && ENCRYPTION_METHODS.some((method) => method.value === sharedMethod)) {
      setEncryptionMethod(sharedMethod as EncryptionMethod);
      hasSharedParams = true;
    }

    if (sharedPassword) {
      setPassword(sharedPassword);
      setConfirmPassword(sharedPassword);
      hasSharedParams = true;
    }

    if (hasSharedParams) {
      currentUrl.searchParams.delete('stickyRoomId');
      currentUrl.searchParams.delete('stickyEncrypted');
      currentUrl.searchParams.delete('stickyEncryptionMethod');
      const nextSearch = currentUrl.searchParams.toString();
      const nextUrl = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ''}${currentUrl.hash}`;
      window.history.replaceState({}, document.title, nextUrl);
    }
  }, []);

  useEffect(() => {
    void refreshRecentRooms();
  }, []);

  useEffect(() => {
    setBrandHeaderHidden(isInRoom);

    return () => {
      setBrandHeaderHidden(false);
    };
  }, [isInRoom, setBrandHeaderHidden]);

  useEffect(() => {
    if (!showColorPicker) {
      setColorPickerPosition(null);
      return;
    }

    updateColorPickerPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        colorPickerPanelRef.current?.contains(target) ||
        colorPickerButtonRef.current?.contains(target)
      ) {
        return;
      }

      setShowColorPicker(false);
    };

    const handleReposition = () => {
      updateColorPickerPosition();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [showColorPicker]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem('sticky_notes_canvas_locked', isCanvasLocked ? '1' : '0');
  }, [isCanvasLocked]);

  useEffect(() => {
    if (!isInRoom) {
      previousNoteIdsRef.current = new Set();
      hasHydratedNotesRef.current = false;
      return;
    }

    const previousNoteIds = previousNoteIdsRef.current;
    const nextNoteIds = new Set(notes.map((note) => note.id));

    if (!hasHydratedNotesRef.current) {
      previousNoteIdsRef.current = nextNoteIds;
      hasHydratedNotesRef.current = true;
      return;
    }

    const addedRemoteNotes = notes
      .filter((note) => !previousNoteIds.has(note.id))
      .filter((note) => note.createdBy !== roomInfo?.userId)
      .sort((a, b) => Math.max(b.updatedAt, b.createdAt) - Math.max(a.updatedAt, a.createdAt));

    previousNoteIdsRef.current = nextNoteIds;

    if (addedRemoteNotes.length === 0) {
      return;
    }

    const newestRemoteNote = addedRemoteNotes[0];
    window.setTimeout(() => {
      focusNoteInViewport(newestRemoteNote);
    }, 80);
  }, [isInRoom, notes, roomInfo?.userId, canvasScale]);

  useEffect(() => {
    return () => {
      clearCanvasTouchHold();
      if (roomRef.current) {
        roomRef.current.leaveRoom();
      }
    };
  }, []);

  if (!isInRoom) {
    return (
      <div className="px-5 py-6 pb-14 sm:px-4">
        <div className="mx-auto max-w-[480px]">

          <div className="mb-7">
            <p className="mb-1.5 font-['DM_Sans',_'Noto_Sans_SC',sans-serif] text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">MeshKit Notes Wall</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">{'便签墙'}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {'创建一个多人共享的自由画布，可以随时回到最近房间继续协作。'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ExperienceBadge tone="emerald">{'实时协作'}</ExperienceBadge>
              <ExperienceBadge tone="sky">{'自由拖拽'}</ExperienceBadge>
              <ExperienceBadge tone="amber">{'可选端到端加密'}</ExperienceBadge>
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl space-y-4 rounded-[14px] border border-[#e8ecf2] bg-white p-6 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="昵称"
                className="min-w-0 flex-1 rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all focus:border-[#f59e0b] focus:outline-none focus:ring-4 focus:ring-[rgba(245,158,11,0.12)]"
              />
              <button
                onClick={generateRandomUserName}
                className="shrink-0 whitespace-nowrap rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-[13px] font-medium text-[#5e6687] transition-all hover:border-[#f59e0b] hover:text-[#f59e0b] sm:px-5"
              >
                随机
              </button>
            </div>

            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder={'房间码'}
                className="min-w-0 flex-1 rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all focus:border-[#f59e0b] focus:outline-none focus:ring-4 focus:ring-[rgba(245,158,11,0.12)]"
              />
              <button
                onClick={generateRoomId}
                className="shrink-0 whitespace-nowrap rounded-[10px] bg-[#1a1f36] px-4 py-3 text-[13px] font-medium text-white transition-all hover:bg-[#2d3352] sm:px-5"
              >
                生成
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-[10px] border border-[#f0f3f8] bg-[#f8fafd] px-4 py-3">
              <input
                type="checkbox"
                id="encryption"
                checked={enableEncryption}
                onChange={(e) => setEnableEncryption(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="encryption" className="text-sm text-gray-700 cursor-pointer">
                启用端到端加密
              </label>
            </div>

            {enableEncryption && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    加密算法
                  </label>
                  <div className="relative">
                    <select
                      value={encryptionMethod}
                      onChange={(e) => setEncryptionMethod(e.target.value as EncryptionMethod)}
                      className="w-full appearance-none rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 pr-10 text-slate-900 shadow-sm transition-all focus:border-[#f59e0b] focus:outline-none focus:ring-4 focus:ring-[rgba(245,158,11,0.12)]"
                    >
                      {ENCRYPTION_METHODS.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {ENCRYPTION_METHODS.find(m => m.value === encryptionMethod)?.description}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    密码
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码（至少4个字符）"
                    className="w-full rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all focus:border-[#f59e0b] focus:outline-none focus:ring-4 focus:ring-[rgba(245,158,11,0.12)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    确认密码
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={'请再次输入密码'}
                    className="w-full rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all focus:border-[#f59e0b] focus:outline-none focus:ring-4 focus:ring-[rgba(245,158,11,0.12)]"
                  />
                </div>
              </>
            )}

            <button
              onClick={handleJoinRoom}
              className="w-full rounded-[10px] bg-[#f59e0b] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(245,158,11,0.3)] transition-all hover:bg-[#d97706]"
            >
              {roomId ? '加入房间' : '创建房间'}
            </button>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-2.5 text-xs text-[#5e6687] sm:grid-cols-4 sm:gap-3">
                <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#eef2f8] bg-[#f8fafd] px-3 py-2">
                  <span className="text-[#22c55e]">{'●'}</span>
                  <span>{'P2P 直连'}</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#eef2f8] bg-[#f8fafd] px-3 py-2">
                  <span className="text-[#22c55e]">{'●'}</span>
                  <span>{'实时协作'}</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#eef2f8] bg-[#f8fafd] px-3 py-2">
                  <span className="text-[#22c55e]">{'●'}</span>
                  <span>{'端到端加密'}</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#eef2f8] bg-[#f8fafd] px-3 py-2">
                  <span className="text-[#22c55e]">{'●'}</span>
                  <span>{'本地存储'}</span>
                </div>
              </div>
              </div>
            </div>

          {recentRooms.length > 0 && (
            <div className="mx-auto mt-4 w-full max-w-5xl rounded-[14px] border border-[#e8ecf2] bg-white p-5 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{'最近房间'}</h2>
                  <p className="mt-1 text-xs text-[#8e95b2]">{'未销毁且未过期的房间会保留在这里，方便继续进入。'}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshRecentRooms()}
                    className="rounded-full border border-[#d7deeb] bg-white px-3 py-1 text-[12px] font-medium text-[#5e6687] transition hover:border-[#f59e0b] hover:text-[#f59e0b]"
                  >
                    {'刷新'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDestroyAllRecentRooms()}
                    disabled={isDestroyingAllRecentRooms || recentRoomActionId !== null || recentRooms.every((room) => !room.isOwner)}
                    className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDestroyingAllRecentRooms ? '销毁中...' : '全部销毁'}
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {recentRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-[#edf2fb] bg-[#f8fafd] px-4 py-3 text-left transition hover:border-[#f7c56d] hover:bg-[#fffaf0]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">{room.id}</span>
                        {room.isEncrypted && (
                          <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-[11px] font-medium text-[#d97706]">
                            {'加密'}
                          </span>
                        )}
                        {room.isOwner && (<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{'房主'}</span>)}
                        {typeof room.noteCount === 'number' && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">{room.noteCount}{' 张便签'}</span>
                        )}
                      </div>
                      <div className="mt-1 text-[12px] text-[#8e95b2]">
                        {room.expiresAt ? `剩余 ${formatRemainingTime(Math.max(room.expiresAt - Date.now(), 0))}` : '可继续进入'}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => void handleEnterRecentRoom(room)} disabled={recentRoomActionId === room.id || isDestroyingAllRecentRooms} className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#5e6687] shadow-sm transition hover:text-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-60">{recentRoomActionId === room.id ? '处理中...' : '进入'}</button>
                      {room.isOwner && <button type="button" onClick={() => void handleDestroyRecentRoom(room)} disabled={recentRoomActionId === room.id || isDestroyingAllRecentRooms} className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">{'销毁'}</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#f0f3f8] text-center">
            <p className="text-xs text-gray-400">{'MeshKit · P2P 协作工具套件'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-156px)] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#edf4ff_100%)] px-3 pb-3 pt-3 sm:min-h-[calc(100dvh-168px)] sm:px-4 sm:py-4">
      <div className="relative z-20 flex-shrink-0 overflow-visible rounded-[28px] border border-white/70 bg-white/88 px-3 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6 sm:py-4">
        <div className="mx-auto max-w-7xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#5e6687]">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isConnected
                      ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]'
                      : 'bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.14)]'
                  }`}
                />
                <span>{isConnected ? `已连接 · ${Math.max(users.length, 1)} 人` : '等待连接'}</span>
              </div>
              <div className="rounded-full border border-[#e8ecf2] bg-[#f8fafd] px-3 py-1 text-[11px] font-medium text-[#8e95b2]">
                {isCanvasLocked ? '画布已锁定' : '长按拖动画布/便签'}
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex w-max min-w-full items-center gap-2 px-1 sm:flex-wrap sm:px-0">
                <div className="flex items-center gap-2 rounded-full border border-[#d7deeb] bg-[#f8fafd] px-3 py-2 text-[12px]">
                  <span className="text-[#8e95b2]">{'房间'}</span>
                  <span className="font-mono font-semibold text-slate-900">{roomInfo?.roomId}</span>
                  {roomInfo?.isEncrypted && (
                    <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-[11px] font-medium text-[#d97706]">
                      {roomInfo?.encryptionMethod || '加密'}
                    </span>
                  )}
                </div>
                <button type="button" onClick={copyRoomId} className="rounded-full border border-[#d7deeb] bg-white px-3.5 py-2 text-[12px] font-medium text-[#5e6687] transition hover:border-slate-300 hover:bg-[#f8fafd]">{'复制'}</button>
                <button type="button" onClick={shareRoom} disabled={isSharingRoom} className="rounded-full border border-sky-200 bg-sky-50 px-3.5 py-2 text-[12px] font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60">{isSharingRoom ? '分享中...' : '分享'}</button>
                <button type="button" onClick={handleRefreshRoom} disabled={isRefreshingRoom} className="rounded-full border border-[#d7deeb] bg-white px-3.5 py-2 text-[12px] font-medium text-[#5e6687] transition hover:border-slate-300 hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-60">{isRefreshingRoom ? '刷新中...' : '刷新'}</button>
                <button type="button" onClick={handleLocateLatestNote} disabled={notes.length === 0} className="rounded-full border border-[#d7deeb] bg-white px-3.5 py-2 text-[12px] font-medium text-[#5e6687] transition hover:border-slate-300 hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-50">{'找最新便签'}</button>
                {isEditingName ? (
                  <div className="flex items-center gap-2 rounded-full border border-[#d7deeb] bg-white px-3 py-1.5">
                    <input type="text" value={tempUserName} onChange={(e) => setTempUserName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelEditName(); }} className="w-28 bg-transparent text-[12px] text-slate-900 outline-none" placeholder={'输入昵称'} autoFocus />
                    <button type="button" onClick={handleSaveName} className="rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-medium text-white">{'保存'}</button>
                    <button type="button" onClick={handleCancelEditName} className="rounded-full border border-[#d7deeb] px-2.5 py-1 text-[11px] font-medium text-[#5e6687]">{'取消'}</button>
                  </div>
                ) : (
                  <button type="button" onClick={handleStartEditName} className="flex items-center gap-2 rounded-full border border-[#d7deeb] bg-white px-3 py-2 text-[12px] text-slate-700 transition hover:border-sky-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: roomInfo?.userColor }} />
                    <span className="max-w-[120px] truncate font-medium">{roomInfo?.userName}</span>
                    <span className="text-[#8e95b2]">{'改昵称'}</span>
                  </button>
                )}
                <div className="relative shrink-0">
                  <button ref={colorPickerButtonRef} type="button" onClick={(e) => { e.stopPropagation(); if (!showColorPicker) { updateColorPickerPosition(); } setShowColorPicker((prev) => !prev); }} className="rounded-full bg-sky-600 px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_20px_rgba(14,165,233,0.22)] transition hover:bg-sky-700">{'+ 添加便签'}</button>
                </div>
                <button type="button" onClick={handleToggleCanvasLock} className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition ${isCanvasLocked ? 'border border-amber-200 bg-amber-50 text-amber-700' : 'border border-[#d7deeb] bg-white text-[#5e6687] hover:border-slate-300 hover:bg-[#f8fafd]'}`}>{isCanvasLocked ? '解锁画布' : '锁定画布'}</button>
                <button type="button" onClick={() => void handleLeaveRoom()} className="rounded-full border border-[#d7deeb] bg-white px-3.5 py-2 text-[12px] font-medium text-[#5e6687] transition hover:border-slate-300 hover:bg-[#f8fafd]">{'离开'}</button>
                <button type="button" onClick={() => void handleDestroyRoom()} className="rounded-full bg-rose-600 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-rose-700">{'销毁'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        ref={wallRef}
        className="relative mt-3 min-h-[360px] flex-1 overflow-hidden rounded-[30px] border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] select-none sm:min-h-[420px]"
        style={{
          cursor: isCanvasLocked ? 'default' : isDraggingCanvas ? 'grabbing' : 'grab',
          touchAction: isCanvasLocked ? 'auto' : 'none',
        }}
        onClick={() => setShowColorPicker(false)}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
      >
        <div
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
            transformOrigin: '0 0',
            transition: isDraggingCanvas ? 'none' : 'transform 0.1s ease-out',
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {notes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="rounded-[24px] border border-dashed border-[#d7e3f5] bg-white/50 px-8 py-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <p className="mb-2 text-lg font-semibold text-slate-700">{'还没有便签'}</p>
                <p className="text-sm text-[#8e95b2]">{'点击右上角的“添加便签”，或者让其他成员在房间里一起创建。'}</p>
              </div>
            </div>
          ) : (
            notes.map((note) => (
              <StickyNoteCard
                key={note.id}
                note={note}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
                canvasScale={canvasScale}
              />
            ))
          )}
        </div>

        {isCanvasTouchPending && !isDraggingCanvas && !isCanvasLocked && (
          <div className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full bg-slate-900/72 px-4 py-1.5 text-[11px] font-medium text-white shadow-lg">
            {'长按后再拖动画布或便签'}
          </div>
        )}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-[20px] border border-white/70 bg-white/92 p-2.5 shadow-[0_16px_36px_rgba(15,23,42,0.12)] backdrop-blur">
          <button
            type="button"
            onClick={() => setCanvasScale((prev) => Math.max(0.5, +(prev - 0.1).toFixed(2)))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d7deeb] bg-white text-base font-semibold text-slate-700 transition hover:border-sky-300"
            title={'缩小画布'}
          >
            -
          </button>
          <div className="min-w-[54px] text-center text-[12px] font-semibold text-slate-700">{Math.round(canvasScale * 100)}%</div>
          <button
            type="button"
            onClick={() => setCanvasScale((prev) => Math.min(3, +(prev + 0.1).toFixed(2)))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d7deeb] bg-white text-base font-semibold text-slate-700 transition hover:border-sky-300"
            title={'放大画布'}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setCanvasScale(1);
              setCanvasOffset({ x: 0, y: 0 });
            }}
            className="rounded-full bg-sky-600 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-sky-700"
            title={'重置缩放和位置'}
          >
            {'重置视图'}
          </button>
        </div>
      </div>

      <div className="mt-3 flex-shrink-0 rounded-[20px] border border-white/70 bg-white/90 px-4 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex flex-col gap-2 text-[12px] text-[#5e6687] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 truncate font-medium text-slate-700">
            {'房间号: '}{roomInfo?.roomId}
            {roomExpiresIn !== null && (
              <span className="ml-2 text-[#d97706]">
                {'剩余 '}{formatRemainingTime(roomExpiresIn)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="rounded-full bg-[#f8fafd] px-3 py-1 font-medium text-slate-700">{'便签数: '}{notes.length}</span>
            <span className="rounded-full bg-[#f8fafd] px-3 py-1 font-medium text-slate-700">{'在线人数: '}{users.length}</span>
          </div>
        </div>
      </div>

      {showColorPicker && colorPickerPosition && (
        <div
          ref={colorPickerPanelRef}
          className="fixed z-[400] w-[220px] rounded-[18px] border border-[#e8ecf2] bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
          style={{
            top: colorPickerPosition.top,
            left: colorPickerPosition.left,
          }}
        >
          <p className="mb-3 text-sm font-semibold text-slate-900">{'选择便签颜色'}</p>
          <div className="grid grid-cols-4 gap-2">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  void handleAddNote(color);
                }}
                className="h-9 w-9 rounded-2xl border-2 border-white shadow-sm transition hover:scale-105 hover:border-slate-300"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <div className="mt-3 border-t border-[#eef2f8] pt-3">
            <div className="mb-2 text-[12px] font-medium text-[#5e6687]">{'自定义颜色'}</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-xl border border-[#d7deeb] bg-transparent"
                title={'选择自定义颜色'}
              />
              <button
                type="button"
                onClick={() => {
                  void handleAddNote(customColor);
                }}
                className="flex-1 rounded-[12px] bg-sky-600 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-sky-700"
              >
                {'使用这个颜色'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareLinkDialog
        open={showShareDialog}
        shareUrl={shareUrl}
        title={'分享便签墙'}
        description={'可以直接复制链接，或者让对方扫码打开当前房间。'}
        qrTitle={'扫码进入便签墙'}
        qrCaption={'二维码会包含房间号、加密设置和当前链接参数。'}
        downloadQrFileName={`meshkit-sticky-notes-${roomInfo?.roomId || roomId.trim() || 'room'}.png`}
        isSystemShareSupported={typeof navigator !== 'undefined' && typeof navigator.share === 'function'}
        isSystemSharing={isSystemSharingRoom}
        onClose={() => setShowShareDialog(false)}
        onCopyLink={handleCopyShareLink}
        onSystemShare={handleNativeShare}
      />

      {showDestroyPasswordDialog && (
        <PasswordConfirmDialog
          title="Verify Password"
          message="This room is encrypted. Enter the password to confirm destruction."
          confirmLabel="Verify & Destroy"
          onConfirm={handleDestroyRoomConfirm}
          onCancel={handleDestroyRoomCancel}
        />
      )}
    </div>
  );
}

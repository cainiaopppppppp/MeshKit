import { useState, useEffect, useRef } from 'react';
import { useP2P } from '../hooks/useP2P';
import { chatRoom } from '../services/ChatRoom';
import { chatStorage } from '../utils/ChatStorage';
import { ChatMessageCard } from '../components/ChatMessageCard';
import { ExperienceBadge } from '../components/ExperienceShell';
import { ShareLinkDialog } from '../components/ShareLinkDialog';
import { useAppChrome } from '../contexts/AppChromeContext';
import { ENCRYPTION_METHODS, type EncryptionMethod } from '../utils/ChatCrypto';
import type { ChatMessage, ChatUser, ChatRoomConfig, ChatRoomStorage } from '../types/chat';
import { getShareableWebUrl, parseShareInvitePayloadFromUrl } from '../utils/signalingConfig';

function SecureRoomIcon({ className }: { className?: string }) {
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
      <path d="M12 3.75 18.5 6v5.25c0 4.05-2.38 7.25-6.5 9-4.12-1.75-6.5-4.95-6.5-9V6L12 3.75Z" />
      <path d="M9.5 11.25V10a2.5 2.5 0 1 1 5 0v1.25" />
      <rect x="8.5" y="11.25" width="7" height="5.25" rx="1.5" />
    </svg>
  );
}


export function EncryptedChatPage() {
  useP2P();
  const { setBrandHeaderHidden } = useAppChrome();

  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('encrypted_chat_user_name') || '';
  });
  const [userColor] = useState(() => chatStorage.getOrCreateUserColor());
  const [enableEncryption, setEnableEncryption] = useState(false);
  const [encryptionMethod, setEncryptionMethod] = useState<EncryptionMethod>('AES-256-CBC');
  const [isInRoom, setIsInRoom] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // @ts-expect-error onlineCount is kept while the full user list UI is deferred
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [messageInput, setMessageInput] = useState('');
  const [selfDestructTime, setSelfDestructTime] = useState<number | undefined>(undefined);
  const [roomExpiresIn, setRoomExpiresIn] = useState<number | null>(null);
  const [isSharingRoom, setIsSharingRoom] = useState(false);
  const [isSystemSharingRoom, setIsSystemSharingRoom] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isRefreshingRoom, setIsRefreshingRoom] = useState(false);
  const [recentRooms, setRecentRooms] = useState<ChatRoomStorage[]>([]);
  const [recentRoomActionId, setRecentRoomActionId] = useState<string | null>(null);
  const [roomOwnerName, setRoomOwnerName] = useState('');
  const [isRoomOwner, setIsRoomOwner] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempUserName, setTempUserName] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDestroyingCurrentRoomRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    setRoomId(id);
  };

  const generateRandomUserName = () => {
    const randomName = `匿名用户_${Math.random().toString(36).substring(2, 6)}`;
    setUserName(randomName);
  };

  const refreshRecentRooms = () => {
    setRecentRooms(chatStorage.getRecentRooms());
  };

  const applyRecentRoom = (room: ChatRoomStorage) => {
    setRoomId(room.roomId);
    setEnableEncryption(Boolean(room.passwordHash));
    setEncryptionMethod(room.encryptionMethod || 'AES-256-CBC');
    if (!userName.trim() && room.myName) {
      setUserName(room.myName);
    }
    const nextPassword = room.savedPassword || '';
    setPassword(nextPassword);
    setConfirmPassword(nextPassword);
  };

  const handleEnterRecentRoom = async (room: ChatRoomStorage) => {
    if (chatStorage.isRoomDestroyed(room.roomId)) {
      refreshRecentRooms();
      alert('这个房间已被销毁，无法再次进入。');
      return;
    }

    const nextPassword = room.savedPassword || '';
    const nextUserName = userName.trim() || room.myName || '';

    if (room.passwordHash && !nextPassword) {
      applyRecentRoom(room);
      alert('已帮你回填最近房间信息，请输入密码后直接进入。');
      return;
    }

    setRoomId(room.roomId);
    setEnableEncryption(Boolean(room.passwordHash));
    setEncryptionMethod(room.encryptionMethod || 'AES-256-CBC');
    if (nextUserName && !userName.trim()) {
      setUserName(nextUserName);
    }
    setPassword(nextPassword);
    setConfirmPassword(nextPassword);

    setRecentRoomActionId(room.roomId);

    try {
      if (nextUserName) {
        localStorage.setItem('encrypted_chat_user_name', nextUserName);
      }

      await connectToChatRoom({
        roomId: room.roomId,
        password: nextPassword || undefined,
        enableEncryption: Boolean(room.passwordHash),
        encryptionMethod: room.encryptionMethod || 'AES-256-CBC',
      });
    } catch (error) {
      console.error('[EncryptedChatPage] Failed to enter recent room:', error);
      const errorMessage = error instanceof Error ? error.message : '进入最近房间失败';
      alert(errorMessage);
    } finally {
      setRecentRoomActionId(null);
    }
  };

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
    } catch (error) {
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
    } catch (error) {
      console.error('Fallback copy failed:', error);
      window.prompt('请手动复制以下内容', text);
      return false;
    } finally {
      if (textarea.parentNode === document.body) {
        document.body.removeChild(textarea);
      }
    }
  };

  const connectToChatRoom = async (config: ChatRoomConfig) => {
    chatStorage.clearDestroyedRoomMarker(config.roomId.trim());

    await chatRoom.joinRoom(config, userName.trim(), userColor, {
      onMessageReceived: (message) => {
        setMessages((prev) => [...prev, message]);
      },
      onUsersChanged: (userList, totalCount) => {
        setUsers(userList);
        setOnlineCount(totalCount);
      },
      onRoomDestroyed: handleDestroyedRoomExit,
      onRoomExpiring: (remaining) => {
        setRoomExpiresIn(remaining);
      },
    });

    setIsInRoom(true);
    const history = chatRoom.getMessages();
    setMessages(history);
    const roomUsers = chatRoom.getUsers();
    setUsers(roomUsers);
    setOnlineCount(roomUsers.length + 1);

    const roomInfo = chatRoom.getRoomInfo();
    setRoomOwnerName(roomInfo.ownerName || '');
    setIsRoomOwner(roomInfo.isOwner);
    refreshRecentRooms();
  };

  const handleJoinRoom = async () => {
    if (!roomId.trim()) {
      alert('请输入房间码');
      return;
    }

    if (!userName.trim()) {
      alert('请输入昵称');
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
        localStorage.setItem('encrypted_chat_user_name', userName.trim());
      }

      const config: ChatRoomConfig = {
        roomId: roomId.trim(),
        password: password.trim() || undefined,
        enableEncryption,
        encryptionMethod,
      };

      await connectToChatRoom(config);
      return;

      await chatRoom.joinRoom(config, userName.trim(), userColor, {
        onMessageReceived: (message) => {
          setMessages(prev => [...prev, message]);
        },
        onUsersChanged: (userList, totalCount) => {
          setUsers(userList);
          setOnlineCount(totalCount);
        },
        onRoomDestroyed: handleDestroyedRoomExit,
        onRoomExpiring: (remaining) => {
          setRoomExpiresIn(remaining);
        },
      });

      setIsInRoom(true);

      const history = chatRoom.getMessages();
      setMessages(history);

      const roomUsers = chatRoom.getUsers();
      setUsers(roomUsers);
      setOnlineCount(roomUsers.length + 1);

    } catch (error) {
      console.error('[EncryptedChatPage] Failed to join room:', error);
      const errorMessage = error instanceof Error ? error.message : '加入房间失败';
      alert(errorMessage);
    }
  };

  const handleLeaveRoom = () => {
    isDestroyingCurrentRoomRef.current = false;
    void chatRoom.leaveRoom();
    resetRoomState();
  };

  const handleDestroyedRoomExit = () => {
    const destroyedLocally = isDestroyingCurrentRoomRef.current;
    const message = destroyedLocally
      ? '房间已销毁。'
      : '房主已销毁这个加密聊天房间，你已退出当前房间。';

    isDestroyingCurrentRoomRef.current = false;

    if (!destroyedLocally) {
      void chatRoom.leaveRoom().catch(() => undefined);
    }

    resetRoomState();
    alert(message);
  };

  const resetRoomState = () => {
    setIsInRoom(false);
    setMessages([]);
    setUsers([]);
    setOnlineCount(1);
    setRoomExpiresIn(null);
    setRoomOwnerName('');
    setIsRoomOwner(false);
    setShowShareDialog(false);
    setShareUrl('');
    refreshRecentRooms();
  };

  const handleDestroyRecentRoom = (room: ChatRoomStorage) => {
    if (!room.isOwner) {
      alert(room.ownerName
        ? '只有房主可以销毁这个房间。\n\n当前房主：' + room.ownerName
        : '只有房主可以销毁这个房间。');
      return;
    }

    if (
      !confirm(
        `确定要销毁最近房间 ${room.roomId} 吗？\n\n销毁后会清除这个房间在本机的聊天记录和保存信息。`,
      )
    ) {
      return;
    }

    setRecentRoomActionId(room.roomId);

    try {
      chatStorage.destroyRoom(room.roomId);

      if (room.roomId === roomId.trim()) {
        setRoomId('');
        setPassword('');
        setConfirmPassword('');
      }

      refreshRecentRooms();
      alert('最近房间已销毁。');
    } finally {
      setRecentRoomActionId(null);
    }
  };

  const handleDestroyCurrentRoom = async () => {
    if (!roomId.trim()) {
      alert('请先创建或加入房间');
      return;
    }

    if (!isRoomOwner) {
      alert(roomOwnerName
        ? '只有房主可以销毁这个房间。\n\n当前房主：' + roomOwnerName
        : '只有房主可以销毁这个房间。');
      return;
    }

    if (
      !confirm(
        `确定要销毁房间 ${roomId.trim()} 吗？\n\n销毁后会清除本机聊天记录，并立即离开这个房间。`,
      )
    ) {
      return;
    }

    try {
      isDestroyingCurrentRoomRef.current = true;
      await chatRoom.destroyRoom();
    } catch (error) {
      isDestroyingCurrentRoomRef.current = false;
      console.error('[EncryptedChatPage] Failed to destroy room:', error);
      alert(error instanceof Error ? error.message : '销毁房间失败');
    }
  };

  const handleClearRoomData = () => {
    if (!roomId.trim()) {
      alert('请先输入房间码');
      return;
    }

    if (confirm('确定要清除房间 ' + roomId + ' 的本地数据吗？\n\n清除后您可以重新创建此房间。')) {
      chatStorage.clearRoomData(roomId.trim());
      refreshRecentRooms();
      alert('房间数据已清除，现在可以重新创建此房间。');
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    try {
      const message = await chatRoom.sendMessage(
        messageInput.trim(),
        selfDestructTime
      );

      setMessages(prev => [...prev, message]);
      setMessageInput('');
    } catch (error) {
      console.error('[EncryptedChatPage] Failed to send message:', error);
      alert('发送失败，请稍后重试');
    }
  };

  const handleMessageDelete = (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  const handleStartEditName = () => {
    setTempUserName(userName);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (tempUserName.trim()) {
      setUserName(tempUserName.trim());
      chatStorage.saveUserName(tempUserName.trim());
    }
    setIsEditingName(false);
  };

  const copyRoomId = async () => {
    if (!roomId.trim()) {
      alert('请先创建或加入房间');
      return;
    }

    await copyTextWithFallback(roomId.trim(), '房间码已复制到剪贴板');
    return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(roomId);
        alert('房间码已复制到剪贴板');
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = roomId;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
          document.execCommand('copy');
          alert('房间码已复制到剪贴板');
        } catch (err) {
          alert('房间码：' + roomId + '\n请手动复制');
        } finally {
          if (textarea.parentNode === document.body) {
            document.body.removeChild(textarea);
          }
        }
      }
    } catch (error) {
      console.error('复制房间码失败:', error);
      alert('房间码：' + roomId + '\n请手动复制');
    }
  };

  const shareRoom = async () => {
    if (!roomId.trim()) {
      alert('请先创建或加入房间');
      return;
    }

    setIsSharingRoom(true);

    try {
      const shareable = await getShareableWebUrl('/encrypted-chat', {
        encryptedChat: {
          roomId: roomId.trim(),
          encrypted: enableEncryption || !!password.trim(),
          encryptionMethod,
          password: password.trim() || undefined,
        },
      });

      setShareUrl(shareable.url);
      setShowShareDialog(true);
    } catch (error) {
      console.error('[EncryptedChatPage] Failed to share room:', error);
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
    if (!shareUrl || !navigator.share || !roomId.trim()) {
      return;
    }

    setIsSystemSharingRoom(true);

    try {
      await navigator.share({
        title: 'MeshKit 加密聊天',
        text: '加入加密聊天房间 ' + roomId.trim(),
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

  const handleRefreshRoom = async () => {
    if (!roomId.trim()) {
      alert('请先创建或加入房间');
      return;
    }

    setIsRefreshingRoom(true);

    try {
      await chatRoom.leaveRoom();
      await connectToChatRoom({
        roomId: roomId.trim(),
        password: password.trim() || undefined,
        enableEncryption,
        encryptionMethod,
      });
    } catch (error) {
      console.error('[EncryptedChatPage] Failed to refresh room:', error);
      alert(error instanceof Error ? error.message : '刷新房间失败');
    } finally {
      setIsRefreshingRoom(false);
    }
  };

  useEffect(() => {
    const sharedChat = parseShareInvitePayloadFromUrl(window.location.href)?.encryptedChat;

    if (!sharedChat) {
      return;
    }

    if (sharedChat.roomId) {
      setRoomId(sharedChat.roomId);
    }

    if (sharedChat.encrypted) {
      setEnableEncryption(true);
    }

    if (
      sharedChat.encryptionMethod
      && ENCRYPTION_METHODS.some((method) => method.value === sharedChat.encryptionMethod)
    ) {
      setEncryptionMethod(sharedChat.encryptionMethod as EncryptionMethod);
    }

    if (sharedChat.password) {
      setPassword(sharedChat.password);
      setConfirmPassword(sharedChat.password);
    }
  }, []);

  useEffect(() => {
    refreshRecentRooms();
  }, []);

  useEffect(() => {
    setBrandHeaderHidden(isInRoom);

    return () => {
      setBrandHeaderHidden(false);
    };
  }, [isInRoom, setBrandHeaderHidden]);

  const formatRemainingTime = (ms: number): string => {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return hours + '小时' + minutes + '分钟';
  };

  if (!isInRoom) {
    return (
      <div className="px-5 py-6 pb-14 sm:px-4">
        <div className="mx-auto max-w-[480px]">

          <div className="mb-7">
            <p className="mb-1.5 font-['DM_Sans',_'Noto_Sans_SC',sans-serif] text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">MeshKit Private Chat</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">{'加密聊天'}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {'一个加密聊天房间，可以定时销毁信息'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ExperienceBadge tone="emerald">{'端到端保护'}</ExperienceBadge>
              <ExperienceBadge tone="sky">{'P2P 直连'}</ExperienceBadge>
              <ExperienceBadge tone="amber">{'阅后即焚'}</ExperienceBadge>
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl space-y-4 rounded-[14px] border border-[#e8ecf2] bg-white p-6 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="昵称"
                className="min-w-0 flex-1 rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all focus:border-[#10b981] focus:outline-none focus:ring-4 focus:ring-[rgba(16,185,129,0.12)]"
              />
              <button
                onClick={generateRandomUserName}
                className="shrink-0 whitespace-nowrap rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-[13px] font-medium text-[#5e6687] transition-all hover:border-[#10b981] hover:text-[#10b981] sm:px-5"
              >
                {'随机'}
              </button>
            </div>

            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder={'房间码'}
                className="min-w-0 flex-1 rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all focus:border-[#10b981] focus:outline-none focus:ring-4 focus:ring-[rgba(16,185,129,0.12)]"
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
                      className="w-full appearance-none rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 pr-10 text-slate-900 shadow-sm transition-all focus:border-[#10b981] focus:outline-none focus:ring-4 focus:ring-[rgba(16,185,129,0.12)]"
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
                    className="w-full rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all focus:border-[#10b981] focus:outline-none focus:ring-4 focus:ring-[rgba(16,185,129,0.12)]"
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
                    className="w-full rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all focus:border-[#10b981] focus:outline-none focus:ring-4 focus:ring-[rgba(16,185,129,0.12)]"
                  />
                </div>
              </>
            )}

            <button
              onClick={handleJoinRoom}
              className="w-full rounded-[10px] bg-[#10b981] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] transition-all hover:bg-[#059669]"
            >
              进入 / 创建房间
            </button>

            <button
              onClick={handleClearRoomData}
              className="w-full rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-transparent px-4 py-2.5 text-[13px] font-medium text-[#ef4444] transition-all hover:bg-[rgba(239,68,68,0.05)]"
            >
              清除房间本地数据
            </button>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-2.5 text-xs text-[#5e6687] sm:grid-cols-4 sm:gap-3">
                <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#eef2f8] bg-[#f8fafd] px-3 py-2">
                  <span className="text-[#22c55e]">{'●'}</span>
                  <span>{'端到端加密'}</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#eef2f8] bg-[#f8fafd] px-3 py-2">
                  <span className="text-[#22c55e]">{'●'}</span>
                  <span>{'P2P 直连'}</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#eef2f8] bg-[#f8fafd] px-3 py-2">
                  <span className="text-[#22c55e]">{'●'}</span>
                  <span>{'阅后即焚'}</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#eef2f8] bg-[#f8fafd] px-3 py-2">
                  <span className="text-[#22c55e]">{'●'}</span>
                  <span>{'24h 自毁'}</span>
                </div>
              </div>
            </div>
          </div>

          {recentRooms.length > 0 && (
            <div className="mx-auto mt-4 w-full max-w-5xl rounded-[14px] border border-[#e8ecf2] bg-white p-5 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{'最近房间'}</h2>
                  <p className="mt-1 text-xs text-[#8e95b2]">{'未过期的聊天房间会保留在这里，方便继续查看历史消息。'}</p>
                </div>
                <button
                  type="button"
                  onClick={refreshRecentRooms}
                  className="rounded-full border border-[#d7deeb] bg-white px-3 py-1 text-[12px] font-medium text-[#5e6687] transition hover:border-[#10b981] hover:text-[#10b981]"
                >
                  {'刷新'}
                </button>
              </div>

              <div className="space-y-2.5">
                {recentRooms.map((room) => (
                  <div
                    key={room.roomId}
                    className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-[#edf2fb] bg-[#f8fafd] px-4 py-3 text-left transition hover:border-[#9ae6c4] hover:bg-[#f4fcf8]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">{room.roomId}</span>
                        {room.passwordHash && (
                          <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] font-medium text-[#059669]">
                            {'需密码'}
                          </span>
                        )}
                        {room.isOwner ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            {'房主'}
                          </span>
                        ) : room.ownerName ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            {'房主：'}{room.ownerName}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">{room.messages.length}{' 条消息'}</span>
                      </div>
                      <div className="mt-1 text-[12px] text-[#8e95b2]">
                        {'剩余'} {formatRemainingTime(room.expiresAt - Date.now())}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => void handleEnterRecentRoom(room)} disabled={recentRoomActionId === room.roomId} className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#5e6687] shadow-sm transition hover:text-[#10b981] disabled:cursor-not-allowed disabled:opacity-60">{recentRoomActionId === room.roomId ? '处理中...' : '进入'}</button>
                      {room.isOwner && <button type="button" onClick={() => handleDestroyRecentRoom(room)} disabled={recentRoomActionId === room.roomId} className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">{recentRoomActionId === room.roomId ? '处理中...' : '销毁'}</button>}
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
    <div className="h-full min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#eef8f3_48%,_#f8fafc_100%)] px-4 py-4 sm:py-5">
      <div className="mx-auto flex h-full min-h-0 max-w-5xl flex-col">
      <div className="mb-3 rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
                  <SecureRoomIcon className="h-[18px] w-[18px]" />
                </span>
                <h2 className="text-lg font-bold text-gray-900">{'房间: '}{roomId}</h2>
                {isRoomOwner ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    {'房主'}
                  </span>
                ) : roomOwnerName ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    {'房主：'}{roomOwnerName}
                  </span>
                ) : null}
                <button
                  onClick={copyRoomId}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 touch-manipulation min-h-[28px]"
                  title={'复制房间码'}
                >
                  {'复制'}
                </button>
                <button
                  onClick={shareRoom}
                  disabled={isSharingRoom}
                  className="text-xs px-2 py-1 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation min-h-[28px]"
                  title={'分享房间'}
                >
                  {isSharingRoom ? '分享中...' : '分享'}
                </button>
                <button
                  onClick={handleRefreshRoom}
                  disabled={isRefreshingRoom}
                  className="text-xs px-2 py-1 border border-slate-200 bg-slate-50 text-slate-700 rounded hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation min-h-[28px]"
                  title={'刷新房间'}
                >
                  {isRefreshingRoom ? '刷新中...' : '刷新'}
                </button>
                {isRoomOwner && (
                  <button
                    onClick={() => void handleDestroyCurrentRoom()}
                    className="text-xs px-2 py-1 border border-rose-200 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 touch-manipulation min-h-[28px]"
                    title={'销毁房间'}
                  >
                    {'销毁'}
                  </button>
                )}
                {roomExpiresIn && roomExpiresIn < 60 * 60 * 1000 && (
                  <span className="text-xs text-orange-500">
                    {formatRemainingTime(roomExpiresIn)}{'后过期'}
                  </span>
                )}
              </div>
              {isEditingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={tempUserName}
                    onChange={(e) => setTempUserName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    className="px-2 py-1 text-sm border rounded"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    {'保存'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: userColor }}
                  />
                  <span className="text-sm text-gray-600">{userName}</span>
                  {roomOwnerName && (
                    <span className="text-xs text-gray-400">
                      {'房主：'}{roomOwnerName}
                    </span>
                  )}
                  <button
                    onClick={handleStartEditName}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {'编辑'}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-sm text-gray-500">
              {onlineCount}{' 人在线'}
            </span>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
            >
              {'离开'}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-3 min-h-0 flex-1 overflow-y-auto rounded-[28px] border border-white/70 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            {'暂无消息，开始聊天吧'}
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageCard
              key={msg.id}
              message={msg}
              isOwnMessage={msg.userId === chatRoom.getMyUserId()}
              onDelete={handleMessageDelete}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-gray-600">{'阅后即焚：'}</label>
          <select
            value={selfDestructTime || ''}
            onChange={(e) =>
              setSelfDestructTime(e.target.value ? Number(e.target.value) : undefined)
            }
            className="text-xs border rounded px-2 py-1"
          >
            <option value="">{'关闭'}</option>
            <option value="30000">{'30秒'}</option>
            <option value="60000">{'1分钟'}</option>
            <option value="300000">{'5分钟'}</option>
            <option value="600000">{'10分钟'}</option>
          </select>
        </div>

        <div className="flex gap-2">
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={'输入消息... (Shift+Enter 换行)'}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {'发送'}
          </button>
        </div>
      </div>

      <ShareLinkDialog
        open={showShareDialog}
        shareUrl={shareUrl}
        title={'分享加密聊天'}
        description={'可以直接发送链接，也可以让对方扫码进入当前房间。'}
        qrTitle={'扫码进入加密聊天'}
        qrCaption={'二维码会带上房间号、加密方式和当前链接参数。'}
        downloadQrFileName={`meshkit-encrypted-chat-${roomId.trim() || 'room'}.png`}
        isSystemShareSupported={typeof navigator !== 'undefined' && typeof navigator.share === 'function'}
        isSystemSharing={isSystemSharingRoom}
        onClose={() => setShowShareDialog(false)}
        onCopyLink={handleCopyShareLink}
        onSystemShare={handleNativeShare}
      />
      </div>
    </div>
  );
}

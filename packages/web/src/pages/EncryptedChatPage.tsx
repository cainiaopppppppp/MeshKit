/**
 * 加密聊天页面 - "隐秘信使"（房间群聊模式）
 * 参考便签墙UI设计
 */

import { useState, useEffect, useRef } from 'react';
import { useP2P } from '../hooks/useP2P';
import { chatRoom } from '../services/ChatRoom';
import { chatStorage } from '../utils/ChatStorage';
import { ChatMessageCard } from '../components/ChatMessageCard';
import { ENCRYPTION_METHODS, type EncryptionMethod } from '../utils/ChatCrypto';
import type { ChatMessage, ChatUser, ChatRoomConfig } from '../types/chat';

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

  // 房间状态
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userName, setUserName] = useState(() => {
    // 从 localStorage 读取保存的用户名，但不自动生成
    return localStorage.getItem('encrypted_chat_user_name') || '';
  });
  const [userColor] = useState(() => chatStorage.getOrCreateUserColor());
  const [enableEncryption, setEnableEncryption] = useState(false);
  const [encryptionMethod, setEncryptionMethod] = useState<EncryptionMethod>('AES-256-CBC');
  const [isInRoom, setIsInRoom] = useState(false);

  // 聊天状态
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // @ts-expect-error - users保留以备将来显示用户列表，目前使用onlineCount显示人数
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(1); // 在线人数（包括自己）
  const [messageInput, setMessageInput] = useState('');
  const [selfDestructTime, setSelfDestructTime] = useState<number | undefined>(undefined);
  const [roomExpiresIn, setRoomExpiresIn] = useState<number | null>(null);

  // 用户名编辑
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempUserName, setTempUserName] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 生成随机房间码
  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    setRoomId(id);
  };

  // 生成随机用户名
  const generateRandomUserName = () => {
    const randomName = `用户${Math.random().toString(36).substring(2, 6)}`;
    setUserName(randomName);
  };

  // 加入或创建房间
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
      alert('密码至少需要4个字符');
      return;
    }

    if (enableEncryption && password !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }

    try {
      // 保存用户名到 localStorage
      if (userName.trim()) {
        localStorage.setItem('encrypted_chat_user_name', userName.trim());
      }

      const config: ChatRoomConfig = {
        roomId: roomId.trim(),
        password: password.trim() || undefined,
        enableEncryption,
        encryptionMethod,
      };

      await chatRoom.joinRoom(config, userName.trim(), userColor, {
        onMessageReceived: (message) => {
          setMessages(prev => [...prev, message]);
        },
        onUsersChanged: (userList, totalCount) => {
          setUsers(userList);
          setOnlineCount(totalCount);
        },
        onRoomDestroyed: () => {
          alert('房间已销毁（24小时过期）');
          handleLeaveRoom();
        },
        onRoomExpiring: (remaining) => {
          setRoomExpiresIn(remaining);
        },
      });

      setIsInRoom(true);

      // 加载历史消息
      const history = chatRoom.getMessages();
      setMessages(history);

      // 加载用户列表并设置在线人数
      const roomUsers = chatRoom.getUsers();
      setUsers(roomUsers);
      setOnlineCount(roomUsers.length + 1); // +1 包括自己

    } catch (error) {
      console.error('[EncryptedChatPage] Failed to join room:', error);
      const errorMessage = error instanceof Error ? error.message : '加入房间失败';
      alert(errorMessage);
    }
  };

  // 离开房间
  const handleLeaveRoom = () => {
    chatRoom.leaveRoom();
    setIsInRoom(false);
    setMessages([]);
    setUsers([]);
    setOnlineCount(1);
    setRoomExpiresIn(null);
  };

  // 清除当前输入的房间码（用于重新创建房间）
  const handleClearRoomData = () => {
    if (!roomId.trim()) {
      alert('请先输入房间码');
      return;
    }

    if (confirm(`确定要清除房间 ${roomId} 的本地数据吗？\n\n清除后您可以重新创建此房间。`)) {
      chatStorage.destroyRoom(roomId.trim());
      alert('房间数据已清除，您现在可以重新创建此房间。');
    }
  };

  // 发送消息
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
      alert('发送失败');
    }
  };

  // 处理消息删除（阅后即焚）
  const handleMessageDelete = (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  // 开始编辑用户名
  const handleStartEditName = () => {
    setTempUserName(userName);
    setIsEditingName(true);
  };

  // 保存用户名
  const handleSaveName = () => {
    if (tempUserName.trim()) {
      setUserName(tempUserName.trim());
      chatStorage.saveUserName(tempUserName.trim());
    }
    setIsEditingName(false);
  };

  // 复制房间码
  const copyRoomId = async () => {
    try {
      // 检查 Clipboard API 是否可用
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(roomId);
        alert('房间码已复制到剪贴板');
      } else {
        // 降级方案：创建临时输入框
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
          // 如果都失败了，就显示房间码让用户手动复制
          alert(`房间码：${roomId}\n请手动复制`);
        } finally {
          // 安全移除：确保 textarea 是 body 的子节点
          if (textarea.parentNode === document.body) {
            document.body.removeChild(textarea);
          }
        }
      }
    } catch (error) {
      console.error('复制失败:', error);
      alert(`房间码：${roomId}\n请手动复制`);
    }
  };

  // 格式化剩余时间
  const formatRemainingTime = (ms: number): string => {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}小时${minutes}分钟`;
  };

  // 如果还没有进入房间，显示加入界面
  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 md:p-8">
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {/* Header - 移除标题，导航栏已有 */}

          <div className="space-y-4">
            {/* 用户名 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="昵称"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                onClick={generateRandomUserName}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
              >
                随机
              </button>
            </div>

            {/* 房间码 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="房间码"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                onClick={generateRoomId}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
              >
                生成
              </button>
            </div>

            {/* 加密选项 */}
            <div className="flex items-center gap-3 px-1">
              <input
                type="checkbox"
                id="encryption"
                checked={enableEncryption}
                onChange={(e) => setEnableEncryption(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="encryption" className="text-sm text-gray-700 cursor-pointer">
                启用密码保护
              </label>
            </div>

            {/* 加密选项 */}
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
                      className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 appearance-none cursor-pointer transition-all"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                    placeholder="请再次输入密码"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </>
            )}

            {/* 加入按钮 */}
            <button
              onClick={handleJoinRoom}
              className="w-full py-3.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all shadow-sm hover:shadow-md"
            >
              加入房间
            </button>

            {/* 清除房间数据按钮 */}
            <button
              onClick={handleClearRoomData}
              className="w-full py-2.5 px-4 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium hover:bg-red-100 hover:border-red-300 transition-all"
            >
              清除本地数据
            </button>

            {/* 安全特性说明 */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">●</span>
                  <span>端到端加密</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">●</span>
                  <span>P2P 直连</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">●</span>
                  <span>阅后即焚</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">●</span>
                  <span>24h 自毁</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">MeshKit · P2P 协作工具套件</p>
          </div>
        </div>
      </div>
    );
  }

  // 在房间内，显示聊天界面
  return (
    <div className="max-w-xl mx-auto p-4 h-[calc(100vh-120px)] flex flex-col">
      {/* 顶部栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
                  <SecureRoomIcon className="h-[18px] w-[18px]" />
                </span>
                <h2 className="text-lg font-bold text-gray-900">房间: {roomId}</h2>
                {/* 复制房间码按钮 */}
                <button
                  onClick={copyRoomId}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 touch-manipulation min-h-[28px]"
                  title="复制房间码"
                >
                  复制
                </button>
                {roomExpiresIn && roomExpiresIn < 60 * 60 * 1000 && (
                  <span className="text-xs text-orange-500">
                    ⏰ {formatRemainingTime(roomExpiresIn)}后过期
                  </span>
                )}
              </div>
              {/* 用户名显示/编辑 */}
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
                    保存
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: userColor }}
                  />
                  <span className="text-sm text-gray-600">{userName}</span>
                  <button
                    onClick={handleStartEditName}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    编辑
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {onlineCount} 人在线
            </span>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
            >
              离开
            </button>
          </div>
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 bg-white rounded-lg shadow-sm p-4 overflow-y-auto mb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            暂无消息，开始聊天吧！
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

      {/* 输入区域 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        {/* 阅后即焚选项 */}
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-gray-600">阅后即焚：</label>
          <select
            value={selfDestructTime || ''}
            onChange={(e) =>
              setSelfDestructTime(e.target.value ? Number(e.target.value) : undefined)
            }
            className="text-xs border rounded px-2 py-1"
          >
            <option value="">关闭</option>
            <option value="30000">30秒</option>
            <option value="60000">1分钟</option>
            <option value="300000">5分钟</option>
            <option value="600000">10分钟</option>
          </select>
        </div>

        {/* 输入框 */}
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
            placeholder="输入消息... (Shift+Enter 换行)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

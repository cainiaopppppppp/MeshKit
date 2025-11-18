/**
 * 便签墙主页面
 */

import { useState, useEffect, useRef } from 'react';
import { StickyNoteCard } from '../components/StickyNoteCard';
import { StickyNotesRoom } from '../services/StickyNotesRoom';
import type { StickyNote, UserInfo, RoomConfig } from '../types/stickyNote';
import { ENCRYPTION_METHODS, type EncryptionMethod } from '../utils/Encryption';

export function StickyNotesPage() {
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState(() => {
    // 从 localStorage 读取保存的用户名
    return localStorage.getItem('sticky_notes_user_name') || '';
  });
  const [enableEncryption, setEnableEncryption] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempUserName, setTempUserName] = useState('');
  const [customColor, setCustomColor] = useState('#FFE6E6');
  const [encryptionMethod, setEncryptionMethod] = useState<EncryptionMethod>('AES-256-CBC');
  const [roomExpiresIn, setRoomExpiresIn] = useState<number | null>(null);

  // 画布拖动状态
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartOffset = useRef({ x: 0, y: 0 });

  // 画布缩放状态
  const [canvasScale, setCanvasScale] = useState(1);

  const roomRef = useRef<StickyNotesRoom | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);

  // 生成随机用户名
  const generateRandomUserName = () => {
    const randomName = `用户${Math.random().toString(36).substring(2, 6)}`;
    setUserName(randomName);
  };

  // 颜色选项
  const colors = [
    '#FFE6E6', // 粉红
    '#E6F3FF', // 浅蓝
    '#FFF9E6', // 淡黄
    '#E6FFE6', // 淡绿
    '#F3E6FF', // 淡紫
    '#FFE6F3', // 淡粉
    '#E6FFFF', // 淡青
    '#FFEEE6', // 淡橙
  ];

  // 创建或加入房间
  const handleJoinRoom = async () => {
    if (!roomId.trim()) {
      alert('请输入房间码');
      return;
    }

    if (enableEncryption && !password.trim()) {
      alert('启用加密时必须设置密码');
      return;
    }

    try {
      // 保存用户名到 localStorage
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
        onRoomDestroyed: () => {
          alert('房间已被销毁');
          handleLeaveRoom();
        },
        onRoomExpiring: (remainingTime) => {
          setRoomExpiresIn(remainingTime);
        },
      });

      setIsInRoom(true);
      const info = room.getRoomInfo();
      setRoomInfo(info);

      // 如果加入的是已存在的加密房间，更新本地的加密算法设置
      if (info.isExistingEncryptedRoom && info.encryptionMethod) {
        setEncryptionMethod(info.encryptionMethod);
        console.log('[StickyNotesPage] Joined existing encrypted room, using algorithm:', info.encryptionMethod);
      }

      // 加载初始数据
      const initialNotes = await room.getAllNotes();
      setNotes(initialNotes);
      setUsers(room.getAllUsers());

      // 初始化 peerCount
      setPeerCount(1);
    } catch (error) {
      console.error('[StickyNotesPage] Failed to join room:', error);
      const errorMessage = error instanceof Error ? error.message : '加入房间失败';
      alert(errorMessage);
      // 清理失败的房间引用
      if (roomRef.current) {
        roomRef.current = null;
      }
    }
  };

  // 离开房间
  const handleLeaveRoom = async () => {
    if (roomRef.current) {
      await roomRef.current.leaveRoom();
      roomRef.current = null;
    }
    setIsInRoom(false);
    setNotes([]);
    setUsers([]);
    setRoomInfo(null);
  };

  // 销毁房间
  const handleDestroyRoom = async () => {
    if (!roomRef.current) return;

    if (!confirm('确定要销毁房间吗？\n\n销毁后：\n- 所有便签将被删除\n- 所有成员将被移除\n- 此操作不可撤销')) {
      return;
    }

    try {
      // 如果是加密房间，需要输入密码验证
      let verifyPassword: string | null = null;
      if (roomInfo?.isEncrypted) {
        verifyPassword = prompt('这是加密房间，请输入密码以验证身份：');
        if (verifyPassword === null) {
          // 用户取消
          return;
        }
      }

      await roomRef.current.destroyRoom(verifyPassword || undefined);
      setTimeout(() => {
        handleLeaveRoom();
      }, 500); // 延迟离开，确保销毁信号已发送
    } catch (error) {
      alert((error as Error).message || '销毁房间失败');
    }
  };

  // 添加便签
  const handleAddNote = async (color: string) => {
    if (!roomRef.current) return;

    const wall = wallRef.current;
    if (!wall) return;

    const rect = wall.getBoundingClientRect();

    // 随机位置
    const randomX = Math.floor(Math.random() * (rect.width - 250));
    const randomY = Math.floor(Math.random() * (rect.height - 200));

    await roomRef.current.addNote({
      content: '',
      color,
      position: { x: randomX, y: randomY },
      size: { width: 250, height: 200 },
    });

    setShowColorPicker(false);
  };

  // 更新便签
  const handleUpdateNote = async (noteId: string, updates: Partial<StickyNote>) => {
    if (!roomRef.current) return;
    await roomRef.current.updateNote(noteId, updates);
  };

  // 删除便签
  const handleDeleteNote = async (noteId: string) => {
    if (!roomRef.current) return;
    roomRef.current.deleteNote(noteId);
  };

  // 生成随机房间码
  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    setRoomId(id);
  };

  // 开始编辑昵称
  const handleStartEditName = () => {
    setTempUserName(roomInfo?.userName || '');
    setIsEditingName(true);
  };

  // 保存昵称
  const handleSaveName = () => {
    const newName = tempUserName.trim() || '匿名用户';
    if (roomRef.current) {
      roomRef.current.updateUserName(newName);
      setRoomInfo({ ...roomInfo, userName: newName });
    }
    setIsEditingName(false);
  };

  // 取消编辑昵称
  const handleCancelEditName = () => {
    setIsEditingName(false);
  };

  // 画布拖动处理（用于移动端查看屏幕外的便签）
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // 如果点击的是便签卡片，不触发画布拖动
    const target = e.target as HTMLElement;
    if (target.closest('.sticky-note-card')) {
      return;
    }

    setIsDraggingCanvas(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartOffset.current = { ...canvasOffset };

    // 防止文本选择
    e.preventDefault();
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
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
  };

  // 格式化剩余时间
  const formatRemainingTime = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return '即将过期';
    }
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

  // 清理
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.leaveRoom();
      }
    };
  }, []);

  if (!isInRoom) {
    // 房间加入页面
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 md:p-8">
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {/* Header - 移除标题，导航栏已有 */}

          <div className="space-y-4">
            {/* 昵称 */}
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
                onChange={(e) => setRoomId(e.target.value)}
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
                启用端到端加密
              </label>
            </div>

            {/* 密码和加密算法（加密时） */}
            {enableEncryption && (
              <>
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

                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="加密密码"
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
              {roomId ? '加入房间' : '创建房间'}
            </button>

            {/* 说明 */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">●</span>
                  <span>P2P 直连</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">●</span>
                  <span>实时协作</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">●</span>
                  <span>端到端加密</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">●</span>
                  <span>本地存储</span>
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

  // 便签墙页面
  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          {/* 移动端：垂直布局 */}
          <div className="flex flex-col sm:hidden gap-3">
            {/* 连接状态 */}
            <div className="flex items-center justify-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-600">
                {isConnected ? `已连接 (${peerCount} 人)` : '未连接'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-center">
              {/* 房间信息 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg flex-shrink-0">
                <span className="text-sm text-gray-600">房间:</span>
                <span className="text-sm font-mono font-medium text-gray-900">
                  {roomInfo?.roomId}
                </span>
                {roomInfo?.isEncrypted && (
                  <span
                    className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full"
                    title={`端到端加密已启用 (${roomInfo?.encryptionMethod || '未知算法'})`}
                  >
                    🔒 {roomInfo?.encryptionMethod || '加密'}
                  </span>
                )}
                <button
                  onClick={copyRoomId}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 touch-manipulation min-h-[28px]"
                >
                  复制
                </button>
              </div>

              {/* 用户信息 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg flex-shrink-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: roomInfo?.userColor }}
                />
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempUserName}
                      onChange={(e) => setTempUserName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') handleCancelEditName();
                      }}
                      className="text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[80px]"
                      placeholder="输入昵称"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 touch-manipulation min-h-[28px]"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleCancelEditName}
                      className="text-xs px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 touch-manipulation min-h-[28px]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-900 truncate max-w-[100px]">{roomInfo?.userName}</span>
                    <button
                      onClick={handleStartEditName}
                      className="text-sm text-blue-500 hover:text-blue-700 touch-manipulation min-w-[24px] min-h-[24px]"
                      title="编辑昵称"
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>

              {/* 在线用户 */}
              {users.length > 1 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {users
                    .filter(u => u.id !== roomInfo?.userId)
                    .slice(0, 3)
                    .map((user) => (
                      <div
                        key={user.id}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-medium flex-shrink-0"
                        style={{ backgroundColor: user.color }}
                        title={user.name}
                      >
                        {user.name.charAt(0)}
                      </div>
                    ))}
                  {users.length > 4 && (
                    <div className="text-xs text-gray-500 ml-1">
                      +{users.length - 4}
                    </div>
                  )}
                </div>
              )}

              {/* 添加便签按钮 */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(!showColorPicker);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm touch-manipulation min-h-[36px]"
                >
                  + 添加便签
                </button>

                {/* 颜色选择器 */}
                {showColorPicker && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 mt-2 p-3 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] min-w-[100px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-sm font-medium text-gray-700 mb-3 text-center">选择颜色</p>
                    <div className="grid grid-cols-2 gap-1 place-items-center mb-3">
                      {colors.map((color) => (
                        <button
                          key={color}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNote(color);
                          }}
                          className="w-5 h-5 rounded-xl border-2 border-gray-300 hover:border-gray-500 hover:scale-110 transition-all touch-manipulation shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                    {/* 自定义颜色 */}
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs text-gray-600 mb-2 text-center">自定义颜色</p>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={customColor}
                          onChange={(e) => setCustomColor(e.target.value)}
                          className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-300"
                          title="选择自定义颜色"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNote(customColor);
                          }}
                          className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors touch-manipulation"
                        >
                          使用此颜色
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 离开按钮 */}
              <button
                onClick={handleLeaveRoom}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm touch-manipulation min-h-[36px] flex-shrink-0"
              >
                离开房间
              </button>

              {/* 销毁房间按钮 */}
              <button
                onClick={handleDestroyRoom}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm touch-manipulation min-h-[36px] flex-shrink-0"
              >
                销毁房间
              </button>
            </div>
          </div>

          {/* 桌面端：居中布局 */}
          <div className="hidden sm:block">
            {/* 连接状态 */}
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-600">
                  {isConnected ? `已连接 (${peerCount} 人)` : '未连接'}
                </span>
              </div>
            </div>

            {/* 功能按钮（居中） */}
            <div className="flex flex-wrap items-center gap-3 justify-center">
              {/* 房间信息 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg flex-shrink-0">
                <span className="text-sm text-gray-600">房间:</span>
                <span className="text-sm font-mono font-medium text-gray-900">
                  {roomInfo?.roomId}
                </span>
                {roomInfo?.isEncrypted && (
                  <span
                    className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full"
                    title={`端到端加密已启用 (${roomInfo?.encryptionMethod || '未知算法'})`}
                  >
                    🔒 {roomInfo?.encryptionMethod || '加密'}
                  </span>
                )}
                <button
                  onClick={copyRoomId}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 touch-manipulation min-h-[28px]"
                >
                  复制
                </button>
              </div>

              {/* 用户信息 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg flex-shrink-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: roomInfo?.userColor }}
                />
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempUserName}
                      onChange={(e) => setTempUserName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') handleCancelEditName();
                      }}
                      className="text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[80px]"
                      placeholder="输入昵称"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 touch-manipulation min-h-[28px]"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleCancelEditName}
                      className="text-xs px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 touch-manipulation min-h-[28px]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-900 truncate max-w-[100px]">{roomInfo?.userName}</span>
                    <button
                      onClick={handleStartEditName}
                      className="text-sm text-blue-500 hover:text-blue-700 touch-manipulation min-w-[24px] min-h-[24px]"
                      title="编辑昵称"
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>

              {/* 在线用户 */}
              {users.length > 1 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {users
                    .filter(u => u.id !== roomInfo?.userId)
                    .slice(0, 3)
                    .map((user) => (
                      <div
                        key={user.id}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-medium flex-shrink-0"
                        style={{ backgroundColor: user.color }}
                        title={user.name}
                      >
                        {user.name.charAt(0)}
                      </div>
                    ))}
                  {users.length > 4 && (
                    <div className="text-xs text-gray-500 ml-1">
                      +{users.length - 4}
                    </div>
                  )}
                </div>
              )}

              {/* 添加便签按钮 */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(!showColorPicker);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm touch-manipulation min-h-[36px]"
                >
                  + 添加便签
                </button>

                {/* 颜色选择器 */}
                {showColorPicker && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 mt-2 p-3 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] min-w-[100px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-sm font-medium text-gray-700 mb-3 text-center">选择颜色</p>
                    <div className="grid grid-cols-2 gap-1 place-items-center mb-3">
                      {colors.map((color) => (
                        <button
                          key={color}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNote(color);
                          }}
                          className="w-5 h-5 rounded-xl border-2 border-gray-300 hover:border-gray-500 hover:scale-110 transition-all touch-manipulation shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                    {/* 自定义颜色 */}
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs text-gray-600 mb-2 text-center">自定义颜色</p>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={customColor}
                          onChange={(e) => setCustomColor(e.target.value)}
                          className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-300"
                          title="选择自定义颜色"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNote(customColor);
                          }}
                          className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors touch-manipulation"
                        >
                          使用此颜色
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 离开按钮 */}
              <button
                onClick={handleLeaveRoom}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm touch-manipulation min-h-[36px] flex-shrink-0"
              >
                离开房间
              </button>

              {/* 销毁房间按钮 */}
              <button
                onClick={handleDestroyRoom}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm touch-manipulation min-h-[36px] flex-shrink-0"
              >
                销毁房间
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 便签墙区域 */}
      <div
        ref={wallRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{
          cursor: isDraggingCanvas ? 'grabbing' : 'grab',
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
              <div className="text-center">
                <p className="text-gray-400 text-lg mb-2">还没有便签</p>
                <p className="text-gray-300 text-sm">点击右上角"添加便签"开始创建</p>
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

        {/* 缩放控制器 - 浮动在画布右下角 */}
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-3 flex items-center gap-3 z-10">
          <span className="text-sm text-gray-600 font-medium">缩放</span>
          <button
            onClick={() => setCanvasScale(Math.max(0.5, canvasScale - 0.1))}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors"
            title="缩小"
          >
            -
          </button>
          <input
            type="range"
            min="50"
            max="300"
            step="10"
            value={canvasScale * 100}
            onChange={(e) => setCanvasScale(parseInt(e.target.value) / 100)}
            className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((canvasScale - 0.5) / 2.5) * 100}%, #e5e7eb ${((canvasScale - 0.5) / 2.5) * 100}%, #e5e7eb 100%)`
            }}
          />
          <button
            onClick={() => setCanvasScale(Math.min(3, canvasScale + 0.1))}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors"
            title="放大"
          >
            +
          </button>
          <span className="text-sm text-gray-700 font-mono min-w-[3rem] text-center">
            {Math.round(canvasScale * 100)}%
          </span>
          <button
            onClick={() => setCanvasScale(1)}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
            title="重置缩放"
          >
            重置
          </button>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="bg-white border-t border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-1">
          <div className="truncate">
            房间: {roomInfo?.roomId}
            {roomExpiresIn !== null && (
              <span className="ml-2 text-orange-600">
                · ⏱️ {formatRemainingTime(roomExpiresIn)}后过期
              </span>
            )}
          </div>
          <div className="whitespace-nowrap">
            {notes.length} 个便签 · {users.length} 人在线
          </div>
        </div>
      </div>
    </div>
  );
}

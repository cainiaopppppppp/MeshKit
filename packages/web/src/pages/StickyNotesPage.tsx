/**
 * 便签墙主页面
 */

import { useState, useEffect, useRef } from 'react';
import { StickyNoteCard } from '../components/StickyNoteCard';
import { StickyNotesRoom } from '../services/StickyNotesRoom';
import type { StickyNote, UserInfo, RoomConfig } from '../types/stickyNote';

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

  const roomRef = useRef<StickyNotesRoom | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);

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

    // 保存用户名到 localStorage
    if (userName.trim()) {
      localStorage.setItem('sticky_notes_user_name', userName.trim());
    }

    const config: RoomConfig = {
      roomId: roomId.trim(),
      password: password.trim(),
      enableEncryption,
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
    });

    setIsInRoom(true);
    const info = room.getRoomInfo();
    setRoomInfo(info);

    // 加载初始数据
    const initialNotes = await room.getAllNotes();
    setNotes(initialNotes);
    setUsers(room.getAllUsers());

    // 初始化 peerCount
    setPeerCount(1);
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
  const handleDestroyRoom = () => {
    if (!roomRef.current) return;

    if (confirm('确定要销毁房间吗？\n\n销毁后：\n- 所有便签将被删除\n- 所有成员将被移除\n- 此操作不可撤销')) {
      roomRef.current.destroyRoom();
      setTimeout(() => {
        handleLeaveRoom();
      }, 500); // 延迟离开，确保销毁信号已发送
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
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">分布式便签墙</h1>
            <p className="text-gray-500 text-sm">无需服务器，实时协作</p>
          </div>

          <div className="space-y-4">
            {/* 昵称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                昵称
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="输入昵称（留空则随机生成）"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                留空将自动生成随机昵称，也可以输入"匿名"
              </p>
            </div>

            {/* 房间码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                房间码
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="输入或生成房间码"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={generateRoomId}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  生成
                </button>
              </div>
            </div>

            {/* 加密选项 - 暂时隐藏 */}
            {/* TODO: 待 crypto API 支持完善后启用 */}
            {false && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="encryption"
                    checked={enableEncryption}
                    onChange={(e) => setEnableEncryption(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="encryption" className="text-sm text-gray-700">
                    启用端到端加密
                  </label>
                </div>

                {/* 密码（加密时） */}
                {enableEncryption && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      加密密码
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="设置加密密码"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      所有成员需要使用相同的密码才能查看内容
                    </p>
                  </div>
                )}
              </>
            )}

            {/* 加入按钮 */}
            <button
              onClick={handleJoinRoom}
              className="w-full py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              {roomId ? '加入房间' : '创建房间'}
            </button>

            {/* 说明 */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">特性</h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>✅ 完全 P2P，局域网运行</li>
                <li>✅ 实时多人协作</li>
                <li>✅ 离线可用，在线自动同步</li>
                <li>✅ 数据本地存储</li>
                <li>✅ 支持拖拽、调整大小</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 便签墙页面
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto">
          {/* 移动端：垂直布局 */}
          <div className="flex flex-col sm:hidden gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">便签墙</h1>
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-600">
                  {isConnected ? `已连接 (${peerCount} 人)` : '未连接'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-center">
              {/* 房间信息 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg flex-shrink-0">
                <span className="text-sm text-gray-600">房间:</span>
                <span className="text-sm font-mono font-medium text-gray-900">
                  {roomInfo?.roomId}
                </span>
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
            {/* 标题和连接状态 */}
            <div className="flex items-center justify-center gap-4 mb-3">
              <h1 className="text-xl font-bold text-gray-900">便签墙</h1>
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
        className="flex-1 relative overflow-hidden"
        onClick={() => setShowColorPicker(false)}
      >
        {notes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
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
            />
          ))
        )}
      </div>

      {/* 底部提示 */}
      <div className="bg-white border-t border-gray-200 px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-1">
          <div className="truncate">
            房间: {roomInfo?.roomId}
          </div>
          <div className="whitespace-nowrap">
            {notes.length} 个便签 · {users.length} 人在线
          </div>
        </div>
      </div>
    </div>
  );
}

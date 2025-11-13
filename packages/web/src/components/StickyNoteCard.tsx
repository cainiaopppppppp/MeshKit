/**
 * 便签卡片组件 - 支持拖拽、编辑、调整大小
 */

import { useState, useRef, useEffect } from 'react';
import type { StickyNote } from '../types/stickyNote';

interface StickyNoteCardProps {
  note: StickyNote;
  onUpdate: (noteId: string, updates: Partial<StickyNote>) => void;
  onDelete: (noteId: string) => void;
  isReadOnly?: boolean;
  canvasScale?: number;
}

export function StickyNoteCard({ note, onUpdate, onDelete, isReadOnly = false, canvasScale = 1 }: StickyNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, mouseX: 0, mouseY: 0 });

  const cardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 同步外部 note.content 的变化到本地 state
  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

  // 自动聚焦编辑框
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // 点击外部区域自动保存编辑
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        handleSaveEdit();
      }
    };

    // 延迟添加监听器，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, content]);

  // 开始拖拽 - 鼠标事件
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isReadOnly || isEditing || isResizing) return;

    // 忽略在按钮、输入框等交互元素上的点击
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      return;
    }
    if (target.classList.contains('resize-handle')) {
      return;
    }

    setIsDragging(true);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // 开始拖拽 - 触摸事件
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isReadOnly || isEditing || isResizing) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      return;
    }
    if (target.classList.contains('resize-handle')) {
      return;
    }

    const touch = e.touches[0];
    setIsDragging(true);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      });
    }
  };

  // 开始调整大小 - 鼠标事件
  const handleResizeStart = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      width: note.size.width,
      height: note.size.height,
      mouseX: e.clientX,
      mouseY: e.clientY,
    });
  };

  // 开始调整大小 - 触摸事件
  const handleResizeTouchStart = (e: React.TouchEvent) => {
    if (isReadOnly) return;
    e.stopPropagation();
    const touch = e.touches[0];
    setIsResizing(true);
    setResizeStart({
      width: note.size.width,
      height: note.size.height,
      mouseX: touch.clientX,
      mouseY: touch.clientY,
    });
  };

  // 处理移动（拖拽和调整大小）- 支持鼠标和触摸
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (isDragging) {
        const container = cardRef.current?.parentElement;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();

        // 将屏幕坐标转换为逻辑坐标（考虑画布缩放）
        const screenX = clientX - containerRect.left - dragOffset.x;
        const screenY = clientY - containerRect.top - dragOffset.y;
        const newX = screenX / canvasScale;
        const newY = screenY / canvasScale;

        // 不限制边界，允许便签移动到画布的任何位置
        onUpdate(note.id, {
          position: {
            x: newX,
            y: newY,
          },
        });
      } else if (isResizing) {
        // 调整大小时也要考虑缩放
        const deltaX = (clientX - resizeStart.mouseX) / canvasScale;
        const deltaY = (clientY - resizeStart.mouseY) / canvasScale;

        const newWidth = Math.max(200, resizeStart.width + deltaX);
        const newHeight = Math.max(150, resizeStart.height + deltaY);

        onUpdate(note.id, {
          size: { width: newWidth, height: newHeight },
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, isResizing, dragOffset, resizeStart, note.id, note.size, onUpdate]);

  // 保存编辑
  const handleSaveEdit = () => {
    const trimmedContent = content.trim();
    // 总是更新，即使内容相同，确保触发同步
    onUpdate(note.id, { content: trimmedContent });
    setIsEditing(false);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setContent(note.content);
    setIsEditing(false);
  };

  // 删除便签
  const handleDelete = () => {
    if (confirm('确定要删除这个便签吗？')) {
      onDelete(note.id);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`sticky-note-card absolute shadow-lg rounded-lg overflow-hidden touch-none ${
        isDragging ? 'cursor-grabbing opacity-80 z-50' : 'cursor-grab'
      } ${isResizing ? 'select-none' : ''}`}
      style={{
        left: note.position.x,
        top: note.position.y,
        width: note.size.width,
        height: note.size.height,
        backgroundColor: note.color,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* 头部 */}
      <div className="px-3 py-2 bg-black bg-opacity-10 flex items-center justify-between">
        <div className="text-xs text-gray-700 font-medium truncate">
          {new Date(note.createdAt).toLocaleString()}
        </div>
        {!isReadOnly && (
          <div className="flex gap-1">
            {!isEditing && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // 复制便签内容
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(note.content).then(() => {
                        alert('便签内容已复制');
                      }).catch(() => {
                        alert(`内容：${note.content}`);
                      });
                    } else {
                      // 降级方案
                      const textarea = document.createElement('textarea');
                      textarea.value = note.content;
                      textarea.style.position = 'fixed';
                      textarea.style.opacity = '0';
                      document.body.appendChild(textarea);
                      textarea.select();
                      try {
                        document.execCommand('copy');
                        alert('便签内容已复制');
                      } catch (err) {
                        alert(`内容：${note.content}`);
                      } finally {
                        if (textarea.parentNode === document.body) {
                          document.body.removeChild(textarea);
                        }
                      }
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-white bg-opacity-50 hover:bg-opacity-80 rounded touch-manipulation min-h-[32px]"
                  title="复制内容"
                >
                  复制
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="px-3 py-1.5 text-xs bg-white bg-opacity-50 hover:bg-opacity-80 rounded touch-manipulation min-h-[32px]"
                >
                  编辑
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="px-3 py-1.5 text-xs bg-red-500 bg-opacity-50 hover:bg-opacity-80 text-white rounded touch-manipulation min-h-[32px]"
            >
              删除
            </button>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="p-3 overflow-hidden" style={{ height: 'calc(100% - 48px)' }}>
        {isEditing ? (
          <div className="h-full flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl/Cmd + Enter 保存
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveEdit();
                }
                // Esc 取消
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
              className="flex-1 w-full p-2 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-y-auto"
              placeholder="输入内容... (Ctrl+Enter 保存，Esc 取消)"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveEdit();
                }}
                className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 touch-manipulation min-h-[40px]"
              >
                保存
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
                className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 touch-manipulation min-h-[40px]"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-gray-800 h-full overflow-y-auto">
            {note.content || '空白便签'}
          </div>
        )}
      </div>

      {/* 调整大小手柄 */}
      {!isReadOnly && !isEditing && (
        <div
          className="resize-handle absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize touch-none"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeTouchStart}
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.2) 50%)',
          }}
        />
      )}
    </div>
  );
}

/**
 * 便签卡片组件 - 支持拖拽、编辑、缩放和移动端长按拖动
 */

import { useEffect, useRef, useState } from 'react';
import type { StickyNote } from '../types/stickyNote';

interface StickyNoteCardProps {
  note: StickyNote;
  onUpdate: (noteId: string, updates: Partial<StickyNote>) => void;
  onDelete: (noteId: string) => void;
  isReadOnly?: boolean;
  canvasScale?: number;
}

const TOUCH_DRAG_HOLD_MS = 180;
const TOUCH_DRAG_CANCEL_DISTANCE = 10;

export function StickyNoteCard({
  note,
  onUpdate,
  onDelete,
  isReadOnly = false,
  canvasScale = 1,
}: StickyNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, mouseX: 0, mouseY: 0 });
  const [isTouchHoldActive, setIsTouchHoldActive] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const touchDragTimerRef = useRef<number | null>(null);
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        handleSaveEdit();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, content]);

  useEffect(() => {
    return () => {
      clearTouchDragTimer();
    };
  }, []);

  const clearTouchDragTimer = () => {
    if (touchDragTimerRef.current !== null) {
      window.clearTimeout(touchDragTimerRef.current);
      touchDragTimerRef.current = null;
    }
    touchStartPointRef.current = null;
    setIsTouchHoldActive(false);
  };

  const isInteractiveTarget = (target: HTMLElement) => {
    return (
      target.tagName === 'BUTTON'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'INPUT'
      || target.closest('button')
      || target.closest('textarea')
      || target.closest('input')
      || target.classList.contains('resize-handle')
    );
  };

  const startDragging = (clientX: number, clientY: number) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
    setIsDragging(true);
    setIsTouchHoldActive(false);
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (isReadOnly || isEditing || isResizing) {
      return;
    }

    const target = event.target as HTMLElement;
    if (isInteractiveTarget(target)) {
      return;
    }

    startDragging(event.clientX, event.clientY);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (isReadOnly || isEditing || isResizing) {
      return;
    }

    const target = event.target as HTMLElement;
    if (isInteractiveTarget(target)) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    clearTouchDragTimer();
    touchStartPointRef.current = { x: touch.clientX, y: touch.clientY };
    setIsTouchHoldActive(true);

    touchDragTimerRef.current = window.setTimeout(() => {
      if (!touchStartPointRef.current) {
        return;
      }

      startDragging(touchStartPointRef.current.x, touchStartPointRef.current.y);
      touchStartPointRef.current = null;
      touchDragTimerRef.current = null;
    }, TOUCH_DRAG_HOLD_MS);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (!touchStartPointRef.current || isDragging) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - touchStartPointRef.current.x;
    const deltaY = touch.clientY - touchStartPointRef.current.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > TOUCH_DRAG_CANCEL_DISTANCE) {
      clearTouchDragTimer();
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) {
      clearTouchDragTimer();
    }
  };

  const handleResizeStart = (event: React.MouseEvent) => {
    if (isReadOnly) {
      return;
    }

    event.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      width: note.size.width,
      height: note.size.height,
      mouseX: event.clientX,
      mouseY: event.clientY,
    });
  };

  const handleResizeTouchStart = (event: React.TouchEvent) => {
    if (isReadOnly) {
      return;
    }

    event.stopPropagation();
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    clearTouchDragTimer();
    setIsResizing(true);
    setResizeStart({
      width: note.size.width,
      height: note.size.height,
      mouseX: touch.clientX,
      mouseY: touch.clientY,
    });
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (isDragging) {
        const container = cardRef.current?.parentElement;
        if (!container) {
          return;
        }

        const containerRect = container.getBoundingClientRect();
        const screenX = clientX - containerRect.left - dragOffset.x;
        const screenY = clientY - containerRect.top - dragOffset.y;

        onUpdate(note.id, {
          position: {
            x: screenX / canvasScale,
            y: screenY / canvasScale,
          },
        });
        return;
      }

      if (isResizing) {
        const deltaX = (clientX - resizeStart.mouseX) / canvasScale;
        const deltaY = (clientY - resizeStart.mouseY) / canvasScale;

        onUpdate(note.id, {
          size: {
            width: Math.max(220, resizeStart.width + deltaX),
            height: Math.max(160, resizeStart.height + deltaY),
          },
        });
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      handleMove(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      if (isDragging || isResizing) {
        event.preventDefault();
      }

      handleMove(touch.clientX, touch.clientY);
    };

    const handleEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
      clearTouchDragTimer();
    };

    if (!isDragging && !isResizing) {
      return;
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [canvasScale, dragOffset.x, dragOffset.y, isDragging, isResizing, note.id, onUpdate, resizeStart]);

  const handleSaveEdit = () => {
    onUpdate(note.id, { content: content.trim() });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setContent(note.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('确定要删除这张便签吗？')) {
      onDelete(note.id);
    }
  };

  const handleCopy = async () => {
    if (!note.content.trim()) {
      alert('这张便签还是空白的');
      return;
    }

    try {
      await navigator.clipboard.writeText(note.content);
      alert('便签内容已复制');
    } catch (error) {
      console.warn('[StickyNoteCard] Clipboard copy failed:', error);
      window.prompt('请手动复制以下内容', note.content);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`sticky-note-card absolute overflow-hidden rounded-[18px] border border-black/5 shadow-[0_18px_34px_rgba(15,23,42,0.16)] ${
        isDragging ? 'z-50 cursor-grabbing opacity-90' : 'cursor-grab'
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
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0.18))]" />
      <div className="relative flex h-full flex-col backdrop-blur-[0.5px]">
        <div className="flex items-center justify-between gap-2 border-b border-black/5 bg-white/35 px-3 py-2">
          <div className="truncate text-[11px] font-medium text-slate-700">
            {new Date(note.updatedAt || note.createdAt).toLocaleString()}
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-1.5">
              {!isEditing && (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleCopy();
                    }}
                    className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-white"
                    title="复制便签"
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-white"
                    title="编辑便签"
                  >
                    编辑
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDelete();
                }}
                className="rounded-full border border-rose-200 bg-rose-500/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-rose-600"
                title="删除便签"
              >
                删除
              </button>
            </div>
          )}
        </div>

        <div className="relative flex-1 px-3 py-3">
          {isEditing ? (
            <div className="flex h-full flex-col gap-2">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault();
                    handleSaveEdit();
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    handleCancelEdit();
                  }
                }}
                className="w-full flex-1 resize-none rounded-[14px] border border-white/80 bg-white/80 px-3 py-2 text-sm text-slate-700 outline-none ring-0 backdrop-blur focus:border-sky-300"
                placeholder="输入内容... (Ctrl/Cmd + Enter 保存)"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSaveEdit();
                  }}
                  className="flex-1 rounded-[12px] bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-[0_8px_18px_rgba(14,165,233,0.24)] transition hover:bg-sky-700"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCancelEdit();
                  }}
                  className="flex-1 rounded-[12px] border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto whitespace-pre-wrap break-words pr-2 text-sm leading-6 text-slate-800">
              {note.content || '空白便签'}
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-0 right-0 h-8 w-8 rounded-tl-[14px] bg-white/45 shadow-[-4px_-4px_10px_rgba(255,255,255,0.35)] [clip-path:polygon(100%_0,0_100%,100%_100%)]" />

        {!isReadOnly && !isEditing && (
          <div
            className="resize-handle absolute bottom-1 right-1 h-8 w-8 cursor-nwse-resize rounded-full border border-white/60 bg-white/45 shadow-sm backdrop-blur"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeTouchStart}
            title="拖动调整大小"
          >
            <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-3 w-3 rounded-sm border-r-2 border-b-2 border-slate-400" />
          </div>
        )}

        {isTouchHoldActive && !isDragging && !isEditing && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-full bg-slate-900/70 px-3 py-1 text-center text-[11px] text-white shadow-lg">
            长按后拖动便签
          </div>
        )}
      </div>
    </div>
  );
}

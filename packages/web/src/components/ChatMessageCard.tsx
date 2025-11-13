/**
 * 聊天消息卡片组件 - 简洁设计
 */

import { useState, useEffect } from 'react';
import { ChatMessage } from '../types/chat';

interface ChatMessageCardProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  onDelete?: (messageId: string) => void;
}

export function ChatMessageCard({ message, isOwnMessage, onDelete }: ChatMessageCardProps) {
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);

  // 计算阅后即焚剩余时间
  useEffect(() => {
    if (!message.selfDestruct) return;

    const updateRemainingTime = () => {
      const elapsed = Date.now() - message.timestamp;
      const remaining = message.selfDestruct! - elapsed;

      if (remaining <= 0) {
        setIsDeleted(true);
        if (onDelete) {
          onDelete(message.id);
        }
      } else {
        setRemainingTime(remaining);
      }
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(interval);
  }, [message, onDelete]);

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化剩余时间
  const formatRemainingTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  // 如果消息已被删除
  if (isDeleted) {
    return null;
  }

  return (
    <div className="mb-3">
      {/* 用户名和时间 */}
      {!isOwnMessage && (
        <div className="flex items-center gap-2 mb-1 ml-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: message.color || '#999' }}
          />
          <span className="text-xs font-medium text-gray-700">
            {message.userName}
          </span>
          <span className="text-xs text-gray-400">
            {formatTime(message.timestamp)}
          </span>
          {message.selfDestruct && remainingTime !== null && (
            <span className="text-xs text-orange-500 flex items-center gap-1">
              🔥 {formatRemainingTime(remainingTime)}
            </span>
          )}
        </div>
      )}

      {/* 消息内容 */}
      <div
        className={`inline-block px-4 py-2 rounded-2xl max-w-[70%] ${
          isOwnMessage
            ? 'bg-blue-500 text-white ml-auto float-right clear-both'
            : 'bg-white text-gray-900 border border-gray-200'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {/* 自己的消息显示时间 */}
        {isOwnMessage && (
          <div className="flex items-center justify-end gap-2 mt-1">
            <span className="text-xs opacity-70">
              {formatTime(message.timestamp)}
            </span>
            {message.selfDestruct && remainingTime !== null && (
              <span className="text-xs opacity-70">
                🔥 {formatRemainingTime(remainingTime)}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="clear-both" />
    </div>
  );
}

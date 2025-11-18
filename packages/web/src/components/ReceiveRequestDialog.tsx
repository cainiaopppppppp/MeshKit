/**
 * 接收文件请求对话框
 * 简单的接受/拒绝对话框，不包含密码输入
 */

import { useState } from 'react';

interface ReceiveRequestDialogProps {
  senderName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  passwordProtected: boolean;
  encrypted?: boolean;
  encryptionMethod?: string;
  onAccept: () => void;
  onReject: () => void;
  onRejectAndBlock?: (durationMs: number) => void; // 拒绝并屏蔽
}

export function ReceiveRequestDialog({
  senderName,
  fileName,
  fileSize,
  fileType,
  passwordProtected,
  encrypted,
  encryptionMethod,
  onAccept,
  onReject,
  onRejectAndBlock,
}: ReceiveRequestDialogProps) {
  const [showRejectOptions, setShowRejectOptions] = useState(false);
  const formatFileSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📎';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">收到文件传输请求</h2>
          <div className="flex gap-2">
            {passwordProtected && (
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                🔒 需要密码
              </span>
            )}
            {encrypted && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                🔐 已加密
              </span>
            )}
          </div>
        </div>

        {/* 发送者信息 */}
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">👤</span>
            <div>
              <div className="text-sm text-gray-600">来自</div>
              <div className="font-semibold text-gray-900">{senderName}</div>
            </div>
          </div>
        </div>

        {/* 文件信息 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{getFileIcon(fileType)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate" title={fileName}>
                {fileName}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                大小: {formatFileSize(fileSize)}
              </div>
              {encrypted && encryptionMethod && (
                <div className="text-xs text-blue-600 mt-1">
                  加密算法: {encryptionMethod}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        {passwordProtected && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 mt-0.5">⚠️</span>
              <div className="text-sm text-yellow-800">
                此文件受密码保护，接受后需要输入密码才能接收。
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <button
              onClick={onReject}
              className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all border border-gray-300"
            >
              仅拒绝此次
            </button>

            {/* 更多拒绝选项 */}
            {onRejectAndBlock && (
              <>
                <button
                  onClick={() => setShowRejectOptions(!showRejectOptions)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-all"
                  title="更多选项"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showRejectOptions && (
                  <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        onRejectAndBlock(10 * 60 * 1000); // 10分钟
                        setShowRejectOptions(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg transition-all flex items-center gap-2"
                    >
                      <span>🚫</span>
                      <div>
                        <div className="font-medium">屏蔽此设备 10 分钟</div>
                        <div className="text-xs text-gray-500">10分钟内自动拒绝该设备的所有请求</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        onRejectAndBlock(60 * 60 * 1000); // 1小时
                        setShowRejectOptions(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg transition-all flex items-center gap-2"
                    >
                      <span>⛔</span>
                      <div>
                        <div className="font-medium">屏蔽此设备 1 小时</div>
                        <div className="text-xs text-gray-500">1小时内自动拒绝该设备的所有请求</div>
                      </div>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={onAccept}
            className="flex-1 py-3 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all shadow-sm"
          >
            接受
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

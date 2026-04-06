/**
 * 接收文件确认对话框
 * 用于接收方确认是否接收文件，如果有密码保护或加密则需要输入密码
 */

import { useState } from 'react';
import { FileTypeIcon, LockIcon, ShieldLockIcon } from './FileTransferIcons';

interface ReceiveConfirmDialogProps {
  senderName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  passwordProtected: boolean;
  encrypted?: boolean;
  encryptionMethod?: string;
  onAccept: (password?: string) => void;
  onReject: () => void;
}

export function ReceiveConfirmDialog({
  senderName,
  fileName,
  fileSize,
  fileType,
  passwordProtected,
  encrypted,
  encryptionMethod,
  onAccept,
  onReject,
}: ReceiveConfirmDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const formatFileSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  const handleAccept = () => {
    if (passwordProtected || encrypted) {
      if (!password) {
        setError('请输入密码');
        return;
      }
      onAccept(password);
    } else {
      onAccept();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAccept();
    } else if (e.key === 'Escape') {
      onReject();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">接收文件确认</h2>
          <div className="flex gap-2">
            {passwordProtected && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
                <LockIcon className="h-3.5 w-3.5" />
                <span>需要密码</span>
              </span>
            )}
            {encrypted && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                <ShieldLockIcon className="h-3.5 w-3.5" />
                <span>已加密</span>
              </span>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 shadow-sm">
              <FileTypeIcon type={fileType} className="h-6 w-6" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-500 mb-1">来自</p>
              <p className="font-medium text-gray-900 mb-3">{senderName}</p>

              <p className="text-sm font-medium text-gray-500 mb-1">文件名</p>
              <p className="font-medium text-gray-900 break-all mb-3">{fileName}</p>

              <p className="text-sm font-medium text-gray-500 mb-1">大小</p>
              <p className="font-medium text-gray-900">{formatFileSize(fileSize)}</p>

              {encrypted && (
                <>
                  <p className="text-sm font-medium text-gray-500 mb-1 mt-3">加密算法</p>
                  <p className="font-medium text-gray-900">{encryptionMethod || 'AES-256-CBC'}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {(passwordProtected || encrypted) && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {encrypted ? '请输入解密密码' : '请输入接收密码'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入密码"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onReject}
            className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-all"
          >
            拒绝
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all"
          >
            接受
          </button>
        </div>
      </div>
    </div>
  );
}

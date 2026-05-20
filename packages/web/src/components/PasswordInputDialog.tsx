/**
 * 密码输入对话框
 * 用于接收方输入密码以解密文件
 */

import { useState } from 'react';
import { InfoIcon, LockIcon, PaperclipIcon } from './FileTransferIcons';

interface PasswordInputDialogProps {
  fileName: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}

export function PasswordInputDialog({
  fileName,
  onConfirm,
  onCancel,
}: PasswordInputDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }
    onConfirm(password);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">输入密码</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
            <LockIcon className="h-3.5 w-3.5" />
            <span>需要密码</span>
          </span>
        </div>

        {/* 文件信息 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm">
              <PaperclipIcon className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-600">文件名</div>
              <div className="font-medium text-gray-900 truncate" title={fileName}>
                {fileName}
              </div>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="text-sm text-blue-800">
              此文件受密码保护，请向发送方索取密码后输入。
            </div>
          </div>
        </div>

        {/* 密码输入 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            密码
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="请输入密码"
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all border border-gray-300"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all shadow-sm"
          >
            确认
          </button>
        </div>

        {/* 键盘提示 */}
        <div className="mt-4 text-center text-xs text-gray-500">
          按 Enter 确认 · 按 Esc 取消
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

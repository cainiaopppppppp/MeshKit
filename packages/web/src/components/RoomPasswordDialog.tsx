/**
 * 房间密码对话框
 * 用于创建房间时设置密码保护
 */

import { useState } from 'react';
import { LockIcon } from './FileTransferIcons';

interface RoomPasswordDialogProps {
  onConfirm: (password: string | null) => void;
  onCancel: () => void;
}

export function RoomPasswordDialog({ onConfirm, onCancel }: RoomPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (usePassword) {
      if (!password) {
        setError('请输入密码');
        return;
      }

      if (password.length < 4) {
        setError('密码至少4个字符');
        return;
      }

      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }

      onConfirm(password);
    } else {
      onConfirm(null);
    }
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
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">生成取件码</h2>

        <div className="mb-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={usePassword}
              onChange={(e) => {
                setUsePassword(e.target.checked);
                setError('');
                if (!e.target.checked) {
                  setPassword('');
                  setConfirmPassword('');
                }
              }}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600">
                <LockIcon className="h-4 w-4" />
              </span>
              <span>设置接收密码</span>
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            启用后，接收方需要输入正确密码才能接收文件
          </p>
        </div>

        {usePassword && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码
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
                placeholder="请输入密码（至少4个字符）"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请再次输入密码"
              />
            </div>
          </>
        )}

        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 设备名编辑对话框
 */

import { useState } from 'react';

interface DeviceNameEditorProps {
  currentName: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
}

export function DeviceNameEditor({ currentName, onSave, onCancel }: DeviceNameEditorProps) {
  const [newName, setNewName] = useState(currentName);
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = newName.trim();

    if (!trimmed) {
      setError('设备名称不能为空');
      return;
    }

    if (trimmed.length > 20) {
      setError('设备名称不能超过20个字符');
      return;
    }

    onSave(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">编辑设备名</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            设备名称
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="请输入设备名称"
            autoFocus
            maxLength={20}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {newName.length}/20 字符
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

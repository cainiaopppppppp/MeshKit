/**
 * FileSelector - 文件选择组件
 * 接收方用于选择要接收的文件
 */
import { useState } from 'react';
import type { FileMetadata } from '@meshkit/core';
import { FileTypeIcon, InfoIcon, TransferInboxIcon, WarningIcon } from './FileTransferIcons';

interface FileSelectorProps {
  files: FileMetadata[];
  totalSize: number;
  onConfirm: (selectedIndexes: number[]) => void;
  onCancel?: () => void;
}

export function FileSelector({ files, totalSize, onConfirm, onCancel }: FileSelectorProps) {
  // 默认全选
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    new Set(files.map((_, index) => index))
  );

  const toggleFile = (index: number) => {
    const newSelection = new Set(selectedIndexes);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndexes(newSelection);
  };

  const toggleAll = () => {
    if (selectedIndexes.size === files.length) {
      // 全部取消选中
      setSelectedIndexes(new Set());
    } else {
      // 全部选中
      setSelectedIndexes(new Set(files.map((_, index) => index)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIndexes));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const selectedSize = files
    .filter((_, index) => selectedIndexes.has(index))
    .reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="file-selector">
      <div className="mb-4 text-center">
        <div className="mb-3 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
            <TransferInboxIcon className="h-6 w-6" />
          </span>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">接收文件</h2>
        <p className="text-gray-600">请选择要接收的文件</p>
      </div>

      {/* 统计信息 */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-700">
            已选择 <strong>{selectedIndexes.size}</strong> / {files.length} 个文件
          </span>
          <button
            onClick={toggleAll}
            className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
          >
            {selectedIndexes.size === files.length ? '取消全选' : '全选'}
          </button>
        </div>
        <div className="text-sm text-gray-600">
          总大小: <strong>{formatFileSize(selectedSize)}</strong> / {formatFileSize(totalSize)}
        </div>
      </div>

      {/* 文件列表 */}
      <div className="file-list max-h-96 overflow-y-auto mb-4 space-y-2">
        {files.map((file, index) => (
          <div
            key={index}
            onClick={() => toggleFile(index)}
            className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
              selectedIndexes.has(index)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            {/* 复选框 */}
            <input
              type="checkbox"
              checked={selectedIndexes.has(index)}
              onChange={() => toggleFile(index)}
              className="w-5 h-5 text-blue-600 cursor-pointer"
            />

            {/* 文件图标 */}
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm">
              <FileTypeIcon type={file.type} className="h-6 w-6" />
            </div>

            {/* 文件信息 */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-800 truncate">
                {file.name}
              </div>
              <div className="text-sm text-gray-600">
                {formatFileSize(file.size)}
                {file.type && (
                  <span className="ml-2 text-gray-500">· {file.type.split('/')[0]}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 提示信息 */}
      {selectedIndexes.size === 0 && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <p className="flex items-center gap-2 text-sm text-yellow-800">
            <WarningIcon className="h-4 w-4 shrink-0" />
            <span>请至少选择一个文件</span>
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-all"
          >
            取消
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={selectedIndexes.size === 0}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
        >
          {`确认接收${selectedIndexes.size > 0 ? ` (${selectedIndexes.size} 个文件)` : ''}`}
        </button>
      </div>

      {/* 提示 */}
      <div className="mt-4 rounded-lg bg-gray-50 p-3">
        <p className="flex items-center gap-2 text-xs text-gray-600">
          <InfoIcon className="h-4 w-4 shrink-0 text-gray-500" />
          <span>
            <strong>提示:</strong> 文件将依次传输，完成后自动下载
          </span>
        </p>
      </div>
    </div>
  );
}

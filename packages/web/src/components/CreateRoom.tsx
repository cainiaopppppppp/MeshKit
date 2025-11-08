/**
 * CreateRoom - 创建房间界面（支持多文件）
 */
import { useState, useRef } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useAppStore } from '../store';
import { fileTransferManager } from '@meshkit/core';
import { FileQueue } from './FileQueue';

export function CreateRoom() {
  const { createRoom, isCreating, error } = useRoom();
  const { fileQueue, isQueueMode } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 先清空之前的选择
    fileTransferManager.fullReset();
    setSelectedFile(null);

    if (files.length === 1) {
      // 单文件模式
      setSelectedFile(files[0]);
    } else {
      // 多文件模式
      const filesArray = Array.from(files);
      await fileTransferManager.selectFiles(filesArray);
    }
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);

    if (isQueueMode || fileQueue.length > 0) {
      // 已有队列，继续添加
      await fileTransferManager.appendFiles(filesArray);
    } else if (selectedFile) {
      // 已有单文件，转换为队列模式
      await fileTransferManager.selectFiles([selectedFile, ...filesArray]);
      setSelectedFile(null);
    } else {
      // 没有文件，新建队列
      if (filesArray.length === 1) {
        setSelectedFile(filesArray[0]);
      } else {
        await fileTransferManager.selectFiles(filesArray);
      }
    }

    // 清空input
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // 先清空之前的选择
    fileTransferManager.fullReset();
    setSelectedFile(null);

    const filesArray = Array.from(files);
    if (filesArray.length === 1) {
      setSelectedFile(filesArray[0]);
    } else {
      await fileTransferManager.selectFiles(filesArray);
    }
  };

  const handleRemoveFile = (index: number) => {
    fileTransferManager.removeFileFromQueue(index);
  };

  const handleClearAll = () => {
    fileTransferManager.clearFileQueue();
    setSelectedFile(null);
  };

  const handleCreateRoom = async () => {
    if (isQueueMode) {
      // 多文件模式：使用第一个文件创建房间（房间创建后会传输整个队列）
      const firstFile = fileQueue.find(item => item.selected)?.file;
      if (!firstFile) {
        alert('请先选择文件');
        return;
      }
      await createRoom(firstFile);
    } else {
      // 单文件模式
      if (!selectedFile) {
        alert('请先选择文件');
        return;
      }
      await createRoom(selectedFile);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  return (
    <div className="create-room">
      <h3 className="section-title">📤 创建传输房间</h3>

      {/* 拖拽选择文件区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-3 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4 ${
          dragOver
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 hover:border-primary-500 hover:bg-gray-50'
        }`}
      >
        <div className="text-6xl mb-2">📁</div>
        <p className="text-lg font-semibold">
          {selectedFile || isQueueMode ? '更换文件' : '选择文件'}
        </p>
        <p className="text-sm text-gray-500 mt-1">点击或拖拽文件到此处</p>
        <p className="text-xs text-gray-400 mt-1">💡 支持多文件选择</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="room-file-input"
        />
      </div>

      {/* 单文件信息 */}
      {!isQueueMode && selectedFile && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
          <p className="font-semibold">📄 已选择文件</p>
          <p className="text-sm">文件名: {selectedFile.name}</p>
          <p className="text-sm">大小: {formatFileSize(selectedFile.size)}</p>
        </div>
      )}

      {/* 多文件队列 */}
      {isQueueMode && fileQueue.length > 0 && (
        <div className="mb-4">
          <FileQueue queue={fileQueue} isSender={true} onRemove={handleRemoveFile} />
        </div>
      )}

      {/* 文件操作按钮 */}
      {(selectedFile || isQueueMode) && (
        <div className="flex gap-2 mb-4">
          {/* 添加文件按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById('room-add-files-input')?.click();
            }}
            className="flex-1 py-3 px-4 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-all"
          >
            ➕ 添加文件
          </button>
          <input
            type="file"
            multiple
            onChange={handleAddFiles}
            className="hidden"
            id="room-add-files-input"
          />

          {/* 清空全部按钮 */}
          <button
            onClick={handleClearAll}
            className="flex-1 py-3 px-4 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200 transition-all"
          >
            🗑️ 清空全部
          </button>
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <button
        className="create-room-button"
        onClick={handleCreateRoom}
        disabled={(!selectedFile && !isQueueMode) || isCreating}
      >
        {isCreating ? '创建中...' : isQueueMode ? `创建房间（${fileQueue.length}个文件）` : '创建房间'}
      </button>

      <div className="info-text">
        <p>💡 创建房间后，其他用户可以通过房间号加入并接收文件</p>
        {isQueueMode && <p>📦 房间将依次广播所有文件</p>}
        <p>⚠️ 作为房主，您需要保持在线直到所有成员接收完成</p>
      </div>
    </div>
  );
}

/**
 * CreateRoom - 创建房间界面（支持多文件）
 */
import { useState, useRef } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useAppStore } from '../store';
import { fileTransferManager } from '@meshkit/core';
import { FileQueue } from './FileQueue';

export function CreateRoom() {
  const { createRoom, isCreating, error, updateRoomFiles, currentRoom } = useRoom();
  const { fileQueue, isQueueMode } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 密码保护
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');

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
      // 多文件模式 - Room模式跳过验证，避免大文件阻塞
      const filesArray = Array.from(files);
      await fileTransferManager.selectFiles(filesArray, true); // skipValidation=true
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
      // 已有单文件，转换为队列模式 - Room模式跳过验证
      await fileTransferManager.selectFiles([selectedFile, ...filesArray], true);
      setSelectedFile(null);
    } else {
      // 没有文件，新建队列
      if (filesArray.length === 1) {
        setSelectedFile(filesArray[0]);
      } else {
        // Room模式跳过验证
        await fileTransferManager.selectFiles(filesArray, true);
      }
    }

    // 如果已经在房间中，通知房间成员文件列表已更新
    if (currentRoom) {
      // 获取当前的文件队列并转换为元数据列表（包含索引）
      const currentQueue = fileTransferManager.getFileQueue();
      if (currentQueue && currentQueue.length > 0) {
        const updatedFileList = currentQueue.map(item => ({
          ...item.metadata,
          index: item.index, // 保留文件在队列中的索引
        }));
        console.log('[CreateRoom] Notifying room members of file list update:', updatedFileList.length, 'files');
        updateRoomFiles(updatedFileList);
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
      // Room模式跳过验证，避免大文件阻塞
      await fileTransferManager.selectFiles(filesArray, true);
    }
  };

  const handleRemoveFile = (index: number) => {
    fileTransferManager.removeFileFromQueue(index);

    // 如果已经在房间中，通知房间成员文件列表已更新
    if (currentRoom) {
      const currentQueue = fileTransferManager.getFileQueue();
      const updatedFileList = currentQueue.map(item => ({
        ...item.metadata,
        index: item.index, // 保留文件在队列中的索引
      }));
      console.log('[CreateRoom] Notifying room members after file removal:', updatedFileList.length, 'files');
      updateRoomFiles(updatedFileList);
    }
  };

  const handleClearAll = () => {
    fileTransferManager.clearFileQueue();
    setSelectedFile(null);
  };

  const handleCreateRoom = async () => {
    // 验证密码
    if (enablePassword && !password.trim()) {
      alert('请输入密码');
      return;
    }

    if (isQueueMode) {
      // 多文件模式：使用第一个文件创建房间（房间创建后会传输整个队列）
      const firstFile = fileQueue.find(item => item.selected)?.file;
      if (!firstFile) {
        alert('请先选择文件');
        return;
      }
      await createRoom(firstFile, enablePassword ? password : undefined);
    } else {
      // 单文件模式
      if (!selectedFile) {
        alert('请先选择文件');
        return;
      }
      await createRoom(selectedFile, enablePassword ? password : undefined);
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
      {/* 文件选择区域 - 仅在没有文件时显示 */}
      {!selectedFile && !isQueueMode && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all mb-4 ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <p className="text-lg font-medium text-gray-700 mb-1">选择文件</p>
          <p className="text-sm text-gray-500">点击或拖拽文件到此处</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="room-file-input"
          />
        </div>
      )}

      {/* 单文件信息 */}
      {!isQueueMode && selectedFile && (
        <div className="bg-gray-50 border border-gray-200 p-4 mb-4 rounded-lg">
          <p className="font-medium text-gray-900 mb-1">{selectedFile.name}</p>
          <p className="text-sm text-gray-600">{formatFileSize(selectedFile.size)}</p>
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
          {/* 更换文件按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all border border-gray-300"
          >
            更换文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="room-file-input"
          />

          {/* 继续添加按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById('room-add-files-input')?.click();
            }}
            className="flex-1 py-2 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all"
          >
            添加文件
          </button>
          <input
            type="file"
            multiple
            onChange={handleAddFiles}
            className="hidden"
            id="room-add-files-input"
          />

          {/* 清空按钮 */}
          <button
            onClick={handleClearAll}
            className="flex-1 py-2 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all"
          >
            清空
          </button>
        </div>
      )}

      {/* 密码保护（仅在有文件时显示） */}
      {(selectedFile || isQueueMode) && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="enable-password"
              checked={enablePassword}
              onChange={(e) => setEnablePassword(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="enable-password" className="text-sm text-gray-700 font-medium cursor-pointer">
              🔒 设置接收密码
            </label>
          </div>

          {enablePassword && (
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入接收密码"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <p className="text-xs text-gray-500 mt-2">
                接收方需要输入此密码才能接收文件
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <button
        className="w-full py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        onClick={handleCreateRoom}
        disabled={(!selectedFile && !isQueueMode) || isCreating || (enablePassword && !password.trim())}
      >
        {isCreating ? '生成中...' : '生成取件码'}
      </button>
    </div>
  );
}

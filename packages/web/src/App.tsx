import { useState, useEffect } from 'react';
import { useP2P } from './hooks/useP2P';
import { useAppStore } from './store';
import { deviceManager, fileTransferManager, eventBus } from '@meshkit/core';
import { fileStorage } from './utils/FileStorage';
import { RoomModeSelector } from './components/RoomModeSelector';
import { RoomContainer } from './components/RoomContainer';
import { FileSelector } from './components/FileSelector';
import { FileQueue } from './components/FileQueue';

function App() {
  useP2P();

  const {
    isConnected,
    myDeviceName,
    devices,
    selectedDeviceId,
    currentFile,
    isTransferring,
    transferProgress,
    hasDownload,
    downloadFilename,
    isStreamingDownload,
    mode,
    transferMode,
    fileQueue,
    isQueueMode,
    queueDirection,
    setMode,
    selectDevice,
    setCurrentFile,
  } = useAppStore();

  const [dragOver, setDragOver] = useState(false);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [pendingFileList, setPendingFileList] = useState<{ files: any[]; totalSize: number } | null>(null);

  // 处理文件选择（支持单文件和多文件）
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 先清空之前的选择
    fileTransferManager.fullReset();
    setCurrentFile(null);

    if (files.length === 1) {
      // 单文件模式
      const file = files[0];
      console.log('[App] Single file selected:', file.name, file.size);
      const success = await fileTransferManager.selectFile(file);
      if (success) {
        setCurrentFile({
          name: file.name,
          size: file.size,
          type: file.type,
        });
      } else {
        console.error('[App] File validation failed');
        e.target.value = '';
      }
    } else {
      // 多文件模式
      console.log('[App] Multiple files selected:', files.length);
      const filesArray = Array.from(files);
      const success = await fileTransferManager.selectFiles(filesArray);
      if (!success) {
        console.error('[App] Files validation failed');
        e.target.value = '';
      }
    }
  };

  // 处理拖拽
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
    setCurrentFile(null);

    if (files.length === 1) {
      // 单文件模式
      const file = files[0];
      console.log('[App] Single file dropped:', file.name, file.size);
      const success = await fileTransferManager.selectFile(file);
      if (success) {
        setCurrentFile({
          name: file.name,
          size: file.size,
          type: file.type,
        });
      } else {
        console.error('[App] File validation failed');
      }
    } else {
      // 多文件模式
      console.log('[App] Multiple files dropped:', files.length);
      const filesArray = Array.from(files);
      await fileTransferManager.selectFiles(filesArray);
    }
  };

  // 移除队列中的文件
  const handleRemoveFile = (index: number) => {
    fileTransferManager.removeFileFromQueue(index);
  };

  // 添加更多文件
  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);

    if (isQueueMode || fileQueue.length > 0) {
      // 已有队列，继续添加
      await fileTransferManager.appendFiles(filesArray);
    } else if (currentFile) {
      // 已有单文件，转换为队列模式
      const currentFileObj = fileTransferManager.getCurrentFile();
      if (currentFileObj) {
        await fileTransferManager.selectFiles([currentFileObj, ...filesArray]);
        setCurrentFile(null);
      }
    } else {
      // 没有文件，新建选择
      if (filesArray.length === 1) {
        const file = filesArray[0];
        const success = await fileTransferManager.selectFile(file);
        if (success) {
          setCurrentFile({
            name: file.name,
            size: file.size,
            type: file.type,
          });
        }
      } else {
        await fileTransferManager.selectFiles(filesArray);
      }
    }

    // 清空input
    e.target.value = '';
  };

  // 清空所有文件
  const handleClearAll = () => {
    fileTransferManager.clearFileQueue();
    setCurrentFile(null);
  };

  // 发送文件（支持单文件和多文件）
  const handleSendFile = async () => {
    if (!selectedDeviceId) return;

    // 检查连接状态
    if (!isConnected) {
      alert('⚠️ 未连接到信令服务器\n\n请检查：\n1. 信令服务器是否正常运行\n2. 网络连接是否正常\n3. 刷新页面重试');
      return;
    }

    try {
      if (isQueueMode) {
        // 多文件模式：发送文件列表
        const success = await fileTransferManager.sendFileList(selectedDeviceId);
        if (!success) {
          alert('❌ 发送失败\n\n可能原因：\n1. 信令服务器连接断开\n2. 目标设备离线\n3. 网络连接问题\n\n建议：刷新页面重试');
        }
      } else {
        // 单文件模式
        await fileTransferManager.sendFile(selectedDeviceId);
      }
    } catch (error) {
      console.error('[App] Send file error:', error);
      alert('❌ 发送失败：' + (error as Error).message);
    }
  };

  // 处理接收到的文件列表
  const handleFileListReceived = (files: any[], totalSize: number) => {
    setPendingFileList({ files, totalSize });
    setShowFileSelector(true);
  };

  // 确认接收文件选择
  const handleFileSelectionConfirm = async (selectedIndexes: number[]) => {
    setShowFileSelector(false);
    await fileTransferManager.sendFileSelection(selectedIndexes);
    setPendingFileList(null);
  };

  // 取消文件选择
  const handleFileSelectionCancel = () => {
    setShowFileSelector(false);
    setPendingFileList(null);
    fileTransferManager.fullReset();
  };

  // 下载文件
  const handleDownload = async () => {
    // 先尝试从内存中下载（刚接收完的文件）
    const downloadInfo = fileTransferManager.getDownloadInfo();
    if (downloadInfo) {
      fileTransferManager.downloadFile();
      return;
    }

    // 如果内存中没有，从 IndexedDB 加载
    try {
      const lastFileId = localStorage.getItem('meshkit_last_file_id');
      if (!lastFileId) {
        console.error('[App] No file to download');
        alert('没有可下载的文件');
        return;
      }

      const storedFile = await fileStorage.getFile(lastFileId);
      if (!storedFile) {
        console.error('[App] File not found in storage');
        alert('文件未找到，可能已被清理');
        return;
      }

      // 创建下载链接
      const url = URL.createObjectURL(storedFile.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = storedFile.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[App] File downloaded from IndexedDB:', storedFile.filename);
    } catch (error) {
      console.error('[App] Failed to download file:', error);
      alert('下载失败：' + (error as Error).message);
    }
  };

  // 下载特定文件（用于多文件队列）
  const handleDownloadFile = async (filename: string) => {
    try {
      // 尝试从 IndexedDB 获取文件
      const files = await fileStorage.getAllFiles();
      const file = files.find(f => f.filename === filename);

      if (!file) {
        alert(`文件 ${filename} 未找到`);
        return;
      }

      // 创建下载链接
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[App] File downloaded:', filename);
    } catch (error) {
      console.error('[App] Failed to download file:', error);
      alert('下载失败：' + (error as Error).message);
    }
  };

  // 选择设备
  const handleSelectDevice = (deviceId: string) => {
    deviceManager.selectDevice(deviceId);
    selectDevice(deviceId);
  };

  const formatFileSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  // 监听文件列表接收事件
  useEffect(() => {
    const handleFileListEvent = ({ files, totalSize }: any) => {
      handleFileListReceived(files, totalSize);
    };

    eventBus.on('transfer:file-list-received', handleFileListEvent);

    return () => {
      eventBus.off('transfer:file-list-received', handleFileListEvent);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6 md:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">MeshDrop</h1>
          <p className="text-gray-500 text-sm">文件快传</p>
        </div>

        {/* 连接状态 */}
        <div className={`text-center py-2 rounded-lg mb-6 text-sm ${
          isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isConnected ? (
            <span className="font-medium">已连接</span>
          ) : (
            <span className="font-medium">未连接 - 正在重连...</span>
          )}
        </div>

        {/* 设备名称 */}
        <div className="mb-6">
          <input
            type="text"
            value={myDeviceName || ''}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            placeholder="设备名称"
          />
        </div>

        {/* 传输模式选择器（顶层） */}
        <div className="mb-6">
          <RoomModeSelector />
        </div>

        {/* 点对点模式 */}
        {transferMode === 'p2p' && (
          <div>
            {/* 发送/接收选择 */}
            <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setMode('send')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all text-sm ${
                  mode === 'send'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                发送
              </button>
              <button
                onClick={() => setMode('receive')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all text-sm ${
                  mode === 'receive'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                接收
              </button>
            </div>

            {/* 点对点发送模式 */}
            {mode === 'send' && (
              <>
                {/* 文件选择区域 - 仅在没有文件时显示 */}
                {!currentFile && !isQueueMode && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('fileInput')?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all mb-4 ${
                      dragOver
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-lg font-medium text-gray-700 mb-1">选择文件</p>
                    <p className="text-sm text-gray-500">点击或拖拽文件到此处</p>
                    <input
                      id="fileInput"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}

                {/* 单文件信息 */}
                {!isQueueMode && currentFile && (
                  <div className="bg-gray-50 border border-gray-200 p-4 mb-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-1">{currentFile.name}</p>
                    <p className="text-sm text-gray-600">{formatFileSize(currentFile.size)}</p>
                  </div>
                )}

                {/* 文件队列（仅显示发送队列） */}
                {isQueueMode && fileQueue.length > 0 && queueDirection === 'send' && (
                  <div className="mb-4">
                    <FileQueue queue={fileQueue} isSender={true} onRemove={handleRemoveFile} />
                  </div>
                )}

                {/* 文件操作按钮 */}
                {(currentFile || (isQueueMode && queueDirection === 'send')) && (
                  <div className="flex gap-2 mb-4">
                    {/* 更换文件按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('fileInput')?.click();
                      }}
                      className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all border border-gray-300"
                    >
                      更换文件
                    </button>
                    <input
                      id="fileInput"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {/* 添加文件按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('p2p-add-files-input')?.click();
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
                      id="p2p-add-files-input"
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

                {/* 设备列表 */}
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-3">选择设备</h3>
                  {devices.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm">未发现其他设备</p>
                      <p className="text-xs text-gray-400 mt-1">请确保其他设备也打开了此页面</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {devices.map((device) => (
                        <div
                          key={device.id}
                          onClick={() => handleSelectDevice(device.id)}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedDeviceId === device.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <span className="font-medium text-gray-900">{device.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 发送按钮 */}
                <button
                  onClick={handleSendFile}
                  disabled={(!currentFile && !(isQueueMode && queueDirection === 'send')) || !selectedDeviceId || isTransferring}
                  className="w-full py-3 bg-blue-500 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all"
                >
                  {isQueueMode && queueDirection === 'send' ? `发送 ${fileQueue.length} 个文件` : '发送文件'}
                </button>

                {/* 发送进度 */}
                {isTransferring && transferProgress && transferProgress.direction === 'send' && (
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-secondary-500 h-3 rounded-full transition-all"
                        style={{ width: `${transferProgress.progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>速度: {transferProgress.speedMB} MB/s</span>
                      <span>剩余: {transferProgress.remainingTime}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 点对点接收模式 */}
            {mode === 'receive' && (
              <div>
                {/* 文件选择器（接收多文件时） */}
                {showFileSelector && pendingFileList && (
                  <FileSelector
                    files={pendingFileList.files}
                    totalSize={pendingFileList.totalSize}
                    onConfirm={handleFileSelectionConfirm}
                    onCancel={handleFileSelectionCancel}
                  />
                )}

                {/* 文件队列（接收中，仅显示接收队列） */}
                {isQueueMode && !showFileSelector && fileQueue.length > 0 && queueDirection === 'receive' && (
                  <div className="mb-4">
                    <FileQueue queue={fileQueue} isSender={false} />
                  </div>
                )}

                {!isTransferring && !hasDownload && !showFileSelector && !(isQueueMode && queueDirection === 'receive') && (
                  <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-600 font-medium">等待接收文件</p>
                    <p className="text-sm text-gray-400 mt-1">设备已在线</p>
                  </div>
                )}

                {/* 接收进度 */}
                {isTransferring && transferProgress && transferProgress.direction === 'receive' && (
                  <div>
                    <div className="text-center mb-4">
                      <p className="text-base font-medium text-gray-900">正在接收...</p>
                      {isStreamingDownload && (
                        <p className="text-sm text-gray-600 mt-1">流式下载中</p>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${transferProgress.progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{transferProgress.speedMB} MB/s</span>
                      <span>{transferProgress.remainingTime}</span>
                    </div>
                    {isStreamingDownload && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-600">大文件正在边传输边下载</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 下载 - 多文件完成 */}
                {hasDownload && isQueueMode && queueDirection === 'receive' && fileQueue.length > 0 && (
                  <div className="bg-green-50 border border-green-200 p-5 rounded-lg">
                    <h2 className="text-lg font-medium text-gray-900 mb-3">接收完成</h2>
                    <div className="bg-white rounded-lg p-4 mb-3 max-h-60 overflow-y-auto border border-gray-200">
                      <p className="font-medium text-gray-700 mb-2 text-sm">已接收的文件：</p>
                      {fileQueue.filter(item => item.status === 'completed').map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{item.metadata.name}</div>
                            <div className="text-xs text-gray-500">{formatFileSize(item.metadata.size)}</div>
                          </div>
                          <button
                            onClick={() => handleDownloadFile(item.metadata.name)}
                            className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-all whitespace-nowrap"
                          >
                            下载
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 下载 - 单文件完成 */}
                {hasDownload && (!isQueueMode || queueDirection !== 'receive') && (
                  <div className="bg-green-50 border border-green-200 p-5 rounded-lg text-center">
                    <h2 className="text-lg font-medium text-gray-900 mb-2">接收完成</h2>
                    <p className="text-sm text-gray-700 mb-3">{downloadFilename}</p>
                    <button
                      onClick={handleDownload}
                      className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-all"
                    >
                      下载文件
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 取件码模式 */}
        {transferMode === 'room' && (
          <RoomContainer />
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>MeshKit - 局域网文件传输</p>
        </div>
      </div>
    </div>
  );
}

export default App;

import { useState } from 'react';
import { useP2P } from './hooks/useP2P';
import { useAppStore } from './store';
import { deviceManager, fileTransferManager } from '@meshkit/core';
import { fileStorage } from './utils/FileStorage';

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
    setMode,
    selectDevice,
    setCurrentFile,
  } = useAppStore();

  const [dragOver, setDragOver] = useState(false);

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('[App] File selected:', file.name, file.size);
      const success = await fileTransferManager.selectFile(file);
      if (success) {
        setCurrentFile({
          name: file.name,
          size: file.size,
          type: file.type,
        });
      } else {
        console.error('[App] File validation failed');
        // 清空input，允许重新选择
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
    const file = e.dataTransfer.files[0];
    if (file) {
      console.log('[App] File dropped:', file.name, file.size);
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
    }
  };

  // 发送文件
  const handleSendFile = async () => {
    if (selectedDeviceId) {
      await fileTransferManager.sendFile(selectedDeviceId);
    }
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
        return;
      }

      const storedFile = await fileStorage.getFile(lastFileId);
      if (!storedFile) {
        console.error('[App] File not found in storage');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-500 p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">⚡ MeshDrop</h1>
          <p className="text-gray-600 text-sm">文件快传 · MeshKit</p>
        </div>

        {/* 连接状态 */}
        <div className={`text-center py-3 rounded-lg mb-6 ${
          isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isConnected ? '✅ 已连接' : '⚠️ 未连接'}
        </div>

        {/* 设备名称 */}
        <div className="mb-6">
          <input
            type="text"
            value={myDeviceName || ''}
            readOnly
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50"
            placeholder="设备名称"
          />
        </div>

        {/* 模式切换 */}
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setMode('send')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              mode === 'send'
                ? 'bg-white text-primary-500 shadow-md'
                : 'text-gray-600'
            }`}
          >
            📤 发送
          </button>
          <button
            onClick={() => setMode('receive')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              mode === 'receive'
                ? 'bg-white text-primary-500 shadow-md'
                : 'text-gray-600'
            }`}
          >
            📥 接收
          </button>
        </div>

        {/* 发送模式 */}
        {mode === 'send' && (
          <div>
            {/* 文件选择 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileInput')?.click()}
              className={`border-3 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4 ${
                dragOver
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 hover:border-primary-500 hover:bg-gray-50'
              }`}
            >
              <div className="text-6xl mb-2">📁</div>
              <p className="text-lg font-semibold">选择文件</p>
              <p className="text-sm text-gray-500 mt-1">点击或拖拽文件到此处</p>
              <input
                id="fileInput"
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* 文件信息 */}
            {currentFile && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
                <p className="font-semibold">📄 已选择文件</p>
                <p className="text-sm">文件名: {currentFile.name}</p>
                <p className="text-sm">大小: {formatFileSize(currentFile.size)}</p>
              </div>
            )}

            {/* 设备列表 */}
            <div className="mb-4">
              <h3 className="font-semibold mb-2">📱 附近的设备</h3>
              {devices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>未发现其他设备</p>
                  <p className="text-sm">请确保其他设备也打开了此页面</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      onClick={() => handleSelectDevice(device.id)}
                      className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedDeviceId === device.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <span className="text-2xl">
                        {device.name.includes('📱') ? '📱' : '💻'}
                      </span>
                      <span className="font-semibold">{device.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 发送按钮 */}
            <button
              onClick={handleSendFile}
              disabled={!currentFile || !selectedDeviceId || isTransferring}
              className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
            >
              📤 发送文件
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
          </div>
        )}

        {/* 接收模式 */}
        {mode === 'receive' && (
          <div>
            {!isTransferring && !hasDownload && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📱</div>
                <p className="text-lg font-semibold">等待接收文件</p>
                <p className="text-sm text-gray-500 mt-2">设备已在线</p>
              </div>
            )}

            {/* 接收进度 */}
            {isTransferring && transferProgress && transferProgress.direction === 'receive' && (
              <div>
                <div className="text-center mb-4">
                  <p className="text-lg font-semibold">📥 正在接收...</p>
                  {isStreamingDownload && (
                    <p className="text-sm text-green-600 mt-2">
                      ⚡ 流式下载中 - 无需等待即可保存
                    </p>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${transferProgress.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>速度: {transferProgress.speedMB} MB/s</span>
                  <span>剩余: {transferProgress.remainingTime}</span>
                </div>
                {isStreamingDownload && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      💡 <strong>提示:</strong> 大文件正在边传输边下载，节省手机内存
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 下载 */}
            {hasDownload && (
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl text-center">
                <h2 className="text-2xl font-bold mb-2">✅ 文件接收完成！</h2>
                <p className="mb-2">{downloadFilename}</p>
                <p className="text-sm mb-4 opacity-90">📥 文件已自动开始下载</p>
                <button
                  onClick={handleDownload}
                  className="bg-white text-green-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition-all"
                >
                  ⬇️ 点击下载文件
                </button>
                <p className="text-xs mt-3 opacity-75">
                  💡 如果下载未开始，请点击上方按钮
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>💻 ↔️ 📱 局域网直连 · MeshKit</p>
        </div>
      </div>
    </div>
  );
}

export default App;

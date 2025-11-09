/**
 * RoomView - 房间内部界面
 * 显示房间信息、成员列表和传输进度（支持多文件队列）
 */
import { useState } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useAppStore } from '../store';

export function RoomView() {
  const { currentRoom, leaveRoom, isHost, updateRoomFiles, requestFile } = useRoom();
  const { isTransferring, transferProgress, isConnected, fileQueue, p2pConnected } = useAppStore();

  const [copySuccess, setCopySuccess] = useState(false);

  const host = isHost();

  if (!currentRoom) {
    return null;
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const handleLeaveRoom = () => {
    const confirmLeave = window.confirm(
      host
        ? '确定要取消发送吗？取件码将失效。'
        : '确定要取消接收吗？'
    );

    if (confirmLeave) {
      leaveRoom();
    }
  };

  const handleCopyCode = async () => {
    if (!currentRoom) return;

    try {
      await navigator.clipboard.writeText(currentRoom.id);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      // 降级方案：使用传统方法复制
      const textArea = document.createElement('textarea');
      textArea.value = currentRoom.id;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        alert('复制失败，请手动复制取件码');
      }
      document.body.removeChild(textArea);
    }
  };

  // 接收方请求文件（点击"开始传输"）
  const handleRequestFile = (fileIndex: number) => {
    if (!p2pConnected) {
      alert('请等待P2P连接建立');
      return;
    }

    console.log('[RoomView] Requesting file:', fileIndex);
    requestFile(fileIndex);
  };

  // 接收方从receivedBlob下载文件到本地（点击"保存文件"）
  const handleDownloadFile = async (fileIndex: number) => {
    if (!fileQueue || fileQueue.length === 0) {
      alert('文件尚未接收，请等待传输完成');
      return;
    }

    const queueItem = fileQueue.find(item => item.index === fileIndex);
    if (!queueItem) {
      alert('未找到该文件');
      return;
    }

    if (!queueItem.receivedBlob) {
      alert('文件尚未传输，请先点击"开始传输"');
      return;
    }

    console.log('[RoomView] Downloading file from receivedBlob:', queueItem.metadata.name, 'index:', fileIndex);

    try {
      const { fileTransferManager } = await import('@meshkit/core');
      await fileTransferManager.downloadFileByIndex(fileIndex);
    } catch (error) {
      console.error('[RoomView] 下载文件错误:', error);
      alert('下载文件失败: ' + (error as Error).message);
    }
  };

  // 检查文件是否已传输完成（有receivedBlob）
  const isFileReceived = (fileIndex: number): boolean => {
    if (!fileQueue || fileQueue.length === 0) return false;
    const queueItem = fileQueue.find(item => item.index === fileIndex);
    return !!queueItem?.receivedBlob;
  };

  // 发送方删除文件
  const handleRemoveFile = async (fileIndex: number) => {
    if (!currentRoom?.fileList) return;

    const fileName = currentRoom.fileList[fileIndex]?.name;
    if (!fileName) {
      alert('文件不存在');
      return;
    }

    const confirmRemove = window.confirm(`确定要删除文件 "${fileName}" 吗？`);
    if (!confirmRemove) return;

    try {
      // 检查文件列表长度
      if (currentRoom.fileList.length <= 1) {
        alert('至少需要保留一个文件');
        return;
      }

      const { fileTransferManager } = await import('@meshkit/core');

      // 从文件列表中过滤掉要删除的文件
      const updatedFileList = currentRoom.fileList.filter((_, index) => index !== fileIndex);

      // 如果有fileQueue，需要重建队列以保持索引同步
      if (fileQueue && fileQueue.length > 0) {
        console.log('[RoomView] 重建文件队列以保持索引同步');

        // 获取所有对应的File对象（除了要删除的）
        const remainingFiles = fileQueue
          .filter(item => item.index !== fileIndex)
          .map(item => item.file)
          .filter(Boolean); // 移除null值

        if (remainingFiles.length > 0) {
          // 清空队列
          fileTransferManager.clearFileQueue();

          // 重新选择文件（这会重新索引为0, 1, 2...）
          await fileTransferManager.selectFiles(remainingFiles);
          console.log('[RoomView] 文件队列已重建，共', remainingFiles.length, '个文件');
        } else {
          // 如果没有剩余文件，清空队列
          fileTransferManager.clearFileQueue();
        }
      }

      // 更新房间文件列表（会同步到所有成员）
      updateRoomFiles(updatedFileList);

      console.log('[RoomView] 文件已删除:', fileName);
    } catch (error) {
      console.error('[RoomView] 删除文件错误:', error);
      alert('删除文件失败: ' + (error as Error).message);
    }
  };

  // 发送方添加更多文件
  const handleAddMoreFiles = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      try {
        const filesArray = Array.from(files);
        const { fileTransferManager } = await import('@meshkit/core');

        // 创建新文件的元数据
        const newFileMetadata = filesArray.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type
        }));

        // 合并当前文件列表和新文件
        const currentFileList = currentRoom?.fileList || [];
        const updatedFileList = [...currentFileList, ...newFileMetadata];

        // 重建整个文件队列以保持索引同步
        if (fileQueue && fileQueue.length > 0) {
          console.log('[RoomView] 重建文件队列以添加新文件');

          // 获取现有的所有File对象
          const existingFiles = fileQueue.map(item => item.file).filter(Boolean);

          // 合并现有文件和新文件
          const allFiles = [...existingFiles, ...filesArray];

          // 清空队列
          fileTransferManager.clearFileQueue();

          // 重新选择所有文件（这会重新索引为0, 1, 2...）
          await fileTransferManager.selectFiles(allFiles);
          console.log('[RoomView] 文件队列已重建，共', allFiles.length, '个文件');
        } else {
          // 首次添加文件，初始化队列
          await fileTransferManager.selectFiles(filesArray);
          console.log('[RoomView] 初始化文件队列，共', filesArray.length, '个文件');
        }

        // 更新房间文件列表（会同步到所有成员）
        updateRoomFiles(updatedFileList);

        console.log(`[RoomView] 添加了 ${files.length} 个文件`);
        alert(`成功添加 ${files.length} 个文件`);
      } catch (error) {
        console.error('[RoomView] 添加文件错误:', error);
        alert('添加文件失败: ' + (error as Error).message);
      }
    };
    input.click();
  };

  return (
    <div className="room-view">
      {/* 取件码显示 */}
      <div className="mb-6">
        <div className="text-center mb-4">
          <h2 className="text-lg font-medium text-gray-900 mb-3">
            {host ? '取件码' : '已连接'}
          </h2>

          {/* 取件码卡片 */}
          <div className="bg-blue-500 text-white p-5 rounded-lg mb-4">
            <div className="text-sm mb-2 opacity-90">
              {host ? '分享取件码' : '取件码'}
            </div>
            <div className="text-4xl font-bold tracking-widest mb-3 font-mono">
              {currentRoom.id}
            </div>

            {/* 复制按钮 */}
            <button
              onClick={handleCopyCode}
              className="bg-white text-blue-600 px-5 py-2 rounded-lg font-medium hover:bg-gray-100 transition-all"
            >
              {copySuccess ? '已复制' : '复制取件码'}
            </button>
          </div>

          {/* 连接状态 */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>信令 {isConnected ? '已连接' : '未连接'}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${p2pConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${p2pConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span>RTC {p2pConnected ? '已连接' : '未连接'}</span>
            </div>
          </div>
        </div>

        <button
          className="w-full py-2 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all"
          onClick={handleLeaveRoom}
        >
          {host ? '取消发送' : '取消接收'}
        </button>
      </div>

      {/* 可用文件列表 */}
      {currentRoom.fileList && currentRoom.fileList.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">
            {host ? '可下载文件' : '可下载的文件'} ({currentRoom.fileList.length})
          </h3>

          <div className="space-y-2 mb-3">
            {currentRoom.fileList.map((file, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{file.name}</div>
                    <div className="text-sm text-gray-600">{formatFileSize(file.size)}</div>
                  </div>

                  {!host && (
                    <>
                      {!isFileReceived(index) ? (
                        <button
                          onClick={() => handleRequestFile(index)}
                          disabled={!p2pConnected}
                          className="px-5 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                        >
                          开始传输
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownloadFile(index)}
                          className="px-5 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all whitespace-nowrap"
                        >
                          保存文件
                        </button>
                      )}
                    </>
                  )}

                  {host && (
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all border border-gray-300"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 发送方添加文件按钮 */}
          {host && (
            <button
              onClick={handleAddMoreFiles}
              className="w-full py-2 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all"
            >
              添加文件
            </button>
          )}
        </div>
      )}

      {/* 没有文件时的提示（仅发送方） */}
      {host && (!currentRoom.fileList || currentRoom.fileList.length === 0) && (
        <div className="mb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-gray-700 font-medium mb-3">还没有添加文件</p>
            <button
              onClick={handleAddMoreFiles}
              className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all"
            >
              添加文件
            </button>
          </div>
        </div>
      )}

      {/* 传输进度显示 */}
      {isTransferring && transferProgress && (
        <div className="mb-6">
          <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg">
            <div className="text-center mb-4">
              <div className="text-base font-medium text-gray-900">
                {transferProgress.direction === 'send' ? '正在发送...' : '正在接收...'}
              </div>
            </div>
            <div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${transferProgress.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{transferProgress.progress.toFixed(1)}%</span>
                <span>{transferProgress.speedMB} MB/s</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {!isTransferring && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="space-y-2 text-sm text-gray-600">
            {host ? (
              <>
                <p>接收方输入取件码后，可以点击任意文件进行下载</p>
                <p>你可以随时添加或删除文件，接收方会实时看到更新</p>
                <p>传输过程中请保持网络连接</p>
              </>
            ) : (
              <>
                <p>点击任意文件即可开始下载</p>
                <p>每个文件都可以单独下载，不需要一次性下载全部</p>
                <p>文件列表会实时更新</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

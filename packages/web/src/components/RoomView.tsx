/**
 * RoomView - 房间内部界面
 * 显示房间信息、成员列表和传输进度（支持多文件队列）
 */
import { useState } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useAppStore } from '../store';

export function RoomView() {
  const { currentRoom, leaveRoom, isHost, updateRoomFiles, requestFile, markAsCompleted } = useRoom();
  const { isTransferring, isConnected, fileQueue, p2pConnected, transferProgress } = useAppStore();

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

  const handleLeaveRoom = async () => {
    // 检查是否有传输正在进行
    if (isTransferring) {
      const confirmLeave = window.confirm(
        host
          ? '⚠️ 请确保文件已发送完毕！\n\n确定要取消发送吗？取件码将失效。'
          : '⚠️ 请确保文件已接收完毕！\n\n确定要取消接收吗？未完成的文件将丢失。'
      );

      if (!confirmLeave) {
        return;
      }
    } else if (host) {
      // 检查是否有成员正在接收文件
      const { fileTransferManager } = await import('@meshkit/core');
      const queueSummary = fileTransferManager.getQueueSummary();

      // 检查房间成员的传输状态，找出所有正在接收的成员
      const receivingMembers = currentRoom?.members.filter(
        member => member.status === 'receiving' && member.progress !== undefined && member.progress < 100
      ) || [];

      if (receivingMembers.length > 0) {
        // 构建详细的成员信息
        const memberDetails = receivingMembers.map(
          member => `  • ${member.deviceName}: ${member.progress?.toFixed(1)}%`
        ).join('\n');

        const confirmLeave = window.confirm(
          `⚠️ 房间内有 ${receivingMembers.length} 个成员正在接收文件！\n\n正在接收的成员：\n${memberDetails}\n\n确定要关闭房间吗？这将中断他们的传输。`
        );

        if (!confirmLeave) {
          return;
        }
      } else if (queueSummary && queueSummary.transferringCount > 0) {
        // 如果有文件正在传输队列中
        const confirmLeave = window.confirm(
          `⚠️ 还有 ${queueSummary.transferringCount} 个文件正在传输中！\n\n确定要取消发送吗？取件码将失效。`
        );

        if (!confirmLeave) {
          return;
        }
      } else {
        // 正常情况下的确认
        const confirmLeave = window.confirm(
          '确定要关闭房间吗？取件码将失效。'
        );

        if (!confirmLeave) {
          return;
        }
      }
    } else {
      // 接收方正常情况的确认
      const confirmLeave = window.confirm(
        '确定要取消接收吗？'
      );

      if (!confirmLeave) {
        return;
      }
    }

    // 确认后离开房间
    leaveRoom();
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

  // 获取文件传输状态
  const getFileStatus = (fileIndex: number): { status: string; progress: number } => {
    if (!fileQueue || fileQueue.length === 0) {
      return { status: 'pending', progress: 0 };
    }
    const queueItem = fileQueue.find(item => item.index === fileIndex);
    if (!queueItem) {
      return { status: 'pending', progress: 0 };
    }
    return { status: queueItem.status, progress: queueItem.progress };
  };

  // 获取文件状态文本
  const getFileStatusText = (status: string, isHost: boolean): string => {
    switch (status) {
      case 'transferring':
        return isHost ? '发送中' : '接收中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      case 'skipped':
        return '已跳过';
      default:
        return '等待中';
    }
  };

  // 发送方删除文件
  const handleRemoveFile = async (fileIndex: number) => {
    if (!currentRoom?.fileList) return;

    // 根据文件索引查找文件（不能用数组索引，因为删除后索引不连续）
    const fileToRemove = currentRoom.fileList.find(f => f.index === fileIndex);
    if (!fileToRemove) {
      alert('文件不存在');
      return;
    }

    const confirmRemove = window.confirm(`确定要删除文件 "${fileToRemove.name}" 吗？`);
    if (!confirmRemove) return;

    try {
      // 检查文件列表长度
      if (currentRoom.fileList.length <= 1) {
        alert('至少需要保留一个文件');
        return;
      }

      const { fileTransferManager } = await import('@meshkit/core');

      // 直接从队列中移除文件（保持其他文件的索引不变）
      fileTransferManager.removeFileFromQueue(fileIndex);
      console.log('[RoomView] 已从队列中移除文件:', fileToRemove.name);

      // 获取更新后的队列并构建包含索引的文件列表
      const updatedQueue = fileTransferManager.getFileQueue();
      const updatedFileList = updatedQueue.map(item => ({
        ...item.metadata,
        index: item.index, // 保留文件在队列中的索引
      }));

      // 更新房间文件列表（会同步到所有成员）
      updateRoomFiles(updatedFileList);

      console.log('[RoomView] 文件已删除:', fileToRemove.name);
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

        // 使用 appendFiles 追加文件，保持现有文件的索引不变
        const currentQueue = fileTransferManager.getFileQueue();
        let success = false;

        if (currentQueue && currentQueue.length > 0) {
          // 已有文件，追加新文件（索引会继续累加，Room模式跳过验证）
          success = await fileTransferManager.appendFiles(filesArray, true);
          console.log('[RoomView] 追加文件到队列，结果:', success, '共', fileTransferManager.getFileQueue().length, '个文件');
        } else {
          // 首次添加文件，初始化队列（Room模式跳过验证）
          success = await fileTransferManager.selectFiles(filesArray, true);
          console.log('[RoomView] 初始化文件队列，结果:', success, '共', filesArray.length, '个文件');
        }

        // 检查是否添加成功
        if (!success) {
          throw new Error('文件添加失败，可能正在传输中或文件无效');
        }

        // 获取更新后的队列并构建包含索引的文件列表
        const updatedQueue = fileTransferManager.getFileQueue();
        const updatedFileList = updatedQueue.map(item => ({
          ...item.metadata,
          index: item.index, // 保留文件在队列中的索引
        }));

        // 更新房间文件列表（会同步到所有成员）
        updateRoomFiles(updatedFileList);

        console.log(`[RoomView] 添加了 ${files.length} 个文件，当前文件列表:`, updatedFileList.map(f => `${f.name}(index:${f.index})`));
        alert(`成功添加 ${files.length} 个文件`);
      } catch (error) {
        console.error('[RoomView] 添加文件错误:', error);
        alert('添加文件失败: ' + (error as Error).message);
      }
    };
    input.click();
  };

  // 接收方标记为已完成
  const handleMarkAsCompleted = () => {
    const confirmComplete = window.confirm(
      '确定要标记为已完成吗？\n\n标记后，发送方将看到您已完成接收。您不需要下载所有文件即可标记完成。'
    );

    if (confirmComplete) {
      markAsCompleted();
      console.log('[RoomView] User marked as completed');
    }
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
            {currentRoom.fileList.map((file, arrayIndex) => {
              // 使用文件的真实索引，而不是数组索引
              const fileIndex = file.index !== undefined ? file.index : arrayIndex;
              const { status, progress } = getFileStatus(fileIndex);
              const statusText = getFileStatusText(status, host);
              const isReceived = isFileReceived(fileIndex);

              return (
                <div
                  key={fileIndex}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-all"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{file.name}</div>
                      <div className="text-sm text-gray-600">{formatFileSize(file.size)}</div>
                    </div>

                    {!host && (
                      <>
                        {!isReceived ? (
                          <button
                            onClick={() => handleRequestFile(fileIndex)}
                            disabled={!p2pConnected || status === 'transferring'}
                            className="px-5 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                          >
                            {status === 'transferring' ? '传输中' : '开始传输'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDownloadFile(fileIndex)}
                            className="px-5 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all whitespace-nowrap"
                          >
                            保存文件
                          </button>
                        )}
                      </>
                    )}

                    {host && (
                      <button
                        onClick={() => handleRemoveFile(fileIndex)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all border border-gray-300"
                      >
                        删除
                      </button>
                    )}
                  </div>

                  {/* 文件传输进度条 */}
                  {(status === 'transferring' || status === 'completed') && (
                    <div className="mt-2">
                      {status === 'transferring' && transferProgress ? (
                        // 传输中：显示详细信息（百分比、速度、时间）
                        <>
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span className="font-medium text-blue-600">{progress.toFixed(1)}%</span>
                            <span>{transferProgress.speedMB} MB/s</span>
                            <span>剩余 {transferProgress.remainingTime}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all bg-blue-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        // 已完成或等待中：只显示状态和百分比
                        <>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={`font-medium ${
                              status === 'completed' ? 'text-green-600' : 'text-gray-600'
                            }`}>
                              {statusText}
                            </span>
                            <span className="text-gray-600">{progress.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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

          {/* 接收方标记为已完成按钮 */}
          {!host && (
            <button
              onClick={handleMarkAsCompleted}
              className="w-full py-2 px-4 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-all"
            >
              标记为已完成
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

      {/* 房间成员状态（仅发送方可见） */}
      {host && currentRoom.members && currentRoom.members.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">
            房间成员 ({currentRoom.members.length})
          </h3>
          <div className="space-y-2">
            {currentRoom.members.map((member, index) => (
              <div
                key={member.deviceId || index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {member.deviceName}
                    </span>
                    {member.role === 'host' && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        房主
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        member.status === 'receiving'
                          ? 'bg-blue-500'
                          : member.status === 'completed'
                          ? 'bg-green-500'
                          : member.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                      }`}
                    ></div>
                    <span className="text-sm text-gray-600">
                      {member.status === 'receiving'
                        ? '接收中'
                        : member.status === 'completed'
                        ? '已完成'
                        : member.status === 'failed'
                        ? '失败'
                        : '等待中'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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

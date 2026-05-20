/**
 * RoomView - 房间内部界面
 * 显示房间信息、成员列表和传输进度（支持多文件队列）
 */
import { useState } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useAppStore } from '../store';
import { getDesktopShareableWebUrl, getShareableWebUrl } from '../utils/signalingConfig';
import { readPickupSharePassword } from '../utils/pickupShare';
import { ExperienceCard } from './ExperienceShell';
import { DeviceKindIcon, FileTypeIcon, InfoIcon, TrashIcon, getDisplayDeviceName } from './FileTransferIcons';
import { ShareLinkDialog } from './ShareLinkDialog';

export function RoomView() {
  const { currentRoom, leaveRoom, isHost, updateRoomFiles, requestFile, markAsCompleted, refreshRtcConnection } = useRoom();
  const { isTransferring, isConnected, fileQueue, p2pConnected, transferProgress } = useAppStore();

  const [copySuccess, setCopySuccess] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSystemSharing, setIsSystemSharing] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isRefreshingRtc, setIsRefreshingRtc] = useState(false);

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

  const copyTextWithFallback = async (text: string): Promise<boolean> => {
    const electronAPI = (window as any).electronAPI;

    if (electronAPI?.copyText) {
      try {
        return await electronAPI.copyText(text);
      } catch (error) {
        console.warn('[RoomView] electron clipboard copy failed, trying browser fallback:', error);
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.warn('[RoomView] navigator.clipboard copy failed, trying fallback:', error);
      }
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      return document.execCommand('copy');
    } catch (error) {
      console.warn('[RoomView] document.execCommand copy failed:', error);
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const buildPickupShareUrl = async (): Promise<string> => {
    const password = readPickupSharePassword(currentRoom.id) || undefined;
    const invite = {
      pickup: {
        code: currentRoom.id,
        password,
        passwordProtected: currentRoom.hasPassword || !!password,
      },
    };
    const electronAPI = (window as any).electronAPI;

    if (electronAPI?.getEmbeddedServiceStatus) {
      try {
        const serviceStatus = await electronAPI.getEmbeddedServiceStatus();
        return (
          await getDesktopShareableWebUrl(
            undefined,
            '/',
            serviceStatus?.shareWeb?.port,
            invite,
          )
        ).url;
      } catch (error) {
        console.warn('[RoomView] Failed to build desktop pickup share URL, falling back to web URL:', error);
      }
    }

    return (await getShareableWebUrl('/', invite)).url;
  };

  const handleLeaveRoom = async () => {
    // 检查是否有传输正在进行
    if (isTransferring) {
      const confirmLeave = window.confirm(
        host
          ? '请确保文件已发送完毕。\n\n确定要取消发送吗？取件码将失效。'
          : '请确保文件已接收完毕。\n\n确定要取消接收吗？未完成的文件将丢失。'
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
          `房间内有 ${receivingMembers.length} 个成员正在接收文件。\n\n正在接收的成员：\n${memberDetails}\n\n确定要关闭房间吗？这将中断他们的传输。`
        );

        if (!confirmLeave) {
          return;
        }
      } else if (queueSummary && queueSummary.transferringCount > 0) {
        // 如果有文件正在传输队列中
        const confirmLeave = window.confirm(
          `还有 ${queueSummary.transferringCount} 个文件正在传输中。\n\n确定要取消发送吗？取件码将失效。`
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
      const copied = await copyTextWithFallback(currentRoom.id);
      if (!copied) {
        throw new Error('copy failed');
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      alert('复制失败，请手动复制取件码');
    }
  };

  const handleSharePickup = async () => {
    if (!currentRoom) {
      return;
    }

    setIsSharing(true);

    try {
      const nextShareUrl = await buildPickupShareUrl();
      setShareUrl(nextShareUrl);
      setShowShareDialog(true);
    } catch (error) {
      console.error('[RoomView] Failed to share pickup room:', error);
      alert('分享链接生成失败，请稍后再试');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyShareLink = async (): Promise<boolean> => {
    if (!shareUrl) {
      return false;
    }

    const copied = await copyTextWithFallback(shareUrl);
    if (!copied) {
      window.prompt('请手动复制下方链接：', shareUrl);
      return false;
    }

    return true;
  };

  const handleNativeShare = async () => {
    if (!currentRoom || !shareUrl || !navigator.share) {
      return;
    }

    setIsSystemSharing(true);

    try {
      await navigator.share({
        title: 'MeshKit 取件码分享',
        text: `分享取件码 ${currentRoom.id}`,
        url: shareUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.warn('[RoomView] Web Share API failed:', error);
      alert('系统分享失败，请改用复制链接或扫码分享。');
    } finally {
      setIsSystemSharing(false);
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
    if (queueItem.receivedBlob) {
      return { status: 'completed', progress: 100 };
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

  const roomFiles = currentRoom.fileList ?? [];
  const roomMembers = currentRoom.members ?? [];

  const getMemberStatusMeta = (status: string) => {
    switch (status) {
      case 'receiving':
        return {
          dotClassName: 'bg-[#1a6dff]',
          pillClassName: 'bg-[#e8f0ff] text-[#1a6dff]',
          label: '接收中',
        };
      case 'completed':
        return {
          dotClassName: 'bg-[#10b981]',
          pillClassName: 'bg-[rgba(16,185,129,0.1)] text-[#059669]',
          label: '已完成',
        };
      case 'failed':
        return {
          dotClassName: 'bg-[#ef4444]',
          pillClassName: 'bg-[rgba(239,68,68,0.1)] text-[#dc2626]',
          label: '失败',
        };
      default:
        return {
          dotClassName: 'bg-[#f59e0b]',
          pillClassName: 'bg-[rgba(245,158,11,0.12)] text-[#d97706]',
          label: '等待中',
        };
    }
  };

  const getHostFileMetaText = (fileIndex: number, fileSize: number): string => {
    const { status, progress } = getFileStatus(fileIndex);

    if (status === 'transferring') {
      return `${formatFileSize(fileSize)} · 发送中 ${progress.toFixed(1)}%`;
    }

    if (status === 'completed') {
      return `${formatFileSize(fileSize)} · 已发送完成`;
    }

    if (status === 'failed') {
      return `${formatFileSize(fileSize)} · 发送失败`;
    }

    return formatFileSize(fileSize);
  };

  const handleRefreshRtc = async () => {
    setIsRefreshingRtc(true);

    try {
      const refreshed = await refreshRtcConnection();
      if (!refreshed) {
        alert('刷新 RTC 连接失败，请稍后重试。');
        return;
      }

      alert(
        host
          ? '已重新初始化 RTC 服务，请等待接收方重新连接。'
          : '已重新发起 RTC 连接，请等待几秒后再试。'
      );
    } finally {
      setIsRefreshingRtc(false);
    }
  };

  const renderConnectionPills = () => (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[12px]">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-white/92">
        <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-[#86efac]' : 'bg-[#fca5a5]'}`} />
        <span>{`信令${isConnected ? '已连接' : '未连接'}`}</span>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-white/92">
        <span className={`h-2 w-2 rounded-full ${p2pConnected ? 'bg-[#86efac]' : 'bg-white/55'}`} />
        <span>{`RTC ${p2pConnected ? '已连接' : '未连接'}`}</span>
      </div>
      <button
        type="button"
        onClick={handleRefreshRtc}
        disabled={isRefreshingRtc}
        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-white/92 transition hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <svg className={`h-3.5 w-3.5 ${isRefreshingRtc ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 4v6h-6" />
        </svg>
        <span>{isRefreshingRtc ? '重连中...' : '刷新 RTC'}</span>
      </button>
    </div>
  );

  if (host) {
    return (
      <div className="space-y-4">
        <section className="rounded-[18px] bg-[linear-gradient(180deg,_#2f73ff_0%,_#2457d5_100%)] px-6 py-7 text-white shadow-[0_18px_40px_rgba(37,99,235,0.28)]">
          <div className="text-center">
            <div className="text-[15px] font-semibold text-white/88">分享取件码</div>
            <div className="mt-4 flex items-center justify-center gap-2.5 sm:gap-3">
              {currentRoom.id.split('').map((digit, index) => (
                <span key={`${digit}-${index}`} className="font-mono text-[42px] font-bold leading-none text-white sm:text-[48px]">
                  {digit}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleCopyCode}
                className="rounded-[12px] border border-white/20 bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/16"
              >
                {copySuccess ? '已复制取件码' : '复制取件码'}
              </button>
              <button
                onClick={handleSharePickup}
                disabled={isSharing}
                className="rounded-[12px] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1a6dff] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSharing ? '生成中...' : '分享链接'}
              </button>
            </div>

            {renderConnectionPills()}
          </div>
        </section>

        {isTransferring && transferProgress && transferProgress.direction === 'send' && (
          <ExperienceCard className="p-5">
            <div className="mb-3 flex items-center justify-between text-[12px] text-[#5e6687]">
              <span className="text-[15px] font-semibold text-[#1a1f36]">发送中</span>
              <span className="font-semibold text-[#1a1f36]">{transferProgress.progress.toFixed(1)}%</span>
            </div>
            <div className="mb-3 h-3 w-full rounded-full bg-[#e8ecf2]">
              <div className="h-3 rounded-full bg-[#1a6dff] transition-all" style={{ width: `${transferProgress.progress}%` }} />
            </div>
            <div className="flex items-center justify-between text-[12px] text-[#8e95b2]">
              <span>{transferProgress.speedMB} MB/s</span>
              <span>{`剩余 ${transferProgress.remainingTime}`}</span>
            </div>
          </ExperienceCard>
        )}

        <ExperienceCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[#edf2fb] px-5 py-4">
            <div className="text-[16px] font-semibold text-[#1a1f36]">{`可下载文件 (${roomFiles.length})`}</div>
            <button
              onClick={handleAddMoreFiles}
              className="shrink-0 rounded-[12px] bg-[#1a6dff] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#0a4fc9]"
            >
              + 添加文件
            </button>
          </div>

          <div className="space-y-3 p-5">
            {roomFiles.length > 0 ? roomFiles.map((file, arrayIndex) => {
              const fileIndex = file.index !== undefined ? file.index : arrayIndex;

              return (
                <div
                  key={fileIndex}
                  className="flex items-center gap-3 rounded-[14px] border border-[#edf2fb] bg-[#f8fafd] px-4 py-4"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#e8f0ff] text-[#1a6dff]">
                    <FileTypeIcon type={file.type} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-[#1a1f36]">{file.name}</div>
                    <div className="mt-1 text-[12px] text-[#8e95b2]">{getHostFileMetaText(fileIndex, file.size)}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(fileIndex)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[12px] border border-[rgba(239,68,68,0.2)] bg-white px-4 py-2 text-[12px] font-semibold text-[#ef4444] transition hover:bg-[rgba(239,68,68,0.05)]"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span>删除</span>
                  </button>
                </div>
              );
            }) : (
              <div className="rounded-[14px] border border-dashed border-[#d7e3f5] bg-[#f8fafd] px-5 py-8 text-center">
                <div className="text-[14px] font-semibold text-[#4f5d87]">还没有可分享的文件</div>
                <button
                  onClick={handleAddMoreFiles}
                  className="mt-4 rounded-[12px] bg-[#1a6dff] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#0a4fc9]"
                >
                  添加文件
                </button>
              </div>
            )}
          </div>
        </ExperienceCard>

        <ExperienceCard className="overflow-hidden p-0">
          <div className="border-b border-[#edf2fb] px-5 py-4">
            <div className="text-[16px] font-semibold text-[#1a1f36]">{`房间成员 (${roomMembers.length})`}</div>
          </div>

          <div className="space-y-3 p-5">
            {roomMembers.map((member, index) => {
              const statusMeta = getMemberStatusMeta(member.status);
              const memberDescription = member.role === 'host'
                ? '当前发送方'
                : member.status === 'receiving' && typeof member.progress === 'number'
                  ? `正在接收 ${member.progress.toFixed(0)}%`
                  : member.status === 'completed'
                    ? '已完成接收'
                    : member.status === 'failed'
                      ? '接收失败'
                      : '等待连接';

              return (
                <div
                  key={member.deviceId || index}
                  className="flex items-center gap-3 rounded-[14px] border border-[#edf2fb] bg-[#f8fafd] px-4 py-4"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${
                    member.role === 'host'
                      ? 'bg-[#1f2340] text-white'
                      : 'border border-[#e8ecf2] bg-white text-[#5e6687]'
                  }`}>
                    <DeviceKindIcon deviceName={member.deviceName} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-[#1a1f36]">
                      {getDisplayDeviceName(member.deviceName)}
                    </div>
                    <div className="mt-1 text-[12px] text-[#8e95b2]">{memberDescription}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {member.role === 'host' && (
                      <span className="rounded-full bg-[#e8f0ff] px-2.5 py-1 text-[11px] font-semibold text-[#1a6dff]">
                        房主
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusMeta.pillClassName}`}>
                      <span className={`h-2 w-2 rounded-full ${statusMeta.dotClassName}`} />
                      <span>{statusMeta.label}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ExperienceCard>

        {!isTransferring && (
          <ExperienceCard className="border-[#edf2fb] bg-[#f8fafd] p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#8e95b2]">
                <InfoIcon className="h-4 w-4" />
              </span>
              <div className="space-y-2 text-[13px] leading-6 text-[#8e95b2]">
                <div>接收方输入取件码后，可以点击任意文件进行下载</div>
                <div>你可以随时添加或删除文件，接收方会实时看到更新</div>
                <div>房主请保持当前页面打开，不要切换到其他功能页</div>
                <div>传输过程中请保持网络连接</div>
              </div>
            </div>
          </ExperienceCard>
        )}

        <button
          className="w-full rounded-[14px] border border-[rgba(239,68,68,0.28)] bg-white px-6 py-4 text-[15px] font-semibold text-[#ef4444] transition hover:bg-[rgba(239,68,68,0.04)]"
          onClick={handleLeaveRoom}
        >
          取消发送
        </button>

        <ShareLinkDialog
          open={showShareDialog}
          shareUrl={shareUrl}
          title={'分享取件码'}
          description={'复制链接或让对方扫码，都可以直接打开当前取件页并写入连接参数。'}
          qrTitle={'扫码打开取件页'}
          qrCaption={'二维码会携带当前取件码和连接信息，适合手机直接扫码进入。'}
          downloadQrFileName={`meshkit-pickup-${currentRoom.id}.png`}
          isSystemShareSupported={typeof navigator !== 'undefined' && typeof navigator.share === 'function'}
          isSystemSharing={isSystemSharing}
          onClose={() => setShowShareDialog(false)}
          onCopyLink={handleCopyShareLink}
          onSystemShare={handleNativeShare}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] bg-[linear-gradient(180deg,_#2f73ff_0%,_#2457d5_100%)] px-6 py-7 text-white shadow-[0_18px_40px_rgba(37,99,235,0.22)]">
        <div className="text-center">
          <div className="text-[15px] font-semibold text-white/88">已连接取件码</div>
          <div className="mt-4 flex items-center justify-center gap-2.5 sm:gap-3">
            {currentRoom.id.split('').map((digit, index) => (
              <span key={`${digit}-${index}`} className="font-mono text-[38px] font-bold leading-none text-white sm:text-[44px]">
                {digit}
              </span>
            ))}
          </div>
          {renderConnectionPills()}
        </div>
      </section>

      {isTransferring && transferProgress && transferProgress.direction === 'receive' && (
        <ExperienceCard className="p-5">
          <div className="mb-3 flex items-center justify-between text-[12px] text-[#5e6687]">
            <span className="text-[15px] font-semibold text-[#1a1f36]">正在接收</span>
            <span className="font-semibold text-[#1a1f36]">{transferProgress.progress.toFixed(1)}%</span>
          </div>
          <div className="mb-3 h-3 w-full rounded-full bg-[#e8ecf2]">
            <div className="h-3 rounded-full bg-[#1a6dff] transition-all" style={{ width: `${transferProgress.progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[12px] text-[#8e95b2]">
            <span>{transferProgress.speedMB} MB/s</span>
            <span>{`剩余 ${transferProgress.remainingTime}`}</span>
          </div>
        </ExperienceCard>
      )}

      <ExperienceCard className="overflow-hidden p-0">
        <div className="border-b border-[#edf2fb] px-5 py-4">
          <div className="text-[16px] font-semibold text-[#1a1f36]">{`可下载文件 (${roomFiles.length})`}</div>
        </div>

        <div className="space-y-3 p-5">
          {roomFiles.length > 0 ? roomFiles.map((file, arrayIndex) => {
            const fileIndex = file.index !== undefined ? file.index : arrayIndex;
            const { status, progress } = getFileStatus(fileIndex);
            const statusText = getFileStatusText(status, host);
            const isReceived = isFileReceived(fileIndex);

            return (
              <div
                key={fileIndex}
                className="rounded-[14px] border border-[#edf2fb] bg-[#f8fafd] px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#e8f0ff] text-[#1a6dff]">
                    <FileTypeIcon type={file.type} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-[#1a1f36]">{file.name}</div>
                    <div className="mt-1 text-[12px] text-[#8e95b2]">
                      {status === 'transferring'
                        ? `${formatFileSize(file.size)} · ${statusText} ${progress.toFixed(1)}%`
                        : status === 'completed'
                          ? `${formatFileSize(file.size)} · 已可保存`
                          : formatFileSize(file.size)}
                    </div>
                  </div>
                  {!isReceived ? (
                    <button
                      onClick={() => handleRequestFile(fileIndex)}
                      disabled={!p2pConnected || status === 'transferring'}
                      className="shrink-0 rounded-[12px] bg-[#1a6dff] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#0a4fc9] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {status === 'transferring' ? '传输中' : '开始传输'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDownloadFile(fileIndex)}
                      className="shrink-0 rounded-[12px] bg-[#1a6dff] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#0a4fc9]"
                    >
                      保存文件
                    </button>
                  )}
                </div>

                {(status === 'transferring' || status === 'completed') && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[#8e95b2]">
                      <span className={status === 'completed' ? 'font-medium text-[#10b981]' : 'font-medium text-[#1a6dff]'}>
                        {statusText}
                      </span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#e8ecf2]">
                      <div
                        className={`h-2 rounded-full transition-all ${status === 'completed' ? 'bg-[#10b981]' : 'bg-[#1a6dff]'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="rounded-[14px] border border-dashed border-[#d7e3f5] bg-[#f8fafd] px-5 py-8 text-center">
              <div className="text-[14px] font-semibold text-[#4f5d87]">等待发送方提供文件</div>
              <div className="mt-2 text-[12px] text-[#8e95b2]">文件列表会在房间内实时更新</div>
            </div>
          )}
        </div>
      </ExperienceCard>

      {roomFiles.length > 0 && (
        <button
          onClick={handleMarkAsCompleted}
          className="w-full rounded-[14px] bg-[#1a6dff] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(26,109,255,0.24)] transition hover:bg-[#0a4fc9]"
        >
          标记为已完成
        </button>
      )}

      {!isTransferring && (
        <ExperienceCard className="border-[#edf2fb] bg-[#f8fafd] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#8e95b2]">
              <InfoIcon className="h-4 w-4" />
            </span>
            <div className="space-y-2 text-[13px] leading-6 text-[#8e95b2]">
              <div>点击任意文件即可开始下载</div>
              <div>每个文件都可以单独下载，不需要一次性下载全部</div>
              <div>文件列表会实时更新，请保持此页面开启</div>
            </div>
          </div>
        </ExperienceCard>
      )}

      <button
        className="w-full rounded-[14px] border border-[rgba(239,68,68,0.28)] bg-white px-6 py-4 text-[15px] font-semibold text-[#ef4444] transition hover:bg-[rgba(239,68,68,0.04)]"
        onClick={handleLeaveRoom}
      >
        取消接收
      </button>
    </div>
  );
}

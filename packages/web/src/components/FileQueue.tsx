/**
 * FileQueue - 文件队列显示组件
 * 显示文件队列和传输状态
 */
import type { FileQueueItem } from '@meshkit/core';
import { InfoIcon, QueueListIcon, TransferStatusIcon, TrashIcon, XCircleIcon } from './FileTransferIcons';

interface FileQueueProps {
  queue: FileQueueItem[];
  isSender?: boolean;
  onRemove?: (index: number) => void; // 新增删除回调
}

export function FileQueue({ queue, isSender = false, onRemove }: FileQueueProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending': return '等待中';
      case 'transferring': return '传输中';
      case 'completed': return '已完成';
      case 'skipped': return '已跳过';
      case 'failed': return '失败';
      default: return '未知';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return 'text-gray-600';
      case 'transferring': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'skipped': return 'text-gray-400';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // 统计信息
  const totalSize = queue.reduce((sum, item) => sum + item.metadata.size, 0);
  const selectedCount = queue.filter(item => item.selected).length;
  const completedCount = queue.filter(item => item.status === 'completed').length;
  const failedCount = queue.filter(item => item.status === 'failed').length;

  const getStatusBadgeClasses = (status: string): string => {
    switch (status) {
      case 'transferring':
        return 'border-blue-200 bg-blue-50 text-blue-600';
      case 'completed':
        return 'border-green-200 bg-green-50 text-green-600';
      case 'failed':
        return 'border-red-200 bg-red-50 text-red-600';
      case 'skipped':
        return 'border-gray-200 bg-gray-50 text-gray-400';
      default:
        return 'border-gray-200 bg-white text-gray-500';
    }
  };

  return (
    <div className="file-queue">
      {/* 统计摘要 */}
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-200 bg-white text-blue-600 shadow-sm">
            <QueueListIcon className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-bold text-gray-800">文件队列</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-700">
            文件总数: <strong>{queue.length}</strong>
          </div>
          <div className="text-gray-700">
            {isSender ? '待发送' : '已选择'}: <strong>{selectedCount}</strong>
          </div>
          <div className="text-green-600">
            已完成: <strong>{completedCount}</strong>
          </div>
          <div className={failedCount > 0 ? 'text-red-600' : 'text-gray-400'}>
            失败: <strong>{failedCount}</strong>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          总大小: <strong>{formatFileSize(totalSize)}</strong>
        </div>
      </div>

      {/* 文件列表 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {queue.map((item) => (
          <div
            key={item.index}
            className={`p-3 border-2 rounded-lg transition-all ${
              item.status === 'transferring'
                ? 'border-blue-500 bg-blue-50'
                : item.status === 'completed'
                ? 'border-green-500 bg-green-50'
                : item.status === 'failed'
                ? 'border-red-500 bg-red-50'
                : item.status === 'skipped'
                ? 'border-gray-300 bg-gray-50 opacity-60'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* 状态图标 */}
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${getStatusBadgeClasses(item.status)}`}>
                <TransferStatusIcon status={item.status} className="h-5 w-5" />
              </div>

              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800 truncate">
                    {item.metadata.name}
                  </span>
                  {!item.selected && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                      未选中
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span>{formatFileSize(item.metadata.size)}</span>
                  <span className={getStatusColor(item.status)}>
                    {getStatusText(item.status)}
                  </span>
                </div>

                {/* 进度条（仅在传输中显示） */}
                {item.status === 'transferring' && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {item.progress.toFixed(1)}%
                    </div>
                  </div>
                )}

                {/* 错误信息 */}
                {item.status === 'failed' && item.error && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-red-600">
                    <XCircleIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.error}</span>
                  </div>
                )}
              </div>

              {/* 删除按钮（仅发送方且未传输时显示） */}
              {isSender && onRemove && (item.status === 'pending' || item.status === 'failed') && (
                <button
                  onClick={() => onRemove(item.index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                  title="移除此文件"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 底部提示 */}
      {queue.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="flex items-center gap-2 text-xs text-gray-600">
            <InfoIcon className="h-4 w-4 shrink-0 text-gray-500" />
            <span>
              <strong>提示:</strong> 这是传输的文件
              {!isSender && '，完成后点击下载'}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

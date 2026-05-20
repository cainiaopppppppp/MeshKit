/**
 * FileQueue - 文件队列展示组件
 */
import type { FileQueueItem } from '@meshkit/core';
import {
  InfoIcon,
  QueueListIcon,
  TransferStatusIcon,
  TrashIcon,
  XCircleIcon,
} from './FileTransferIcons';

interface FileQueueProps {
  queue: FileQueueItem[];
  isSender?: boolean;
  onRemove?: (index: number) => void;
}

const statusTextMap: Record<string, string> = {
  pending: '等待中',
  transferring: '传输中',
  completed: '已完成',
  skipped: '已跳过',
  failed: '失败',
};

const statusToneMap: Record<string, string> = {
  pending: 'text-[#5e6687]',
  transferring: 'text-[#1a6dff]',
  completed: 'text-[#10b981]',
  skipped: 'text-[#8e95b2]',
  failed: 'text-[#ef4444]',
};

const statusBadgeMap: Record<string, string> = {
  pending: 'border-[#d7dfea] bg-white text-[#8e95b2]',
  transferring: 'border-[#bfd6ff] bg-[#eef4ff] text-[#1a6dff]',
  completed: 'border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] text-[#10b981]',
  skipped: 'border-[#d7dfea] bg-[#f8fafd] text-[#8e95b2]',
  failed: 'border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] text-[#ef4444]',
};

export function FileQueue({ queue, isSender = false, onRemove }: FileQueueProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const totalSize = queue.reduce((sum, item) => sum + item.metadata.size, 0);
  const selectedCount = queue.filter((item) => item.selected).length;
  const completedCount = queue.filter((item) => item.status === 'completed').length;
  const failedCount = queue.filter((item) => item.status === 'failed').length;

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-[#d8e5ff] bg-[linear-gradient(135deg,#f7faff,#fff9fb)] px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#bfd6ff] bg-white text-[#1a6dff] shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
            <QueueListIcon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[16px] font-bold text-[#1a1f36]">文件队列</h3>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px]">
          <div className="text-[#4f5d87]">
            文件总数: <strong className="text-[#1a1f36]">{queue.length}</strong>
          </div>
          <div className="text-[#4f5d87]">
            {isSender ? '待发送' : '已选择'}: <strong className="text-[#1a1f36]">{selectedCount}</strong>
          </div>
          <div className="text-[#10b981]">
            已完成: <strong>{completedCount}</strong>
          </div>
          <div className={failedCount > 0 ? 'text-[#ef4444]' : 'text-[#8e95b2]'}>
            失败: <strong>{failedCount}</strong>
          </div>
        </div>

        <div className="mt-2 text-[14px] text-[#4f5d87]">
          总大小: <strong className="text-[#1a1f36]">{formatFileSize(totalSize)}</strong>
        </div>
      </div>

      <div className="space-y-3">
        {queue.map((item) => (
          <div
            key={item.index}
            className={`rounded-[14px] border px-4 py-3 transition ${
              item.status === 'transferring'
                ? 'border-[#bfd6ff] bg-[#f5f9ff]'
                : item.status === 'completed'
                  ? 'border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.05)]'
                  : item.status === 'failed'
                    ? 'border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.05)]'
                    : item.status === 'skipped'
                      ? 'border-[#e5e9f1] bg-[#f8fafd] opacity-70'
                      : 'border-[#dfe5ef] bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border ${statusBadgeMap[item.status] ?? statusBadgeMap.pending}`}>
                <TransferStatusIcon status={item.status} className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-[#1a1f36]">
                    {item.metadata.name}
                  </span>
                  {!item.selected && (
                    <span className="rounded-full bg-[#eef2f8] px-2 py-0.5 text-[11px] font-medium text-[#8e95b2]">
                      未选中
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[14px] text-[#5e6687]">
                  <span>{formatFileSize(item.metadata.size)}</span>
                  <span className={statusToneMap[item.status] ?? statusToneMap.pending}>
                    {statusTextMap[item.status] ?? '未知'}
                  </span>
                </div>

                {item.status === 'transferring' && (
                  <div className="mt-3">
                    <div className="h-2 w-full rounded-full bg-[#e8ecf2]">
                      <div
                        className="h-2 rounded-full bg-[#1a6dff] transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[12px] text-[#8e95b2]">{item.progress.toFixed(1)}%</div>
                  </div>
                )}

                {item.status === 'failed' && item.error && (
                  <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#ef4444]">
                    <XCircleIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.error}</span>
                  </div>
                )}
              </div>

              {isSender && onRemove && (item.status === 'pending' || item.status === 'failed') && (
                <button
                  onClick={() => onRemove(item.index)}
                  className="rounded-[10px] p-2 text-[#ef4444] transition hover:bg-[rgba(239,68,68,0.08)] hover:text-[#dc2626]"
                  title="移除此文件"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {queue.length > 0 && (
        <div className="flex items-center gap-2 text-[12px] text-[#8e95b2]">
          <InfoIcon className="h-4 w-4 shrink-0 text-[#8e95b2]" />
          <span>
            提示: 这是传输的文件{!isSender ? '，完成后点击下载' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

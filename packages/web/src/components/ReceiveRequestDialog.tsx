/**
 * 接收文件请求对话框
 * 单文件传输时的接收确认
 */

import {
  DeviceKindIcon,
  FileTypeIcon,
  InfoIcon,
  LockIcon,
  ShieldLockIcon,
  getDisplayDeviceName,
} from './FileTransferIcons';

interface ReceiveRequestDialogProps {
  senderName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  passwordProtected: boolean;
  encrypted?: boolean;
  encryptionMethod?: string;
  onAccept: () => void;
  onReject: () => void;
  onRejectAndBlock?: (durationMs: number) => void;
}

function formatFileSize(bytes: number) {
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k)),
  );

  return `${(bytes / Math.pow(k, index)).toFixed(index === 0 ? 0 : 2)} ${sizes[index]}`;
}

export function ReceiveRequestDialog({
  senderName,
  fileName,
  fileSize,
  fileType,
  passwordProtected,
  encrypted,
  encryptionMethod,
  onAccept,
  onReject,
  onRejectAndBlock,
}: ReceiveRequestDialogProps) {
  const displaySenderName = getDisplayDeviceName(senderName);
  const fileTypeLabel = fileType ? fileType.split('/')[0] : '未知类型';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.24)] px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[460px] rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.18)] animate-scale-in">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[#e7edfb] bg-[linear-gradient(180deg,#fbfcff_0%,#f5f8ff_100%)] p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-[#202544] text-white shadow-[0_10px_24px_rgba(32,37,68,0.22)]">
                <DeviceKindIcon deviceName={senderName} className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7e89ad]">
                  收到文件传输请求
                </div>
                <div className="mt-1 text-[18px] font-semibold leading-[1.3] text-[#1a1f36] sm:text-[20px]">
                  {displaySenderName}
                  <span className="ml-1 text-[18px] font-semibold text-[#1a1f36] sm:text-[20px]">
                    请求发送文件
                  </span>
                </div>
                <div className="mt-2 text-[12px] text-[#7e89ad] sm:text-[13px]">
                  来自同一局域网的设备
                </div>
                {(passwordProtected || encrypted) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {passwordProtected && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffe1a8] bg-[#fff7e3] px-3 py-1 text-[12px] font-medium text-[#b7791f]">
                        <LockIcon className="h-3.5 w-3.5" />
                        需要密码
                      </span>
                    )}
                    {encrypted && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8e4ff] bg-[#eef4ff] px-3 py-1 text-[12px] font-medium text-[#3867d6]">
                        <ShieldLockIcon className="h-3.5 w-3.5" />
                        {encryptionMethod ? `已加密 · ${encryptionMethod}` : '已加密'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#e6ebf5] bg-[#f8fafd] p-4">
            <div className="flex items-center gap-3 rounded-[16px] border border-[#ebeff7] bg-white px-4 py-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-[#e3e8f3] bg-[#f8fafd] text-[#6a7598]">
                <FileTypeIcon type={fileType} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-[#1a1f36]" title={fileName}>
                  {fileName}
                </div>
                <div className="mt-1 text-[12px] text-[#7e89ad]">{fileTypeLabel}</div>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-[16px] border border-[#e6ebf5] bg-white">
              <div className="grid grid-cols-2 divide-x divide-[#e2e8f3]">
                <div className="px-4 py-4 text-center">
                  <div className="text-[24px] font-semibold leading-none text-[#1a1f36]">1</div>
                  <div className="mt-1 text-[12px] text-[#7e89ad]">文件数</div>
                </div>
                <div className="px-4 py-4 text-center">
                  <div className="text-[24px] font-semibold leading-none text-[#1a1f36]">{formatFileSize(fileSize)}</div>
                  <div className="mt-1 text-[12px] text-[#7e89ad]">文件大小</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-[#e6ebf5] bg-[#fbfcff] px-4 py-3">
            <div className="flex items-start gap-2 text-[13px] text-[#66708f]">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#6f93ff]" />
              <span>接受后，将立即开始接收这个文件。</span>
            </div>
          </div>

          <button
            onClick={onAccept}
            className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#3578ff_0%,#2b66e8_100%)] px-5 py-4 text-[16px] font-semibold text-white shadow-[0_16px_32px_rgba(53,120,255,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_36px_rgba(53,120,255,0.32)]"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m4.75 10.5 3.25 3.25 7.25-7.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            接受
          </button>

          <div className={`grid gap-3 ${onRejectAndBlock ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <button
              onClick={onReject}
              className="rounded-[14px] border border-[#dbe3f0] bg-white px-4 py-3 text-[14px] font-semibold text-[#4f5d87] transition hover:border-[#c9d4e7] hover:bg-[#f8fafd]"
            >
              拒绝此次
            </button>
            {onRejectAndBlock && (
              <>
                <button
                  onClick={() => onRejectAndBlock(10 * 60 * 1000)}
                  className="rounded-[14px] border border-[#dbe3f0] bg-white px-4 py-3 text-[14px] font-semibold text-[#4f5d87] transition hover:border-[#c9d4e7] hover:bg-[#f8fafd]"
                >
                  屏蔽 10 分钟
                </button>
                <button
                  onClick={() => onRejectAndBlock(60 * 60 * 1000)}
                  className="rounded-[14px] border border-[#dbe3f0] bg-white px-4 py-3 text-[14px] font-semibold text-[#4f5d87] transition hover:border-[#c9d4e7] hover:bg-[#f8fafd]"
                >
                  屏蔽 1 小时
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.22s ease-out;
        }
      `}</style>
    </div>
  );
}

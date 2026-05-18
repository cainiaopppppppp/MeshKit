import { useEffect, useRef, useState } from 'react';
import { ShareQrCode } from './ShareQrCode';

interface ShareLinkDialogProps {
  open: boolean;
  shareUrl: string;
  title: string;
  description?: string;
  qrTitle?: string;
  qrCaption?: string;
  copyLabel?: string;
  downloadQrLabel?: string;
  closeLabel?: string;
  shareLabel?: string;
  downloadQrFileName?: string;
  isSystemShareSupported?: boolean;
  isSystemSharing?: boolean;
  onClose: () => void;
  onCopyLink: () => boolean | void | Promise<boolean | void>;
  onSystemShare?: () => void | Promise<void>;
}

export function ShareLinkDialog({
  open,
  shareUrl,
  title,
  description,
  qrTitle = '扫码打开',
  qrCaption,
  copyLabel = '复制链接',
  downloadQrLabel = '下载二维码',
  closeLabel = '关闭',
  shareLabel = '系统分享',
  downloadQrFileName = 'meshkit-share-qr.png',
  isSystemShareSupported = false,
  isSystemSharing = false,
  onClose,
  onCopyLink,
  onSystemShare,
}: ShareLinkDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
      setQrDataUrl('');
      setIsCopyingLink(false);
      setCopySuccess(false);
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleDownloadQr = () => {
    if (!qrDataUrl) {
      return;
    }

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = downloadQrFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = async () => {
    setIsCopyingLink(true);

    try {
      const copied = await onCopyLink();
      if (copied === false) {
        return;
      }

      setCopySuccess(true);
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopySuccess(false);
        copyResetTimerRef.current = null;
      }, 1800);
    } finally {
      setIsCopyingLink(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-[rgba(15,23,42,0.54)] p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[760px] rounded-[32px] border border-[rgba(255,255,255,0.72)] bg-[linear-gradient(180deg,_rgba(248,251,255,0.98)_0%,_rgba(255,255,255,0.98)_100%)] p-5 shadow-[0_28px_100px_rgba(15,23,42,0.24)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 rounded-[24px] border border-[#dbe7ff] bg-[linear-gradient(135deg,_#eff5ff_0%,_#f8fbff_55%,_#ffffff_100%)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a6dff]">
              {'分享中心'}
            </div>
            <h2 className="mt-2 text-[24px] font-bold tracking-tight text-[#1a1f36]">{title}</h2>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-[#42507a]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#cfe0ff] bg-white text-[#4f5d87] shadow-[0_10px_24px_rgba(26,109,255,0.08)] transition hover:border-[#8fb3ff] hover:text-[#1a1f36]"
            aria-label={closeLabel}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_292px]">
          <div className="rounded-[24px] border border-[#dbe4f2] bg-[linear-gradient(180deg,_#f5f8ff_0%,_#ffffff_100%)] p-4 sm:p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#0f62fe]">
              {'分享链接'}
            </div>
            <div className="mt-3 rounded-[18px] border border-[#d7e2f6] bg-white px-4 py-3 font-mono text-[12px] leading-7 text-[#42507a] break-all shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              {shareUrl}
            </div>
            <div className="mt-4 rounded-[16px] border border-[#e6edf8] bg-white/80 px-4 py-3 text-[12px] leading-6 text-[#5e6687]">
              {'可以直接发给其他设备，也可以让对方直接扫码打开。'}
            </div>
          </div>

          <ShareQrCode
            text={shareUrl}
            title={qrTitle}
            caption={qrCaption}
            onDataUrlChange={setQrDataUrl}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#e7eef9] pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="text-[12px] leading-6 text-[#5e6687]">
            {'优先推荐扫码，手机体验会更顺手。'}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              disabled={isCopyingLink}
              className={`rounded-[14px] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(26,109,255,0.24)] transition ${
                copySuccess
                  ? 'bg-[linear-gradient(135deg,_#16a34a_0%,_#15803d_100%)] shadow-[0_10px_24px_rgba(22,163,74,0.24)]'
                  : 'bg-[linear-gradient(135deg,_#2f73ff_0%,_#1a5fe9_100%)] hover:brightness-105'
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {isCopyingLink ? '复制中...' : copySuccess ? '已复制' : copyLabel}
            </button>
            <button
              type="button"
              onClick={handleDownloadQr}
              disabled={!qrDataUrl}
              className="rounded-[14px] border border-[#cfe0ff] bg-[#eef4ff] px-4 py-2.5 text-[13px] font-semibold text-[#1a5fe9] transition hover:bg-[#e6efff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadQrLabel}
            </button>
            {isSystemShareSupported && onSystemShare ? (
              <button
                type="button"
                onClick={() => void onSystemShare()}
                disabled={isSystemSharing}
                className="rounded-[14px] border border-[#d7deeb] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#4f5d87] transition hover:border-[#1a6dff] hover:text-[#1a6dff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSystemSharing ? '分享中...' : shareLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

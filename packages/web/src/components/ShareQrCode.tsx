import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface ShareQrCodeProps {
  text: string;
  title?: string;
  caption?: string;
  compact?: boolean;
  onDataUrlChange?: (dataUrl: string) => void;
}

export function ShareQrCode({
  text,
  title = '扫码加入',
  caption,
  compact = false,
  onDataUrlChange,
}: ShareQrCodeProps) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!text) {
      setDataUrl('');
      onDataUrlChange?.('');
      return undefined;
    }

    void QRCode.toDataURL(text, {
      margin: 1,
      width: 240,
      color: {
        dark: '#1a1f36',
        light: '#ffffff',
      },
    }).then((result: string) => {
      if (!cancelled) {
        setDataUrl(result);
        onDataUrlChange?.(result);
      }
    }).catch((error: unknown) => {
      console.error('[WebShareQrCode] Failed to generate QR code:', error);
      if (!cancelled) {
        setDataUrl('');
        onDataUrlChange?.('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [text, onDataUrlChange]);

  return (
    <div className={compact ? '' : 'rounded-[24px] border border-[#dbe4f2] bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-5 shadow-[0_8px_28px_rgba(26,31,54,0.06)]'}>
      {!compact ? (
        <div className="mb-4">
          <h3 className="text-[14px] font-semibold text-[#1a1f36]">{title}</h3>
          {caption ? (
            <p className="mt-1 text-[12px] leading-6 text-[#5e6687]">{caption}</p>
          ) : null}
        </div>
      ) : null}

      <div className={`flex items-center justify-center rounded-[18px] border ${compact ? 'border-[#f0f3f8] bg-[#f8fafd] p-3' : 'border-dashed border-[#dbe4f2] bg-[#f5f8ff] p-4'}`}>
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={title}
            className={compact ? 'h-40 w-40 rounded-[10px] bg-white p-2 shadow-[0_1px_3px_rgba(26,31,54,0.04)]' : 'h-56 w-56 rounded-[16px] bg-white p-3 shadow-[0_8px_24px_rgba(26,31,54,0.08)]'}
          />
        ) : (
          <div className="max-w-xs text-center text-[12px] leading-6 text-[#5e6687]">
            {'当前还没有可分享的链接，生成或导入邀请链接后，这里会自动显示二维码。'}
          </div>
        )}
      </div>
    </div>
  );
}

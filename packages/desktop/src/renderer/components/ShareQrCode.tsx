import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface ShareQrCodeProps {
  text: string;
  title?: string;
  caption?: string;
}

export function ShareQrCode({ text, title = '扫码加入', caption }: ShareQrCodeProps) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!text) {
      setDataUrl('');
      return undefined;
    }

    void QRCode.toDataURL(text, {
      margin: 1,
      width: 240,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    }).then((result: string) => {
      if (!cancelled) {
        setDataUrl(result);
      }
    }).catch((error: unknown) => {
      console.error('[ShareQrCode] Failed to generate QR code:', error);
      if (!cancelled) {
        setDataUrl('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-950">{title}</h3>
        {caption && (
          <p className="mt-1 text-sm leading-6 text-slate-600">{caption}</p>
        )}
      </div>

      <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Share QR code"
            className="h-60 w-60 rounded-2xl bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
          />
        ) : (
          <div className="max-w-xs text-center text-sm leading-6 text-slate-500">
            当前还没有可分享的邀请链接。开启共享后，这里会自动生成二维码。
          </div>
        )}
      </div>
    </div>
  );
}

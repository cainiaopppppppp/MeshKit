import { useEffect, useMemo, useState } from 'react';
import {
  autoConfigureSignaling,
  loadSignalingConfigDraft,
  resetSignalingConfigDraft,
  saveSignalingConfigDraft,
  type SignalingConfigDraft,
} from '../utils/signalingConfig';

type NoticeTone = 'success' | 'warning' | 'info';

interface NoticeState {
  tone: NoticeTone;
  message: string;
}

function getNoticeClasses(tone: NoticeTone): string {
  switch (tone) {
    case 'success':
      return 'border-green-200 bg-green-50 text-green-800';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    default:
      return 'border-blue-200 bg-blue-50 text-blue-800';
  }
}

export function SettingsPage() {
  const [form, setForm] = useState<SignalingConfigDraft>({
    host: 'localhost',
    wsPort: '7000',
    peerPort: '8000',
  });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);

  useEffect(() => {
    setForm(loadSignalingConfigDraft());
  }, []);

  const preview = useMemo(() => {
    const host = form.host.trim() || 'localhost';
    const wsPort = form.wsPort.trim() || '7000';
    const peerPort = form.peerPort.trim() || '8000';

    return {
      wsUrl: `ws://${host}:${wsPort}/ws`,
      peerUrl: `http://${host}:${peerPort}/peerjs`,
    };
  }, [form.host, form.wsPort, form.peerPort]);

  const updateField = (field: keyof SignalingConfigDraft, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const saved = saveSignalingConfigDraft(form);
    setForm({
      host: saved.host,
      wsPort: String(saved.wsPort),
      peerPort: String(saved.peerPort),
    });
    setNotice({
      tone: 'success',
      message: `配置已保存为 ${saved.host}。刷新页面后会使用新的信令地址。`,
    });
  };

  const handleReset = () => {
    const resetDraft = resetSignalingConfigDraft();
    setForm(resetDraft);
    setNotice({
      tone: 'info',
      message: '已恢复默认配置。网页版会优先使用当前访问地址，本机测试时仍可直接用 localhost。',
    });
  };

  const handleAutoConfigure = async () => {
    setIsAutoConfiguring(true);
    setNotice({
      tone: 'info',
      message: '正在自动探测可用的信令服务器，请稍候...',
    });

    try {
      const result = await autoConfigureSignaling(form);
      const nextDraft = {
        host: result.config.host,
        wsPort: String(result.config.wsPort),
        peerPort: String(result.config.peerPort),
      };

      setForm(nextDraft);

      if (result.verified) {
        saveSignalingConfigDraft(nextDraft);
        setNotice({
          tone: 'success',
          message: `已自动配置并保存为 ${result.config.host}。刷新页面后即可直接使用。`,
        });
      } else {
        setNotice({
          tone: 'warning',
          message: `暂时没有探测到可用信令服务，已先填入最可能的地址 ${result.config.host}。请确认服务器已启动后再点击保存。`,
        });
      }
    } catch (error) {
      console.error('[SettingsPage] Auto configure failed:', error);
      setNotice({
        tone: 'warning',
        message: '自动配置失败。你仍然可以手动填写服务器地址和端口。',
      });
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h1 className="mb-6 text-2xl font-bold text-gray-800">信令服务器配置</h1>

        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-blue-900">使用说明</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-blue-800">
            <li>网页版会优先尝试当前网页地址，例如 `192.168.x.x:3000` 里的那台服务器地址。</li>
            <li>只有当前网页地址不可用时，才会回退到浏览器可识别到的本机地址或 localhost。</li>
            <li>点击“一键自动配置”后，系统会尝试探测当前能连通的信令服务器。</li>
            <li>如果你要让多台设备协作，信令服务器需要先在其中一台设备上启动。</li>
          </ul>
        </div>

        {notice && (
          <div className={`mb-6 rounded-lg border p-4 text-sm ${getNoticeClasses(notice.tone)}`}>
            {notice.message}
          </div>
        )}

        <div className="mb-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              服务器地址
            </label>
            <input
              type="text"
              value={form.host}
              onChange={(e) => updateField('host', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              placeholder="localhost 或 IP 地址，如 192.168.1.100"
            />
            <p className="mt-1 text-xs text-gray-500">
              运行信令服务器的电脑的 IP 地址或域名
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              WebSocket 端口
            </label>
            <input
              type="number"
              value={form.wsPort}
              onChange={(e) => updateField('wsPort', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              placeholder="7000"
            />
            <p className="mt-1 text-xs text-gray-500">
              信令服务器的 WebSocket 端口，默认是 7000
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              PeerJS 端口
            </label>
            <input
              type="number"
              value={form.peerPort}
              onChange={(e) => updateField('peerPort', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              placeholder="8000"
            />
            <p className="mt-1 text-xs text-gray-500">
              PeerJS 信令端口，默认是 8000
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">当前配置预览</h3>
          <div className="space-y-1 font-mono text-sm text-gray-600">
            <div>WebSocket: {preview.wsUrl}</div>
            <div>PeerJS: {preview.peerUrl}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleAutoConfigure}
            disabled={isAutoConfiguring}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAutoConfiguring ? '正在自动配置...' : '一键自动配置'}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-600"
          >
            保存配置
          </button>
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg bg-gray-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-gray-600"
          >
            重置为默认
          </button>
        </div>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">局域网部署步骤</h2>
          <ol className="list-inside list-decimal space-y-2 text-sm text-amber-800">
            <li>在一台电脑上启动信令服务器：<code className="rounded bg-amber-100 px-1">pnpm dev:signaling</code></li>
            <li>让其他设备通过这台电脑的局域网地址打开网页，或在设置页里自动配置。</li>
            <li>如果自动配置没有命中，再手动填入服务器 IP 并保存。</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

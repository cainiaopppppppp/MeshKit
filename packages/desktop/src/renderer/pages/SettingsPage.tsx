import { useEffect, useMemo, useState } from 'react';
import {
  autoConfigureSignaling,
  getDesktopShareableWebUrl,
  loadSignalingConfigDraft,
  resetSignalingConfigDraft,
  saveSignalingConfigDraft,
  type SignalingConfigDraft,
} from '@meshkit/web/utils/signalingConfig';
import { DesktopComputerIcon, MobilePhoneIcon } from '@meshkit/web/components/FileTransferIcons';

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

async function copyTextWithFallback(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('[DesktopSettingsPage] navigator.clipboard failed, trying fallback copy:', error);
    }
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', 'true');
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '-9999px';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  let copied = false;

  try {
    copied = document.execCommand('copy');
  } catch (error) {
    console.warn('[DesktopSettingsPage] document.execCommand copy failed:', error);
  }

  document.body.removeChild(textArea);

  if (selection) {
    selection.removeAllRanges();
    if (previousRange) {
      selection.addRange(previousRange);
    }
  }

  return copied;
}

export function SettingsPage() {
  const [form, setForm] = useState<SignalingConfigDraft>({
    host: 'localhost',
    wsPort: '7000',
    peerPort: '8000',
  });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [isCopyingInvite, setIsCopyingInvite] = useState(false);
  const [shareUrlPreview, setShareUrlPreview] = useState('');

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
      message: `配置已保存为 ${saved.host}。之后会使用这组信令地址。`,
    });
  };

  const handleReset = () => {
    const resetDraft = resetSignalingConfigDraft();
    setForm(resetDraft);
    setShareUrlPreview('');
    setNotice({
      tone: 'info',
      message: '已经恢复默认配置。本机测试可继续使用 localhost。',
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
          message: `已自动配置并保存为 ${result.config.host}。`,
        });
      } else {
        setNotice({
          tone: 'warning',
          message: `暂时没有探测到可用服务，先帮你填入了最可能的地址 ${result.config.host}。确认信令服务启动后再保存即可。`,
        });
      }
    } catch (error) {
      console.error('[DesktopSettingsPage] Auto configure failed:', error);
      setNotice({
        tone: 'warning',
        message: '自动配置失败。你仍然可以手动输入服务器地址并保存。',
      });
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  const handleCopyInviteLink = async () => {
    setIsCopyingInvite(true);

    try {
      const result = await getDesktopShareableWebUrl(form);
      setShareUrlPreview(result.url);

      const copied = await copyTextWithFallback(result.url);
      if (!copied) {
        window.prompt('复制失败，请手动复制下面的邀请链接：', result.url);
      }

      setNotice({
        tone: copied ? 'success' : 'info',
        message: copied
          ? `邀请链接已复制。对方打开后会自动写入 ${result.signalHost}。`
          : `邀请链接已生成。对方打开后会自动写入 ${result.signalHost}，你可以手动复制后发给对方。`,
      });
    } catch (error) {
      console.error('[DesktopSettingsPage] Failed to create invite link:', error);
      setNotice({
        tone: 'warning',
        message: '生成邀请链接失败。请先确认本机局域网地址可用，再重试。',
      });
    } finally {
      setIsCopyingInvite(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">应用设置</h1>
          <p className="text-gray-600">配置桌面端要连接的信令服务，并生成可发给手机或浏览器用户的邀请链接</p>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-xl font-bold text-gray-900">信令服务器配置</h2>

          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">推荐顺序</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-blue-800">
              <li>先在一台电脑上运行 <code className="rounded bg-blue-100 px-1">pnpm dev:signaling</code></li>
              <li>点击“一键自动配置”，应用会优先尝试 WLAN 或以太网地址，尽量避开 VMware / Hyper-V 等虚拟网卡</li>
              <li>需要分享给手机浏览器时，再点击“复制邀请链接”</li>
            </ol>
          </div>

          {notice && (
            <div className={`mb-6 rounded-xl border p-4 text-sm ${getNoticeClasses(notice.tone)}`}>
              {notice.message}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                服务器地址
              </label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => updateField('host', e.target.value)}
                placeholder="例如 192.168.1.100 或 localhost"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-lg text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                如果这台桌面端本身就在运行信令服务，分享给其他设备时会自动把 localhost 换成本机局域网 IP。
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                WebSocket 端口
              </label>
              <input
                type="number"
                value={form.wsPort}
                onChange={(e) => updateField('wsPort', e.target.value)}
                placeholder="7000"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-lg text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                PeerJS 端口
              </label>
              <input
                type="number"
                value={form.peerPort}
                onChange={(e) => updateField('peerPort', e.target.value)}
                placeholder="8000"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-lg text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-sm font-semibold text-gray-700">配置预览</p>
              <div className="space-y-1 font-mono text-sm text-gray-600">
                <div>WebSocket: {preview.wsUrl}</div>
                <div>PeerJS: {preview.peerUrl}</div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-2 text-sm font-semibold text-emerald-900">浏览器邀请链接</p>
              <p className="text-sm text-emerald-800">
                这个链接默认会指向本机 <code className="rounded bg-emerald-100 px-1">3000</code> 端口的网页，并把当前信令地址一并带上。对方打开后会自动完成配置。
              </p>
              <p className="mt-2 text-xs text-emerald-700">
                使用前请先在这台电脑上启动网页版本，例如运行 <code className="rounded bg-emerald-100 px-1">pnpm dev:web</code>。
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white/80 px-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <DesktopComputerIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-950">电脑</div>
                    <div className="text-xs text-emerald-700">运行 Web 页面并复制邀请链接</div>
                  </div>
                </div>

                <div className="hidden text-center text-emerald-300 sm:block">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14m-4-4 4 4-4 4" />
                  </svg>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white/80 px-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                    <MobilePhoneIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-950">手机</div>
                    <div className="text-xs text-emerald-700">打开链接后自动写入信令 IP</div>
                  </div>
                </div>
              </div>

              {shareUrlPreview && (
                <div className="mt-4 break-all rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-emerald-900">
                  {shareUrlPreview}
                </div>
              )}

              <button
                onClick={handleCopyInviteLink}
                disabled={isCopyingInvite}
                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCopyingInvite ? '正在生成邀请链接...' : '复制邀请链接'}
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleAutoConfigure}
                disabled={isAutoConfiguring}
                className="flex-1 rounded-lg bg-sky-500 px-6 py-3 font-semibold text-white transition-all hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAutoConfiguring ? '正在自动配置...' : '一键自动配置'}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 font-semibold text-white transition-all hover:shadow-lg"
              >
                保存配置
              </button>
              <button
                onClick={handleReset}
                className="flex-1 rounded-lg border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50"
              >
                重置
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <h3 className="mb-2 font-bold">补充说明</h3>
          <p className="mb-1">桌面端本身不会变成一个能给手机直接打开的网页，所以分享给手机时，实际发出去的是浏览器页面链接。</p>
          <p>这就是为什么复制邀请链接前，需要先让这台电脑上的 Web 页面也能被访问。</p>
        </div>
      </div>
    </div>
  );
}

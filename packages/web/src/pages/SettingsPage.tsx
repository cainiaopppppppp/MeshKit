import { useEffect, useMemo, useState } from 'react';

import {
  autoConfigureSignaling,
  getShareableWebUrlForDraft,
  loadSignalingConfigDraft,
  parseSharedSignalingConfigFromUrl,
  resetSignalingConfigDraft,
  saveSignalingConfigDraft,
  type SignalingConfigDraft,
} from '../utils/signalingConfig';
import { DesktopComputerIcon, MobilePhoneIcon } from '../components/FileTransferIcons';
import { ShareQrCode } from '../components/ShareQrCode';

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
      return 'border-amber-200 bg-amber-50 text-amber-900';
    default:
      return 'border-sky-200 bg-sky-50 text-sky-800';
  }
}

async function copyTextWithFallback(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('[WebSettingsPage] navigator.clipboard failed, trying fallback copy:', error);
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
    console.warn('[WebSettingsPage] document.execCommand copy failed:', error);
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
  const [shareUrlPreview, setShareUrlPreview] = useState('');
  const [inviteLinkInput, setInviteLinkInput] = useState('');
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [isCopyingInvite, setIsCopyingInvite] = useState(false);

  useEffect(() => {
    setForm(loadSignalingConfigDraft());
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getShareableWebUrlForDraft(form, '/')
      .then((result) => {
        if (!cancelled) {
          setShareUrlPreview(result.url);
        }
      })
      .catch((error) => {
        console.error('[WebSettingsPage] Failed to build share URL preview:', error);
        if (!cancelled) {
          setShareUrlPreview('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form.host, form.wsPort, form.peerPort]);

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
      message: `已保存连接配置：${saved.host}:${saved.wsPort}/${saved.peerPort}`,
    });
  };

  const handleReset = () => {
    const resetDraft = resetSignalingConfigDraft();
    setForm(resetDraft);
    setInviteLinkInput('');
    setNotice({
      tone: 'info',
      message: '已恢复默认配置。网页端会优先使用当前访问地址，或你分享出去的邀请链接参数。',
    });
  };

  const handleAutoConfigure = async () => {
    setIsAutoConfiguring(true);
    setNotice({
      tone: 'info',
      message: '正在自动探测可用的连接地址...',
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
          message: `自动配置成功，已切换到 ${result.config.host}。`,
        });
      } else {
        setNotice({
          tone: 'warning',
          message: `暂时没探测到在线服务，先为你填入了最可能的地址 ${result.config.host}。确认对方设备已经开启共享后，再保存即可。`,
        });
      }
    } catch (error) {
      console.error('[WebSettingsPage] Auto configure failed:', error);
      setNotice({
        tone: 'warning',
        message: '自动配置失败，你仍然可以手动输入地址，或直接打开别人发来的邀请链接。',
      });
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  const handleCopyInviteLink = async () => {
    setIsCopyingInvite(true);

    try {
      const result = await getShareableWebUrlForDraft(form, '/');
      setShareUrlPreview(result.url);

      const copied = await copyTextWithFallback(result.url);
      setNotice({
        tone: copied ? 'success' : 'info',
        message: copied
          ? `邀请链接已复制。对方打开后会自动写入 ${form.host.trim() || 'localhost'}。`
          : '邀请链接已生成，但浏览器没给剪贴板权限。你可以手动复制下方的当前共享地址。',
      });

      if (!copied) {
        window.prompt('请手动复制这个邀请链接：', result.url);
      }
    } catch (error) {
      console.error('[WebSettingsPage] Failed to build invite link:', error);
      setNotice({
        tone: 'warning',
        message: '生成邀请链接失败，请刷新页面后重试。',
      });
    } finally {
      setIsCopyingInvite(false);
    }
  };

  const handleImportInviteLink = () => {
    const parsed = parseSharedSignalingConfigFromUrl(inviteLinkInput);
    if (!parsed) {
      setNotice({
        tone: 'warning',
        message: '这个链接里没有识别到有效的共享参数，请检查后再试。',
      });
      return;
    }

    const nextDraft = {
      host: parsed.host,
      wsPort: String(parsed.wsPort),
      peerPort: String(parsed.peerPort),
    };

    saveSignalingConfigDraft(nextDraft);
    setForm(nextDraft);
    setNotice({
      tone: 'success',
      message: `已导入邀请链接，当前将连接到 ${parsed.host}。`,
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_36%),linear-gradient(180deg,_#f7fbff_0%,_#eef5ff_46%,_#f8fafc_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.28em] text-sky-600">
                MeshKit Share Hub
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">共享中心</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                网页版本本身就是分享页。你只需要打开正确的网页地址，然后把邀请链接发出去，或者直接让对方扫码进入。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopyInviteLink}
                disabled={isCopyingInvite}
                className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCopyingInvite ? '正在复制...' : '复制邀请链接'}
              </button>
              <button
                onClick={handleAutoConfigure}
                disabled={isAutoConfiguring}
                className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAutoConfiguring ? '正在自动配置...' : '一键自动配置'}
              </button>
            </div>
          </div>
        </section>

        {notice && (
          <div className={`rounded-2xl border px-5 py-4 text-sm ${getNoticeClasses(notice.tone)}`}>
            {notice.message}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">当前共享地址</h2>
                <p className="mt-1 text-sm text-slate-600">
                  这是最适合分享给手机和其他浏览器的地址。打开后会自动写入当前连接参数。
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Web Share
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Share URL</div>
                <div className="mt-2 break-all rounded-2xl bg-white px-4 py-4 font-mono text-xs text-slate-800">
                  {shareUrlPreview || '正在生成邀请链接...'}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">WebSocket</div>
                  <div className="mt-2 font-mono text-xs text-emerald-900">{preview.wsUrl}</div>
                </div>

                <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">PeerJS</div>
                  <div className="mt-2 font-mono text-xs text-sky-900">{preview.peerUrl}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
                    <DesktopComputerIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-950">分享端</div>
                    <div className="text-sm text-slate-600">打开当前网页，再复制邀请链接</div>
                  </div>
                </div>

                <div className="hidden justify-center text-slate-300 md:flex">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14m-4-4 4 4-4 4" />
                  </svg>
                </div>

                <div className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                    <MobilePhoneIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-950">加入端</div>
                    <div className="text-sm text-slate-600">打开链接或扫码后，自动完成配置</div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <ShareQrCode
            text={shareUrlPreview}
            title="扫码加入"
            caption="手机直接扫这个二维码，就会打开当前网页并自动写入相同的连接地址。"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[28px] border border-white/70 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-950">导入邀请链接</h2>
              <p className="mt-1 text-sm text-slate-600">
                如果别人已经把邀请链接发给你，你也可以把它粘贴到这里，当前浏览器会自动写入对应的主机和端口。
              </p>
            </div>

            <div className="space-y-3">
              <textarea
                value={inviteLinkInput}
                onChange={(event) => setInviteLinkInput(event.target.value)}
                placeholder="把邀请链接粘贴到这里，例如 http://192.168.x.x:3000/?meshkitHost=..."
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
              />
              <button
                onClick={handleImportInviteLink}
                className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                导入邀请链接
              </button>
            </div>
          </article>

          <article className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-amber-950">浏览器端说明</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-amber-900">
              <p>网页端支持复制邀请链接、扫码加入和导入邀请链接。</p>
              <p>网页端本身不能像桌面端那样做局域网自动发现，所以最稳的方式仍然是直接发链接或二维码。</p>
              <p>如果你当前访问的是 `localhost`，分享前最好确认生成出来的邀请链接已经变成了局域网地址。</p>
            </div>
          </article>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-950">高级连接配置</h2>
            <p className="mt-1 text-sm text-slate-600">
              只有在你需要手动指定服务器地址时才需要改这里。通常直接打开邀请链接就够了。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">服务器地址</label>
              <input
                type="text"
                value={form.host}
                onChange={(event) => updateField('host', event.target.value)}
                placeholder="localhost 或 192.168.x.x"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">WebSocket 端口</label>
              <input
                type="number"
                value={form.wsPort}
                onChange={(event) => updateField('wsPort', event.target.value)}
                placeholder="7000"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">PeerJS 端口</label>
              <input
                type="number"
                value={form.peerPort}
                onChange={(event) => updateField('peerPort', event.target.value)}
                placeholder="8000"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="mb-2 font-semibold text-slate-900">连接预览</div>
            <div className="space-y-1 font-mono text-xs">
              <div>WebSocket: {preview.wsUrl}</div>
              <div>PeerJS: {preview.peerUrl}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleSave}
              className="flex-1 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              保存配置
            </button>
            <button
              onClick={handleReset}
              className="flex-1 rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              重置为默认
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

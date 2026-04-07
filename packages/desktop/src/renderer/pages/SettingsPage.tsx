import { useEffect, useMemo, useState } from 'react';

import {
  autoConfigureSignaling,
  getDesktopShareableWebUrl,
  loadSignalingConfigDraft,
  parseSharedSignalingConfigFromUrl,
  resetSignalingConfigDraft,
  saveSignalingConfigDraft,
  type SignalingConfigDraft,
} from '@meshkit/web/utils/signalingConfig';
import { DesktopComputerIcon, MobilePhoneIcon } from '@meshkit/web/components/FileTransferIcons';

import { ShareQrCode } from '../components/ShareQrCode';

type NoticeTone = 'success' | 'warning' | 'info';
type DesktopServicesStatus = Awaited<ReturnType<Window['electronAPI']['getEmbeddedServiceStatus']>>;

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

function getStatusPillClasses(running: boolean): string {
  return running
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-rose-100 text-rose-700';
}

function formatLastSeen(lastSeenAt: number): string {
  const diffMs = Date.now() - lastSeenAt;
  if (diffMs < 5_000) {
    return '刚刚在线';
  }

  const seconds = Math.max(1, Math.round(diffMs / 1000));
  return `${seconds} 秒前在线`;
}

async function copyTextWithFallback(text: string): Promise<boolean> {
  if (window.electronAPI?.copyText) {
    try {
      return await window.electronAPI.copyText(text);
    } catch (error) {
      console.warn('[DesktopSettingsPage] electron clipboard copy failed, trying browser fallback:', error);
    }
  }

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
  const [serviceStatus, setServiceStatus] = useState<DesktopServicesStatus | null>(null);
  const [shareUrlPreview, setShareUrlPreview] = useState('');
  const [inviteLinkInput, setInviteLinkInput] = useState('');
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [isCopyingInvite, setIsCopyingInvite] = useState(false);
  const [isRefreshingServices, setIsRefreshingServices] = useState(false);
  const [isTogglingSharing, setIsTogglingSharing] = useState(false);
  const isShareReady = !!(
    serviceStatus?.sharingEnabled
    && serviceStatus.signaling.running
    && serviceStatus.shareWeb.running
  );

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

  const refreshServiceStatus = async (silent = false) => {
    if (!window.electronAPI?.getEmbeddedServiceStatus) {
      return;
    }

    if (!silent) {
      setIsRefreshingServices(true);
    }

    try {
      const nextStatus = await window.electronAPI.getEmbeddedServiceStatus();
      setServiceStatus(nextStatus);
    } catch (error) {
      console.error('[DesktopSettingsPage] Failed to load embedded service status:', error);
      if (!silent) {
        setNotice({
          tone: 'warning',
          message: '读取共享状态失败，请稍后重试。',
        });
      }
    } finally {
      if (!silent) {
        setIsRefreshingServices(false);
      }
    }
  };

  useEffect(() => {
    setForm(loadSignalingConfigDraft());
    void refreshServiceStatus(true);

    const timer = window.setInterval(() => {
      void refreshServiceStatus(true);
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isShareReady) {
      setShareUrlPreview('');
      return undefined;
    }

    void getDesktopShareableWebUrl(form, '/', serviceStatus.shareWeb.port)
      .then((result) => {
        if (!cancelled) {
          setShareUrlPreview(result.url);
        }
      })
      .catch((error) => {
        console.error('[DesktopSettingsPage] Failed to build share URL preview:', error);
        if (!cancelled) {
          setShareUrlPreview('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form, isShareReady, serviceStatus?.shareWeb.port]);

  const handleSave = () => {
    const saved = saveSignalingConfigDraft(form);
    const nextDraft = {
      host: saved.host,
      wsPort: String(saved.wsPort),
      peerPort: String(saved.peerPort),
    };

    setForm(nextDraft);
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
      message: '已恢复默认配置。桌面端会优先使用当前电脑的内置共享服务。',
    });
  };

  const handleAutoConfigure = async () => {
    setIsAutoConfiguring(true);
    setNotice({
      tone: 'info',
      message: '正在自动探测可用的共享主机...',
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
          message: `暂时没探测到已在线服务，先为你填入了最可能的地址 ${result.config.host}。确认对方电脑已开启共享后，再保存即可。`,
        });
      }
    } catch (error) {
      console.error('[DesktopSettingsPage] Auto configure failed:', error);
      setNotice({
        tone: 'warning',
        message: '自动配置失败，你仍然可以手动输入地址或使用附近共享列表。',
      });
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!isShareReady) {
      setNotice({
        tone: 'warning',
        message: '共享还没有开启成功，请先点击“开始共享”。',
      });
      return;
    }

    setIsCopyingInvite(true);

    try {
      const result = await getDesktopShareableWebUrl(form, '/', serviceStatus.shareWeb.port);
      setShareUrlPreview(result.url);

      const copied = await copyTextWithFallback(result.url);
      setNotice({
        tone: copied ? 'success' : 'info',
        message: copied
          ? `邀请链接已复制，对方打开后会自动写入 ${result.signalHost}。`
          : '邀请链接已生成，但系统没给剪贴板权限。你可以手动复制下方的当前共享地址。',
      });
    } catch (error) {
      console.error('[DesktopSettingsPage] Failed to build invite link:', error);
      setNotice({
        tone: 'warning',
        message: '生成邀请链接失败，请先确认共享服务已经正常启动。',
      });
    } finally {
      setIsCopyingInvite(false);
    }
  };

  const applySharedLink = (link: string, sourceLabel: string) => {
    const parsed = parseSharedSignalingConfigFromUrl(link);
    if (!parsed) {
      setNotice({
        tone: 'warning',
        message: `${sourceLabel}里没有识别到有效的共享参数。`,
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
      message: `已应用 ${sourceLabel}，当前将连接到 ${parsed.host}。`,
    });
  };

  const handleImportInviteLink = () => {
    applySharedLink(inviteLinkInput, '邀请链接');
  };

  const handleRestartServices = async () => {
    if (!window.electronAPI?.restartEmbeddedServices) {
      return;
    }

    setIsRefreshingServices(true);
    setNotice({
      tone: 'info',
      message: '正在重启共享服务，请稍等...',
    });

    try {
      const nextStatus = await window.electronAPI.restartEmbeddedServices();
      setServiceStatus(nextStatus);
      setNotice({
        tone: nextStatus.signaling.running && nextStatus.shareWeb.running ? 'success' : 'warning',
        message: nextStatus.signaling.running && nextStatus.shareWeb.running
          ? '共享服务已重新启动。'
          : '共享服务已尝试重启，但仍有模块未能启动成功，请查看下方状态。',
      });
    } catch (error) {
      console.error('[DesktopSettingsPage] Failed to restart embedded services:', error);
      setNotice({
        tone: 'warning',
        message: '重启共享服务失败，请稍后再试。',
      });
    } finally {
      setIsRefreshingServices(false);
    }
  };

  const handleToggleSharing = async () => {
    if (!window.electronAPI?.startEmbeddedServices || !window.electronAPI?.stopEmbeddedServices) {
      return;
    }

    setIsTogglingSharing(true);
    setNotice({
      tone: 'info',
      message: serviceStatus?.sharingEnabled ? '正在停止共享...' : '正在开始共享...',
    });

    try {
      const nextStatus = serviceStatus?.sharingEnabled
        ? await window.electronAPI.stopEmbeddedServices()
        : await window.electronAPI.startEmbeddedServices();

      setServiceStatus(nextStatus);
      setNotice({
        tone: nextStatus.sharingEnabled ? 'success' : 'info',
        message: nextStatus.sharingEnabled
          ? '共享已开启，现在可以复制链接或让手机扫码加入。'
          : '共享已停止，当前电脑不会再对外广播或提供分享页面。',
      });
    } catch (error) {
      console.error('[DesktopSettingsPage] Failed to toggle sharing:', error);
      setNotice({
        tone: 'warning',
        message: '切换共享状态失败，请稍后再试。',
      });
    } finally {
      setIsTogglingSharing(false);
    }
  };

  const discoveredShares = serviceStatus?.discovery.discoveredShares || [];

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
                这台电脑现在可以自己托管信令服务、浏览器分享页，并在局域网里自动广播。你只要开始共享，然后把链接发出去，或者让对方直接扫码加入。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleToggleSharing}
                disabled={isTogglingSharing}
                className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTogglingSharing
                  ? (serviceStatus?.sharingEnabled ? '正在停止共享...' : '正在开始共享...')
                  : (serviceStatus?.sharingEnabled ? '停止共享' : '开始共享')}
              </button>
              <button
                onClick={handleCopyInviteLink}
                disabled={isCopyingInvite || !isShareReady}
                className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCopyingInvite ? '正在复制...' : '复制邀请链接'}
              </button>
              <button
                onClick={handleRestartServices}
                disabled={isRefreshingServices}
                className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshingServices ? '正在重启...' : '重启共享服务'}
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
                  这是推荐发给手机和浏览器的地址。打开后会自动写入这台电脑的连接参数。
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClasses(isShareReady)}`}>
                {isShareReady ? '共享中' : '未共享'}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Share URL</div>
                <div className="mt-2 break-all rounded-2xl bg-white px-4 py-4 font-mono text-xs text-slate-800">
                  {shareUrlPreview || '开启共享后，这里会显示可直接分享的邀请链接。'}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Signal Host</div>
                  <div className="mt-2 text-sm font-semibold text-emerald-950">
                    {form.host || serviceStatus?.preferredHost || 'localhost'}
                  </div>
                  <div className="mt-1 font-mono text-xs text-emerald-800">
                    {serviceStatus?.signaling.wsUrl || preview.wsUrl}
                  </div>
                </div>

                <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">LAN Address</div>
                  <div className="mt-2 text-sm font-semibold text-sky-950">
                    {serviceStatus?.preferredHost || '127.0.0.1'}
                  </div>
                  <div className="mt-1 font-mono text-xs text-sky-800">
                    {serviceStatus?.shareWeb.url || '等待分享页启动...'}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
                    <DesktopComputerIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-950">电脑端</div>
                    <div className="text-sm text-slate-600">点击开始共享，再复制邀请链接</div>
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
                    <div className="font-semibold text-slate-950">手机或浏览器</div>
                    <div className="text-sm text-slate-600">扫码或打开链接后，自动完成连接配置</div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <ShareQrCode
            text={shareUrlPreview}
            title="扫码加入"
            caption="手机直接扫这个二维码，就会打开内置分享页并自动写入当前电脑的连接地址。"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[28px] border border-white/70 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">附近共享</h2>
                <p className="mt-1 text-sm text-slate-600">
                  同一局域网里已开启共享的电脑会自动出现在这里。点一下就能把连接地址填入本机。
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClasses(!!serviceStatus?.discovery.running)}`}>
                {serviceStatus?.discovery.running ? '自动发现已开启' : '自动发现未开启'}
              </span>
            </div>

            {discoveredShares.length > 0 ? (
              <div className="space-y-3">
                {discoveredShares.map((share) => (
                  <div key={share.instanceId} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-950">{share.deviceName}</div>
                        <div className="mt-1 font-mono text-xs text-slate-600">
                          {share.shareUrl}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>Host: {share.host}</span>
                          <span>WS: {share.wsPort}</span>
                          <span>Peer: {share.peerPort}</span>
                          <span>{formatLastSeen(share.lastSeenAt)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => applySharedLink(share.shareUrl, `附近共享 ${share.deviceName}`)}
                          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          使用这个地址加入
                        </button>
                        <button
                          onClick={() => {
                            void copyTextWithFallback(share.shareUrl);
                            setNotice({
                              tone: 'success',
                              message: `已复制 ${share.deviceName} 的分享链接。`,
                            });
                          }}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          复制链接
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm leading-7 text-slate-500">
                还没有发现附近共享。确认另一台电脑已经打开 MeshKit 并开启共享后，这里会自动刷新。
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">共享状态</h2>

            <div className="mt-5 space-y-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">内置信令服务</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClasses(!!serviceStatus?.signaling.running)}`}>
                    {serviceStatus?.signaling.running ? '运行中' : '未启动'}
                  </span>
                </div>
                <div className="mt-2 font-mono text-xs text-slate-600">{serviceStatus?.signaling.wsUrl || preview.wsUrl}</div>
                {serviceStatus?.signaling.error && (
                  <div className="mt-2 text-xs text-rose-700">{serviceStatus.signaling.error}</div>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">浏览器分享页</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClasses(!!serviceStatus?.shareWeb.running)}`}>
                    {serviceStatus?.shareWeb.running ? '可访问' : '未启动'}
                  </span>
                </div>
                <div className="mt-2 font-mono text-xs text-slate-600">{serviceStatus?.shareWeb.url || '等待启动'}</div>
                {serviceStatus?.shareWeb.error && (
                  <div className="mt-2 text-xs text-rose-700">{serviceStatus.shareWeb.error}</div>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">局域网自动发现</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClasses(!!serviceStatus?.discovery.running)}`}>
                    {serviceStatus?.discovery.running ? '广播中' : '未启动'}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  本机识别地址：{serviceStatus?.localAddresses.join(' / ') || '读取中...'}
                </div>
                {serviceStatus?.discovery.error && (
                  <div className="mt-2 text-xs text-rose-700">{serviceStatus.discovery.error}</div>
                )}
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[28px] border border-white/70 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-950">导入邀请链接</h2>
              <p className="mt-1 text-sm text-slate-600">
                如果别人直接把邀请网址发给你，你可以粘贴到这里，一键导入连接配置。
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
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleImportInviteLink}
                  className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  导入邀请链接
                </button>
                <button
                  onClick={handleAutoConfigure}
                  disabled={isAutoConfiguring}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAutoConfiguring ? '正在自动探测...' : '一键自动配置'}
                </button>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-white/70 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-950">高级连接配置</h2>
              <p className="mt-1 text-sm text-slate-600">
                仅在你需要手动指定别的服务器时使用。普通情况下，直接共享或导入邀请链接就够了。
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">服务器地址</label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(event) => updateField('host', event.target.value)}
                  placeholder={serviceStatus?.preferredHost || 'localhost'}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="mb-2 font-semibold text-slate-900">连接预览</div>
                <div className="space-y-1 font-mono text-xs">
                  <div>WebSocket: {preview.wsUrl}</div>
                  <div>PeerJS: {preview.peerUrl}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSave}
                  className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  保存配置
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  重置为默认
                </button>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

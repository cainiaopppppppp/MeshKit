import { useEffect, useMemo, useState } from 'react';

import { DesktopComputerIcon, MobilePhoneIcon } from '../components/FileTransferIcons';
import { ShareQrCode } from '../components/ShareQrCode';
import {
  autoConfigureSignaling,
  getShareableWebUrlForDraft,
  loadSignalingConfigDraft,
  parseSharedSignalingConfigFromUrl,
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
      return 'border-[rgba(16,185,129,0.16)] bg-[rgba(16,185,129,0.08)] text-[#047857]';
    case 'warning':
      return 'border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.08)] text-[#b45309]';
    default:
      return 'border-[rgba(26,109,255,0.14)] bg-[#e8f0ff] text-[#1a6dff]';
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
      host,
      wsUrl: `ws://${host}:${wsPort}/ws`,
      peerUrl: `http://${host}:${peerPort}/peerjs`,
      lanUrl: shareUrlPreview || `http://${host}:3000/`,
    };
  }, [form.host, form.wsPort, form.peerPort, shareUrlPreview]);

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
      message: '已恢复默认配置。网页端会优先使用当前访问地址，或者你导入的邀请链接参数。',
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
          message: `暂时没探测到已在线服务，先为你填入了最可能的地址 ${result.config.host}。确认对方设备已开启共享后，再保存即可。`,
        });
      }
    } catch (error) {
      console.error('[WebSettingsPage] Auto configure failed:', error);
      setNotice({
        tone: 'warning',
        message: '自动配置失败，你仍然可以手动输入地址，或者直接打开别人发来的邀请链接。',
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
          ? `邀请链接已复制，对方打开后会自动写入 ${form.host.trim() || 'localhost'}。`
          : '邀请链接已生成，但浏览器没给剪贴板权限。你可以手动复制下方的当前共享地址。',
      });

      if (!copied) {
        window.prompt('请手动复制这条邀请链接：', result.url);
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
    <div className="mx-auto max-w-[480px] px-5 py-6 pb-14 sm:px-4">
      <section className="mb-7">
        <p className="mb-1.5 font-['DM_Sans',_'Noto_Sans_SC',sans-serif] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a6dff]">
          MeshKit Share Hub
        </p>
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#1a1f36]">共享中心</h1>
        <p className="mt-2 text-sm leading-7 text-[#5e6687]">
          管理邀请链接、二维码和连接配置。网页版本本身就是分享页，只要地址正确，对方打开后就能自动写入连接参数。
        </p>
      </section>

      {notice ? (
        <div className={`mb-4 rounded-[10px] border px-4 py-3 text-[13px] ${getNoticeClasses(notice.tone)}`}>
          {notice.message}
        </div>
      ) : null}

      <section className="mb-4 overflow-hidden rounded-[14px] border border-[#e8ecf2] bg-white shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#f0f3f8] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-[#1a1f36]">当前共享地址</h2>
            <p className="mt-1 text-[12px] text-[#8e95b2]">推荐直接发给手机或浏览器，打开后自动写入连接参数。</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyInviteLink}
              disabled={isCopyingInvite}
              className="rounded-[8px] border border-[#e8ecf2] bg-white px-3.5 py-2 text-[12px] font-medium text-[#5e6687] transition hover:border-[#1a6dff] hover:text-[#1a6dff] disabled:opacity-60"
            >
              {isCopyingInvite ? '复制中...' : '复制链接'}
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 rounded-[8px] border border-[#f0f3f8] bg-[#f8fafd] px-3.5 py-3 font-mono text-[11px] leading-5 text-[#5e6687] break-all">
            {shareUrlPreview || '正在生成邀请链接...'}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[12px] font-medium text-[#5e6687]">SIGNAL HOST</div>
              <div className="mt-1 text-[14px] font-semibold text-[#1a1f36]">{preview.host}</div>
              <div className="mt-1 text-[11px] text-[#8e95b2] break-all">{preview.wsUrl}</div>
            </div>
            <div>
              <div className="text-[12px] font-medium text-[#5e6687]">LAN ADDRESS</div>
              <div className="mt-1 text-[14px] font-semibold text-[#1a1f36]">{preview.host}</div>
              <div className="mt-1 text-[11px] text-[#8e95b2] break-all">{preview.lanUrl}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5 text-center shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
          <h2 className="text-[13px] font-semibold text-[#1a1f36]">扫码加入</h2>
          <p className="mt-1 text-[12px] text-[#8e95b2]">手机扫描二维码后自动写入连接地址。</p>
          <div className="mt-4">
            <ShareQrCode text={shareUrlPreview} compact />
          </div>
        </div>

        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
          <h2 className="text-[13px] font-semibold text-[#1a1f36]">共享状态</h2>
          <p className="mt-1 text-[12px] text-[#8e95b2]">网页端本身没有桌面端的内置服务，但会根据当前地址生成可分享入口。</p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-[8px] border border-[#f0f3f8] bg-[#f8fafd] px-3.5 py-3 text-[12px]">
              <span className="font-medium text-[#1a1f36]">分享地址预览</span>
              <span className="rounded-full bg-[#e8f0ff] px-2.5 py-0.5 text-[11px] font-medium text-[#1a6dff]">已生成</span>
            </div>
            <div className="rounded-[8px] border border-[#f0f3f8] bg-[#f8fafd] px-3.5 py-3 text-[12px]">
              <div className="font-medium text-[#1a1f36]">连接预览</div>
              <div className="mt-1 text-[11px] leading-5 text-[#8e95b2] break-all">{preview.wsUrl}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
          <h2 className="text-[13px] font-semibold text-[#1a1f36]">附近共享</h2>
          <p className="mt-1 text-[12px] text-[#8e95b2]">浏览器端没有局域网自动发现，最稳的方式仍然是发邀请链接或二维码。</p>
          <div className="mt-4 rounded-[10px] border border-dashed border-[#e8ecf2] px-4 py-6 text-center">
            <svg className="mx-auto h-7 w-7 text-[#8e95b2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
            </svg>
            <div className="mt-2 text-[12px] font-medium text-[#5e6687]">请直接分享邀请链接</div>
            <div className="mt-1 text-[11px] text-[#8e95b2]">网页端不做自动发现，避免误判局域网地址。</div>
          </div>
        </div>

        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
          <h2 className="text-[13px] font-semibold text-[#1a1f36]">导入邀请链接</h2>
          <p className="mt-1 text-[12px] text-[#8e95b2]">把邀请链接粘贴到这里，一键导入连接配置。</p>
          <textarea
            value={inviteLinkInput}
            onChange={(event) => setInviteLinkInput(event.target.value)}
            placeholder="http://192.168.x.x:3000/?meshkitHost=..."
            rows={4}
            className="mt-4 w-full rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-[12px] text-[#1a1f36] placeholder:text-[#8e95b2] focus:border-[#1a6dff] focus:outline-none"
          />
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleImportInviteLink}
              className="rounded-[8px] bg-[#1a6dff] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#0a4fc9]"
            >
              导入邀请链接
            </button>
            <button
              type="button"
              onClick={handleAutoConfigure}
              disabled={isAutoConfiguring}
              className="rounded-[8px] border border-[#e8ecf2] bg-white px-4 py-2.5 text-[12px] font-medium text-[#5e6687] transition hover:border-[#1a6dff] hover:text-[#1a6dff] disabled:opacity-60"
            >
              {isAutoConfiguring ? '正在自动配置...' : '一键自动配置'}
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-[14px] border border-[#e8ecf2] bg-white p-5 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
        <div className="mb-4">
          <h2 className="text-[13px] font-semibold text-[#1a1f36]">高级连接配置</h2>
          <p className="mt-1 text-[12px] text-[#8e95b2]">仅在你需要手动指定服务器时使用。普通情况下，直接发邀请链接就够了。</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#5e6687]">服务器地址</label>
            <input
              type="text"
              value={form.host}
              onChange={(event) => updateField('host', event.target.value)}
              className="w-full rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-sm text-[#1a1f36] placeholder:text-[#8e95b2] focus:border-[#1a6dff] focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#5e6687]">WebSocket 端口</label>
              <input
                type="number"
                value={form.wsPort}
                onChange={(event) => updateField('wsPort', event.target.value)}
                className="w-full rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-sm text-[#1a1f36] focus:border-[#1a6dff] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#5e6687]">PeerJS 端口</label>
              <input
                type="number"
                value={form.peerPort}
                onChange={(event) => updateField('peerPort', event.target.value)}
                className="w-full rounded-[10px] border border-[#e8ecf2] bg-white px-4 py-3 text-sm text-[#1a1f36] focus:border-[#1a6dff] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-[8px] border border-[#f0f3f8] bg-[#f8fafd] px-3.5 py-3 font-mono text-[11px] leading-6 text-[#8e95b2]">
            <div className="mb-1 font-sans text-[11px] font-semibold text-[#5e6687]">连接预览</div>
            WebSocket: {preview.wsUrl}
            <br />
            PeerJS: {preview.peerUrl}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-[8px] bg-[#1a6dff] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#0a4fc9]"
            >
              保存配置
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-[8px] border border-[#e8ecf2] bg-white px-4 py-2.5 text-[12px] font-medium text-[#5e6687] transition hover:border-[#1a6dff] hover:text-[#1a6dff]"
            >
              重置为默认
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[14px] border border-[rgba(26,109,255,0.1)] bg-[linear-gradient(135deg,#e8f0ff,rgba(26,109,255,0.04))] p-4 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white text-[#1a6dff] shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
              <DesktopComputerIcon className="h-4 w-4" />
            </span>
            <div className="text-[12px] text-[#5e6687]">
              <div className="font-semibold text-[#1a1f36]">分享端</div>
              <div>打开当前网页，复制邀请链接或二维码。</div>
            </div>
          </div>
          <div className="hidden text-[#8e95b2] sm:block">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-4-4 4 4-4 4" />
            </svg>
          </div>
          <div className="flex flex-1 items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white text-[#1a6dff] shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
              <MobilePhoneIcon className="h-4 w-4" />
            </span>
            <div className="text-[12px] text-[#5e6687]">
              <div className="font-semibold text-[#1a1f36]">加入端</div>
              <div>打开链接后会自动写入主机和端口。</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

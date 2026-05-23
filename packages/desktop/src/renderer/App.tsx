import { useEffect, useState, type MouseEvent, type ReactElement } from 'react';
import { HashRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { EncryptedChatPage } from './pages/EncryptedChatPage';
import { FileTransferPage } from './pages/FileTransferPage';
import { HelpPage } from './pages/HelpPage';
import { SettingsPage } from './pages/SettingsPage';
import { StickyNotesPage } from './pages/StickyNotesPage';
import { AppChromeProvider, useAppChrome } from '@meshkit/web/contexts/AppChromeContext';
import { usePickupHostNavigationGuard } from '@meshkit/web/hooks/usePickupHostNavigationGuard';
import { I18nProvider, LanguageToggleButton } from '@meshkit/web/i18n';
import { getDesktopShareableWebUrl, loadSignalingConfigDraft } from '@meshkit/web/utils/signalingConfig';
import meshkitIconUrl from './assets/meshkit-icon.png';

type MainTabTone = 'blue' | 'orange' | 'green';

interface MainTabItem {
  to: string;
  label: string;
  tone: MainTabTone;
  icon: ReactElement;
}

const mainTabs: MainTabItem[] = [
  {
    to: '/',
    label: '文件传输',
    tone: 'blue',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12l7-7 7 7" />
      </svg>
    ),
  },
  {
    to: '/sticky-notes',
    label: '便签墙',
    tone: 'orange',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 12h5" />
      </svg>
    ),
  },
  {
    to: '/encrypted-chat',
    label: '加密聊天',
    tone: 'green',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

function getMainTabClasses(active: boolean, tone: MainTabTone): string {
  const base = 'inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-medium transition-all sm:flex-none sm:gap-1.5 sm:px-3 sm:text-sm';
  if (!active) {
    return `${base} text-slate-500 hover:bg-slate-50 hover:text-slate-900`;
  }

  switch (tone) {
    case 'orange':
      return `${base} bg-amber-500 text-white shadow-[0_2px_8px_rgba(245,158,11,0.3)]`;
    case 'green':
      return `${base} bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]`;
    default:
      return `${base} bg-[#1a6dff] text-white shadow-[0_2px_8px_rgba(26,109,255,0.3)]`;
  }
}

function getActionButtonClasses(active: boolean): string {
  return active
    ? 'flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#1a6dff] bg-[#1a6dff] text-white shadow-[0_2px_8px_rgba(26,109,255,0.3)] transition'
    : 'flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-[#1a6dff] hover:text-slate-900';
}

async function copyTextWithFallback(text: string): Promise<boolean> {
  if (window.electronAPI?.copyText) {
    try {
      return await window.electronAPI.copyText(text);
    } catch (error) {
      console.warn('[DesktopNavigation] electron clipboard copy failed, trying browser fallback:', error);
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('[DesktopNavigation] navigator.clipboard failed, trying fallback copy:', error);
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
    console.warn('[DesktopNavigation] document.execCommand copy failed:', error);
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

function BrandHeader() {
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    if (!window.electronAPI?.getVersion) {
      return;
    }

    window.electronAPI.getVersion().then(setAppVersion).catch((error) => {
      console.warn('[DesktopApp] Failed to read app version:', error);
    });
  }, []);

  return (
    <header className="border-b border-slate-100 bg-white px-4 py-7 text-center">
      <h1 className="inline-flex items-center justify-center gap-2.5 font-['DM_Sans',_'Noto_Sans_SC',sans-serif] text-[22px] font-bold tracking-[-0.03em] text-slate-900">
        <img
          src={meshkitIconUrl}
          alt=""
          className="h-8 w-8 rounded-[9px] object-contain shadow-[0_6px_18px_rgba(26,109,255,0.16)]"
        />
        <span>
          Mesh<span className="text-[#1a6dff]">Kit</span> Desktop
        </span>
        {appVersion ? <span className="ml-2 text-xs font-normal tracking-normal text-slate-400">v{appVersion}</span> : null}
      </h1>
      <div className="mt-1 text-sm text-slate-500">{'P2P 协作工具套件'}</div>
      <a
        href="https://github.com/cainiaopppppppp/MeshKit"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-[#1a6dff]"
      >
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
        </svg>
        GitHub
      </a>
    </header>
  );
}

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isBrandHeaderHidden } = useAppChrome();
  const { guardNavigation } = usePickupHostNavigationGuard(location.pathname);
  const [isCopyingInvite, setIsCopyingInvite] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isShareReady, setIsShareReady] = useState(false);

  const handleProtectedNavigation = (event: MouseEvent<HTMLAnchorElement>, targetPath: string) => {
    if (!guardNavigation(targetPath)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  useEffect(() => {
    if (!window.electronAPI?.getEmbeddedServiceStatus) {
      setIsShareReady(false);
      return;
    }

    let cancelled = false;

    void window.electronAPI.getEmbeddedServiceStatus()
      .then((status) => {
        if (!cancelled) {
          setIsShareReady(!!(status?.shareWeb?.running && status?.shareWeb?.port));
        }
      })
      .catch((error) => {
        console.warn('[DesktopNavigation] Failed to read embedded service status:', error);
        if (!cancelled) {
          setIsShareReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const copyInviteLink = async () => {
    if (!window.electronAPI?.getEmbeddedServiceStatus) {
      alert('当前 desktop 还无法读取共享服务状态。');
      return;
    }

    setIsCopyingInvite(true);

    try {
      const status = await window.electronAPI.getEmbeddedServiceStatus();
      const sharePort = status?.shareWeb?.port;
      const shareRunning = !!(status?.shareWeb?.running && sharePort);

      setIsShareReady(shareRunning);

      if (!shareRunning || !sharePort) {
        navigate('/settings');
        alert('请先在设置页开启共享，然后再复制邀请链接。');
        return;
      }

      const draft = loadSignalingConfigDraft();
      const result = await getDesktopShareableWebUrl(draft, '/', sharePort);
      const copied = await copyTextWithFallback(result.url);

      if (!copied) {
        window.prompt('复制失败，请手动复制这条邀请链接：', result.url);
        return;
      }

      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 2200);
    } catch (error) {
      console.error('[DesktopNavigation] Failed to copy invite link:', error);
      alert('生成邀请链接失败，请先确认共享服务已正常启动。');
    } finally {
      setIsCopyingInvite(false);
    }
  };

  return (
    <>
      {!isBrandHeaderHidden && <BrandHeader />}
      <div className="sticky top-0 z-40 border-b border-slate-100 bg-[rgba(245,247,251,0.85)] backdrop-blur-xl">
        <nav className="mx-auto flex max-w-[480px] flex-wrap items-center justify-center gap-2 px-5 py-2.5 sm:flex-nowrap sm:px-4">
          <div className="order-2 flex w-full justify-center sm:order-1 sm:flex-1">
            <div className="flex w-full rounded-[10px] border border-slate-200 bg-white p-[3px] shadow-[0_1px_3px_rgba(26,31,54,0.04)] sm:w-auto">
              {mainTabs.map((tab) => {
                const active = location.pathname === tab.to;
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    onClick={(event) => handleProtectedNavigation(event, tab.to)}
                    className={getMainTabClasses(active, tab.tone)}
                  >
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="order-1 ml-auto flex items-center gap-1 sm:order-2 sm:ml-0">
            <button
              onClick={copyInviteLink}
              title={isShareReady ? '复制邀请链接' : '前往设置开启共享'}
              disabled={isCopyingInvite}
              className={`inline-flex min-h-[34px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium leading-none transition sm:px-3 ${
                copySuccess
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : isShareReady
                    ? 'border-slate-200 bg-white text-slate-500 hover:border-[#1a6dff] hover:text-slate-900'
                    : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:text-amber-800'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.75 7.75A2.75 2.75 0 0 1 11.5 5h5.75A2.75 2.75 0 0 1 20 7.75v8.5A2.75 2.75 0 0 1 17.25 19h-5.75a2.75 2.75 0 0 1-2.75-2.75v-8.5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.25 5V4.75A2.75 2.75 0 0 0 12.5 2H6.75A2.75 2.75 0 0 0 4 4.75v8.5A2.75 2.75 0 0 0 6.75 16H8" />
              </svg>
              <span className="hidden whitespace-nowrap md:inline">
                {isCopyingInvite
                  ? '复制中...'
                  : copySuccess
                    ? '已复制'
                    : '邀请链接'}
              </span>
            </button>

            <LanguageToggleButton className="flex h-[34px] min-w-[42px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-500 transition hover:border-[#1a6dff] hover:text-slate-900" />

            <Link
              to="/help"
              title={'帮助'}
              onClick={(event) => handleProtectedNavigation(event, '/help')}
              className={getActionButtonClasses(location.pathname === '/help')}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17h.01" />
              </svg>
            </Link>

            <Link
              to="/settings"
              title={'设置'}
              onClick={(event) => handleProtectedNavigation(event, '/settings')}
              className={getActionButtonClasses(location.pathname === '/settings')}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}

function App() {
  return (
    <I18nProvider>
      <AppChromeProvider>
        <HashRouter>
          <div className="flex min-h-screen flex-col bg-[#f5f7fb]">
            <Navigation />
            <div className="flex-1 min-h-0">
              <Routes>
                <Route path="/" element={<FileTransferPage />} />
                <Route path="/sticky-notes" element={<StickyNotesPage />} />
                <Route path="/encrypted-chat" element={<EncryptedChatPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/help" element={<HelpPage />} />
              </Routes>
            </div>
          </div>
        </HashRouter>
      </AppChromeProvider>
    </I18nProvider>
  );
}

export default App;

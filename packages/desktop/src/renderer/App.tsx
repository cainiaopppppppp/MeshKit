import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FileTransferPage } from './pages/FileTransferPage';
import { StickyNotesPage } from './pages/StickyNotesPage';
import { EncryptedChatPage } from './pages/EncryptedChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';

function Navigation() {
  const location = useLocation();
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    // 获取 Electron 应用信息
    if (window.electronAPI) {
      window.electronAPI.getVersion().then(setAppVersion);
    }
  }, []);

  return (
    <nav className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto">
        {/* 第一行：品牌名称 */}
        <div className="text-center mb-2">
          <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-indigo-700 transition-all">
            MeshKit Desktop
          </Link>
          {appVersion && (
            <span className="ml-2 text-xs text-gray-500">v{appVersion}</span>
          )}
        </div>

        {/* 第二行：说明文字 */}
        <div className="text-center mb-2">
          <div className="text-xs sm:text-sm text-gray-600 font-medium">
            P2P 协作工具套件
          </div>
        </div>

        {/* GitHub 链接 */}
        <div className="text-center mb-3">
          <a
            href="https://github.com/cainiaopppppppp/MeshKit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.137 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">GitHub</span>
          </a>
        </div>

        {/* 第三行：导航标签（居中） */}
        <div className="flex gap-2 justify-center items-center relative">
          <Link
            to="/"
            className={`px-4 sm:px-5 py-2.5 rounded-xl font-medium transition-all text-sm sm:text-base touch-manipulation inline-flex items-center gap-2 ${
              location.pathname === '/'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                : 'text-gray-700 hover:bg-white hover:shadow-md hover:scale-105 bg-white/60'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>文件传输</span>
          </Link>
          <Link
            to="/sticky-notes"
            className={`px-4 sm:px-5 py-2.5 rounded-xl font-medium transition-all text-sm sm:text-base touch-manipulation inline-flex items-center gap-2 ${
              location.pathname === '/sticky-notes'
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/30 scale-105'
                : 'text-gray-700 hover:bg-white hover:shadow-md hover:scale-105 bg-white/60'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span>便签墙</span>
          </Link>
          <Link
            to="/encrypted-chat"
            className={`px-4 sm:px-5 py-2.5 rounded-xl font-medium transition-all text-sm sm:text-base touch-manipulation inline-flex items-center gap-2 ${
              location.pathname === '/encrypted-chat'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 scale-105'
                : 'text-gray-700 hover:bg-white hover:shadow-md hover:scale-105 bg-white/60'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>加密聊天</span>
          </Link>

          {/* 右侧按钮组 - 绝对定位 */}
          <div className="absolute right-0 flex gap-2">
            {/* 帮助按钮 */}
            <Link
              to="/help"
              className={`p-2.5 rounded-lg transition-all ${
                location.pathname === '/help'
                  ? 'bg-gray-700 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-md'
              }`}
              title="帮助"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Link>
            {/* 设置按钮 */}
            <Link
              to="/settings"
              className={`p-2.5 rounded-lg transition-all ${
                location.pathname === '/settings'
                  ? 'bg-gray-700 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-md'
              }`}
              title="设置"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<FileTransferPage />} />
          <Route path="/sticky-notes" element={<StickyNotesPage />} />
          <Route path="/encrypted-chat" element={<EncryptedChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;

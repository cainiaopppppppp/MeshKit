/**
 * MeshKit - 主应用入口，支持多页面路由
 */

import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FileTransferPage } from './pages/FileTransferPage';
import { StickyNotesPage } from './pages/StickyNotesPage';

function Navigation() {
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto">
        {/* 第一行：品牌名称 */}
        <div className="text-center mb-2">
          <Link to="/" className="text-xl font-bold text-gray-900">
            MeshKit
          </Link>
        </div>

        {/* 第二行：说明文字 */}
        <div className="text-center mb-3">
          <div className="text-xs sm:text-sm text-gray-500">
            P2P 协作工具套件
          </div>
        </div>

        {/* 第三行：导航标签（居中） */}
        <div className="flex gap-2 justify-center">
          <Link
            to="/"
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base touch-manipulation ${
              location.pathname === '/'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            文件传输
          </Link>
          <Link
            to="/sticky-notes"
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base touch-manipulation ${
              location.pathname === '/sticky-notes'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            便签墙
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<FileTransferPage />} />
          <Route path="/sticky-notes" element={<StickyNotesPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

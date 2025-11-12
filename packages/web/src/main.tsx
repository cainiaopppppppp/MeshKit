// 必须首先导入 crypto polyfill，在 y-webrtc 加载之前确保 crypto.subtle 可用
import './utils/CryptoPolyfill';
// 初始化全局错误抑制器，过滤浏览器扩展错误
import { initErrorSuppressor } from './utils/ErrorSuppressor';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 初始化错误抑制器
initErrorSuppressor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

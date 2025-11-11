// 必须首先导入 crypto polyfill，在 y-webrtc 加载之前确保 crypto.subtle 可用
import './utils/CryptoPolyfill';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

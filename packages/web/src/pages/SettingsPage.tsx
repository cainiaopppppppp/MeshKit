/**
 * 设置页面 - 配置信令服务器地址
 */

import { useState, useEffect } from 'react';
import { config } from '@meshkit/core';

export function SettingsPage() {
  const [serverHost, setServerHost] = useState('localhost');
  const [wsPort, setWsPort] = useState('7000');
  const [peerPort, setPeerPort] = useState('8000');

  // 从 localStorage 加载已保存的配置
  useEffect(() => {
    const saved = localStorage.getItem('meshkit_signaling_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setServerHost(parsed.host || 'localhost');
        setWsPort(String(parsed.wsPort || 7000));
        setPeerPort(String(parsed.peerPort || 8000));
      } catch (e) {
        console.error('Failed to parse saved config:', e);
      }
    } else {
      // 使用当前配置
      const currentConfig = config.get('signalingServer');
      if (currentConfig) {
        setServerHost(currentConfig.host || 'localhost');
        setWsPort(String(currentConfig.wsPort || 7000));
        setPeerPort(String(currentConfig.peerPort || 8000));
      }
    }
  }, []);

  const handleSave = () => {
    const newConfig = {
      host: serverHost,
      wsPort: parseInt(wsPort),
      peerPort: parseInt(peerPort),
    };

    // 更新内存配置
    config.set('signalingServer', newConfig);

    // 保存到 localStorage
    localStorage.setItem('meshkit_signaling_config', JSON.stringify(newConfig));

    alert('配置已保存！请刷新页面以使配置生效。');
  };

  const handleReset = () => {
    setServerHost('localhost');
    setWsPort('7000');
    setPeerPort('8000');
    localStorage.removeItem('meshkit_signaling_config');
    alert('配置已重置为默认值！');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">信令服务器配置</h1>

        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-sm font-semibold text-blue-900 mb-2">💡 使用说明</h2>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>默认配置使用 localhost，适合本地开发和测试</li>
            <li>如需局域网内多台电脑协作，需配置运行信令服务器的电脑 IP</li>
            <li>配置后需要刷新页面才能生效</li>
          </ul>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              服务器地址
            </label>
            <input
              type="text"
              value={serverHost}
              onChange={(e) => setServerHost(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="localhost 或 IP 地址，如 192.168.1.100"
            />
            <p className="mt-1 text-xs text-gray-500">
              运行信令服务器的电脑的 IP 地址或域名
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WebSocket 端口
            </label>
            <input
              type="number"
              value={wsPort}
              onChange={(e) => setWsPort(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="7000"
            />
            <p className="mt-1 text-xs text-gray-500">
              信令服务器的 WebSocket 端口（默认 7000）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PeerJS 端口
            </label>
            <input
              type="number"
              value={peerPort}
              onChange={(e) => setPeerPort(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="8000"
            />
            <p className="mt-1 text-xs text-gray-500">
              PeerJS 信令服务端口（默认 8000）
            </p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">当前配置预览：</h3>
          <div className="text-sm text-gray-600 space-y-1 font-mono">
            <div>WebSocket: ws://{serverHost}:{wsPort}/ws</div>
            <div>PeerJS: {serverHost}:{peerPort}</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            保存配置
          </button>
          <button
            onClick={handleReset}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            重置为默认
          </button>
        </div>

        <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h2 className="text-sm font-semibold text-amber-900 mb-2">📋 局域网部署步骤</h2>
          <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
            <li>
              <strong>启动信令服务器</strong>（在一台电脑上）：
              <div className="ml-6 mt-1 font-mono text-xs bg-amber-100 p-2 rounded">
                pnpm dev:signaling
              </div>
            </li>
            <li>
              <strong>查看服务器 IP 地址</strong>：
              <div className="ml-6 mt-1 space-y-1">
                <div className="font-mono text-xs">Windows: ipconfig</div>
                <div className="font-mono text-xs">Mac/Linux: ifconfig 或 ip addr</div>
              </div>
            </li>
            <li>
              <strong>配置客户端</strong>：在其他电脑的浏览器中，访问本页面并填入服务器 IP
            </li>
            <li>
              <strong>保存并刷新</strong>：点击"保存配置"后刷新页面即可使用
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

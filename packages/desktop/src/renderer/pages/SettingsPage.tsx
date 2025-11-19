import React, { useState, useEffect } from 'react';
import { config } from '@meshkit/core';

export function SettingsPage() {
  const [serverHost, setServerHost] = useState('localhost');
  const [wsPort, setWsPort] = useState('7000');
  const [peerPort, setPeerPort] = useState('8000');
  const [saved, setSaved] = useState(false);

  // 加载当前配置
  useEffect(() => {
    const signalingConfig = config.get('signalingServer');
    if (signalingConfig) {
      setServerHost(signalingConfig.host || 'localhost');
      setWsPort(String(signalingConfig.wsPort || 7000));
      setPeerPort(String(signalingConfig.peerPort || 8000));
    }
  }, []);

  const handleSave = () => {
    // 更新配置
    config.set('signalingServer', {
      host: serverHost,
      wsPort: parseInt(wsPort),
      peerPort: parseInt(peerPort),
    });

    // 保存到 localStorage
    localStorage.setItem('meshkit_signaling_config', JSON.stringify({
      host: serverHost,
      wsPort: parseInt(wsPort),
      peerPort: parseInt(peerPort),
    }));

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);

    // 提示用户需要重启应用
    alert('配置已保存！请重启应用以使配置生效。');
  };

  const handleReset = () => {
    setServerHost('localhost');
    setWsPort('7000');
    setPeerPort('8000');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ⚙️ 应用设置
          </h1>
          <p className="text-gray-600">
            配置信令服务器地址以连接到局域网内的其他设备
          </p>
        </div>

        {/* 设置卡片 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-2xl">📡</span>
            信令服务器配置
          </h2>

          {/* 说明 */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-sm text-blue-900">
              <strong>提示：</strong> 如果要在局域网内的多台电脑之间传输文件，需要：
            </p>
            <ol className="list-decimal list-inside text-sm text-blue-800 mt-2 space-y-1">
              <li>在一台电脑上运行信令服务器（<code className="bg-blue-100 px-1 rounded">pnpm dev:signaling</code>）</li>
              <li>记下该电脑的 IP 地址（如 192.168.1.100）</li>
              <li>在其他电脑的 Desktop 应用中填入该 IP 地址</li>
            </ol>
          </div>

          {/* 表单 */}
          <div className="space-y-6">
            {/* 服务器地址 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                服务器地址 (IP 或域名)
              </label>
              <input
                type="text"
                value={serverHost}
                onChange={(e) => setServerHost(e.target.value)}
                placeholder="例如: 192.168.1.100 或 localhost"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg text-gray-900 placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                本地测试使用 <code className="bg-gray-100 px-1 rounded">localhost</code>，局域网使用服务器电脑的 IP 地址
              </p>
            </div>

            {/* WebSocket 端口 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                WebSocket 端口
              </label>
              <input
                type="number"
                value={wsPort}
                onChange={(e) => setWsPort(e.target.value)}
                placeholder="7000"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg text-gray-900 placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                默认: 7000
              </p>
            </div>

            {/* PeerJS 端口 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                PeerJS 端口
              </label>
              <input
                type="number"
                value={peerPort}
                onChange={(e) => setPeerPort(e.target.value)}
                placeholder="8000"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg text-gray-900 placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                默认: 8000
              </p>
            </div>

            {/* 预览 */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">配置预览：</p>
              <div className="space-y-1 text-sm font-mono text-gray-600">
                <div>WebSocket: <span className="text-blue-600">ws://{serverHost}:{wsPort}/ws</span></div>
                <div>PeerJS: <span className="text-blue-600">http://{serverHost}:{peerPort}/peerjs</span></div>
              </div>
            </div>

            {/* 按钮组 */}
            <div className="flex gap-4">
              <button
                onClick={handleSave}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                💾 保存配置
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                🔄 重置
              </button>
            </div>

            {/* 保存成功提示 */}
            {saved && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <p className="text-green-800 font-medium">
                  ✅ 配置已保存！请重启应用以使配置生效。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 帮助信息 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
            <span>💡</span>
            如何查看电脑的 IP 地址？
          </h3>
          <div className="text-sm text-yellow-800 space-y-2">
            <p><strong>Windows:</strong> 打开命令提示符，运行 <code className="bg-yellow-100 px-1 rounded">ipconfig</code></p>
            <p><strong>Mac/Linux:</strong> 打开终端，运行 <code className="bg-yellow-100 px-1 rounded">ifconfig</code> 或 <code className="bg-yellow-100 px-1 rounded">ip addr</code></p>
            <p className="text-xs">通常是 192.168.x.x 或 10.0.x.x 格式的地址</p>
          </div>
        </div>
      </div>
    </div>
  );
}

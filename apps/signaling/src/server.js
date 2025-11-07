// Signaling Server - P2P局域网文件传输
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const PORT = 8000;

// 创建 HTTP 服务器（仅用于WebSocket）
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('P2P Transfer Signaling Server Running\n');
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 存储所有连接的设备
const devices = new Map();

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log('✅ 新设备连接:', clientIp);

  let deviceId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'register':
          deviceId = data.deviceId;
          devices.set(deviceId, {
            id: deviceId,
            name: data.deviceName,
            ws: ws,
            timestamp: Date.now()
          });
          console.log(`📱 设备注册: ${data.deviceName} (${deviceId})`);

          // 广播设备列表
          broadcastDeviceList();
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // 转发信令消息（PeerJS已处理，这里保留作为扩展）
          const targetDevice = devices.get(data.target);
          if (targetDevice && targetDevice.ws.readyState === WebSocket.OPEN) {
            targetDevice.ws.send(JSON.stringify({
              type: data.type,
              from: deviceId,
              data: data.data
            }));
          }
          break;

        case 'heartbeat':
          // 心跳
          if (deviceId && devices.has(deviceId)) {
            devices.get(deviceId).timestamp = Date.now();
          }
          break;
      }
    } catch (error) {
      console.error('❌ 消息处理错误:', error);
    }
  });

  ws.on('close', () => {
    if (deviceId) {
      console.log(`👋 设备断开: ${deviceId}`);
      devices.delete(deviceId);
      broadcastDeviceList();
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error);
  });
});

// 广播设备列表
function broadcastDeviceList() {
  const deviceList = Array.from(devices.values()).map(device => ({
    id: device.id,
    name: device.name,
    timestamp: device.timestamp
  }));

  const message = JSON.stringify({
    type: 'device-list',
    devices: deviceList
  });

  console.log(`📡 广播设备列表 (共 ${deviceList.length} 个设备)`);

  devices.forEach(device => {
    if (device.ws.readyState === WebSocket.OPEN) {
      device.ws.send(message);
    }
  });
}

// 定期清理离线设备
setInterval(() => {
  const now = Date.now();
  let cleaned = false;

  devices.forEach((device, id) => {
    if (now - device.timestamp > 15000) { // 15秒超时
      console.log(`🧹 清理离线设备: ${id}`);
      devices.delete(id);
      cleaned = true;
    }
  });

  if (cleaned) {
    broadcastDeviceList();
  }
}, 5000);

// 获取本机IP地址
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部和非IPv4地址
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();

  console.log('');
  console.log('=================================');
  console.log('🚀 信令服务器已启动！');
  console.log('=================================');
  console.log('');
  console.log('📱 WebSocket地址：');
  console.log('');
  console.log(`   ws://${localIP}:${PORT}`);
  console.log('');
  console.log('   或者');
  console.log('');
  console.log(`   ws://localhost:${PORT}`);
  console.log('');
  console.log('=================================');
  console.log('');
  console.log('💡 提示：');
  console.log('  - 用于设备发现和信令交换');
  console.log('  - 实际文件传输通过P2P直连');
  console.log('  - 按 Ctrl+C 停止服务器');
  console.log('');
  console.log('📊 服务器日志：');
  console.log('');
});

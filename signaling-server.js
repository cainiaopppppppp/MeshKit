// signaling-server.js - 修复版
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

// MIME类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  console.log('请求:', req.url);

  // 根路径返回 index.html
  if (req.url === '/') {
    req.url = '/index.html';
  }

  // 处理静态文件
  const filePath = path.join(__dirname, req.url);
  const extname = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // 检查文件是否存在
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    // 读取并返回文件
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
      res.end(data);
    });
  });
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
          // 转发信令消息
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
  console.log('🚀 局域网传输服务器已启动！');
  console.log('=================================');
  console.log('');
  console.log('📱 在电脑和手机上访问：');
  console.log('');
  console.log(`   http://${localIP}:${PORT}`);
  console.log('');
  console.log('   或者');
  console.log('');
  console.log(`   http://localhost:${PORT}`);
  console.log('');
  console.log('=================================');
  console.log('');
  console.log('💡 提示：');
  console.log('  - 模块化架构，易于扩展');
  console.log('  - 电脑和手机需要在同一WiFi');
  console.log('  - 按 Ctrl+C 停止服务器');
  console.log('');
  console.log('📂 支持的文件：');
  console.log('  - HTML, JS, CSS (模块化)');
  console.log('  - 静态资源 (图片等)');
  console.log('');
  console.log('📊 服务器日志：');
  console.log('');
});

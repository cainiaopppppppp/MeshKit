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

// 存储所有房间
const rooms = new Map();

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

        case 'create-room':
          handleCreateRoom(data, ws);
          break;

        case 'join-room':
          handleJoinRoom(data, ws);
          break;

        case 'leave-room':
          handleLeaveRoom(data);
          break;

        case 'start-broadcast':
          handleStartBroadcast(data);
          break;

        case 'update-room-files':
          handleUpdateRoomFiles(data);
          break;

        case 'request-file':
          handleRequestFile(data);
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

// 生成6位房间号
function generateRoomId() {
  let roomId;
  do {
    roomId = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(roomId));
  return roomId;
}

// 向房间内所有成员广播消息
function broadcastToRoom(room, message, excludeDeviceId = null) {
  room.members.forEach(member => {
    if (member.deviceId !== excludeDeviceId) {
      const device = devices.get(member.deviceId);
      if (device && device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(JSON.stringify(message));
      }
    }
  });
}

// 处理创建房间
function handleCreateRoom(data, ws) {
  const { deviceId, deviceName, data: roomData } = data;
  const { fileInfo, fileList, isMultiFile } = roomData;

  const roomId = generateRoomId();
  const room = {
    id: roomId,
    name: `Room ${roomId}`,
    hostId: deviceId,
    members: [{
      deviceId,
      deviceName,
      role: 'host',
      status: 'waiting',
      joinedAt: Date.now()
    }],
    createdAt: Date.now(),
    fileInfo,
    fileList: isMultiFile ? fileList : undefined,
    isMultiFile: isMultiFile || false,
    status: 'waiting'
  };

  rooms.set(roomId, room);
  console.log(`🏠 房间创建成功: ${roomId} by ${deviceName}`);

  // 发送房间创建成功消息
  ws.send(JSON.stringify({
    type: 'room-update',
    room
  }));
}

// 处理加入房间
function handleJoinRoom(data, ws) {
  const { deviceId, deviceName, roomId } = data;

  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({
      type: 'room-error',
      error: '房间不存在'
    }));
    return;
  }

  // 检查是否已经在房间中
  const existingMember = room.members.find(m => m.deviceId === deviceId);
  if (existingMember) {
    // 已在房间中，直接返回房间信息
    ws.send(JSON.stringify({
      type: 'room-update',
      room
    }));
    return;
  }

  // 添加新成员
  room.members.push({
    deviceId,
    deviceName,
    role: 'member',
    status: 'waiting',
    joinedAt: Date.now()
  });

  console.log(`👤 ${deviceName} 加入房间: ${roomId}`);

  // 向所有成员广播房间更新（包括新加入的成员）
  broadcastToRoom(room, {
    type: 'room-update',
    room
  });

  // 向新成员发送房间信息
  ws.send(JSON.stringify({
    type: 'room-update',
    room
  }));
}

// 处理离开房间
function handleLeaveRoom(data) {
  const { deviceId, roomId } = data;

  const room = rooms.get(roomId);
  if (!room) return;

  // 移除成员
  room.members = room.members.filter(m => m.deviceId !== deviceId);

  console.log(`👋 设备离开房间: ${deviceId} from ${roomId}`);

  // 如果房主离开或房间为空，删除房间
  if (deviceId === room.hostId || room.members.length === 0) {
    console.log(`🗑️  删除房间: ${roomId}`);
    rooms.delete(roomId);

    // 通知所有成员房间已关闭
    broadcastToRoom(room, {
      type: 'room-error',
      error: '房间已关闭'
    });
  } else {
    // 通知其他成员
    broadcastToRoom(room, {
      type: 'room-update',
      room
    });
  }
}

// 处理开始广播
function handleStartBroadcast(data) {
  const { roomId } = data;

  const room = rooms.get(roomId);
  if (!room) return;

  room.status = 'transferring';

  console.log(`📡 开始广播: ${roomId}`);

  // 通知所有成员开始传输
  broadcastToRoom(room, {
    type: 'room-update',
    room
  });
}

// 处理更新房间文件列表（添加/删除文件）
function handleUpdateRoomFiles(data) {
  const { roomId, fileList } = data;

  const room = rooms.get(roomId);
  if (!room) return;

  room.fileList = fileList;
  room.isMultiFile = fileList && fileList.length > 1;

  console.log(`📝 更新房间文件列表: ${roomId}, ${fileList.length} 个文件`);

  // 通知所有成员文件列表已更新
  broadcastToRoom(room, {
    type: 'room-update',
    room
  });
}

// 处理文件下载请求（接收方请求特定文件）
function handleRequestFile(data) {
  const { roomId, deviceId, fileIndex } = data;

  const room = rooms.get(roomId);
  if (!room) return;

  console.log(`📥 文件下载请求: Room ${roomId}, File ${fileIndex} by ${deviceId}`);

  // 转发请求给房主
  const host = devices.get(room.hostId);
  if (host && host.ws.readyState === WebSocket.OPEN) {
    host.ws.send(JSON.stringify({
      type: 'file-request',
      from: deviceId,
      fileIndex
    }));
  }
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

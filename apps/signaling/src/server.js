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

// 存储所有房间
const rooms = new Map();

/**
 * 生成6位房间号
 */
function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 创建房间
 */
function createRoom(hostId, hostName, roomData) {
  const roomId = generateRoomId();

  const room = {
    id: roomId,
    name: `${hostName}的传输房间`,
    hostId: hostId,
    members: [{
      deviceId: hostId,
      deviceName: hostName,
      role: 'host',
      status: 'waiting',
      joinedAt: Date.now(),
    }],
    createdAt: Date.now(),
    fileInfo: roomData.fileInfo,
    fileList: roomData.fileList,
    isMultiFile: roomData.isMultiFile,
    status: 'waiting'
  };

  rooms.set(roomId, room);
  console.log(`🏠 房间创建: ${roomId} by ${hostName}`, roomData.isMultiFile ? `(多文件模式, ${roomData.fileList?.length || 0} 个文件)` : '(单文件模式)');

  return room;
}

/**
 * 加入房间
 */
function joinRoom(roomId, deviceId, deviceName) {
  const room = rooms.get(roomId);

  if (!room) {
    throw new Error('房间不存在');
  }

  if (room.status !== 'waiting') {
    throw new Error('房间已开始传输，无法加入');
  }

  // 检查是否已在房间中
  const existingMember = room.members.find(m => m.deviceId === deviceId);
  if (existingMember) {
    return room; // 已在房间中，直接返回
  }

  // 添加成员
  const member = {
    deviceId: deviceId,
    deviceName: deviceName,
    role: 'member',
    status: 'waiting',
    joinedAt: Date.now(),
  };

  room.members.push(member);
  console.log(`👤 ${deviceName} 加入房间 ${roomId}`);

  return room;
}

/**
 * 离开房间
 */
function leaveRoom(roomId, deviceId) {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  // 如果是主持人离开，解散房间
  if (room.hostId === deviceId) {
    console.log(`🏠 房间解散: ${roomId} (主持人离开)`);
    rooms.delete(roomId);
    return { dissolved: true };
  }

  // 移除成员
  room.members = room.members.filter(m => m.deviceId !== deviceId);
  console.log(`👋 成员离开房间 ${roomId}`);

  return { dissolved: false, room };
}

/**
 * 广播房间更新到房间内所有成员
 */
function broadcastRoomUpdate(room) {
  const message = JSON.stringify({
    type: 'room-update',
    room: room
  });

  room.members.forEach(member => {
    const device = devices.get(member.deviceId);
    if (device && device.ws.readyState === WebSocket.OPEN) {
      device.ws.send(message);
    }
  });
}

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

        case 'create-room':
          // 创建房间
          try {
            const room = createRoom(deviceId, data.deviceName, data.data);
            ws.send(JSON.stringify({
              type: 'room-update',
              room: room
            }));
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'room-error',
              error: error.message
            }));
          }
          break;

        case 'join-room':
          // 加入房间
          try {
            const room = joinRoom(data.roomId, deviceId, data.deviceName);
            // 通知加入者
            ws.send(JSON.stringify({
              type: 'room-update',
              room: room
            }));
            // 广播房间更新给所有成员
            broadcastRoomUpdate(room);
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'room-error',
              error: error.message
            }));
          }
          break;

        case 'leave-room':
          // 离开房间
          try {
            const result = leaveRoom(data.roomId, deviceId);
            if (result && result.dissolved) {
              // 通知所有成员房间已解散
              const room = rooms.get(data.roomId);
              if (room) {
                broadcastRoomUpdate({ ...room, status: 'dissolved' });
              }
            } else if (result && result.room) {
              // 广播房间更新
              broadcastRoomUpdate(result.room);
            }
          } catch (error) {
            console.error('离开房间错误:', error);
          }
          break;

        case 'start-broadcast':
          // 开始群发传输
          try {
            const room = rooms.get(data.roomId);
            if (!room) {
              throw new Error('房间不存在');
            }
            if (room.hostId !== deviceId) {
              throw new Error('只有主持人可以开始传输');
            }

            room.status = 'transferring';
            console.log(`📤 开始群发: 房间 ${data.roomId}, 共 ${room.members.length} 个成员`);

            // 广播开始传输
            broadcastRoomUpdate(room);
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'room-error',
              error: error.message
            }));
          }
          break;

        case 'file-request':
          // 接收方请求文件
          try {
            const room = rooms.get(data.roomId);
            if (!room) {
              throw new Error('房间不存在');
            }

            // 转发文件请求给房主
            const hostDevice = devices.get(room.hostId);
            if (hostDevice && hostDevice.ws.readyState === WebSocket.OPEN) {
              hostDevice.ws.send(JSON.stringify({
                type: 'file-request',
                fileIndex: data.fileIndex,
                requesterId: data.requesterId || deviceId,
                roomId: data.roomId
              }));
              console.log(`📥 文件请求: 房间 ${data.roomId}, 文件索引 ${data.fileIndex}, 请求者 ${deviceId}`);
            } else {
              throw new Error('房主不在线');
            }
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'room-error',
              error: error.message
            }));
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

      // 离开所有加入的房间
      rooms.forEach((room, roomId) => {
        const result = leaveRoom(roomId, deviceId);
        if (result && result.dissolved) {
          // 房间已解散
          broadcastRoomUpdate({ ...room, status: 'dissolved' });
        } else if (result && result.room) {
          // 广播房间更新
          broadcastRoomUpdate(result.room);
        }
      });
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

// 定期清理离线设备和过期房间
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

  // 清理超过1小时的房间
  rooms.forEach((room, roomId) => {
    if (now - room.createdAt > 3600000) { // 1小时
      console.log(`🧹 清理过期房间: ${roomId}`);
      rooms.delete(roomId);
    }
  });
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

const os = require('os');
const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const { ExpressPeerServer } = require('peer');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const HOST = process.env.HOST || '0.0.0.0';
const WS_PORT = parsePositiveInt(process.env.WS_PORT, 7000);
const PEER_PORT = parsePositiveInt(process.env.PEER_PORT, 8000);
const DEVICE_STALE_TIME = parsePositiveInt(process.env.DEVICE_STALE_TIME, 15_000);
const ROOM_STALE_TIME = parsePositiveInt(process.env.ROOM_STALE_TIME, 3_600_000);
const CLEANUP_INTERVAL = parsePositiveInt(process.env.CLEANUP_INTERVAL, 5_000);

const devices = new Map();
const rooms = new Map();
const topics = new Map();

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  const lanAddress = addresses.find((address) =>
    address.startsWith('192.168.') || address.startsWith('10.'),
  );

  return lanAddress || addresses[0] || '127.0.0.1';
}

function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function serializeRoom(room) {
  const { password, ...rest } = room;
  return {
    ...rest,
    hasPassword: !!password,
  };
}

function createRoom(hostId, hostName, roomData = {}) {
  const roomId = generateRoomId();
  const room = {
    id: roomId,
    name: `${hostName} 的传输房间`,
    hostId,
    members: [
      {
        deviceId: hostId,
        deviceName: hostName,
        role: 'host',
        status: 'waiting',
        joinedAt: Date.now(),
      },
    ],
    createdAt: Date.now(),
    fileInfo: roomData.fileInfo,
    fileList: roomData.fileList,
    isMultiFile: roomData.isMultiFile,
    status: 'waiting',
    password: roomData.password || null,
  };

  rooms.set(roomId, room);
  console.log(
    `[signaling] Room created: ${roomId} by ${hostName}${room.password ? ' (password protected)' : ''}`,
  );
  return room;
}

function joinRoom(roomId, deviceId, deviceName, password) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('房间不存在');
  }

  if (room.password) {
    if (password === undefined || password === null || String(password).trim() === '') {
      throw new Error('此房间需要密码');
    }

    if (password !== room.password) {
      throw new Error('密码错误');
    }
  }

  if (room.status !== 'waiting') {
    throw new Error('房间已开始传输，暂时无法加入');
  }

  const existingMember = room.members.find((member) => member.deviceId === deviceId);
  if (existingMember) {
    return room;
  }

  room.members.push({
    deviceId,
    deviceName,
    role: 'member',
    status: 'waiting',
    joinedAt: Date.now(),
  });

  console.log(`[signaling] ${deviceName} joined room ${roomId}`);
  return room;
}

function leaveRoom(roomId, deviceId) {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  if (room.hostId === deviceId) {
    rooms.delete(roomId);
    console.log(`[signaling] Room dissolved: ${roomId}`);
    return { dissolved: true, room };
  }

  room.members = room.members.filter((member) => member.deviceId !== deviceId);
  console.log(`[signaling] Member left room ${roomId}: ${deviceId}`);
  return { dissolved: false, room };
}

function broadcastDeviceList() {
  const deviceList = Array.from(devices.values()).map((device) => ({
    id: device.id,
    name: device.name,
    timestamp: device.timestamp,
  }));

  const message = JSON.stringify({
    type: 'device-list',
    devices: deviceList,
  });

  devices.forEach((device) => {
    if (device.ws.readyState === WebSocket.OPEN) {
      device.ws.send(message);
    }
  });
}

function broadcastRoomUpdate(room) {
  const roomInfo = serializeRoom(room);
  const message = JSON.stringify({
    type: 'room-update',
    room: roomInfo,
  });

  room.members.forEach((member) => {
    const device = devices.get(member.deviceId);
    if (device && device.ws.readyState === WebSocket.OPEN) {
      device.ws.send(message);
    }
  });
}

const peerApp = express();
const peerHttpServer = http.createServer(peerApp);
const peerServer = ExpressPeerServer(peerHttpServer, {
  debug: true,
  path: '/',
  allow_discovery: true,
});

peerApp.use('/peerjs', peerServer);
peerApp.get('/', (_req, res) => {
  res.send('MeshKit PeerJS server is running.\n');
});
peerApp.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'peerjs',
    port: PEER_PORT,
  });
});

peerServer.on('connection', (client) => {
  console.log(`[signaling] Peer connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`[signaling] Peer disconnected: ${client.getId()}`);
});

const wsApp = express();
const wsHttpServer = http.createServer(wsApp);

wsApp.get('/', (_req, res) => {
  res.send('MeshKit signaling server is running.\n');
});
wsApp.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'signaling',
    port: WS_PORT,
    devices: devices.size,
    rooms: rooms.size,
  });
});

const wss = new WebSocket.Server({
  server: wsHttpServer,
  path: '/ws',
});

wss.on('connection', (ws, req) => {
  const clientIp = req?.socket?.remoteAddress;
  console.log(`[signaling] WebSocket client connected from ${clientIp || 'unknown'}`);

  let deviceId = null;
  let deviceName = null;

  const upsertRegisteredDevice = (nextDeviceName) => {
    if (!deviceId) {
      return false;
    }

    const resolvedDeviceName =
      typeof nextDeviceName === 'string' && nextDeviceName.trim() ? nextDeviceName : deviceName;

    if (!resolvedDeviceName) {
      return false;
    }

    const existingDevice = devices.get(deviceId);
    const hasChanged =
      !existingDevice || existingDevice.ws !== ws || existingDevice.name !== resolvedDeviceName;

    deviceName = resolvedDeviceName;
    devices.set(deviceId, {
      id: deviceId,
      name: resolvedDeviceName,
      ws,
      timestamp: Date.now(),
    });

    return hasChanged;
  };

  ws.on('message', (rawMessage) => {
    try {
      const data = JSON.parse(String(rawMessage));

      if (deviceId && data.type !== 'register') {
        const restored = upsertRegisteredDevice(
          typeof data.deviceName === 'string' ? data.deviceName : undefined,
        );
        if (restored) {
          broadcastDeviceList();
        }
      }

      switch (data.type) {
        case 'subscribe':
          if (Array.isArray(data.topics)) {
            data.topics.forEach((topic) => {
              if (!topics.has(topic)) {
                topics.set(topic, new Set());
              }
              topics.get(topic).add(ws);
            });
          }
          break;

        case 'unsubscribe':
          if (Array.isArray(data.topics)) {
            data.topics.forEach((topic) => {
              const subscribers = topics.get(topic);
              if (!subscribers) {
                return;
              }

              subscribers.delete(ws);
              if (subscribers.size === 0) {
                topics.delete(topic);
              }
            });
          }
          break;

        case 'publish':
          if (data.topic && topics.has(data.topic)) {
            const subscribers = topics.get(data.topic);
            const message = JSON.stringify(data);

            subscribers.forEach((subscriber) => {
              if (subscriber !== ws && subscriber.readyState === WebSocket.OPEN) {
                subscriber.send(message);
              }
            });
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'register':
          if (!data.deviceId || !data.deviceName) {
            break;
          }

          deviceId = data.deviceId;
          deviceName = data.deviceName;
          upsertRegisteredDevice(data.deviceName);
          broadcastDeviceList();
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate': {
          const targetDevice = devices.get(data.target);
          if (targetDevice && targetDevice.ws.readyState === WebSocket.OPEN) {
            targetDevice.ws.send(
              JSON.stringify({
                type: data.type,
                from: deviceId,
                data: data.data,
              }),
            );
          }
          break;
        }

        case 'heartbeat':
          if (deviceId) {
            const restored = upsertRegisteredDevice();
            if (restored) {
              broadcastDeviceList();
            }
          }
          break;

        case 'create-room':
          try {
            if (!deviceId) {
              throw new Error('设备尚未注册');
            }

            const room = createRoom(deviceId, data.deviceName, data.data || {});
            ws.send(
              JSON.stringify({
                type: 'room-update',
                room: serializeRoom(room),
              }),
            );
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '创建房间失败',
              }),
            );
          }
          break;

        case 'join-room':
          try {
            if (!deviceId) {
              throw new Error('设备尚未注册');
            }

            const room = joinRoom(data.roomId, deviceId, data.deviceName, data.password);
            ws.send(
              JSON.stringify({
                type: 'room-update',
                room: serializeRoom(room),
              }),
            );
            broadcastRoomUpdate(room);
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '加入房间失败',
              }),
            );
          }
          break;

        case 'leave-room': {
          if (!deviceId) {
            break;
          }

          const result = leaveRoom(data.roomId, deviceId);
          if (result?.room) {
            broadcastRoomUpdate({
              ...result.room,
              status: result.dissolved ? 'dissolved' : result.room.status,
            });
          }
          break;
        }

        case 'start-broadcast':
          try {
            const room = rooms.get(data.roomId);
            if (!room) {
              throw new Error('房间不存在');
            }

            if (room.hostId !== deviceId) {
              throw new Error('只有房主可以开始传输');
            }

            room.status = 'transferring';
            broadcastRoomUpdate(room);
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '开始传输失败',
              }),
            );
          }
          break;

        case 'file-request':
          try {
            const room = rooms.get(data.roomId);
            if (!room) {
              throw new Error('房间不存在');
            }

            const requesterId = data.requesterId || deviceId;
            const member = room.members.find((item) => item.deviceId === requesterId);
            if (member) {
              member.status = 'receiving';
              member.progress = 0;
              broadcastRoomUpdate(room);
            }

            const hostDevice = devices.get(room.hostId);
            if (!hostDevice || hostDevice.ws.readyState !== WebSocket.OPEN) {
              throw new Error('房主当前不在线');
            }

            hostDevice.ws.send(
              JSON.stringify({
                type: 'file-request',
                fileIndex: data.fileIndex,
                requesterId,
                roomId: data.roomId,
              }),
            );
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '请求文件失败',
              }),
            );
          }
          break;

        case 'update-room-files':
          try {
            const room = rooms.get(data.roomId);
            if (!room) {
              throw new Error('房间不存在');
            }

            if (room.hostId !== deviceId) {
              throw new Error('只有房主可以更新房间文件');
            }

            room.fileList = data.fileList;
            room.isMultiFile = Array.isArray(data.fileList) && data.fileList.length > 1;
            broadcastRoomUpdate(room);
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '更新房间文件失败',
              }),
            );
          }
          break;

        case 'update-member-status':
          try {
            const room = rooms.get(data.roomId);
            if (!room) {
              throw new Error('房间不存在');
            }

            const member = room.members.find((item) => item.deviceId === data.deviceId);
            if (!member) {
              throw new Error('成员不存在');
            }

            member.status = data.status;
            if (typeof data.progress === 'number') {
              member.progress = data.progress;
            }

            broadcastRoomUpdate(room);
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '更新成员状态失败',
              }),
            );
          }
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('[signaling] Failed to handle message:', error);
    }
  });

  ws.on('close', () => {
    topics.forEach((subscribers, topic) => {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        topics.delete(topic);
      }
    });

    if (!deviceId) {
      return;
    }

    const activeDevice = devices.get(deviceId);
    if (activeDevice && activeDevice.ws !== ws) {
      return;
    }

    devices.delete(deviceId);
    broadcastDeviceList();

    rooms.forEach((room, roomId) => {
      const result = leaveRoom(roomId, deviceId);
      if (result?.room) {
        broadcastRoomUpdate({
          ...result.room,
          status: result.dissolved ? 'dissolved' : result.room.status,
        });
      }
    });
  });

  ws.on('error', (error) => {
    console.error('[signaling] WebSocket error:', error);
  });
});

setInterval(() => {
  const now = Date.now();
  let removedDevice = false;

  devices.forEach((device, id) => {
    if (now - device.timestamp > DEVICE_STALE_TIME) {
      devices.delete(id);
      removedDevice = true;
    }
  });

  if (removedDevice) {
    broadcastDeviceList();
  }

  rooms.forEach((room, roomId) => {
    if (now - room.createdAt > ROOM_STALE_TIME) {
      rooms.delete(roomId);
    }
  });
}, CLEANUP_INTERVAL);

wsHttpServer.listen(WS_PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('=================================');
  console.log('MeshKit WebSocket signaling server started');
  console.log('=================================');
  console.log(`ws://${localIP}:${WS_PORT}/ws`);
  console.log(`ws://localhost:${WS_PORT}/ws`);
  console.log('');
});

peerHttpServer.listen(PEER_PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('=================================');
  console.log('MeshKit PeerJS server started');
  console.log('=================================');
  console.log(`http://${localIP}:${PEER_PORT}/peerjs`);
  console.log(`http://localhost:${PEER_PORT}/peerjs`);
  console.log('');
});

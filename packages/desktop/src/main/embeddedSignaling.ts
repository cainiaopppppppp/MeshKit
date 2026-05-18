import { createServer, type Server as HttpServer } from 'node:http';

import { getPreferredLocalHost } from './networkUtils';

const express = require('express') as () => any;
const WebSocketLib = require('ws') as {
  OPEN: number;
  Server: new (options: Record<string, unknown>) => any;
};
const { ExpressPeerServer } = require('peer') as {
  ExpressPeerServer: (server: HttpServer, options: Record<string, unknown>) => any;
};

interface RegisteredDevice {
  id: string;
  name: string;
  ws: any;
  timestamp: number;
}

interface RoomMember {
  deviceId: string;
  deviceName: string;
  role: 'host' | 'member';
  status: string;
  joinedAt: number;
  progress?: number;
}

interface RoomRecord {
  id: string;
  name: string;
  hostId: string;
  members: RoomMember[];
  createdAt: number;
  fileInfo?: unknown;
  fileList?: unknown;
  isMultiFile?: boolean;
  status: string;
  password: string | null;
}

interface StartEmbeddedSignalingOptions {
  host?: string;
  wsPort?: number;
  peerPort?: number;
}

export interface EmbeddedSignalingStatus {
  running: boolean;
  listenHost: string;
  publicHost: string;
  wsPort: number;
  peerPort: number;
  wsUrl: string;
  peerUrl: string;
  error?: string;
}

export interface EmbeddedSignalingController {
  status: EmbeddedSignalingStatus;
  stop: () => Promise<void>;
}

function generateRoomId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function serializeRoom(room: RoomRecord): Record<string, unknown> {
  return {
    ...room,
    hasPassword: !!room.password,
    password: undefined,
  };
}

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function listen(server: HttpServer, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleError = (error: Error) => {
      server.off('listening', handleListening);
      reject(error);
    };

    const handleListening = () => {
      server.off('error', handleError);
      resolve();
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(port, host);
  });
}

export async function startEmbeddedSignaling(
  options: StartEmbeddedSignalingOptions = {},
): Promise<EmbeddedSignalingController> {
  const listenHost = options.host || '0.0.0.0';
  const wsPort = options.wsPort || 7000;
  const peerPort = options.peerPort || 8000;
  const publicHost = getPreferredLocalHost();
  const deviceStaleTime = 45_000;

  const devices = new Map<string, RegisteredDevice>();
  const rooms = new Map<string, RoomRecord>();
  const topics = new Map<string, Set<any>>();

  const wsApp = express();
  const peerApp = express();
  const wsHttpServer = createServer(wsApp);
  const peerHttpServer = createServer(peerApp);
  const peerServer = ExpressPeerServer(peerHttpServer, {
    debug: true,
    path: '/',
    allow_discovery: true,
  });

  peerApp.use('/peerjs', peerServer);
  peerApp.get('/', (_req: any, res: any) => {
    res.send('MeshKit embedded PeerJS server is running.\n');
  });

  wsApp.get('/', (_req: any, res: any) => {
    res.send('MeshKit embedded signaling server is running.\n');
  });

  const wss = new WebSocketLib.Server({
    server: wsHttpServer,
    path: '/ws',
  });

  const broadcastDeviceList = () => {
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
      if (device.ws.readyState === WebSocketLib.OPEN) {
        device.ws.send(message);
      }
    });
  };

  const broadcastRoomUpdate = (room: RoomRecord | (RoomRecord & { status?: string })) => {
    const roomInfo = serializeRoom(room as RoomRecord);
    const message = JSON.stringify({
      type: 'room-update',
      room: roomInfo,
    });

    room.members.forEach((member) => {
      const device = devices.get(member.deviceId);
      if (device && device.ws.readyState === WebSocketLib.OPEN) {
        device.ws.send(message);
      }
    });
  };

  const createRoom = (hostId: string, hostName: string, roomData: Record<string, any>) => {
    const roomId = generateRoomId();
    const room: RoomRecord = {
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
    return room;
  };

  const joinRoom = (roomId: string, deviceId: string, deviceName: string, password?: string | null) => {
    const room = rooms.get(roomId);
    if (!room) {
      throw new Error('房间不存在');
    }

    if (room.password) {
      if (password === undefined || password === null || password.trim() === '') {
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

    return room;
  };

  const leaveRoom = (roomId: string, deviceId: string) => {
    const room = rooms.get(roomId);
    if (!room) {
      return null;
    }

    if (room.hostId === deviceId) {
      rooms.delete(roomId);
      return { dissolved: true as const, room };
    }

    room.members = room.members.filter((member) => member.deviceId !== deviceId);
    return { dissolved: false as const, room };
  };

  wss.on('connection', (ws: any, req: any) => {
    const clientIp = req?.socket?.remoteAddress;
    console.log(`[embedded-signaling] WebSocket client connected from ${clientIp || 'unknown'}`);

    let deviceId: string | null = null;
    let deviceName: string | null = null;

    const upsertRegisteredDevice = (nextDeviceName?: string) => {
      if (!deviceId) {
        return false;
      }

      const resolvedDeviceName = typeof nextDeviceName === 'string' && nextDeviceName.trim()
        ? nextDeviceName
        : deviceName;

      if (!resolvedDeviceName) {
        return false;
      }

      const existingDevice = devices.get(deviceId);
      const hasChanged = !existingDevice
        || existingDevice.ws !== ws
        || existingDevice.name !== resolvedDeviceName;

      deviceName = resolvedDeviceName;
      devices.set(deviceId, {
        id: deviceId,
        name: resolvedDeviceName,
        ws,
        timestamp: Date.now(),
      });

      return hasChanged;
    };

    ws.on('message', (rawMessage: any) => {
      try {
        const data = JSON.parse(String(rawMessage));

        if (deviceId && data.type !== 'register') {
          const deviceRestored = upsertRegisteredDevice(
            typeof data.deviceName === 'string' ? data.deviceName : undefined,
          );
          if (deviceRestored) {
            broadcastDeviceList();
          }
        }

        switch (data.type) {
          case 'subscribe':
            if (Array.isArray(data.topics)) {
              data.topics.forEach((topic: string) => {
                if (!topics.has(topic)) {
                  topics.set(topic, new Set());
                }

                topics.get(topic)?.add(ws);
              });
            }
            break;

          case 'unsubscribe':
            if (Array.isArray(data.topics)) {
              data.topics.forEach((topic: string) => {
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
              if (!subscribers) {
                break;
              }

              const message = JSON.stringify(data);
              subscribers.forEach((subscriber) => {
                if (subscriber !== ws && subscriber.readyState === WebSocketLib.OPEN) {
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
            if (targetDevice && targetDevice.ws.readyState === WebSocketLib.OPEN) {
              targetDevice.ws.send(JSON.stringify({
                type: data.type,
                from: deviceId,
                data: data.data,
              }));
            }
            break;
          }

          case 'heartbeat':
            if (deviceId) {
              const deviceRestored = upsertRegisteredDevice();
              if (deviceRestored) {
                broadcastDeviceList();
              }
            }
            break;

          case 'create-room': {
            try {
              if (!deviceId) {
                throw new Error('设备尚未注册');
              }

              const room = createRoom(deviceId, data.deviceName, data.data || {});
              ws.send(JSON.stringify({
                type: 'room-update',
                room: serializeRoom(room),
              }));
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '创建房间失败',
              }));
            }
            break;
          }

          case 'join-room': {
            try {
              if (!deviceId) {
                throw new Error('设备尚未注册');
              }

              const room = joinRoom(data.roomId, deviceId, data.deviceName, data.password);
              ws.send(JSON.stringify({
                type: 'room-update',
                room: serializeRoom(room),
              }));
              broadcastRoomUpdate(room);
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '加入房间失败',
              }));
            }
            break;
          }

          case 'leave-room': {
            if (!deviceId) {
              break;
            }

            const result = leaveRoom(data.roomId, deviceId);
            if (result?.room) {
              const nextStatus = result.dissolved ? 'dissolved' : result.room.status;
              broadcastRoomUpdate({
                ...result.room,
                status: nextStatus,
              });
            }
            break;
          }

          case 'start-broadcast': {
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
              ws.send(JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '开始传输失败',
              }));
            }
            break;
          }

          case 'file-request': {
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
              if (!hostDevice || hostDevice.ws.readyState !== WebSocketLib.OPEN) {
                throw new Error('房主当前不在线');
              }

              hostDevice.ws.send(JSON.stringify({
                type: 'file-request',
                fileIndex: data.fileIndex,
                requesterId,
                roomId: data.roomId,
              }));
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '请求文件失败',
              }));
            }
            break;
          }

          case 'update-room-files': {
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
              ws.send(JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '更新房间文件失败',
              }));
            }
            break;
          }

          case 'update-member-status': {
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
              ws.send(JSON.stringify({
                type: 'room-error',
                error: error instanceof Error ? error.message : '更新成员状态失败',
              }));
            }
            break;
          }

          default:
            break;
        }
      } catch (error) {
        console.error('[embedded-signaling] Failed to handle message:', error);
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
        const result = leaveRoom(roomId, deviceId as string);
        if (result?.room) {
          const nextStatus = result.dissolved ? 'dissolved' : result.room.status;
          broadcastRoomUpdate({
            ...result.room,
            status: nextStatus,
          });
        }
      });
    });

    ws.on('error', (error: Error) => {
      console.error('[embedded-signaling] WebSocket error:', error);
    });
  });

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    let removedDevice = false;

    devices.forEach((device, id) => {
      if (now - device.timestamp > deviceStaleTime) {
        devices.delete(id);
        removedDevice = true;
      }
    });

    if (removedDevice) {
      broadcastDeviceList();
    }

    rooms.forEach((room, roomId) => {
      if (now - room.createdAt > 3_600_000) {
        rooms.delete(roomId);
      }
    });
  }, 5_000);

  try {
    await listen(wsHttpServer, wsPort, listenHost);
    await listen(peerHttpServer, peerPort, listenHost);
  } catch (error) {
    clearInterval(cleanupTimer);
    wss.close();
    await Promise.allSettled([
      closeHttpServer(wsHttpServer),
      closeHttpServer(peerHttpServer),
    ]);
    throw error;
  }

  peerServer.on?.('connection', (client: any) => {
    console.log(`[embedded-signaling] Peer connected: ${client.getId?.() || 'unknown'}`);
  });

  peerServer.on?.('disconnect', (client: any) => {
    console.log(`[embedded-signaling] Peer disconnected: ${client.getId?.() || 'unknown'}`);
  });

  const status: EmbeddedSignalingStatus = {
    running: true,
    listenHost,
    publicHost,
    wsPort,
    peerPort,
    wsUrl: `ws://${publicHost}:${wsPort}/ws`,
    peerUrl: `http://${publicHost}:${peerPort}/peerjs`,
  };

  return {
    status,
    stop: async () => {
      clearInterval(cleanupTimer);

      devices.forEach((device) => {
        try {
          device.ws.close();
        } catch {
          // Ignore close errors during shutdown.
        }
      });

      wss.clients?.forEach((client: any) => {
        try {
          client.terminate?.();
        } catch {
          // Ignore client terminate failures during shutdown.
        }
      });

      wss.close();

      try {
        peerServer.close?.();
      } catch {
        // Ignore peer server close failures during shutdown.
      }

      try {
        peerServer._wss?.close?.();
      } catch {
        // Ignore peer websocket close failures during shutdown.
      }

      await Promise.allSettled([
        closeHttpServer(wsHttpServer),
        closeHttpServer(peerHttpServer),
      ]);
    },
  };
}

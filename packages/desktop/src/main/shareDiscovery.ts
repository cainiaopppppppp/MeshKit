import { randomUUID } from 'node:crypto';
import { createSocket, type Socket } from 'node:dgram';
import { hostname } from 'node:os';

import { getBroadcastAddresses, getLocalIPAddresses, getPreferredLocalHost } from './networkUtils';

const DISCOVERY_MESSAGE_TYPE = 'meshkit-share-announcement';
const DISCOVERY_VERSION = 1;
const DEFAULT_DISCOVERY_PORT = 41041;
const BROADCAST_INTERVAL_MS = 3000;
const PEER_EXPIRY_MS = 12000;

export interface ShareDiscoveryAnnouncement {
  type: typeof DISCOVERY_MESSAGE_TYPE;
  version: typeof DISCOVERY_VERSION;
  instanceId: string;
  deviceName: string;
  host: string;
  sharePort: number;
  shareUrl: string;
  wsPort: number;
  peerPort: number;
  timestamp: number;
}

export interface DiscoveredShare {
  instanceId: string;
  deviceName: string;
  host: string;
  sharePort: number;
  shareUrl: string;
  wsPort: number;
  peerPort: number;
  lastSeenAt: number;
  discoveredAt: number;
}

export interface ShareDiscoveryStatus {
  running: boolean;
  port: number;
  deviceName: string;
  error?: string;
}

export interface ShareDiscoveryController {
  status: ShareDiscoveryStatus;
  getDiscoveredShares: () => DiscoveredShare[];
  stop: () => Promise<void>;
}

interface StartShareDiscoveryOptions {
  shareUrl: string;
  sharePort: number;
  wsPort: number;
  peerPort: number;
  host?: string;
  port?: number;
  deviceName?: string;
}

function closeSocket(socket: Socket): Promise<void> {
  return new Promise((resolve) => {
    try {
      socket.close(() => resolve());
    } catch {
      resolve();
    }
  });
}

function bindSocket(socket: Socket, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleError = (error: Error) => {
      socket.off('listening', handleListening);
      reject(error);
    };

    const handleListening = () => {
      socket.off('error', handleError);
      resolve();
    };

    socket.once('error', handleError);
    socket.once('listening', handleListening);
    socket.bind(port, '0.0.0.0');
  });
}

export async function startShareDiscovery(
  options: StartShareDiscoveryOptions,
): Promise<ShareDiscoveryController> {
  const port = options.port || DEFAULT_DISCOVERY_PORT;
  const instanceId = randomUUID();
  const deviceName = options.deviceName?.trim() || hostname();
  const publicHost = options.host || getPreferredLocalHost();
  const localHosts = new Set([
    '127.0.0.1',
    'localhost',
    ...getLocalIPAddresses(),
  ]);
  const discoveredShares = new Map<string, DiscoveredShare>();
  const socket = createSocket({ type: 'udp4', reuseAddr: true });

  const buildAnnouncement = (): ShareDiscoveryAnnouncement => ({
    type: DISCOVERY_MESSAGE_TYPE,
    version: DISCOVERY_VERSION,
    instanceId,
    deviceName,
    host: publicHost,
    sharePort: options.sharePort,
    shareUrl: options.shareUrl,
    wsPort: options.wsPort,
    peerPort: options.peerPort,
    timestamp: Date.now(),
  });

  const cleanupExpiredShares = () => {
    const now = Date.now();
    discoveredShares.forEach((share, key) => {
      if (now - share.lastSeenAt > PEER_EXPIRY_MS) {
        discoveredShares.delete(key);
      }
    });
  };

  const broadcastAnnouncement = () => {
    const payload = Buffer.from(JSON.stringify(buildAnnouncement()));

    cleanupExpiredShares();

    getBroadcastAddresses().forEach((address) => {
      socket.send(payload, port, address, (error) => {
        if (error) {
          console.warn(`[share-discovery] Failed to broadcast to ${address}:`, error.message);
        }
      });
    });
  };

  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString()) as Partial<ShareDiscoveryAnnouncement>;
      if (data.type !== DISCOVERY_MESSAGE_TYPE || data.version !== DISCOVERY_VERSION) {
        return;
      }

      if (!data.instanceId || data.instanceId === instanceId) {
        return;
      }

      if (!data.host || !data.shareUrl || !data.sharePort || !data.wsPort || !data.peerPort) {
        return;
      }

      if (localHosts.has(data.host)) {
        return;
      }

      const now = Date.now();
      const existing = discoveredShares.get(data.instanceId);
      discoveredShares.set(data.instanceId, {
        instanceId: data.instanceId,
        deviceName: data.deviceName?.trim() || data.host,
        host: data.host,
        sharePort: data.sharePort,
        shareUrl: data.shareUrl,
        wsPort: data.wsPort,
        peerPort: data.peerPort,
        discoveredAt: existing?.discoveredAt || now,
        lastSeenAt: now,
      });
    } catch {
      // Ignore unrelated UDP traffic.
    }
  });

  socket.on('error', (error) => {
    console.error('[share-discovery] Socket error:', error);
  });

  await bindSocket(socket, port);
  socket.setBroadcast(true);

  broadcastAnnouncement();

  const broadcastTimer = setInterval(broadcastAnnouncement, BROADCAST_INTERVAL_MS);
  const cleanupTimer = setInterval(cleanupExpiredShares, BROADCAST_INTERVAL_MS);

  const status: ShareDiscoveryStatus = {
    running: true,
    port,
    deviceName,
  };

  return {
    status,
    getDiscoveredShares: () => {
      cleanupExpiredShares();
      return Array.from(discoveredShares.values())
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    },
    stop: async () => {
      clearInterval(broadcastTimer);
      clearInterval(cleanupTimer);
      await closeSocket(socket);
    },
  };
}

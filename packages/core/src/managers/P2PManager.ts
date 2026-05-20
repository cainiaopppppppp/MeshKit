import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { eventBus } from '../utils/EventBus';
import { config } from '../utils/Config';

let PeerJS: typeof Peer | null = null;

export class P2PManager {
  private peer: Peer | null = null;
  private myDeviceId: string | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private isInitialized = false;
  private peerRefreshPromise: Promise<void> | null = null;

  private static readonly PEER_READY_TIMEOUT = 8000;
  private static readonly PEER_REFRESH_RETRY_DELAYS = [1200, 2500, 4000];

  async init(deviceId: string): Promise<void> {
    if (this.isInitialized && this.peer && !this.peer.destroyed) {
      console.warn('[P2PManager] Already initialized');
      return;
    }

    this.myDeviceId = deviceId;

    try {
      await this.loadPeerJS();

      if (!PeerJS) {
        throw new Error('Failed to load PeerJS');
      }

      await this.openPeerWithRetry(deviceId);
    } catch (error) {
      await this.destroyPeer();
      console.error('[P2PManager] Initialization failed:', error);
      eventBus.emit('p2p:connection:error', {
        peer: deviceId,
        error: error as Error,
      });
      throw error;
    }
  }

  private async loadPeerJS(): Promise<void> {
    if (PeerJS) {
      return;
    }

    try {
      if (typeof window !== 'undefined' && (window as any).Peer) {
        PeerJS = (window as any).Peer;
        return;
      }

      const module = await import('peerjs');
      PeerJS = module.default || module;
    } catch (error) {
      console.error('[P2PManager] Failed to load PeerJS:', error);
      throw new Error('PeerJS not available');
    }
  }

  private buildPeerOptions(): any {
    const webrtcConfig = config.get('webrtc');
    const peerjsConfig = config.get('peerjs');
    const signalingConfig = config.get('signalingServer');
    const resolvedSignalingConfig = config.getResolvedSignalingServer();

    const peerOptions: any = {
      config: webrtcConfig.config as RTCConfiguration,
      debug: peerjsConfig?.debug ?? 2,
    };

    if (signalingConfig?.host && signalingConfig?.peerPort) {
      console.log(
        '[P2PManager] Using configured signaling server:',
        `${signalingConfig.host}:${signalingConfig.peerPort}`,
      );
      peerOptions.host = signalingConfig.host;
      peerOptions.port = signalingConfig.peerPort;
      peerOptions.path = peerjsConfig?.path || '/peerjs';
    } else if (peerjsConfig?.port && typeof window !== 'undefined') {
      console.log(
        '[P2PManager] Using resolved PeerJS server:',
        `${resolvedSignalingConfig.host}:${resolvedSignalingConfig.peerPort}`,
      );
      peerOptions.host = resolvedSignalingConfig.host;
      peerOptions.port = resolvedSignalingConfig.peerPort;
      peerOptions.path = peerjsConfig.path || '/';
    } else if (peerjsConfig?.host) {
      console.log(
        '[P2PManager] Using configured PeerJS server:',
        `${peerjsConfig.host}:${peerjsConfig.port}`,
      );
      peerOptions.host = peerjsConfig.host;
      peerOptions.port = peerjsConfig.port;
      peerOptions.path = peerjsConfig.path;
    } else {
      console.log('[P2PManager] Creating Peer with default PeerJS server...');
      console.log('[P2PManager] Note: Using public PeerJS server (may be slow in China)');
    }

    return peerOptions;
  }

  private createPeer(deviceId: string): void {
    if (!PeerJS) {
      throw new Error('Failed to load PeerJS');
    }

    this.peer = new PeerJS(deviceId, this.buildPeerOptions());
    this.setupPeerEvents();
  }

  private shouldRetryPeerRefresh(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return message.includes('is taken') || message.includes('unavailable-id');
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async destroyPeer(settleDelayMs = 0): Promise<void> {
    const currentPeer = this.peer;
    this.peer = null;
    this.isInitialized = false;

    if (currentPeer && !currentPeer.destroyed) {
      try {
        currentPeer.disconnect();
      } catch (error) {
        console.warn('[P2PManager] Failed to disconnect peer cleanly:', error);
      }

      try {
        currentPeer.destroy();
      } catch (error) {
        console.warn('[P2PManager] Failed to destroy peer cleanly:', error);
      }
    }

    if (settleDelayMs > 0) {
      await this.delay(settleDelayMs);
    }
  }

  private async openPeer(deviceId: string): Promise<void> {
    this.createPeer(deviceId);
    await this.waitForPeerReady();
    this.isInitialized = true;
    eventBus.emit('p2p:initialized', { deviceId });
  }

  private async openPeerWithRetry(deviceId: string): Promise<void> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < P2PManager.PEER_REFRESH_RETRY_DELAYS.length; attempt += 1) {
      try {
        await this.openPeer(deviceId);
        return;
      } catch (error) {
        lastError = error;
        const attemptNumber = attempt + 1;
        const delayMs = P2PManager.PEER_REFRESH_RETRY_DELAYS[attempt];

        console.warn(
          `[P2PManager] Peer open attempt ${attemptNumber}/${P2PManager.PEER_REFRESH_RETRY_DELAYS.length} failed:`,
          error,
        );

        await this.destroyPeer();

        if (!this.shouldRetryPeerRefresh(error) || attemptNumber === P2PManager.PEER_REFRESH_RETRY_DELAYS.length) {
          throw error;
        }

        console.warn(`[P2PManager] Waiting ${delayMs}ms before retrying peer initialization...`);
        await this.delay(delayMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Peer initialization failed');
  }

  private async waitForPeerReady(timeoutMs = P2PManager.PEER_READY_TIMEOUT): Promise<void> {
    if (!this.peer) {
      throw new Error('Peer is not initialized');
    }

    const currentPeer = this.peer;
    if ((currentPeer as any).open) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Peer ready timeout'));
      }, timeoutMs);

      const handleOpen = () => {
        cleanup();
        resolve();
      };

      const handleError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        currentPeer.off('open', handleOpen);
        currentPeer.off('error', handleError);
      };

      currentPeer.on('open', handleOpen);
      currentPeer.on('error', handleError);
    });
  }

  private setupPeerEvents(): void {
    if (!this.peer) {
      return;
    }

    this.peer.on('open', (id: string) => {
      console.log('[P2PManager] Peer opened with ID:', id);
      eventBus.emit('p2p:ready', { deviceId: id });
    });

    this.peer.on('connection', (conn: DataConnection) => {
      console.log('[P2PManager] Incoming connection from:', conn.peer);
      this.handleIncomingConnection(conn);
    });

    this.peer.on('error', (error: Error) => {
      console.error('[P2PManager] Peer error:', error);
      eventBus.emit('p2p:connection:error', {
        peer: this.myDeviceId || 'unknown',
        error,
      });
    });

    this.peer.on('disconnected', () => {
      console.warn('[P2PManager] Peer disconnected');
      if (this.peer && !this.peer.destroyed) {
        this.peer.reconnect();
      }
    });

    this.peer.on('close', () => {
      console.log('[P2PManager] Peer closed');
      this.isInitialized = false;
    });
  }

  connect(targetDeviceId: string, metadata?: any): DataConnection {
    if (!this.isInitialized || !this.peer) {
      throw new Error('P2PManager not initialized');
    }

    const connectionId = `outgoing-${targetDeviceId}`;
    const existingConn = this.connections.get(connectionId);

    if (existingConn && existingConn.open) {
      console.log(`[P2PManager] Reusing existing connection to ${targetDeviceId}`);
      return existingConn;
    }

    if (existingConn) {
      console.log(`[P2PManager] Cleaning up closed connection to ${targetDeviceId}`);
      this.connections.delete(connectionId);
    }

    console.log(`[P2PManager] Creating new connection to ${targetDeviceId}...`);

    const conn = this.peer.connect(targetDeviceId, {
      reliable: true,
      serialization: 'binary',
      metadata,
    });

    this.setupConnectionEvents(conn, 'outgoing');
    return conn;
  }

  private handleIncomingConnection(conn: DataConnection): void {
    this.setupConnectionEvents(conn, 'incoming');
  }

  private setupConnectionEvents(
    conn: DataConnection,
    direction: 'incoming' | 'outgoing',
  ): void {
    const connectionId = `${direction}-${conn.peer}`;
    this.connections.set(connectionId, conn);

    console.log(`[P2PManager] Setting up connection: ${connectionId}`);

    let isOpened = false;
    const timeout = setTimeout(() => {
      if (!isOpened) {
        console.error(`[P2PManager] ⚠️  Connection timeout: ${connectionId} (30s)`);
        console.error('[P2PManager] Possible causes:');
        console.error('  1. PeerJS public server is slow or unavailable');
        console.error('  2. Network/Firewall blocking WebRTC');
        console.error('  3. NAT traversal failed');
        console.error('Suggestion: Consider using a local PeerJS server');
      }
    }, 30000);

    conn.on('open', () => {
      isOpened = true;
      clearTimeout(timeout);
      console.log(`[P2PManager] Connection opened: ${connectionId}`);
      eventBus.emit('p2p:connection:open', {
        peer: conn.peer,
        direction,
      });
    });

    conn.on('data', (data: any) => {
      eventBus.emit('p2p:connection:data', {
        peer: conn.peer,
        data,
      });
    });

    conn.on('close', () => {
      clearTimeout(timeout);
      console.log(`[P2PManager] Connection closed: ${connectionId}`);
      this.connections.delete(connectionId);
      eventBus.emit('p2p:connection:close', {
        peer: conn.peer,
      });
    });

    conn.on('error', (error: Error) => {
      clearTimeout(timeout);
      console.error(`[P2PManager] Connection error: ${connectionId}`, error);
      eventBus.emit('p2p:connection:error', {
        peer: conn.peer,
        error,
      });
    });
  }

  getConnection(peerId: string, direction: 'incoming' | 'outgoing'): DataConnection | undefined {
    const connectionId = `${direction}-${peerId}`;
    return this.connections.get(connectionId);
  }

  closeConnection(peerId: string, direction: 'incoming' | 'outgoing'): void {
    const connectionId = `${direction}-${peerId}`;
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.close();
      this.connections.delete(connectionId);
    }
  }

  closeAllConnections(): void {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
  }

  async refreshPeer(): Promise<void> {
    if (this.peerRefreshPromise) {
      return this.peerRefreshPromise;
    }

    if (!this.myDeviceId) {
      throw new Error('P2PManager not initialized');
    }

    this.peerRefreshPromise = (async () => {
      const currentDeviceId = this.myDeviceId!;

      this.closeAllConnections();
      await this.destroyPeer(800);
      await this.loadPeerJS();
      await this.openPeerWithRetry(currentDeviceId);
    })().finally(() => {
      this.peerRefreshPromise = null;
    });

    return this.peerRefreshPromise;
  }

  destroy(): void {
    this.closeAllConnections();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.isInitialized = false;
    this.peerRefreshPromise = null;
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      deviceId: this.myDeviceId,
      peerReady: this.peer && !this.peer.destroyed,
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.keys()),
    };
  }
}

export const p2pManager = new P2PManager();

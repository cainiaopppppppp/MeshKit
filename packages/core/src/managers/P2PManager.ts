/**
 * P2PManager - P2P连接管理器
 * 管理所有WebRTC P2P连接的生命周期
 */
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { eventBus } from '../utils/EventBus';
import { config } from '../utils/Config';

// 动态导入PeerJS（处理不同环境）
let PeerJS: typeof Peer | null = null;

export class P2PManager {
  private peer: Peer | null = null;
  private myDeviceId: string | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private isInitialized: boolean = false;

  /**
   * 初始化P2P管理器
   */
  async init(deviceId: string): Promise<void> {
    if (this.isInitialized) {
      console.warn('[P2PManager] Already initialized');
      return;
    }

    this.myDeviceId = deviceId;

    try {
      // 加载PeerJS
      await this.loadPeerJS();

      if (!PeerJS) {
        throw new Error('Failed to load PeerJS');
      }

      // 创建Peer实例
      const webrtcConfig = config.get('webrtc');
      const peerjsConfig = config.get('peerjs');
      const signalingConfig = config.get('signalingServer');

      // 根据配置选择PeerJS服务器
      const peerOptions: any = {
        config: webrtcConfig.config as RTCConfiguration,
        debug: peerjsConfig?.debug ?? 2,
      };

      // 优先级1: 使用用户配置的信令服务器地址
      if (signalingConfig?.host && signalingConfig?.peerPort) {
        console.log('[P2PManager] Using configured signaling server:', `${signalingConfig.host}:${signalingConfig.peerPort}`);
        peerOptions.host = signalingConfig.host;
        peerOptions.port = signalingConfig.peerPort;
        peerOptions.path = peerjsConfig?.path || '/peerjs';
      }
      // 优先级2: 动态获取当前访问的hostname（浏览器环境）
      else if (peerjsConfig?.port && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        console.log('[P2PManager] Using local PeerJS server:', `${hostname}:${peerjsConfig.port}`);
        peerOptions.host = hostname;
        peerOptions.port = peerjsConfig.port;
        peerOptions.path = peerjsConfig.path || '/';
      }
      // 优先级3: 使用配置文件中的固定host（兼容旧配置）
      else if (peerjsConfig?.host) {
        console.log('[P2PManager] Using configured PeerJS server:', `${peerjsConfig.host}:${peerjsConfig.port}`);
        peerOptions.host = peerjsConfig.host;
        peerOptions.port = peerjsConfig.port;
        peerOptions.path = peerjsConfig.path;
      }
      // 优先级4: 使用默认公共服务器
      else {
        console.log('[P2PManager] Creating Peer with default PeerJS server...');
        console.log('[P2PManager] ⚠️  Note: Using public PeerJS server (may be slow in China)');
      }

      this.peer = new PeerJS(deviceId, peerOptions);

      // 设置事件监听
      this.setupPeerEvents();

      this.isInitialized = true;
      eventBus.emit('p2p:initialized', { deviceId });
    } catch (error) {
      console.error('[P2PManager] Initialization failed:', error);
      eventBus.emit('p2p:connection:error', {
        peer: deviceId,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * 动态加载PeerJS
   */
  private async loadPeerJS(): Promise<void> {
    if (PeerJS) return;

    try {
      // 尝试从全局加载（浏览器环境）
      if (typeof window !== 'undefined' && (window as any).Peer) {
        PeerJS = (window as any).Peer;
        return;
      }

      // 尝试从npm包加载
      const module = await import('peerjs');
      PeerJS = module.default || module;
    } catch (error) {
      console.error('[P2PManager] Failed to load PeerJS:', error);
      throw new Error('PeerJS not available');
    }
  }

  /**
   * 设置Peer事件监听
   */
  private setupPeerEvents(): void {
    if (!this.peer) return;

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
      // 尝试重连
      if (this.peer && !this.peer.destroyed) {
        this.peer.reconnect();
      }
    });

    this.peer.on('close', () => {
      console.log('[P2PManager] Peer closed');
    });
  }

  /**
   * 连接到远程设备
   * 如果连接已存在且处于open状态，则复用该连接
   */
  connect(targetDeviceId: string, metadata?: any): DataConnection {
    if (!this.isInitialized || !this.peer) {
      throw new Error('P2PManager not initialized');
    }

    // 检查是否已有outgoing连接
    const connectionId = `outgoing-${targetDeviceId}`;
    const existingConn = this.connections.get(connectionId);

    if (existingConn && existingConn.open) {
      console.log(`[P2PManager] Reusing existing connection to ${targetDeviceId}`);
      return existingConn;
    }

    // 如果连接存在但已关闭，清理它
    if (existingConn) {
      console.log(`[P2PManager] Cleaning up closed connection to ${targetDeviceId}`);
      this.connections.delete(connectionId);
    }

    console.log(`[P2PManager] Creating new connection to ${targetDeviceId}...`);

    // 配置数据连接选项
    const conn = this.peer.connect(targetDeviceId, {
      reliable: true,
      serialization: 'binary', // 使用二进制序列化，而非JSON（关键！）
      metadata,
    });

    this.setupConnectionEvents(conn, 'outgoing');

    return conn;
  }

  /**
   * 处理传入连接
   */
  private handleIncomingConnection(conn: DataConnection): void {
    this.setupConnectionEvents(conn, 'incoming');
  }

  /**
   * 设置连接事件监听
   */
  private setupConnectionEvents(
    conn: DataConnection,
    direction: 'incoming' | 'outgoing'
  ): void {
    const connectionId = `${direction}-${conn.peer}`;
    this.connections.set(connectionId, conn);

    console.log(`[P2PManager] Setting up connection: ${connectionId}`);

    // 添加连接超时检测（30秒）
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
      console.log(`[P2PManager] ✅ Connection opened: ${connectionId}`);
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
      console.log(`[P2PManager] Connection closed: ${connectionId}`);
      this.connections.delete(connectionId);
      eventBus.emit('p2p:connection:close', {
        peer: conn.peer,
      });
    });

    conn.on('error', (error: Error) => {
      console.error(`[P2PManager] Connection error: ${connectionId}`, error);
      eventBus.emit('p2p:connection:error', {
        peer: conn.peer,
        error,
      });
    });
  }

  /**
   * 获取连接
   */
  getConnection(peerId: string, direction: 'incoming' | 'outgoing'): DataConnection | undefined {
    const connectionId = `${direction}-${peerId}`;
    return this.connections.get(connectionId);
  }

  /**
   * 关闭指定连接
   */
  closeConnection(peerId: string, direction: 'incoming' | 'outgoing'): void {
    const connectionId = `${direction}-${peerId}`;
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.close();
      this.connections.delete(connectionId);
    }
  }

  /**
   * 关闭所有连接
   */
  closeAllConnections(): void {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
  }

  /**
   * 销毁P2P管理器
   */
  destroy(): void {
    this.closeAllConnections();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.isInitialized = false;
  }

  /**
   * 获取连接状态
   */
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

// 导出单例
export const p2pManager = new P2PManager();

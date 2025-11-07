/**
 * P2PManager - P2P连接管理器
 * 管理所有P2P连接的生命周期
 */
import { eventBus } from './EventBus.js';
import { config } from './Config.js';

class P2PManager {
  constructor() {
    this.peer = null;
    this.myDeviceId = null;
    this.connections = new Map(); // 所有活跃连接
    this.isInitialized = false;
  }

  /**
   * 初始化P2P
   * @param {string} deviceId - 设备ID
   */
  async init(deviceId) {
    if (this.isInitialized) {
      console.warn('P2PManager already initialized');
      return;
    }

    this.myDeviceId = deviceId;

    try {
      // 加载PeerJS
      if (typeof Peer === 'undefined') {
        await this.loadPeerJS();
      }

      // 创建Peer实例
      this.peer = new Peer(deviceId, {
        config: config.get('webrtc')
      });

      // 设置事件监听
      this.setupPeerEvents();

      this.isInitialized = true;
      eventBus.emit('p2p:initialized', { deviceId });
    } catch (error) {
      console.error('Failed to initialize P2P:', error);
      eventBus.emit('p2p:error', { error, stage: 'initialization' });
      throw error;
    }
  }

  /**
   * 动态加载PeerJS
   */
  loadPeerJS() {
    return new Promise((resolve, reject) => {
      if (typeof Peer !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/peerjs@1.5.0/dist/peerjs.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * 设置Peer事件监听
   */
  setupPeerEvents() {
    this.peer.on('open', (id) => {
      console.log('Peer opened with ID:', id);
      eventBus.emit('p2p:ready', { deviceId: id });
    });

    this.peer.on('connection', (conn) => {
      console.log('Incoming connection from:', conn.peer);
      this.handleIncomingConnection(conn);
    });

    this.peer.on('error', (error) => {
      console.error('Peer error:', error);
      eventBus.emit('p2p:error', { error, stage: 'peer' });
    });

    this.peer.on('disconnected', () => {
      console.warn('Peer disconnected, attempting reconnect...');
      eventBus.emit('p2p:disconnected');

      // 尝试重连
      if (!this.peer.destroyed) {
        this.peer.reconnect();
      }
    });

    this.peer.on('close', () => {
      console.log('Peer closed');
      eventBus.emit('p2p:closed');
    });
  }

  /**
   * 连接到远程设备
   * @param {string} targetDeviceId - 目标设备ID
   * @param {Object} metadata - 连接元数据
   * @returns {DataConnection} 连接对象
   */
  connect(targetDeviceId, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('P2PManager not initialized');
    }

    console.log(`Connecting to ${targetDeviceId}...`);

    const conn = this.peer.connect(targetDeviceId, {
      reliable: true,
      metadata
    });

    this.setupConnectionEvents(conn, 'outgoing');

    return conn;
  }

  /**
   * 处理传入连接
   */
  handleIncomingConnection(conn) {
    this.setupConnectionEvents(conn, 'incoming');
  }

  /**
   * 设置连接事件监听
   */
  setupConnectionEvents(conn, direction) {
    const connectionId = `${direction}-${conn.peer}`;
    this.connections.set(connectionId, conn);

    conn.on('open', () => {
      console.log(`Connection opened: ${connectionId}`);
      eventBus.emit('p2p:connection:open', {
        conn,
        peer: conn.peer,
        direction,
        metadata: conn.metadata
      });
    });

    conn.on('data', (data) => {
      eventBus.emit('p2p:connection:data', {
        conn,
        peer: conn.peer,
        data,
        direction
      });
    });

    conn.on('close', () => {
      console.log(`Connection closed: ${connectionId}`);
      this.connections.delete(connectionId);
      eventBus.emit('p2p:connection:close', {
        peer: conn.peer,
        direction
      });
    });

    conn.on('error', (error) => {
      console.error(`Connection error: ${connectionId}`, error);
      eventBus.emit('p2p:connection:error', {
        peer: conn.peer,
        error,
        direction
      });
    });
  }

  /**
   * 关闭指定连接
   */
  closeConnection(connectionId) {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.close();
      this.connections.delete(connectionId);
    }
  }

  /**
   * 关闭所有连接
   */
  closeAllConnections() {
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
  }

  /**
   * 销毁P2P管理器
   */
  destroy() {
    this.closeAllConnections();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.isInitialized = false;
    eventBus.emit('p2p:destroyed');
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      initialized: this.isInitialized,
      deviceId: this.myDeviceId,
      peerReady: this.peer && !this.peer.destroyed,
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.keys())
    };
  }
}

// 导出单例
export const p2pManager = new P2PManager();
export default P2PManager;

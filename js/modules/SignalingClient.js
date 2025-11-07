/**
 * SignalingClient - 信令客户端
 * 处理WebSocket连接和设备发现
 */
import { eventBus } from '../core/EventBus.js';
import { config } from '../core/Config.js';

class SignalingClient {
  constructor() {
    this.ws = null;
    this.deviceId = null;
    this.deviceName = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
  }

  /**
   * 连接到信令服务器
   * @param {string} deviceId - 设备ID
   * @param {string} deviceName - 设备名称
   */
  connect(deviceId, deviceName) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;

    const wsUrl = `ws://${window.location.hostname}:${window.location.port}`;
    console.log('Connecting to signaling server:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketEvents();
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      eventBus.emit('signaling:error', { error });
      this.scheduleReconnect();
    }
  }

  /**
   * 设置WebSocket事件监听
   */
  setupWebSocketEvents() {
    this.ws.onopen = () => {
      console.log('Connected to signaling server');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // 注册设备
      this.register();

      // 启动心跳
      this.startHeartbeat();

      eventBus.emit('signaling:connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from signaling server');
      this.isConnected = false;
      this.stopHeartbeat();

      eventBus.emit('signaling:disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      eventBus.emit('signaling:error', { error });
    };
  }

  /**
   * 注册设备
   */
  register() {
    this.send({
      type: 'register',
      deviceId: this.deviceId,
      deviceName: this.deviceName
    });
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    this.stopHeartbeat();

    const interval = config.get('signaling.heartbeatInterval');
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'heartbeat' });
      }
    }, interval);
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 处理消息
   */
  handleMessage(message) {
    switch (message.type) {
      case 'device-list':
        eventBus.emit('signaling:device-list', {
          devices: message.devices
        });
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        eventBus.emit('signaling:webrtc-signal', message);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * 发送消息
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not open');
    }
  }

  /**
   * 计划重连
   */
  scheduleReconnect() {
    const maxAttempts = config.get('signaling.maxReconnectAttempts');

    if (this.reconnectAttempts >= maxAttempts) {
      console.error('Max reconnect attempts reached');
      eventBus.emit('signaling:reconnect-failed');
      return;
    }

    this.reconnectAttempts++;

    const delay = config.get('signaling.reconnectDelay');
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.deviceId, this.deviceName);
    }, delay);
  }

  /**
   * 更新设备名称
   */
  updateDeviceName(newName) {
    this.deviceName = newName;
    if (this.isConnected) {
      this.register();
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      connected: this.isConnected,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// 导出单例
export const signalingClient = new SignalingClient();
export default SignalingClient;

/**
 * SignalingClient - 信令客户端
 * 处理WebSocket连接和设备发现
 */
import { eventBus } from '../utils/EventBus';
import { config } from '../utils/Config';
import type { SignalingMessage } from '../types';

export class SignalingClient {
  private ws: WebSocket | null = null;
  private deviceId: string | null = null;
  private deviceName: string | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  /**
   * 连接到信令服务器
   */
  connect(url: string, deviceId: string, deviceName: string): void {
    this.deviceId = deviceId;
    this.deviceName = deviceName;

    console.log('[SignalingClient] Connecting to:', url);

    try {
      this.ws = new WebSocket(url);
      this.setupWebSocketEvents();
    } catch (error) {
      console.error('[SignalingClient] Failed to create WebSocket:', error);
      eventBus.emit('signaling:error', { error: error as Error });
      this.scheduleReconnect(url);
    }
  }

  /**
   * 设置WebSocket事件监听
   */
  private setupWebSocketEvents(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[SignalingClient] Connected to signaling server');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // 注册设备
      this.register();

      // 启动心跳
      this.startHeartbeat();

      eventBus.emit('signaling:connected', undefined);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[SignalingClient] Failed to parse message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('[SignalingClient] Disconnected from signaling server');
      this.isConnected = false;
      this.stopHeartbeat();

      eventBus.emit('signaling:disconnected', undefined);

      // 尝试重连
      if (this.ws) {
        const url = this.ws.url;
        this.scheduleReconnect(url);
      }
    };

    this.ws.onerror = (error: Event) => {
      console.error('[SignalingClient] WebSocket error:', error);
      eventBus.emit('signaling:error', { error: error as any });
    };
  }

  /**
   * 注册设备
   */
  private register(): void {
    this.send({
      type: 'register',
      deviceId: this.deviceId!,
      deviceName: this.deviceName!,
    });
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    const interval = config.get('signaling').heartbeatInterval;
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'heartbeat' });
      }
    }, interval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 处理消息
   */
  private handleMessage(message: SignalingMessage): void {
    switch (message.type) {
      case 'device-list':
        if (message.devices) {
          eventBus.emit('signaling:device-list', {
            devices: message.devices,
          });
        }
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // 转发WebRTC信令（暂时不实现，PeerJS内部处理）
        break;

      case 'room-update':
      case 'room-error':
        // 触发通用的signaling:message事件，由RoomManager处理
        eventBus.emit('signaling:message', { message });
        break;

      default:
        console.log('[SignalingClient] Unknown message type:', message.type);
    }
  }

  /**
   * 发送消息
   */
  send(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[SignalingClient] Cannot send message: WebSocket not open');
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(url: string): void {
    const maxAttempts = config.get('signaling').maxReconnectAttempts;

    if (this.reconnectAttempts >= maxAttempts) {
      console.error('[SignalingClient] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;

    const delay = config.get('signaling').reconnectDelay;
    console.log(
      `[SignalingClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})...`
    );

    this.reconnectTimer = setTimeout(() => {
      if (this.deviceId && this.deviceName) {
        this.connect(url, this.deviceId, this.deviceName);
      }
    }, delay);
  }

  /**
   * 更新设备名称
   */
  updateDeviceName(newName: string): void {
    this.deviceName = newName;
    if (this.isConnected) {
      this.register();
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
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
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// 导出单例
export const signalingClient = new SignalingClient();

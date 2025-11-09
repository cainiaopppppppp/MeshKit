/**
 * Config - 配置管理（TypeScript版本）
 */
import type { P2PConfig } from '../types';

class Config {
  private config: P2PConfig;

  constructor() {
    this.config = {
      webrtc: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        config: {
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
        },
      },
      peerjs: {
        // PeerJS服务器运行在独立的8000端口
        // WebSocket信令服务器运行在7000端口
        // host会自动使用当前访问的hostname，支持IP变动
        port: 8000,
        path: '/peerjs',  // 自定义路径
        debug: 2, // 调试级别
        // 如果想用公共服务器，注释掉port和path即可
      },
      transfer: {
        chunkSize: 1024 * 1024, // 1MB (优化大文件传输)
        sendDelay: 0,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 300000, // 5分钟超时（支持大文件）
      },
      signaling: {
        reconnectDelay: 3000,
        heartbeatInterval: 3000,
        maxReconnectAttempts: 5,
      },
      features: {
        multipleFiles: false,
        encryption: false,
        compression: false,
        chat: false,
        clipboard: false,
      },
    };
  }

  /**
   * 获取配置
   */
  get<K extends keyof P2PConfig>(key: K): P2PConfig[K];
  get(path: string): any {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 设置配置
   */
  set<K extends keyof P2PConfig>(key: K, value: P2PConfig[K]): void;
  set(path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey) return;

    let target: any = this.config;

    for (const key of keys) {
      if (!(key in target)) {
        target[key] = {};
      }
      target = target[key];
    }

    target[lastKey] = value;
  }

  /**
   * 批量更新配置
   */
  update(updates: Partial<P2PConfig>): void {
    this.deepMerge(this.config, updates);
  }

  /**
   * 深度合并对象
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) target[key] = {};
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * 重置配置为默认值
   */
  reset(): void {
    const defaultConfig = new Config();
    this.config = defaultConfig.config;
  }

  /**
   * 导出配置
   */
  export(): P2PConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 导入配置
   */
  import(config: P2PConfig): void {
    this.config = JSON.parse(JSON.stringify(config));
  }
}

// 导出单例
export const config = new Config();
export default Config;

/**
 * Config - 配置管理
 * 统一管理应用配置，支持扩展
 */
class Config {
  constructor() {
    this.config = {
      // WebRTC配置
      webrtc: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        config: {
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        }
      },

      // 文件传输配置
      transfer: {
        chunkSize: 256 * 1024, // 256KB 分块大小
        sendDelay: 0,          // 发送延迟（ms）
        maxRetries: 3,         // 最大重试次数
        retryDelay: 1000,      // 重试延迟（ms）
        timeout: 30000         // 连接超时（ms）
      },

      // 信令服务器配置
      signaling: {
        reconnectDelay: 3000,  // 重连延迟（ms）
        heartbeatInterval: 3000, // 心跳间隔（ms）
        maxReconnectAttempts: 5  // 最大重连次数
      },

      // UI配置
      ui: {
        showNotifications: true,
        autoDownload: false,
        theme: 'auto' // 'light', 'dark', 'auto'
      },

      // 调试配置
      debug: {
        enabled: false,
        logLevel: 'info' // 'debug', 'info', 'warn', 'error'
      },

      // 扩展插件配置
      plugins: {},

      // 功能开关
      features: {
        multipleFiles: false,    // 多文件传输（待扩展）
        encryption: false,       // 加密传输（待扩展）
        compression: false,      // 压缩传输（待扩展）
        chat: false,            // 聊天功能（待扩展）
        clipboard: false        // 剪贴板共享（待扩展）
      }
    };
  }

  /**
   * 获取配置
   * @param {string} path - 配置路径，如 'webrtc.iceServers'
   * @returns {*} 配置值
   */
  get(path) {
    const keys = path.split('.');
    let value = this.config;

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
   * @param {string} path - 配置路径
   * @param {*} value - 配置值
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.config;

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
   * @param {Object} updates - 配置更新对象
   */
  update(updates) {
    this.deepMerge(this.config, updates);
  }

  /**
   * 深度合并对象
   */
  deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
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
  reset() {
    const defaultConfig = new Config();
    this.config = defaultConfig.config;
  }

  /**
   * 导出配置
   * @returns {Object} 配置对象
   */
  export() {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 导入配置
   * @param {Object} config - 配置对象
   */
  import(config) {
    this.config = JSON.parse(JSON.stringify(config));
  }
}

// 导出单例
export const config = new Config();
export default Config;

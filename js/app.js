/**
 * App - 应用主入口
 * 初始化并协调所有模块
 */
import { eventBus } from './core/EventBus.js';
import { config } from './core/Config.js';
import { p2pManager } from './core/P2PManager.js';
import { signalingClient } from './modules/SignalingClient.js';
import { deviceManager } from './modules/DeviceManager.js';
import { fileTransfer } from './modules/FileTransfer.js';
import { uiManager } from './ui/UIManager.js';
import { logger } from './utils/Logger.js';

class App {
  constructor() {
    this.isInitialized = false;
    this.deviceId = null;
    this.deviceName = null;
  }

  /**
   * 初始化应用
   */
  async init() {
    if (this.isInitialized) {
      logger.warn('App already initialized');
      return;
    }

    try {
      logger.info('Initializing P2P Transfer App...');

      // 生成设备信息
      this.deviceId = deviceManager.constructor.generateDeviceId();
      this.deviceName = deviceManager.constructor.generateDeviceName(this.deviceId);

      logger.info('Device Info', { id: this.deviceId, name: this.deviceName });

      // 初始化UI管理器
      uiManager.init();
      logger.info('UI Manager initialized');

      // 设置设备名称输入框
      const deviceNameInput = document.getElementById('deviceName');
      if (deviceNameInput) {
        deviceNameInput.value = this.deviceName;
      }

      // 初始化设备管理器
      deviceManager.init(this.deviceId, this.deviceName);
      logger.info('Device Manager initialized');

      // 初始化P2P管理器
      await p2pManager.init(this.deviceId);
      logger.info('P2P Manager initialized');

      // 连接信令服务器
      signalingClient.connect(this.deviceId, this.deviceName);
      logger.info('Signaling Client connecting...');

      // 设置全局事件监听
      this.setupGlobalEventListeners();

      this.isInitialized = true;
      logger.info('App initialization complete!');

      // 触发应用就绪事件
      eventBus.emit('app:ready', {
        deviceId: this.deviceId,
        deviceName: this.deviceName
      });

    } catch (error) {
      logger.error('App initialization failed', error);
      throw error;
    }
  }

  /**
   * 设置全局事件监听
   */
  setupGlobalEventListeners() {
    // 监听设备名称更新
    eventBus.on('signaling:name-update', ({ name }) => {
      signalingClient.updateDeviceName(name);
    });

    // 监听应用错误
    eventBus.on('p2p:error', ({ error, stage }) => {
      logger.error(`P2P Error at ${stage}`, error);
    });

    eventBus.on('signaling:error', ({ error }) => {
      logger.error('Signaling Error', error);
    });

    eventBus.on('transfer:error', ({ error, direction }) => {
      logger.error(`Transfer Error (${direction})`, error);
    });

    // 监听连接状态
    eventBus.on('signaling:connected', () => {
      logger.info('Connected to signaling server');
    });

    eventBus.on('signaling:disconnected', () => {
      logger.warn('Disconnected from signaling server');
    });

    // 监听P2P状态
    eventBus.on('p2p:ready', ({ deviceId }) => {
      logger.info('P2P ready', { deviceId });
    });

    eventBus.on('p2p:connection:open', ({ peer, direction }) => {
      logger.info(`P2P connection opened (${direction})`, { peer });
    });

    eventBus.on('p2p:connection:close', ({ peer, direction }) => {
      logger.info(`P2P connection closed (${direction})`, { peer });
    });

    // 监听传输事件
    eventBus.on('transfer:started', ({ direction, file }) => {
      logger.info(`Transfer started (${direction})`, file);
    });

    eventBus.on('transfer:completed', ({ direction, avgSpeedMB }) => {
      logger.info(`Transfer completed (${direction})`, { avgSpeedMB });
    });

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        logger.debug('Page hidden');
      } else {
        logger.debug('Page visible');
      }
    });

    // 监听在线/离线状态
    window.addEventListener('online', () => {
      logger.info('Network online');
    });

    window.addEventListener('offline', () => {
      logger.warn('Network offline');
    });
  }

  /**
   * 清理资源
   */
  cleanup() {
    logger.info('Cleaning up...');

    try {
      // 关闭所有P2P连接
      p2pManager.destroy();

      // 断开信令连接
      signalingClient.disconnect();

      // 取消正在进行的传输
      if (fileTransfer.isTransferring) {
        fileTransfer.cancelTransfer();
      }

      logger.info('Cleanup complete');
    } catch (error) {
      logger.error('Cleanup error', error);
    }
  }

  /**
   * 获取应用状态
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      signaling: signalingClient.getStatus(),
      p2p: p2pManager.getConnectionStatus(),
      transfer: fileTransfer.getStatus(),
      devices: {
        count: deviceManager.getDeviceCount(),
        selected: deviceManager.selectedDeviceId
      }
    };
  }

  /**
   * 重启应用
   */
  async restart() {
    logger.info('Restarting app...');

    this.cleanup();
    this.isInitialized = false;

    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.init();
  }
}

// 创建应用实例
const app = new App();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init().catch(error => {
      console.error('Failed to initialize app:', error);
      alert('应用初始化失败，请刷新页面重试');
    });
  });
} else {
  app.init().catch(error => {
    console.error('Failed to initialize app:', error);
    alert('应用初始化失败，请刷新页面重试');
  });
}

// 导出应用实例到全局（用于调试）
window.P2PApp = app;
window.P2PEventBus = eventBus;
window.P2PConfig = config;
window.P2PLogger = logger;

// 导出应用实例
export default app;

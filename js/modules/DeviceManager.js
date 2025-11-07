/**
 * DeviceManager - 设备管理器
 * 管理附近的设备列表
 */
import { eventBus } from '../core/EventBus.js';

class DeviceManager {
  constructor() {
    this.myDeviceId = null;
    this.myDeviceName = null;
    this.devices = new Map(); // 附近的设备
    this.selectedDeviceId = null;

    this.setupEventListeners();
  }

  /**
   * 初始化设备管理器
   */
  init(deviceId, deviceName) {
    this.myDeviceId = deviceId;
    this.myDeviceName = deviceName;

    eventBus.emit('device:initialized', {
      deviceId,
      deviceName
    });
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听设备列表更新
    eventBus.on('signaling:device-list', ({ devices }) => {
      this.updateDevices(devices);
    });
  }

  /**
   * 更新设备列表
   */
  updateDevices(deviceList) {
    this.devices.clear();

    deviceList.forEach(device => {
      // 不包括自己
      if (device.id !== this.myDeviceId) {
        this.devices.set(device.id, {
          id: device.id,
          name: device.name,
          timestamp: device.timestamp,
          lastSeen: Date.now()
        });
      }
    });

    // 如果选中的设备已经离线，清除选择
    if (this.selectedDeviceId && !this.devices.has(this.selectedDeviceId)) {
      this.selectedDeviceId = null;
      eventBus.emit('device:selection-cleared');
    }

    eventBus.emit('device:list-updated', {
      devices: Array.from(this.devices.values())
    });
  }

  /**
   * 选择设备
   */
  selectDevice(deviceId) {
    if (!this.devices.has(deviceId)) {
      console.warn('Device not found:', deviceId);
      return false;
    }

    this.selectedDeviceId = deviceId;
    const device = this.devices.get(deviceId);

    eventBus.emit('device:selected', {
      deviceId,
      device
    });

    return true;
  }

  /**
   * 取消选择
   */
  clearSelection() {
    this.selectedDeviceId = null;
    eventBus.emit('device:selection-cleared');
  }

  /**
   * 获取设备信息
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId);
  }

  /**
   * 获取选中的设备
   */
  getSelectedDevice() {
    if (!this.selectedDeviceId) return null;
    return this.devices.get(this.selectedDeviceId);
  }

  /**
   * 获取所有设备
   */
  getAllDevices() {
    return Array.from(this.devices.values());
  }

  /**
   * 获取设备数量
   */
  getDeviceCount() {
    return this.devices.size;
  }

  /**
   * 检查设备是否在线
   */
  isDeviceOnline(deviceId) {
    return this.devices.has(deviceId);
  }

  /**
   * 更新我的设备名称
   */
  updateMyDeviceName(newName) {
    this.myDeviceName = newName;
    eventBus.emit('device:name-updated', { newName });
  }

  /**
   * 生成设备ID
   */
  static generateDeviceId() {
    return 'device-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 生成设备名称
   */
  static generateDeviceName(deviceId) {
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
    const deviceType = isMobile ? '📱手机' : '💻电脑';
    const shortId = deviceId.substr(-4).toUpperCase();
    return `${deviceType}-${shortId}`;
  }

  /**
   * 获取设备图标
   */
  static getDeviceIcon(deviceName) {
    if (deviceName.includes('📱')) return '📱';
    if (deviceName.includes('💻')) return '💻';
    return '📱';
  }
}

// 导出单例
export const deviceManager = new DeviceManager();
export default DeviceManager;

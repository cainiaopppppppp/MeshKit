/**
 * DeviceManager - 设备管理器
 * 管理附近的设备列表和设备选择
 */
import { eventBus } from '../utils/EventBus';
import type { Device } from '../types';

export class DeviceManager {
  private myDeviceId: string | null = null;
  private myDeviceName: string | null = null;
  private devices: Map<string, Device> = new Map();
  private selectedDeviceId: string | null = null;

  /**
   * 初始化设备管理器
   */
  init(deviceId: string, deviceName: string): void {
    this.myDeviceId = deviceId;
    this.myDeviceName = deviceName;

    // 监听设备列表更新
    eventBus.on('signaling:device-list', ({ devices }) => {
      this.updateDevices(devices);
    });
  }

  /**
   * 更新设备列表
   */
  private updateDevices(deviceList: Device[]): void {
    this.devices.clear();

    deviceList.forEach((device) => {
      // 不包括自己
      if (device.id !== this.myDeviceId) {
        this.devices.set(device.id, {
          ...device,
          lastSeen: Date.now(),
        });
      }
    });

    // 如果选中的设备已经离线，清除选择
    if (this.selectedDeviceId && !this.devices.has(this.selectedDeviceId)) {
      this.selectedDeviceId = null;
      eventBus.emit('device:selection-cleared', undefined);
    }

    eventBus.emit('device:list-updated', {
      devices: Array.from(this.devices.values()),
    });
  }

  /**
   * 选择设备
   */
  selectDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      console.warn('[DeviceManager] Device not found:', deviceId);
      return false;
    }

    this.selectedDeviceId = deviceId;

    eventBus.emit('device:selected', {
      deviceId,
      device,
    });

    return true;
  }

  /**
   * 取消选择
   */
  clearSelection(): void {
    this.selectedDeviceId = null;
    eventBus.emit('device:selection-cleared', undefined);
  }

  /**
   * 获取设备信息
   */
  getDevice(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * 获取选中的设备
   */
  getSelectedDevice(): Device | null {
    if (!this.selectedDeviceId) return null;
    return this.devices.get(this.selectedDeviceId) || null;
  }

  /**
   * 获取所有设备
   */
  getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  /**
   * 获取设备数量
   */
  getDeviceCount(): number {
    return this.devices.size;
  }

  /**
   * 检查设备是否在线
   */
  isDeviceOnline(deviceId: string): boolean {
    return this.devices.has(deviceId);
  }

  /**
   * 更新我的设备名称
   */
  updateMyDeviceName(newName: string): void {
    this.myDeviceName = newName;
  }

  /**
   * 获取我的设备信息
   */
  getMyDevice(): { id: string; name: string } | null {
    if (!this.myDeviceId || !this.myDeviceName) return null;
    return {
      id: this.myDeviceId,
      name: this.myDeviceName,
    };
  }

  /**
   * 生成设备ID
   */
  static generateDeviceId(): string {
    return 'device-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 生成设备名称
   */
  static generateDeviceName(deviceId?: string): string {
    const isMobile =
      typeof navigator !== 'undefined' &&
      /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
    const deviceType = isMobile ? '📱手机' : '💻电脑';
    const shortId = deviceId
      ? deviceId.substr(-4).toUpperCase()
      : Math.random().toString(36).substr(-4).toUpperCase();
    return `${deviceType}-${shortId}`;
  }

  /**
   * 获取设备图标
   */
  static getDeviceIcon(deviceName: string): string {
    if (deviceName.includes('📱')) return '📱';
    if (deviceName.includes('💻')) return '💻';
    return '📱';
  }
}

// 导出单例
export const deviceManager = new DeviceManager();

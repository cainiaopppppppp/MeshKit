/**
 * 设备屏蔽管理器
 * 管理被用户屏蔽的设备列表
 */

export interface BlockedDevice {
  deviceId: string;
  deviceName: string;
  blockedUntil: number; // 屏蔽截止时间戳
  blockedAt: number; // 屏蔽开始时间戳
}

const STORAGE_KEY = 'meshkit_blocked_devices';

export class DeviceBlockManager {
  private blockedDevices: Map<string, BlockedDevice>;
  private cleanupInterval: number | null = null;

  constructor() {
    this.blockedDevices = new Map();
    this.loadFromStorage();
    this.startCleanupTimer();
  }

  /**
   * 屏蔽设备
   * @param deviceId 设备ID
   * @param deviceName 设备名称
   * @param durationMs 屏蔽时长（毫秒）
   */
  blockDevice(deviceId: string, deviceName: string, durationMs: number): void {
    const now = Date.now();
    const blockedDevice: BlockedDevice = {
      deviceId,
      deviceName,
      blockedAt: now,
      blockedUntil: now + durationMs,
    };

    this.blockedDevices.set(deviceId, blockedDevice);
    this.saveToStorage();

    console.log(`[DeviceBlockManager] Blocked device: ${deviceName} (${deviceId}) for ${durationMs / 1000}s`);
  }

  /**
   * 解除屏蔽设备
   * @param deviceId 设备ID
   */
  unblockDevice(deviceId: string): void {
    const device = this.blockedDevices.get(deviceId);
    if (device) {
      this.blockedDevices.delete(deviceId);
      this.saveToStorage();
      console.log(`[DeviceBlockManager] Unblocked device: ${device.deviceName} (${deviceId})`);
    }
  }

  /**
   * 检查设备是否被屏蔽
   * @param deviceId 设备ID
   * @returns 是否被屏蔽
   */
  isBlocked(deviceId: string): boolean {
    const device = this.blockedDevices.get(deviceId);
    if (!device) return false;

    const now = Date.now();
    if (now >= device.blockedUntil) {
      // 屏蔽时间已过，自动解除
      this.unblockDevice(deviceId);
      return false;
    }

    return true;
  }

  /**
   * 获取所有被屏蔽的设备
   * @returns 被屏蔽设备列表
   */
  getBlockedDevices(): BlockedDevice[] {
    const now = Date.now();
    const devices: BlockedDevice[] = [];

    this.blockedDevices.forEach((device) => {
      if (now < device.blockedUntil) {
        devices.push(device);
      } else {
        // 过期的自动清理
        this.blockedDevices.delete(device.deviceId);
      }
    });

    return devices;
  }

  /**
   * 获取剩余屏蔽时间（秒）
   * @param deviceId 设备ID
   * @returns 剩余秒数，如果未屏蔽返回0
   */
  getRemainingTime(deviceId: string): number {
    const device = this.blockedDevices.get(deviceId);
    if (!device) return 0;

    const now = Date.now();
    const remaining = Math.max(0, device.blockedUntil - now);
    return Math.ceil(remaining / 1000);
  }

  /**
   * 从 localStorage 加载屏蔽列表
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as BlockedDevice[];
        const now = Date.now();

        data.forEach((device) => {
          // 只加载未过期的
          if (device.blockedUntil > now) {
            this.blockedDevices.set(device.deviceId, device);
          }
        });

        console.log(`[DeviceBlockManager] Loaded ${this.blockedDevices.size} blocked devices from storage`);
      }
    } catch (error) {
      console.error('[DeviceBlockManager] Failed to load from storage:', error);
    }
  }

  /**
   * 保存到 localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.blockedDevices.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[DeviceBlockManager] Failed to save to storage:', error);
    }
  }

  /**
   * 启动清理定时器（每分钟检查一次过期设备）
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupExpiredDevices();
    }, 60000); // 每分钟执行一次
  }

  /**
   * 清理过期的屏蔽设备
   */
  private cleanupExpiredDevices(): void {
    const now = Date.now();
    let cleaned = 0;

    this.blockedDevices.forEach((device, deviceId) => {
      if (now >= device.blockedUntil) {
        this.blockedDevices.delete(deviceId);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.saveToStorage();
      console.log(`[DeviceBlockManager] Cleaned up ${cleaned} expired devices`);
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 单例实例
export const deviceBlockManager = new DeviceBlockManager();

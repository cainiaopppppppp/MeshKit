/**
 * @p2p-transfer/core
 *
 * P2P文件传输核心逻辑包
 * 跨平台共享：Web、Desktop（Electron）、Mobile（React Native）
 */

// 类型定义
export * from './types';

// 工具类
export { eventBus } from './utils/EventBus';
export { default as EventBus } from './utils/EventBus';
export { config } from './utils/Config';
export { default as Config } from './utils/Config';
export * from './utils';

// 管理器
export { P2PManager, p2pManager } from './managers/P2PManager';
export { DeviceManager, deviceManager } from './managers/DeviceManager';
export { FileTransferManager, fileTransferManager } from './managers/FileTransferManager';

// 服务
export { SignalingClient, signalingClient } from './services/SignalingClient';

// 导入用于内部函数使用
import { DeviceManager, deviceManager } from './managers/DeviceManager';
import { p2pManager } from './managers/P2PManager';
import { fileTransferManager } from './managers/FileTransferManager';
import { signalingClient } from './services/SignalingClient';

/**
 * 初始化核心模块
 *
 * @param deviceId - 设备ID（可选，不提供会自动生成）
 * @param deviceName - 设备名称（可选，不提供会自动生成）
 * @returns 设备信息
 */
export async function initCore(deviceId?: string, deviceName?: string) {
  console.log('[@p2p-transfer/core] Initializing...');

  // 生成或使用提供的设备ID和名称
  const finalDeviceId = deviceId || DeviceManager.generateDeviceId();
  const finalDeviceName = deviceName || DeviceManager.generateDeviceName(finalDeviceId);

  // 初始化设备管理器
  deviceManager.init(finalDeviceId, finalDeviceName);

  // 初始化P2P管理器
  await p2pManager.init(finalDeviceId);

  console.log('[@p2p-transfer/core] Initialized', {
    deviceId: finalDeviceId,
    deviceName: finalDeviceName,
  });

  return {
    deviceId: finalDeviceId,
    deviceName: finalDeviceName,
  };
}

/**
 * 连接到信令服务器
 *
 * @param url - 信令服务器URL
 */
export function connectSignaling(url: string) {
  const device = deviceManager.getMyDevice();
  if (!device) {
    throw new Error('Device not initialized. Call initCore() first.');
  }

  signalingClient.connect(url, device.id, device.name);
}

/**
 * 清理资源
 */
export function cleanup() {
  console.log('[@p2p-transfer/core] Cleaning up...');

  fileTransferManager.fullReset();
  p2pManager.destroy();
  signalingClient.disconnect();
  deviceManager.clearSelection();

  console.log('[@p2p-transfer/core] Cleanup complete');
}

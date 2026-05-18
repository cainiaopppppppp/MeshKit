/**
 * @p2p-transfer/core
 *
 * Shared core exports for Web, Desktop, and Mobile.
 */

export * from './types';

export { eventBus } from './utils/EventBus';
export { default as EventBus } from './utils/EventBus';
export { config } from './utils/Config';
export { default as Config } from './utils/Config';
export { fileEncryption, FileEncryptionHelper, ENCRYPTION_METHODS } from './utils/FileEncryption';
export type { EncryptionMethod } from './utils/FileEncryption';
export * from './utils';

export { P2PManager, p2pManager } from './managers/P2PManager';
export { DeviceManager, deviceManager } from './managers/DeviceManager';
export { FileTransferManager, fileTransferManager } from './managers/FileTransferManager';
export { RoomManager, roomManager } from './managers/RoomManager';
export { DeviceBlockManager, deviceBlockManager } from './managers/DeviceBlockManager';
export type { BlockedDevice } from './managers/DeviceBlockManager';

export { SignalingClient, signalingClient } from './services/SignalingClient';

import { DeviceManager, deviceManager } from './managers/DeviceManager';
import { p2pManager } from './managers/P2PManager';
import { fileTransferManager } from './managers/FileTransferManager';
import { roomManager } from './managers/RoomManager';
import { signalingClient } from './services/SignalingClient';

function isPeerIdUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('is taken') || message.includes('unavailable-id');
}

export async function initCore(deviceId?: string, deviceName?: string) {
  console.log('[@p2p-transfer/core] Initializing...');

  let finalDeviceId = deviceId || DeviceManager.generateDeviceId();
  let finalDeviceName = deviceName || DeviceManager.generateDeviceName(finalDeviceId);

  try {
    await p2pManager.init(finalDeviceId);
  } catch (error) {
    if (!isPeerIdUnavailableError(error)) {
      throw error;
    }

    const fallbackDeviceId = DeviceManager.generateDeviceId();
    const fallbackDeviceName = deviceName || DeviceManager.generateDeviceName(fallbackDeviceId);

    console.warn('[@p2p-transfer/core] Device ID unavailable, switching to a new ID:', {
      previousDeviceId: finalDeviceId,
      nextDeviceId: fallbackDeviceId,
    });

    await p2pManager.init(fallbackDeviceId);
    finalDeviceId = fallbackDeviceId;
    finalDeviceName = fallbackDeviceName;
  }

  deviceManager.init(finalDeviceId, finalDeviceName);
  roomManager.init(finalDeviceId, finalDeviceName);

  console.log('[@p2p-transfer/core] Initialized', {
    deviceId: finalDeviceId,
    deviceName: finalDeviceName,
  });

  return {
    deviceId: finalDeviceId,
    deviceName: finalDeviceName,
  };
}

export function connectSignaling(url: string) {
  const device = deviceManager.getMyDevice();
  if (!device) {
    throw new Error('Device not initialized. Call initCore() first.');
  }

  signalingClient.connect(url, device.id, device.name);
}

export async function refreshP2PPeer() {
  await p2pManager.refreshPeer();
}

export function updateDeviceName(newName: string) {
  if (!newName || newName.trim() === '') {
    throw new Error('Device name cannot be empty');
  }

  const trimmedName = newName.trim();
  deviceManager.updateMyDeviceName(trimmedName);
  signalingClient.updateDeviceName(trimmedName);

  console.log('[@p2p-transfer/core] Device name updated:', trimmedName);

  return trimmedName;
}

export function cleanup() {
  console.log('[@p2p-transfer/core] Cleaning up...');

  fileTransferManager.fullReset();
  p2pManager.destroy();
  signalingClient.disconnect();
  deviceManager.clearSelection();

  console.log('[@p2p-transfer/core] Cleanup complete');
}

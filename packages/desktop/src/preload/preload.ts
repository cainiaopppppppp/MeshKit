import { clipboard, contextBridge, ipcRenderer } from 'electron';

export interface EmbeddedServiceDetails {
  running: boolean;
  listenHost: string;
  publicHost: string;
  error?: string;
}

export interface EmbeddedSignalingDetails extends EmbeddedServiceDetails {
  wsPort: number;
  peerPort: number;
  wsUrl: string;
  peerUrl: string;
}

export interface EmbeddedShareWebDetails extends EmbeddedServiceDetails {
  port: number;
  url: string;
  rootDir: string;
}

export interface DiscoveredShareDetails {
  instanceId: string;
  deviceName: string;
  host: string;
  sharePort: number;
  shareUrl: string;
  wsPort: number;
  peerPort: number;
  lastSeenAt: number;
  discoveredAt: number;
}

export interface EmbeddedDiscoveryDetails {
  running: boolean;
  port: number;
  deviceName: string;
  error?: string;
  discoveredShares: DiscoveredShareDetails[];
}

export interface EmbeddedServicesStatus {
  sharingEnabled: boolean;
  signaling: EmbeddedSignalingDetails;
  shareWeb: EmbeddedShareWebDetails;
  discovery: EmbeddedDiscoveryDetails;
  preferredHost: string;
  localAddresses: string[];
}

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  getLocalIPAddresses: () => ipcRenderer.invoke('network:getLocalIPAddresses'),
  getEmbeddedServiceStatus: () => ipcRenderer.invoke('services:getStatus') as Promise<EmbeddedServicesStatus>,
  startEmbeddedServices: () => ipcRenderer.invoke('services:start') as Promise<EmbeddedServicesStatus>,
  stopEmbeddedServices: () => ipcRenderer.invoke('services:stop') as Promise<EmbeddedServicesStatus>,
  restartEmbeddedServices: () => ipcRenderer.invoke('services:restart') as Promise<EmbeddedServicesStatus>,
  copyText: async (text: string) => {
    clipboard.writeText(text);
    return true;
  },
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (defaultPath: string) => ipcRenderer.invoke('dialog:saveFile', defaultPath),
  isElectron: true,
});

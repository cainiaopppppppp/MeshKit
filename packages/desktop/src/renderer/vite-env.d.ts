/// <reference types="vite/client" />

declare module 'qrcode';

interface Window {
  electronAPI?: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    getLocalIPAddresses: () => Promise<string[]>;
    getEmbeddedServiceStatus: () => Promise<import('../preload/preload').EmbeddedServicesStatus>;
    startEmbeddedServices: () => Promise<import('../preload/preload').EmbeddedServicesStatus>;
    stopEmbeddedServices: () => Promise<import('../preload/preload').EmbeddedServicesStatus>;
    restartEmbeddedServices: () => Promise<import('../preload/preload').EmbeddedServicesStatus>;
    copyText: (text: string) => Promise<boolean>;
    openFile: () => Promise<string[]>;
    openDirectory: () => Promise<string[]>;
    saveFile: (defaultPath: string) => Promise<string | undefined>;
    isElectron: boolean;
  };
}

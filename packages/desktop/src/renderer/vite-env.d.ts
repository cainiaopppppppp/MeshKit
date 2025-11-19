/// <reference types="vite/client" />

// Electron API 类型定义
interface Window {
  electronAPI?: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    openFile: () => Promise<string[]>;
    openDirectory: () => Promise<string[]>;
    saveFile: (defaultPath: string) => Promise<string | undefined>;
    isElectron: boolean;
  };
}

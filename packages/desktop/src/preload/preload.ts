import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

  // 文件对话框
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (defaultPath: string) => ipcRenderer.invoke('dialog:saveFile', defaultPath),

  // 环境标识
  isElectron: true,
});

// TypeScript 类型定义
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
      openFile: () => Promise<string[]>;
      openDirectory: () => Promise<string[]>;
      saveFile: (defaultPath: string) => Promise<string | undefined>;
      isElectron: boolean;
    };
  }
}

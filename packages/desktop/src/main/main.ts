import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { join } from 'path';
import { networkInterfaces } from 'os';
import { autoUpdater } from 'electron-updater';

// 禁用硬件加速（可选，解决某些平台的渲染问题）
// app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const rendererDevUrl = 'http://127.0.0.1:5173';

function isPrivateIPv4(address: string): boolean {
  if (/^10\.\d+\.\d+\.\d+$/.test(address)) {
    return true;
  }

  if (/^192\.168\.\d+\.\d+$/.test(address)) {
    return true;
  }

  const match = address.match(/^172\.(\d+)\.\d+\.\d+$/);
  if (!match) {
    return false;
  }

  const secondOctet = Number.parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isLikelyVirtualAdapter(name: string): boolean {
  return /vmware|virtualbox|hyper-v|vethernet|default switch|vmnet|docker|wsl|tailscale|zerotier|wireguard|bluetooth/i.test(name);
}

function getAdapterPriority(name: string, address: string): number {
  let score = 100;
  const normalized = name.toLowerCase();

  if (normalized.includes('wlan') || normalized.includes('wi-fi') || normalized.includes('wifi') || normalized.includes('无线')) {
    score -= 40;
  } else if (normalized.includes('ethernet') || normalized.includes('以太网')) {
    score -= 30;
  }

  if (isPrivateIPv4(address)) {
    score -= 20;
  }

  if (address.startsWith('192.168.')) {
    score -= 8;
  } else if (address.startsWith('10.')) {
    score -= 6;
  } else if (address.startsWith('172.')) {
    score -= 4;
  }

  if (isLikelyVirtualAdapter(name)) {
    score += 100;
  }

  return score;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MeshKit - P2P 文件传输',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    show: false, // 先不显示，等内容加载后再显示
  });

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 加载应用
  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
    mainWindow.loadURL(rendererDevUrl);
    // 打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    // 临时：生产模式也打开开发者工具用于调试
    mainWindow.webContents.openDevTools();
  }

  // 拦截新窗口打开，使用默认浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 创建应用菜单
  createMenu();
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '查看',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '切换开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/cainiaopppppppp/MeshKit');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 应用启动
app.whenReady().then(() => {
  createWindow();

  // 检查更新（仅在生产环境）
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    // macOS: 点击 dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 通信示例
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

ipcMain.handle('network:getLocalIPAddresses', () => {
  const interfaces = networkInterfaces();
  const candidates: Array<{ name: string; address: string }> = [];

  for (const [name, group] of Object.entries(interfaces)) {
    if (!group) continue;

    for (const info of group) {
      if (info.family === 'IPv4' && !info.internal) {
        candidates.push({
          name,
          address: info.address,
        });
      }
    }
  }

  const sortedCandidates = candidates
    .sort((a, b) => getAdapterPriority(a.name, a.address) - getAdapterPriority(b.name, b.address));

  const physicalCandidates = sortedCandidates.filter((item) => !isLikelyVirtualAdapter(item.name));
  const preferredCandidates = physicalCandidates.length > 0 ? physicalCandidates : sortedCandidates;

  return Array.from(new Set(preferredCandidates.map((item) => item.address)));
});

// 文件选择对话框
ipcMain.handle('dialog:openFile', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
  });
  return result.filePaths;
});

// 文件夹选择对话框
ipcMain.handle('dialog:openDirectory', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });
  return result.filePaths;
});

// 保存文件对话框
ipcMain.handle('dialog:saveFile', async (_, defaultPath: string) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath,
  });
  return result.filePath;
});

// 自动更新事件
autoUpdater.on('update-available', () => {
  console.log('发现新版本');
});

autoUpdater.on('update-downloaded', () => {
  console.log('更新已下载');
  autoUpdater.quitAndInstall();
});

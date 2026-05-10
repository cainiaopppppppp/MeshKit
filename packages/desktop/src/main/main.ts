import { existsSync } from 'node:fs';
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { join } from 'node:path';

import { autoUpdater } from 'electron-updater';

import {
  startEmbeddedSignaling,
  type EmbeddedSignalingController,
  type EmbeddedSignalingStatus,
} from './embeddedSignaling';
import { getLocalIPAddresses, getPreferredLocalHost } from './networkUtils';
import {
  startShareDiscovery,
  type DiscoveredShare,
  type ShareDiscoveryController,
  type ShareDiscoveryStatus,
} from './shareDiscovery';
import {
  startShareWebServer,
  type ShareWebServerController,
  type ShareWebServerStatus,
} from './shareWebServer';

let mainWindow: BrowserWindow | null = null;
let signalingController: EmbeddedSignalingController | null = null;
let shareWebController: ShareWebServerController | null = null;
let discoveryController: ShareDiscoveryController | null = null;
let isStoppingServices = false;
let sharingEnabled = true;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const rendererDevUrl = 'http://127.0.0.1:5173';

let signalingStatus: EmbeddedSignalingStatus = {
  running: false,
  listenHost: '0.0.0.0',
  publicHost: getPreferredLocalHost(),
  wsPort: 7000,
  peerPort: 8000,
  wsUrl: `ws://${getPreferredLocalHost()}:7000/ws`,
  peerUrl: `http://${getPreferredLocalHost()}:8000/peerjs`,
};

let shareWebStatus: ShareWebServerStatus = {
  running: false,
  listenHost: '0.0.0.0',
  publicHost: getPreferredLocalHost(),
  port: 3000,
  url: `http://${getPreferredLocalHost()}:3000/`,
  rootDir: getShareWebRootDir(),
};

let discoveryStatus: ShareDiscoveryStatus = {
  running: false,
  port: 41041,
  deviceName: 'MeshKit',
};

function getShareWebRootDir(): string {
  return join(__dirname, '../web-share');
}

function getWindowIconPath(): string | undefined {
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(process.resourcesPath, 'build/icon.png'),
    join(process.resourcesPath, 'icon.png'),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function getDiscoveredShares(): DiscoveredShare[] {
  return discoveryController?.getDiscoveredShares() || [];
}

function getEmbeddedServiceStatus() {
  return {
    sharingEnabled,
    signaling: signalingStatus,
    shareWeb: shareWebStatus,
    discovery: {
      ...discoveryStatus,
      discoveredShares: getDiscoveredShares(),
    },
    preferredHost: getPreferredLocalHost(),
    localAddresses: getLocalIPAddresses(),
  };
}

async function startEmbeddedServices() {
  if (signalingController || shareWebController || discoveryController) {
    return;
  }

  try {
    signalingController = await startEmbeddedSignaling({
      host: '0.0.0.0',
      wsPort: 7000,
      peerPort: 8000,
    });
    signalingStatus = signalingController.status;
    console.log(`[desktop] Embedded signaling ready: ${signalingStatus.wsUrl}`);
  } catch (error) {
    signalingController = null;
    signalingStatus = {
      ...signalingStatus,
      running: false,
      error: error instanceof Error ? error.message : 'Failed to start embedded signaling',
    };
    console.error('[desktop] Failed to start embedded signaling:', error);
  }

  try {
    shareWebController = await startShareWebServer({
      rootDir: getShareWebRootDir(),
      host: '0.0.0.0',
      preferredPort: 3000,
    });
    shareWebStatus = shareWebController.status;
    console.log(`[desktop] Embedded share page ready: ${shareWebStatus.url}`);
  } catch (error) {
    shareWebController = null;
    shareWebStatus = {
      ...shareWebStatus,
      running: false,
      error: error instanceof Error ? error.message : 'Failed to start embedded share page',
    };
    console.error('[desktop] Failed to start embedded share page:', error);
  }

  if (signalingStatus.running && shareWebStatus.running) {
    try {
      discoveryController = await startShareDiscovery({
        host: shareWebStatus.publicHost,
        sharePort: shareWebStatus.port,
        shareUrl: shareWebStatus.url,
        wsPort: signalingStatus.wsPort,
        peerPort: signalingStatus.peerPort,
      });
      discoveryStatus = discoveryController.status;
      console.log(`[desktop] Share discovery ready on UDP ${discoveryStatus.port}`);
    } catch (error) {
      discoveryController = null;
      discoveryStatus = {
        ...discoveryStatus,
        running: false,
        error: error instanceof Error ? error.message : 'Failed to start LAN discovery',
      };
      console.error('[desktop] Failed to start share discovery:', error);
    }
  }
}

async function stopEmbeddedServices() {
  await Promise.allSettled([
    discoveryController?.stop(),
    signalingController?.stop(),
    shareWebController?.stop(),
  ]);

  signalingStatus = {
    ...signalingStatus,
    running: false,
    error: undefined,
  };
  shareWebStatus = {
    ...shareWebStatus,
    running: false,
    error: undefined,
  };
  discoveryStatus = {
    ...discoveryStatus,
    running: false,
    error: undefined,
  };

  discoveryController = null;
  signalingController = null;
  shareWebController = null;
}

async function enableSharing() {
  sharingEnabled = true;
  await startEmbeddedServices();
  return getEmbeddedServiceStatus();
}

async function disableSharing() {
  sharingEnabled = false;
  await stopEmbeddedServices();
  return getEmbeddedServiceStatus();
}

async function restartEmbeddedServices() {
  await stopEmbeddedServices();
  sharingEnabled = true;
  await startEmbeddedServices();
  return getEmbeddedServiceStatus();
}

function createWindow() {
  const windowIcon = getWindowIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MeshKit - P2P Collaboration',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    icon: windowIcon,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    void mainWindow.loadURL(rendererDevUrl);
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'selectAll', label: 'Select All' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { role: 'toggleDevTools', label: 'Toggle DevTools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize', label: 'Minimize' },
        { role: 'close', label: 'Close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Project Homepage',
          click: async () => {
            await shell.openExternal('https://github.com/cainiaopppppppp/MeshKit');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  await enableSharing();
  createWindow();

  if (!isDev) {
    void autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', (event) => {
  if (isStoppingServices) {
    return;
  }

  event.preventDefault();
  isStoppingServices = true;

  void stopEmbeddedServices().finally(() => {
    app.quit();
  });
});

ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:getPlatform', () => process.platform);
ipcMain.handle('network:getLocalIPAddresses', () => getLocalIPAddresses());
ipcMain.handle('services:getStatus', () => getEmbeddedServiceStatus());
ipcMain.handle('services:start', () => enableSharing());
ipcMain.handle('services:stop', () => disableSharing());
ipcMain.handle('services:restart', () => restartEmbeddedServices());

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
  });
  return result.filePaths;
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });
  return result.filePaths;
});

ipcMain.handle('dialog:saveFile', async (_, defaultPath: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath,
  });
  return result.filePath;
});

autoUpdater.on('update-available', () => {
  console.log('[desktop] Update available');
});

autoUpdater.on('update-downloaded', () => {
  console.log('[desktop] Update downloaded');
  autoUpdater.quitAndInstall();
});

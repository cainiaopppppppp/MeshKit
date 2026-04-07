import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

import { findAvailablePort, getPreferredLocalHost } from './networkUtils';

const express = require('express') as {
  (): any;
  static: (rootDir: string) => any;
};

interface StartShareWebServerOptions {
  rootDir: string;
  host?: string;
  preferredPort?: number;
}

export interface ShareWebServerStatus {
  running: boolean;
  listenHost: string;
  publicHost: string;
  port: number;
  url: string;
  rootDir: string;
  error?: string;
}

export interface ShareWebServerController {
  status: ShareWebServerStatus;
  stop: () => Promise<void>;
}

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolveClose();
    });
  });
}

function listen(server: HttpServer, port: number, host: string): Promise<void> {
  return new Promise((resolveListen, reject) => {
    const handleError = (error: Error) => {
      server.off('listening', handleListening);
      reject(error);
    };

    const handleListening = () => {
      server.off('error', handleError);
      resolveListen();
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(port, host);
  });
}

export async function startShareWebServer(
  options: StartShareWebServerOptions,
): Promise<ShareWebServerController> {
  const rootDir = resolve(options.rootDir);
  const listenHost = options.host || '0.0.0.0';
  const preferredPort = options.preferredPort || 3000;

  if (!existsSync(rootDir)) {
    throw new Error(`分享网页资源不存在：${rootDir}`);
  }

  const indexPath = join(rootDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`分享网页入口不存在：${indexPath}`);
  }

  const port = await findAvailablePort(preferredPort, 20, listenHost);
  const publicHost = getPreferredLocalHost();

  const webApp = express();
  const webServer = createServer(webApp);

  webApp.use(express.static(rootDir));
  webApp.use((req: any, res: any, next: any) => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    if (extname(req.path || '')) {
      next();
      return;
    }

    res.sendFile(indexPath);
  });

  await listen(webServer, port, listenHost);

  const status: ShareWebServerStatus = {
    running: true,
    listenHost,
    publicHost,
    port,
    url: `http://${publicHost}:${port}/`,
    rootDir,
  };

  return {
    status,
    stop: async () => {
      await closeHttpServer(webServer);
    },
  };
}

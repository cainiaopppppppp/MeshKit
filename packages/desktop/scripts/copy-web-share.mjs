import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(__dirname, '../../web/dist');
const targetDir = resolve(__dirname, '../dist/web-share');

if (!existsSync(sourceDir)) {
  throw new Error(`Web 分享资源不存在，请先构建 packages/web: ${sourceDir}`);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`[desktop] Copied web share assets to ${targetDir}`);

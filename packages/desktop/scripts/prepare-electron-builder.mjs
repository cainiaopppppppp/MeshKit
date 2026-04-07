import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(__dirname, '..');
const desktopRequire = createRequire(resolve(desktopRoot, 'package.json'));

function patchPeerPackageJson() {
  const peerEntryPath = desktopRequire.resolve('peer');
  const peerPackageJsonPath = join(dirname(peerEntryPath), '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(peerPackageJsonPath, 'utf8'));

  if (typeof packageJson.binary !== 'string') {
    console.log('[desktop] peer/package.json is already compatible with electron-builder');
    return;
  }

  delete packageJson.binary;

  writeFileSync(
    peerPackageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );

  console.log(`[desktop] Patched peer/package.json for electron-builder: ${peerPackageJsonPath}`);
}

patchPeerPackageJson();

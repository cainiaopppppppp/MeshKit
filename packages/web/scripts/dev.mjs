import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

function isPrivateIPv4(address) {
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

function isLikelyVirtualAdapter(name) {
  return /vmware|virtualbox|hyper-v|vethernet|default switch|vmnet|docker|wsl|tailscale|zerotier|wireguard|bluetooth/i.test(name);
}

function isLikelyVirtualOrHostOnlyRange(address) {
  return (
    /^192\.168\.124\.\d+$/.test(address)
    || /^192\.168\.254\.\d+$/.test(address)
    || /^192\.168\.56\.\d+$/.test(address)
    || /^192\.168\.137\.\d+$/.test(address)
    || /^172\.24\.\d+\.\d+$/.test(address)
    || /^172\.17\.\d+\.\d+$/.test(address)
    || /^172\.18\.\d+\.\d+$/.test(address)
    || /^172\.19\.\d+\.\d+$/.test(address)
  );
}

function getAdapterPriority(name, address) {
  let score = 100;
  const normalized = name.toLowerCase();

  if (
    normalized.includes('wlan')
    || normalized.includes('wi-fi')
    || normalized.includes('wifi')
    || normalized.includes('wireless')
  ) {
    score -= 40;
  } else if (normalized.includes('ethernet')) {
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

  if (isLikelyVirtualOrHostOnlyRange(address)) {
    score += 120;
  }

  if (address.endsWith('.1')) {
    score += 25;
  }

  return score;
}

function getShareableHosts() {
  const interfaces = networkInterfaces();
  const candidates = [];

  for (const [name, group] of Object.entries(interfaces)) {
    if (!group) {
      continue;
    }

    for (const info of group) {
      if (info.family !== 'IPv4' || info.internal || !isPrivateIPv4(info.address)) {
        continue;
      }

      candidates.push({
        address: info.address,
        name,
      });
    }
  }

  const sorted = candidates.sort((a, b) => getAdapterPriority(a.name, a.address) - getAdapterPriority(b.name, b.address));
  const filtered = sorted.filter((item) => !isLikelyVirtualAdapter(item.name) && !isLikelyVirtualOrHostOnlyRange(item.address));
  const preferred = filtered.length > 0 ? filtered : sorted;

  return Array.from(new Set(preferred.map((item) => item.address)));
}

function color(text, code) {
  return `\u001b[${code}m${text}\u001b[0m`;
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function printBanner(port, readyLine) {
  const localUrl = `http://localhost:${port}/`;
  const networkUrls = getShareableHosts().map((host) => `http://${host}:${port}/`);

  console.log();
  console.log(`  ${color(readyLine || 'VITE ready', '36;1')}`);
  console.log();
  console.log(`  ${color('->', '36')}  Local:   ${localUrl}`);

  for (const url of networkUrls) {
    console.log(`  ${color('->', '36')}  Network: ${url}`);
  }

  if (networkUrls.length > 0) {
    console.log(`  ${color('->', '36')}  Share:   ${color(networkUrls[0], '32;1')}`);
  }

  console.log(`  ${color('->', '36')}  Press ${color('Ctrl+C', '1')} to stop`);
  console.log();
}

function shouldSuppressLine(line) {
  const normalized = stripAnsi(line).trim().toLowerCase();

  return (
    normalized.includes('local:')
    || normalized.includes('network:')
    || normalized.includes('press h + enter to show help')
  );
}

function extractPortFromLocalLine(line) {
  const match = line.match(/http:\/\/[^:]+:(\d+)\//);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function start() {
  const bannerOnly = process.argv.includes('--banner-only') || process.env.MESHKIT_DEV_BANNER_ONLY === '1';
  const viteBinPath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
  const child = spawn(process.execPath, [viteBinPath, '--clearScreen', 'false'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'inherit'],
  });

  let readyLine = '';
  let printedBanner = false;
  let stdoutBuffer = '';

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const cleanLine = stripAnsi(line);
      const trimmed = cleanLine.trim();

      if (trimmed.includes('ready in')) {
        readyLine = trimmed;
        continue;
      }

      if (!printedBanner && trimmed.includes('Local:')) {
        const port = extractPortFromLocalLine(trimmed) ?? 3000;
        printBanner(port, readyLine);
        printedBanner = true;
        if (bannerOnly) {
          child.kill();
        }
        continue;
      }

      if (shouldSuppressLine(line)) {
        continue;
      }

      console.log(line);
    }
  });

  child.on('close', (code) => {
    if (bannerOnly && printedBanner) {
      process.exit(0);
    }
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
}

start();

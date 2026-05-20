import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';

export interface LocalNetworkCandidate {
  name: string;
  address: string;
  netmask: string;
  broadcastAddress: string;
}

export function isPrivateIPv4(address: string): boolean {
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

export function isLikelyVirtualAdapter(name: string): boolean {
  return /vmware|virtualbox|hyper-v|vethernet|default switch|vmnet|docker|wsl|tailscale|zerotier|wireguard|bluetooth/i.test(name);
}

export function isLikelyVirtualOrHostOnlyRange(address: string): boolean {
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

export function getAdapterPriority(name: string, address: string): number {
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

function ipv4ToInt(address: string): number {
  return address
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .reduce((result, part) => ((result << 8) | part) >>> 0, 0);
}

function intToIpv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
}

function getBroadcastAddress(address: string, netmask: string): string {
  const addressInt = ipv4ToInt(address);
  const netmaskInt = ipv4ToInt(netmask);
  const broadcastInt = (addressInt & netmaskInt) | (~netmaskInt >>> 0);
  return intToIpv4(broadcastInt >>> 0);
}

export function getLocalNetworkCandidates(): LocalNetworkCandidate[] {
  const interfaces = networkInterfaces();
  const candidates: LocalNetworkCandidate[] = [];

  for (const [name, group] of Object.entries(interfaces)) {
    if (!group) {
      continue;
    }

    for (const info of group) {
      if (
        info.family !== 'IPv4'
        || info.internal
        || !isPrivateIPv4(info.address)
        || !info.netmask
      ) {
        continue;
      }

      candidates.push({
        name,
        address: info.address,
        netmask: info.netmask,
        broadcastAddress: getBroadcastAddress(info.address, info.netmask),
      });
    }
  }

  return candidates
    .sort((a, b) => getAdapterPriority(a.name, a.address) - getAdapterPriority(b.name, b.address));
}

export function getLocalIPAddresses(): string[] {
  const sortedCandidates = getLocalNetworkCandidates();
  const physicalCandidates = sortedCandidates.filter((item) => !isLikelyVirtualAdapter(item.name));
  const preferredCandidates = physicalCandidates.length > 0 ? physicalCandidates : sortedCandidates;
  return Array.from(new Set(preferredCandidates.map((item) => item.address)));
}

export function getBroadcastAddresses(): string[] {
  const sortedCandidates = getLocalNetworkCandidates();
  const physicalCandidates = sortedCandidates.filter((item) => !isLikelyVirtualAdapter(item.name));
  const preferredCandidates = physicalCandidates.length > 0 ? physicalCandidates : sortedCandidates;

  return Array.from(new Set([
    ...preferredCandidates.map((item) => item.broadcastAddress),
    '255.255.255.255',
  ]));
}

export function getPreferredLocalHost(): string {
  return getLocalIPAddresses()[0] || '127.0.0.1';
}

export async function findAvailablePort(startPort: number, maxAttempts = 20, host = '127.0.0.1'): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    const available = await canListenOnPort(port, host);
    if (available) {
      return port;
    }
  }

  throw new Error(`No available port found starting from ${startPort}`);
}

function canListenOnPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

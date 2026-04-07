import { config } from '@meshkit/core';

export interface SignalingConfigDraft {
  host: string;
  wsPort: string;
  peerPort: string;
}

export interface ResolvedSignalingConfig {
  host: string;
  wsPort: number;
  peerPort: number;
}

export interface AutoConfigureResult {
  config: ResolvedSignalingConfig;
  verified: boolean;
  testedHosts: string[];
}

export interface ShareableWebUrlResult {
  url: string;
  host: string;
  candidates: string[];
}

export interface SharedSignalingConfigApplyResult {
  applied: boolean;
  config?: ResolvedSignalingConfig;
}

export interface DesktopShareableWebUrlResult extends ShareableWebUrlResult {
  signalHost: string;
}

const STORAGE_KEY = 'meshkit_signaling_config';
const DEFAULT_WS_PORT = 7000;
const DEFAULT_PEER_PORT = 8000;
const DEFAULT_WEB_SHARE_PORT = 3000;
const SHARE_HOST_PARAM = 'meshkitHost';
const SHARE_WS_PORT_PARAM = 'meshkitWsPort';
const SHARE_PEER_PORT_PARAM = 'meshkitPeerPort';

function isLoopbackHost(host?: string): boolean {
  if (!host) return false;
  return ['localhost', '127.0.0.1', '::1'].includes(host.trim().toLowerCase());
}

function getRuntimeHost(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const hostname = window.location.hostname?.trim();
  if (!hostname || hostname === '0.0.0.0') {
    return undefined;
  }

  return hostname;
}

function sanitizePort(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function uniqueHosts(hosts: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const host of hosts) {
    const normalized = host?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeSharePath(pathname = '/'): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function persistResolvedSignalingConfig(normalized: ResolvedSignalingConfig): ResolvedSignalingConfig {
  config.set('signalingServer', normalized);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function isPrivateIPv4(host?: string): boolean {
  if (!host) return false;

  if (/^10\.\d+\.\d+\.\d+$/.test(host)) {
    return true;
  }

  if (/^192\.168\.\d+\.\d+$/.test(host)) {
    return true;
  }

  const match = host.match(/^172\.(\d+)\.\d+\.\d+$/);
  if (!match) {
    return false;
  }

  const secondOctet = Number.parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isRealLanHost(host?: string): boolean {
  return !!host && isPrivateIPv4(host) && !isLoopbackHost(host);
}

function isLikelyVirtualOrHostOnlyRange(host?: string): boolean {
  if (!host) return false;

  return (
    /^192\.168\.124\.\d+$/.test(host)
    || /^192\.168\.254\.\d+$/.test(host)
    || /^192\.168\.56\.\d+$/.test(host)
    || /^192\.168\.137\.\d+$/.test(host)
    || /^172\.24\.\d+\.\d+$/.test(host)
    || /^172\.17\.\d+\.\d+$/.test(host)
    || /^172\.18\.\d+\.\d+$/.test(host)
    || /^172\.19\.\d+\.\d+$/.test(host)
  );
}

function getLanHostPriority(host?: string): number {
  if (!host) return 999;

  let score = 100;

  if (isLoopbackHost(host)) {
    score += 400;
  }

  if (!isPrivateIPv4(host)) {
    score += 250;
  }

  if (host.startsWith('192.168.')) {
    score -= 40;
  } else if (host.startsWith('10.')) {
    score -= 25;
  } else if (host.startsWith('172.')) {
    score -= 10;
  }

  if (isLikelyVirtualOrHostOnlyRange(host)) {
    score += 220;
  }

  if (host.endsWith('.1')) {
    score += 80;
  } else {
    score -= 20;
  }

  return score;
}

function extractIPv4FromCandidate(candidateText: string): string | null {
  const match = candidateText.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  if (!match) {
    return null;
  }

  return match[1];
}

async function getElectronLocalIPAddresses(): Promise<string[]> {
  const electronAPI = (window as any).electronAPI;

  if (!electronAPI?.getLocalIPAddresses) {
    return [];
  }

  try {
    const addresses = await electronAPI.getLocalIPAddresses();
    return Array.isArray(addresses) ? addresses.filter(Boolean) : [];
  } catch (error) {
    console.warn('[signalingConfig] Failed to read local IP addresses:', error);
    return [];
  }
}

async function getBrowserLocalIPAddresses(timeoutMs = 1600): Promise<string[]> {
  if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
    return [];
  }

  return new Promise((resolve) => {
    const discovered = new Set<string>();
    const connection = new RTCPeerConnection({ iceServers: [] });

    const finish = () => {
      window.clearTimeout(timer);
      connection.onicecandidate = null;

      try {
        connection.close();
      } catch {
        // Ignore close failures during probing.
      }

      resolve(Array.from(discovered));
    };

    const timer = window.setTimeout(finish, timeoutMs);

    connection.onicecandidate = (event) => {
      const candidate = event.candidate;
      if (!candidate) {
        finish();
        return;
      }

      const address = candidate.address || extractIPv4FromCandidate(candidate.candidate);
      if (address && isPrivateIPv4(address)) {
        discovered.add(address);
      }
    };

    connection.createDataChannel('meshkit-ip-probe');
    connection.createOffer()
      .then((offer) => connection.setLocalDescription(offer))
      .catch((error) => {
        console.warn('[signalingConfig] Failed to gather browser local IP addresses:', error);
        finish();
      });
  });
}

export function getResolvedSignalingConfig(): ResolvedSignalingConfig {
  const currentConfig = config.get('signalingServer');
  const runtimeHost = getRuntimeHost();
  const configuredHost = currentConfig?.host?.trim();

  let host = configuredHost || runtimeHost || 'localhost';

  if (runtimeHost && configuredHost && isLoopbackHost(configuredHost) && !isLoopbackHost(runtimeHost)) {
    host = runtimeHost;
  }

  return {
    host,
    wsPort: sanitizePort(currentConfig?.wsPort, DEFAULT_WS_PORT),
    peerPort: sanitizePort(currentConfig?.peerPort, DEFAULT_PEER_PORT),
  };
}

export function toDraftConfig(value: Partial<ResolvedSignalingConfig> | undefined): SignalingConfigDraft {
  const resolved = getResolvedSignalingConfig();

  return {
    host: value?.host || resolved.host,
    wsPort: String(value?.wsPort ?? resolved.wsPort),
    peerPort: String(value?.peerPort ?? resolved.peerPort),
  };
}

export function loadSignalingConfigDraft(): SignalingConfigDraft {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return toDraftConfig({
        host: parsed.host,
        wsPort: sanitizePort(parsed.wsPort, DEFAULT_WS_PORT),
        peerPort: sanitizePort(parsed.peerPort, DEFAULT_PEER_PORT),
      });
    }
  } catch (error) {
    console.warn('[signalingConfig] Failed to parse saved config:', error);
  }

  const currentConfig = config.get('signalingServer');
  return toDraftConfig({
    host: currentConfig?.host,
    wsPort: currentConfig?.wsPort,
    peerPort: currentConfig?.peerPort,
  });
}

export function saveSignalingConfigDraft(draft: SignalingConfigDraft): ResolvedSignalingConfig {
  const normalized: ResolvedSignalingConfig = {
    host: draft.host.trim() || getResolvedSignalingConfig().host,
    wsPort: sanitizePort(draft.wsPort, DEFAULT_WS_PORT),
    peerPort: sanitizePort(draft.peerPort, DEFAULT_PEER_PORT),
  };

  return persistResolvedSignalingConfig(normalized);
}

export function resetSignalingConfigDraft(): SignalingConfigDraft {
  localStorage.removeItem(STORAGE_KEY);
  config.set('signalingServer', {
    wsPort: DEFAULT_WS_PORT,
    peerPort: DEFAULT_PEER_PORT,
  });

  return toDraftConfig({
    wsPort: DEFAULT_WS_PORT,
    peerPort: DEFAULT_PEER_PORT,
  });
}

export async function getAutoConfigCandidates(preferredHost?: string): Promise<string[]> {
  const resolved = getResolvedSignalingConfig();
  const currentHost = getRuntimeHost();
  const localIPs = await getElectronLocalIPAddresses();
  const shouldUseBrowserIPs = !isRealLanHost(currentHost) || isLikelyVirtualOrHostOnlyRange(currentHost);
  const browserIPs = shouldUseBrowserIPs ? await getBrowserLocalIPAddresses() : [];

  const primaryCandidates = uniqueHosts([
    preferredHost,
    resolved.host,
    currentHost,
    ...localIPs,
    ...browserIPs,
  ]);

  const realLanCandidates = primaryCandidates.filter((host) => isRealLanHost(host));
  const nonLoopbackCandidates = primaryCandidates.filter((host) => !isLoopbackHost(host));
  const loopbackCandidates = primaryCandidates.filter((host) => isLoopbackHost(host));

  return uniqueHosts([
    ...realLanCandidates,
    ...nonLoopbackCandidates,
    ...loopbackCandidates,
    'localhost',
    '127.0.0.1',
  ]).sort((a, b) => getLanHostPriority(a) - getLanHostPriority(b));
}

export async function probeSignalingServer(host: string, wsPort: number, timeoutMs = 1600): Promise<boolean> {
  return new Promise((resolve) => {
    let opened = false;
    let settled = false;
    let socket: WebSocket | null = null;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timer);

      if (socket) {
        try {
          socket.close();
        } catch {
          // Ignore close failures during probing.
        }
      }

      resolve(result);
    };

    const timer = window.setTimeout(() => finish(false), timeoutMs);

    try {
      socket = new WebSocket(`ws://${host}:${wsPort}/ws`);
      socket.onopen = () => {
        opened = true;
        finish(true);
      };
      socket.onerror = () => finish(false);
      socket.onclose = () => {
        if (!opened) {
          finish(false);
        }
      };
    } catch (error) {
      console.warn('[signalingConfig] Probe failed to start:', error);
      finish(false);
    }
  });
}

export async function autoConfigureSignaling(draft?: Partial<SignalingConfigDraft>): Promise<AutoConfigureResult> {
  const wsPortCandidates = Array.from(new Set([
    sanitizePort(draft?.wsPort, DEFAULT_WS_PORT),
    DEFAULT_WS_PORT,
  ]));
  const peerPortCandidates = Array.from(new Set([
    sanitizePort(draft?.peerPort, DEFAULT_PEER_PORT),
    DEFAULT_PEER_PORT,
  ]));
  const candidates = await getAutoConfigCandidates(draft?.host);

  for (const host of candidates) {
    for (const wsPort of wsPortCandidates) {
      const verified = await probeSignalingServer(host, wsPort);
      if (!verified) {
        continue;
      }

      const peerPort = wsPort === sanitizePort(draft?.wsPort, DEFAULT_WS_PORT)
        ? sanitizePort(draft?.peerPort, DEFAULT_PEER_PORT)
        : peerPortCandidates[0];

      return {
        config: {
          host,
          wsPort,
          peerPort,
        },
        verified: true,
        testedHosts: candidates,
      };
    }
  }

  return {
    config: {
      host: candidates[0] || getResolvedSignalingConfig().host,
      wsPort: wsPortCandidates[0],
      peerPort: peerPortCandidates[0],
    },
    verified: false,
    testedHosts: candidates,
  };
}

function parseSharedSignalingConfigFromSearch(search: string): ResolvedSignalingConfig | null {
  const params = new URLSearchParams(search);
  const host = params.get(SHARE_HOST_PARAM)?.trim();

  if (!host || host === '0.0.0.0') {
    return null;
  }

  return {
    host,
    wsPort: sanitizePort(params.get(SHARE_WS_PORT_PARAM) ?? undefined, DEFAULT_WS_PORT),
    peerPort: sanitizePort(params.get(SHARE_PEER_PORT_PARAM) ?? undefined, DEFAULT_PEER_PORT),
  };
}

function applySharedConfigParams(url: URL, resolved: ResolvedSignalingConfig): void {
  url.searchParams.set(SHARE_HOST_PARAM, resolved.host);
  url.searchParams.set(SHARE_WS_PORT_PARAM, String(resolved.wsPort));
  url.searchParams.set(SHARE_PEER_PORT_PARAM, String(resolved.peerPort));
}

function stripSharedConfigParams(url: URL): void {
  url.searchParams.delete(SHARE_HOST_PARAM);
  url.searchParams.delete(SHARE_WS_PORT_PARAM);
  url.searchParams.delete(SHARE_PEER_PORT_PARAM);
}

function resolveDraftSignalingConfig(draft?: Partial<SignalingConfigDraft>): ResolvedSignalingConfig {
  const current = getResolvedSignalingConfig();

  return {
    host: draft?.host?.trim() || current.host,
    wsPort: sanitizePort(draft?.wsPort, current.wsPort),
    peerPort: sanitizePort(draft?.peerPort, current.peerPort),
  };
}

function getPreferredShareHost(candidates: string[]): string {
  return candidates.find((host) => isRealLanHost(host) && !isLikelyVirtualOrHostOnlyRange(host))
    || candidates.find((host) => isRealLanHost(host))
    || candidates.find((host) => !isLoopbackHost(host))
    || candidates[0]
    || 'localhost';
}

export function applySharedSignalingConfigFromUrl(search?: string): SharedSignalingConfigApplyResult {
  if (typeof window === 'undefined') {
    return { applied: false };
  }

  const sharedConfig = parseSharedSignalingConfigFromSearch(search ?? window.location.search);
  if (!sharedConfig) {
    return { applied: false };
  }

  persistResolvedSignalingConfig(sharedConfig);

  const currentUrl = new URL(window.location.href);
  if (
    currentUrl.searchParams.has(SHARE_HOST_PARAM)
    || currentUrl.searchParams.has(SHARE_WS_PORT_PARAM)
    || currentUrl.searchParams.has(SHARE_PEER_PORT_PARAM)
  ) {
    stripSharedConfigParams(currentUrl);
    const nextSearch = currentUrl.searchParams.toString();
    const nextUrl = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ''}${currentUrl.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }

  return {
    applied: true,
    config: sharedConfig,
  };
}

export async function getShareableWebUrl(pathname = '/'): Promise<ShareableWebUrlResult> {
  const resolved = getResolvedSignalingConfig();
  const currentHost = getRuntimeHost();
  const localIPs = await getElectronLocalIPAddresses();
  const shouldUseBrowserIPs = !isRealLanHost(currentHost) || isLikelyVirtualOrHostOnlyRange(currentHost);
  const browserIPs = shouldUseBrowserIPs ? await getBrowserLocalIPAddresses() : [];

  const candidates = uniqueHosts([
    resolved.host,
    currentHost,
    ...localIPs,
    ...browserIPs,
    'localhost',
    '127.0.0.1',
  ]).sort((a, b) => getLanHostPriority(a) - getLanHostPriority(b));

  const preferredHost = getPreferredShareHost(candidates);

  const port = window.location.port ? `:${window.location.port}` : '';
  const normalizedPath = normalizeSharePath(pathname);
  const url = new URL(`${window.location.protocol}//${preferredHost}${port}${normalizedPath}`);

  applySharedConfigParams(url, resolved);

  return {
    url: url.toString(),
    host: preferredHost,
    candidates,
  };
}

export async function getDesktopShareableWebUrl(
  draft?: Partial<SignalingConfigDraft>,
  pathname = '/',
  webPort = DEFAULT_WEB_SHARE_PORT,
): Promise<DesktopShareableWebUrlResult> {
  const localIPs = await getElectronLocalIPAddresses();
  const resolvedDraft = resolveDraftSignalingConfig(draft);
  const candidates = uniqueHosts([
    ...localIPs,
    resolvedDraft.host,
    getResolvedSignalingConfig().host,
    'localhost',
    '127.0.0.1',
  ]).sort((a, b) => getLanHostPriority(a) - getLanHostPriority(b));

  const preferredHost = getPreferredShareHost(candidates);
  const signalHost = isLoopbackHost(resolvedDraft.host) && isRealLanHost(preferredHost)
    ? preferredHost
    : resolvedDraft.host;
  const url = new URL(`http://${preferredHost}:${sanitizePort(webPort, DEFAULT_WEB_SHARE_PORT)}${normalizeSharePath(pathname)}`);

  applySharedConfigParams(url, {
    host: signalHost,
    wsPort: resolvedDraft.wsPort,
    peerPort: resolvedDraft.peerPort,
  });

  return {
    url: url.toString(),
    host: preferredHost,
    signalHost,
    candidates,
  };
}

import { config } from '@meshkit/core';
import CryptoJS from 'crypto-js';

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

export interface StickyNotesSharePayload {
  roomId: string;
  encrypted?: boolean;
  encryptionMethod?: string;
  password?: string;
}

export interface EncryptedChatSharePayload {
  roomId: string;
  encrypted?: boolean;
  encryptionMethod?: string;
  password?: string;
}

export interface PickupSharePayload {
  code: string;
  password?: string;
  passwordProtected?: boolean;
}

export interface ShareInvitePayload {
  version: 1;
  route?: string;
  signaling: ResolvedSignalingConfig;
  stickyNotes?: StickyNotesSharePayload;
  encryptedChat?: EncryptedChatSharePayload;
  pickup?: PickupSharePayload;
}

const STORAGE_KEY = 'meshkit_signaling_config';
const DEFAULT_WS_PORT = 7000;
const DEFAULT_PEER_PORT = 8000;
const DEFAULT_WEB_SHARE_PORT = 3000;
const SHARE_HOST_PARAM = 'meshkitHost';
const SHARE_WS_PORT_PARAM = 'meshkitWsPort';
const SHARE_PEER_PORT_PARAM = 'meshkitPeerPort';
const SHARE_TOKEN_PARAM = 'meshkitInvite';
const SHARE_TOKEN_SECRET = 'meshkit-share-token-v1';

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

function toBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  return normalized + (padding ? '='.repeat(4 - padding) : '');
}

function buildShareInvitePayload(
  resolved: ResolvedSignalingConfig,
  pathname = '/',
  invite?: Pick<ShareInvitePayload, 'stickyNotes' | 'encryptedChat' | 'pickup'>,
): ShareInvitePayload {
  return {
    version: 1,
    route: normalizeSharePath(pathname),
    signaling: resolved,
    stickyNotes: invite?.stickyNotes,
    encryptedChat: invite?.encryptedChat,
    pickup: invite?.pickup,
  };
}

function encodeShareInvitePayload(payload: ShareInvitePayload): string {
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(payload),
    SHARE_TOKEN_SECRET,
  ).toString();

  return toBase64Url(encrypted);
}

function decodeShareInvitePayload(token: string): ShareInvitePayload | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(
      fromBase64Url(token),
      SHARE_TOKEN_SECRET,
    ).toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      return null;
    }

    const parsed = JSON.parse(decrypted) as Partial<ShareInvitePayload>;
    if (!parsed?.signaling?.host) {
      return null;
    }

    return {
      version: 1,
      route: typeof parsed.route === 'string' ? parsed.route : undefined,
      signaling: {
        host: parsed.signaling.host,
        wsPort: sanitizePort(parsed.signaling.wsPort, DEFAULT_WS_PORT),
        peerPort: sanitizePort(parsed.signaling.peerPort, DEFAULT_PEER_PORT),
      },
      stickyNotes: parsed.stickyNotes,
      encryptedChat: parsed.encryptedChat,
      pickup: parsed.pickup,
    };
  } catch (error) {
    console.warn('[signalingConfig] Failed to decode share invite payload:', error);
    return null;
  }
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

export function parseSharedSignalingConfigFromSearch(search: string): ResolvedSignalingConfig | null {
  const params = new URLSearchParams(search);
  const inviteToken = params.get(SHARE_TOKEN_PARAM)?.trim();

  if (inviteToken) {
    const payload = decodeShareInvitePayload(inviteToken);
    if (payload?.signaling) {
      return payload.signaling;
    }
  }

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

function extractHashSearch(hash: string): string | null {
  const questionMarkIndex = hash.indexOf('?');
  if (questionMarkIndex < 0) {
    return null;
  }

  const search = hash.slice(questionMarkIndex).trim();
  return search || null;
}

function collectSearchCandidates(input: string): string[] {
  const trimmed = input.trim();
  const candidates: string[] = [];

  const pushCandidate = (value?: string | null) => {
    const normalized = value?.trim();
    if (!normalized || candidates.includes(normalized)) {
      return;
    }

    candidates.push(normalized);
  };

  if (trimmed.startsWith('?')) {
    pushCandidate(trimmed);
  }

  try {
    const parsedUrl = new URL(trimmed);
    pushCandidate(parsedUrl.search);
    pushCandidate(extractHashSearch(parsedUrl.hash));
  } catch {
    // Ignore invalid URL inputs and continue with string fallbacks.
  }

  const hashIndex = trimmed.indexOf('#');
  if (hashIndex >= 0) {
    pushCandidate(extractHashSearch(trimmed.slice(hashIndex)));
  }

  const questionMarkIndex = trimmed.indexOf('?');
  if (questionMarkIndex >= 0) {
    pushCandidate(trimmed.slice(questionMarkIndex));
  }

  if (candidates.length === 0) {
    pushCandidate(trimmed);
  }

  return candidates;
}

export function parseSharedSignalingConfigFromUrl(input: string): ResolvedSignalingConfig | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  for (const search of collectSearchCandidates(trimmed)) {
    const parsed = parseSharedSignalingConfigFromSearch(search);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function parseShareInvitePayloadFromSearch(search: string): ShareInvitePayload | null {
  const params = new URLSearchParams(search);
  const inviteToken = params.get(SHARE_TOKEN_PARAM)?.trim();

  if (!inviteToken) {
    return null;
  }

  return decodeShareInvitePayload(inviteToken);
}

export function parseShareInvitePayloadFromUrl(input: string): ShareInvitePayload | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  for (const search of collectSearchCandidates(trimmed)) {
    const parsed = parseShareInvitePayloadFromSearch(search);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function applyShareInviteToken(
  url: URL,
  payload: ShareInvitePayload,
): { token: string } {
  const token = encodeShareInvitePayload(payload);
  url.searchParams.delete(SHARE_HOST_PARAM);
  url.searchParams.delete(SHARE_WS_PORT_PARAM);
  url.searchParams.delete(SHARE_PEER_PORT_PARAM);
  url.searchParams.set(SHARE_TOKEN_PARAM, token);
  return { token };
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

async function getWebShareCandidates(primaryHost?: string): Promise<string[]> {
  const currentHost = getRuntimeHost();
  const localIPs = await getElectronLocalIPAddresses();
  const shouldUseBrowserIPs = !isRealLanHost(currentHost) || isLikelyVirtualOrHostOnlyRange(currentHost);
  const browserIPs = shouldUseBrowserIPs ? await getBrowserLocalIPAddresses() : [];

  return uniqueHosts([
    primaryHost,
    currentHost,
    ...localIPs,
    ...browserIPs,
    'localhost',
    '127.0.0.1',
  ]).sort((a, b) => getLanHostPriority(a) - getLanHostPriority(b));
}

async function resolveShareBaseUrl(candidates: string[], pathname = '/'): Promise<{ url: URL; host: string }> {
  const preferredHost = getPreferredShareHost(candidates);
  const normalizedPath = normalizeSharePath(pathname);

  if ((window as any).electronAPI?.getEmbeddedServiceStatus) {
    try {
      const status = await (window as any).electronAPI.getEmbeddedServiceStatus();
      const shareUrl = status?.shareWeb?.url;

      if (status?.shareWeb?.running && shareUrl) {
        const baseUrl = new URL(shareUrl);
        baseUrl.pathname = normalizedPath;
        baseUrl.search = '';
        baseUrl.hash = '';

        return {
          url: baseUrl,
          host: baseUrl.hostname || preferredHost,
        };
      }
    } catch (error) {
      console.warn('[signalingConfig] Failed to read embedded share web status:', error);
    }
  }

  const runtimeProtocol = window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? window.location.protocol
    : 'http:';
  const port = window.location.port
    ? `:${window.location.port}`
    : ((window as any).electronAPI?.isElectron ? `:${DEFAULT_WEB_SHARE_PORT}` : '');

  return {
    url: new URL(`${runtimeProtocol}//${preferredHost}${port}${normalizedPath}`),
    host: preferredHost,
  };
}

async function buildShareableWebUrl(
  resolved: ResolvedSignalingConfig,
  candidates: string[],
  pathname = '/',
  invite?: Pick<ShareInvitePayload, 'stickyNotes' | 'encryptedChat' | 'pickup'>,
): Promise<ShareableWebUrlResult> {
  const { url, host } = await resolveShareBaseUrl(candidates, pathname);
  const normalizedPath = normalizeSharePath(pathname);
  const payload = buildShareInvitePayload(resolved, normalizedPath, invite);
  applyShareInviteToken(url, payload);

  return {
    url: url.toString(),
    host,
    candidates,
  };
}

export async function getShareableWebUrl(
  pathname = '/',
  invite?: Pick<ShareInvitePayload, 'stickyNotes' | 'encryptedChat' | 'pickup'>,
): Promise<ShareableWebUrlResult> {
  const resolved = getResolvedSignalingConfig();
  const candidates = await getWebShareCandidates(resolved.host);

  return await buildShareableWebUrl(resolved, candidates, pathname, invite);
}

export async function getShareableWebUrlForDraft(
  draft?: Partial<SignalingConfigDraft>,
  pathname = '/',
  invite?: Pick<ShareInvitePayload, 'stickyNotes' | 'encryptedChat' | 'pickup'>,
): Promise<ShareableWebUrlResult> {
  const resolvedDraft = resolveDraftSignalingConfig(draft);
  const candidates = await getWebShareCandidates(resolvedDraft.host);

  return await buildShareableWebUrl(resolvedDraft, candidates, pathname, invite);
}

export async function getDesktopShareableWebUrl(
  draft?: Partial<SignalingConfigDraft>,
  pathname = '/',
  webPort = DEFAULT_WEB_SHARE_PORT,
  invite?: Pick<ShareInvitePayload, 'stickyNotes' | 'encryptedChat' | 'pickup'>,
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
  const payload = buildShareInvitePayload({
    host: signalHost,
    wsPort: resolvedDraft.wsPort,
    peerPort: resolvedDraft.peerPort,
  }, pathname, invite);
  applyShareInviteToken(url, payload);

  return {
    url: url.toString(),
    host: preferredHost,
    signalHost,
    candidates,
  };
}

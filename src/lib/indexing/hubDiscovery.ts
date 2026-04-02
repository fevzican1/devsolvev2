import { getStore } from '@netlify/blobs';
import { getSlugByIndex, getTotalPageCount } from '../../data/programmatic';

const STORE_NAME = 'hub-discovery-links';
const HUB_LINK_KEY_PREFIX = 'hub-links:';
const ROTATION_STATE_KEY = 'state:rotation';
const PRIORITY_MANIFEST_KEY = 'priority:discovered:manifest';
const PRIORITY_CHUNK_KEY_PREFIX = 'priority:discovered:chunk:';

const ROTATION_STEP = 7919;

export const DEFAULT_HUB_PATHS = ['/', '/guides', '/tools', '/about', '/contact'] as const;

export interface DiscoveryLink {
  href: string;
  title: string;
  source: 'priority' | 'rotation';
}

export interface HubLinkSnapshot {
  hubPath: string;
  generatedAt: string;
  links: DiscoveryLink[];
}

interface RotationState {
  cursor: number;
  priorityChunkCursor: number;
}

interface PriorityManifest {
  chunkCount: number;
  chunkSize: number;
  total: number;
  updatedAt: string;
}

function toFiniteInteger(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = toFiniteInteger(value);
  if (parsed === null) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isMissingBlobsEnvironmentError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { name?: string; message?: string };
  return maybeError.name === 'MissingBlobsEnvironmentError'
    || Boolean(maybeError.message?.includes('MissingBlobsEnvironmentError'));
}

function fallbackSeedForHub(hubPath: string): number {
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const pathSeed = hubPath.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return daySeed * ROTATION_STEP + pathSeed;
}

function buildFallbackSnapshot(hubPath: string, count: number): HubLinkSnapshot {
  const normalizedHubPath = normalizeHubPath(hubPath);
  const total = getTotalPageCount();
  if (total < 1) {
    return {
      hubPath: normalizedHubPath,
      generatedAt: new Date().toISOString(),
      links: [],
    };
  }

  const links: DiscoveryLink[] = [];
  const selectedPaths = new Set<string>();
  const seed = fallbackSeedForHub(normalizedHubPath);

  let attempts = 0;
  while (links.length < count && attempts < count * 80) {
    const index = (seed + attempts * ROTATION_STEP) % total;
    attempts += 1;

    const slug = getSlugByIndex(index);
    if (!slug) continue;

    const path = `/k/${slug}`;
    if (path === normalizedHubPath || selectedPaths.has(path)) continue;

    selectedPaths.add(path);
    links.push({
      href: path,
      title: programmaticLabelFromPath(path),
      source: 'rotation',
    });
  }

  return {
    hubPath: normalizedHubPath,
    generatedAt: new Date().toISOString(),
    links,
  };
}

function normalizeHubPath(path: string): string {
  if (!path) return '/';
  const withLead = path.startsWith('/') ? path : `/${path}`;
  const singleSlashes = withLead.replace(/\/{2,}/g, '/');
  if (singleSlashes === '/') return '/';
  return singleSlashes.endsWith('/') ? singleSlashes.slice(0, -1) : singleSlashes;
}

function getHubKey(hubPath: string): string {
  return `${HUB_LINK_KEY_PREFIX}${normalizeHubPath(hubPath)}`;
}

function toAbsoluteSiteUrl(siteUrl: string, pathname: string): string {
  return new URL(normalizeHubPath(pathname), siteUrl).toString();
}

function isStale(generatedAt: string, refreshMinutes: number): boolean {
  const generatedMs = Date.parse(generatedAt);
  if (Number.isNaN(generatedMs)) return true;
  return Date.now() - generatedMs > refreshMinutes * 60_000;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function chunkKey(index: number): string {
  return `${PRIORITY_CHUNK_KEY_PREFIX}${String(index).padStart(5, '0')}`;
}

function sanitizeProgrammaticPath(value: string, siteUrl: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;

  if (candidate.startsWith('/k/')) {
    return normalizeHubPath(candidate);
  }

  try {
    const parsed = new URL(candidate);
    const canonical = new URL(siteUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname !== canonical.hostname) return null;
    if (!parsed.pathname.startsWith('/k/')) return null;
    return normalizeHubPath(parsed.pathname);
  } catch {
    return null;
  }
}

function programmaticLabelFromPath(path: string): string {
  const slug = path.replace(/^\/k\//, '').replace(/\/$/, '');
  const words = slug
    .split('-')
    .filter(Boolean)
    .slice(0, 9)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)));

  return words.length > 0 ? words.join(' ') : 'Teknik Rehber';
}

async function getRotationState(store: ReturnType<typeof getStore>): Promise<RotationState> {
  const existing = await store.get(ROTATION_STATE_KEY, { type: 'json' }) as RotationState | null;
  return {
    cursor: existing?.cursor ?? 0,
    priorityChunkCursor: existing?.priorityChunkCursor ?? 0,
  };
}

async function getPriorityCandidates(
  store: ReturnType<typeof getStore>,
  siteUrl: string,
  state: RotationState,
  count: number,
): Promise<string[]> {
  const manifest = await store.get(PRIORITY_MANIFEST_KEY, { type: 'json' }) as PriorityManifest | null;
  if (!manifest || manifest.chunkCount < 1) return [];

  const results: string[] = [];
  let scanned = 0;

  while (results.length < count && scanned < manifest.chunkCount) {
    const idx = (state.priorityChunkCursor + scanned) % manifest.chunkCount;
    const chunk = await store.get(chunkKey(idx), { type: 'json' }) as string[] | null;
    if (Array.isArray(chunk)) {
      for (const item of chunk) {
        const normalized = sanitizeProgrammaticPath(item, siteUrl);
        if (normalized) results.push(normalized);
        if (results.length >= count) break;
      }
    }
    scanned += 1;
  }

  state.priorityChunkCursor = (state.priorityChunkCursor + 1) % manifest.chunkCount;
  return unique(results);
}

export async function getHubLinkSnapshot(hubPath: string): Promise<HubLinkSnapshot | null> {
  try {
    const store = getStore(STORE_NAME);
    const snapshot = await store.get(getHubKey(hubPath), { type: 'json' }) as HubLinkSnapshot | null;
    return snapshot;
  } catch (error) {
    if (isMissingBlobsEnvironmentError(error)) return null;
    throw error;
  }
}

export async function refreshHubLinks(options: {
  hubPath: string;
  siteUrl: string;
  count?: number;
  refreshMinutes?: number;
  force?: boolean;
}): Promise<HubLinkSnapshot> {
  const count = clampInteger(options.count, 20, 1, 500);
  const refreshMinutes = clampInteger(options.refreshMinutes, 180, 5, 10_080);
  const siteUrl = options.siteUrl;
  const normalizedHubPath = normalizeHubPath(options.hubPath);
  try {
    const store = getStore(STORE_NAME);

    const existing = await store.get(getHubKey(normalizedHubPath), { type: 'json' }) as HubLinkSnapshot | null;

    if (existing && !options.force && !isStale(existing.generatedAt, refreshMinutes)) {
      return existing;
    }

    const state = await getRotationState(store);
    const selectedPaths = new Set<string>();
    const links: DiscoveryLink[] = [];

    const priorityCandidates = await getPriorityCandidates(store, siteUrl, state, count);

    for (const path of priorityCandidates) {
      if (links.length >= count) break;
      if (path === normalizedHubPath || selectedPaths.has(path)) continue;
      selectedPaths.add(path);
      links.push({
        href: path,
        title: programmaticLabelFromPath(path),
        source: 'priority',
      });
    }

    const total = getTotalPageCount();
    if (total < 1) {
      const snapshot: HubLinkSnapshot = {
        hubPath: normalizedHubPath,
        generatedAt: new Date().toISOString(),
        links,
      };

      await Promise.all([
        store.setJSON(getHubKey(normalizedHubPath), snapshot),
        store.setJSON(ROTATION_STATE_KEY, state),
      ]);

      return snapshot;
    }

    let attempts = 0;

    while (links.length < count && attempts < count * 50) {
      const index = (state.cursor + attempts * ROTATION_STEP) % total;
      const slug = getSlugByIndex(index);
      attempts += 1;
      if (!slug) continue;

      const path = `/k/${slug}`;
      if (path === normalizedHubPath || selectedPaths.has(path)) continue;

      selectedPaths.add(path);
      links.push({
        href: path,
        title: programmaticLabelFromPath(path),
        source: 'rotation',
      });
    }

    state.cursor = (state.cursor + count * ROTATION_STEP) % total;

    const snapshot: HubLinkSnapshot = {
      hubPath: normalizedHubPath,
      generatedAt: new Date().toISOString(),
      links,
    };

    await Promise.all([
      store.setJSON(getHubKey(normalizedHubPath), snapshot),
      store.setJSON(ROTATION_STATE_KEY, state),
    ]);

    return snapshot;
  } catch (error) {
    if (isMissingBlobsEnvironmentError(error)) {
      return buildFallbackSnapshot(normalizedHubPath, count);
    }
    throw error;
  }
}

export async function getOrRefreshHubLinks(options: {
  hubPath: string;
  siteUrl: string;
  count?: number;
  refreshMinutes?: number;
}): Promise<HubLinkSnapshot> {
  return refreshHubLinks({ ...options, force: false });
}

export async function writeDiscoveredPriorityUrls(options: {
  urls: string[];
  siteUrl: string;
  mode?: 'replace' | 'append';
  chunkSize?: number;
}): Promise<{ accepted: number; chunkCount: number; total: number }> {
  const mode = options.mode ?? 'replace';
  const chunkSize = clampInteger(options.chunkSize, 5000, 100, 10_000);
  const store = getStore(STORE_NAME);

  const normalized = unique(
    options.urls
      .map((url) => sanitizeProgrammaticPath(url, options.siteUrl))
      .filter((v): v is string => Boolean(v)),
  );

  if (mode === 'replace') {
    const listing = await store.list({ prefix: PRIORITY_CHUNK_KEY_PREFIX });
    await Promise.all(listing.blobs.map((blob) => store.delete(blob.key)));
  }

  const currentManifest = await store.get(PRIORITY_MANIFEST_KEY, { type: 'json' }) as PriorityManifest | null;
  const startIndex = mode === 'append' && currentManifest ? currentManifest.chunkCount : 0;
  const chunks: string[][] = [];

  for (let i = 0; i < normalized.length; i += chunkSize) {
    chunks.push(normalized.slice(i, i + chunkSize));
  }

  await Promise.all(
    chunks.map((chunk, i) => store.setJSON(chunkKey(startIndex + i), chunk)),
  );

  const newManifest: PriorityManifest = {
    chunkCount: startIndex + chunks.length,
    chunkSize,
    total: mode === 'append' && currentManifest ? currentManifest.total + normalized.length : normalized.length,
    updatedAt: new Date().toISOString(),
  };

  await store.setJSON(PRIORITY_MANIFEST_KEY, newManifest);

  return {
    accepted: normalized.length,
    chunkCount: newManifest.chunkCount,
    total: newManifest.total,
  };
}

export { normalizeHubPath, toAbsoluteSiteUrl };

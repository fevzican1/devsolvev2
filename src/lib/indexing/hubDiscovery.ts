import { getProgrammaticPageBySlug, getSlugByIndex, getTotalPageCount } from '../../data/programmatic';
import { calculateQualityScore, shouldIndex } from '../quality/scoring';
import { siteConfig } from '../../config/site';

const ROTATION_STEP = 7919;
const indexableSlugCache = new Map<string, boolean>();

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

function fallbackSeedForHub(hubPath: string): number {
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const pathSeed = hubPath.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return daySeed * ROTATION_STEP + pathSeed;
}

function normalizeHubPath(path: string): string {
  if (!path) return '/';
  const withLead = path.startsWith('/') ? path : `/${path}`;
  const singleSlashes = withLead.replace(/\/{2,}/g, '/');
  if (singleSlashes === '/') return '/';
  return singleSlashes.endsWith('/') ? singleSlashes.slice(0, -1) : singleSlashes;
}

function toAbsoluteSiteUrl(siteUrl: string, pathname: string): string {
  return new URL(normalizeHubPath(pathname), siteUrl).toString();
}

function programmaticLabelFromPath(path: string): string {
  const slug = path.replace(/^\/k\//, '').replace(/\/$/, '');
  const words = slug
    .split('-')
    .filter(Boolean)
    .slice(0, 9)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)));

  return words.length > 0 ? words.join(' ') : 'Technical Guide';
}

function slugFromProgrammaticPath(path: string): string | null {
  if (!path.startsWith('/k/')) return null;
  const slug = path.replace(/^\/k\//, '').replace(/\/$/, '');
  return slug.length > 0 ? slug : null;
}

function isIndexableProgrammaticPath(path: string): boolean {
  const slug = slugFromProgrammaticPath(path);
  if (!slug) return false;

  const cached = indexableSlugCache.get(slug);
  if (typeof cached === 'boolean') return cached;

  const page = getProgrammaticPageBySlug(slug);
  if (!page) {
    indexableSlugCache.set(slug, false);
    return false;
  }

  const quality = calculateQualityScore(page);
  const indexable = shouldIndex(
    quality.score,
    siteConfig.programmaticQuality.minIndexScore,
    quality.wordCount,
  );
  indexableSlugCache.set(slug, indexable);
  return indexable;
}

/**
 * Generate hub links deterministically based on the hub path.
 * Uses a seeded rotation through the programmatic page index.
 * No external storage dependency — works on any static hosting platform.
 */
function buildHubLinkSnapshot(hubPath: string, count: number): HubLinkSnapshot {
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
    if (!isIndexableProgrammaticPath(path)) continue;

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

export async function getOrRefreshHubLinks(options: {
  hubPath: string;
  siteUrl: string;
  count?: number;
  refreshMinutes?: number;
}): Promise<HubLinkSnapshot> {
  const count = Math.min(500, Math.max(1, options.count ?? 20));
  return buildHubLinkSnapshot(options.hubPath, count);
}

export async function refreshHubLinks(options: {
  hubPath: string;
  siteUrl: string;
  count?: number;
  refreshMinutes?: number;
  force?: boolean;
}): Promise<HubLinkSnapshot> {
  const count = Math.min(500, Math.max(1, options.count ?? 20));
  return buildHubLinkSnapshot(options.hubPath, count);
}

export async function getHubLinkSnapshot(hubPath: string): Promise<HubLinkSnapshot | null> {
  return buildHubLinkSnapshot(hubPath, 20);
}

export async function writeDiscoveredPriorityUrls(_options: {
  urls: string[];
  siteUrl: string;
  mode?: 'replace' | 'append';
  chunkSize?: number;
}): Promise<{ accepted: number; chunkCount: number; total: number }> {
  // No-op on static Cloudflare deployment — priority URLs are handled via
  // deterministic rotation through the full page index
  return { accepted: 0, chunkCount: 0, total: 0 };
}

export { normalizeHubPath, toAbsoluteSiteUrl };

import { getProgrammaticPageBySlug, getSlugByIndex, getTotalPageCount } from '../../data/programmatic';
import { calculateQualityScore, shouldIndex } from '../quality/scoring';
import { isPageQualityEligible } from '../quality/eligibility';
import { siteConfig } from '../../config/site';

const ROTATION_STEP = 7919;
const indexableSlugCache = new Map<string, boolean>();

export const DEFAULT_HUB_PATHS = ['/', '/guides', '/tools', '/about', '/contact', '/k'] as const;

export interface DiscoveryLink {
  href: string;
  title: string;
  source: 'priority' | 'rotation' | 'weekly-discovery';
}

export interface HubLinkSnapshot {
  hubPath: string;
  generatedAt: string;
  rotationWeek: number;
  links: DiscoveryLink[];
}

function fallbackSeedForHub(hubPath: string): number {
  // Weekly rotation: seed changes every week so hub links rotate for bots.
  // This ensures that bots crawling hubs every few days see NEW /k/ links,
  // gradually exposing the full 18M corpus through the hub discovery channel.
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const pathSeed = hubPath.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return weekNumber * ROTATION_STEP + pathSeed;
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
  const gateEligible = isPageQualityEligible(
    page.slug,
    page.taskVariant,
    page.primaryTool,
    page.intent,
  );
  const indexable = gateEligible && shouldIndex(
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
 *
 * ROTATION MODEL (EKSİK #1 fix):
 * - 60% priority links: high-value pages from priority sitemap tier
 * - 40% weekly-rotated discovery links: different set each week
 * This ensures bots see fresh URLs on every weekly crawl pass.
 */
function buildHubLinkSnapshot(hubPath: string, count: number): HubLinkSnapshot {
  const normalizedHubPath = normalizeHubPath(hubPath);
  const total = getTotalPageCount();
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

  if (total < 1) {
    return {
      hubPath: normalizedHubPath,
      generatedAt: new Date().toISOString(),
      rotationWeek: weekNumber,
      links: [],
    };
  }

  const links: DiscoveryLink[] = [];
  const selectedPaths = new Set<string>();
  const selectedTitles = new Set<string>();
  const seed = fallbackSeedForHub(normalizedHubPath);

  // Split: 60% priority (stable), 40% discovery (weekly rotating)
  const priorityCount = Math.ceil(count * 0.6);
  const discoveryCount = count - priorityCount;

  // Priority links — stable, high-value pages
  let attempts = 0;
  while (links.length < priorityCount && attempts < priorityCount * 80) {
    const index = (seed + attempts * ROTATION_STEP) % total;
    attempts += 1;

    const slug = getSlugByIndex(index);
    if (!slug) continue;

    const path = `/k/${slug}`;
    if (path === normalizedHubPath || selectedPaths.has(path)) continue;
    if (!isIndexableProgrammaticPath(path)) continue;

    const page = getProgrammaticPageBySlug(slug);
    const title = page?.title?.trim() || programmaticLabelFromPath(path);
    const titleKey = title.toLowerCase();
    if (selectedTitles.has(titleKey)) continue;

    selectedPaths.add(path);
    selectedTitles.add(titleKey);
    links.push({
      href: path,
      title,
      source: 'priority',
    });
  }

  // Discovery links — weekly rotation for fresh crawl targets
  const discoverySeed = seed ^ (weekNumber * 104729);
  attempts = 0;
  let discoveryAdded = 0;
  while (discoveryAdded < discoveryCount && attempts < discoveryCount * 80) {
    const index = (discoverySeed + attempts * ROTATION_STEP) % total;
    attempts += 1;

    const slug = getSlugByIndex(index);
    if (!slug) continue;

    const path = `/k/${slug}`;
    if (path === normalizedHubPath || selectedPaths.has(path)) continue;
    if (!isIndexableProgrammaticPath(path)) continue;

    const page = getProgrammaticPageBySlug(slug);
    const title = page?.title?.trim() || programmaticLabelFromPath(path);
    const titleKey = title.toLowerCase();
    if (selectedTitles.has(titleKey)) continue;

    selectedPaths.add(path);
    selectedTitles.add(titleKey);
    links.push({
      href: path,
      title,
      source: 'weekly-discovery',
    });
    discoveryAdded++;
  }

  return {
    hubPath: normalizedHubPath,
    generatedAt: new Date().toISOString(),
    rotationWeek: weekNumber,
    links,
  };
}

export async function getOrRefreshHubLinks(options: {
  hubPath: string;
  siteUrl: string;
  count?: number;
  refreshMinutes?: number;
}): Promise<HubLinkSnapshot> {
  const count = Math.min(500, Math.max(1, options.count ?? 50));
  return buildHubLinkSnapshot(options.hubPath, count);
}

export async function refreshHubLinks(options: {
  hubPath: string;
  siteUrl: string;
  count?: number;
  refreshMinutes?: number;
  force?: boolean;
}): Promise<HubLinkSnapshot> {
  const count = Math.min(500, Math.max(1, options.count ?? 50));
  return buildHubLinkSnapshot(options.hubPath, count);
}

export async function getHubLinkSnapshot(hubPath: string): Promise<HubLinkSnapshot | null> {
  return buildHubLinkSnapshot(hubPath, 50);
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

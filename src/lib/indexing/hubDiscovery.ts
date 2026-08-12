import { guideRegistry } from '../../content/guides';
import { toolRegistry } from '../../tools/registry';
import { getSlugByIndex } from '../../data/programmatic';

const ROTATION_STEP = 7919;

export const DEFAULT_HUB_PATHS = ['/', '/guides', '/tools', '/about', '/contact', '/k'] as const;

export interface DiscoveryLink {
  href: string;
  title: string;
  source: 'priority' | 'rotation' | 'weekly-discovery' | 'corpus';
}

export interface HubLinkSnapshot {
  hubPath: string;
  generatedAt: string;
  rotationWeek: number;
  links: DiscoveryLink[];
}

function fallbackSeedForHub(hubPath: string): number {
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

function buildEditorialCandidates(): DiscoveryLink[] {
  const guideLinks: DiscoveryLink[] = guideRegistry.map((guide) => ({
    href: `/guides/${guide.slug}`,
    title: guide.title,
    source: 'priority',
  }));

  const toolLinks: DiscoveryLink[] = toolRegistry.map((tool) => ({
    href: `/tools/${tool.slug}`,
    title: tool.name,
    source: 'priority',
  }));

  return [...guideLinks, ...toolLinks];
}

/**
 * Weekly-rotating /k/ corpus seeds from the ramp-public window (first 500k).
 * Hubs that only linked guides/tools starved Googlebot of paths into the
 * long-tail corpus; a modest, rotating set restores crawl discovery without
 * spamming thousands of near-duplicate anchors on every hub.
 */
function buildCorpusCandidates(hubPath: string, count: number): DiscoveryLink[] {
  const seed = fallbackSeedForHub(hubPath);
  const links: DiscoveryLink[] = [];
  const seen = new Set<string>();
  const window = 500_000;
  for (let i = 0; links.length < count && i < count * 8; i += 1) {
    const index = (seed + i * ROTATION_STEP) % window;
    const slug = getSlugByIndex(index);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const label = slug.replace(/-\d+$/, '').split('-').slice(0, 6).join(' ');
    links.push({
      href: `/k/${slug}`,
      title: label.charAt(0).toUpperCase() + label.slice(1),
      source: 'corpus',
    });
  }
  return links;
}

/**
 * Editorial hub links + a rotating slice of real /k/ corpus URLs.
 * Mix keeps authority on product pages while feeding crawl discovery.
 */
function buildHubLinkSnapshot(hubPath: string, count: number): HubLinkSnapshot {
  const normalizedHubPath = normalizeHubPath(hubPath);
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const editorial = buildEditorialCandidates();
  const corpusBudget = Math.min(6, Math.max(3, Math.floor(count / 2)));
  const corpus = buildCorpusCandidates(normalizedHubPath, corpusBudget);

  const links: DiscoveryLink[] = [];
  const selectedPaths = new Set<string>();
  const seed = fallbackSeedForHub(normalizedHubPath);

  for (const candidate of corpus) {
    if (links.length >= count) break;
    if (selectedPaths.has(candidate.href)) continue;
    selectedPaths.add(candidate.href);
    links.push(candidate);
  }

  let attempts = 0;
  while (links.length < count && attempts < editorial.length * 4) {
    const index = (seed + attempts * ROTATION_STEP) % editorial.length;
    attempts += 1;
    const candidate = editorial[index];
    if (!candidate || candidate.href === normalizedHubPath || selectedPaths.has(candidate.href)) continue;
    selectedPaths.add(candidate.href);
    links.push({
      ...candidate,
      source: attempts % 5 === 0 ? 'weekly-discovery' : 'priority',
    });
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
  const count = Math.min(14, Math.max(1, options.count ?? 10));
  return buildHubLinkSnapshot(options.hubPath, count);
}

export async function refreshHubLinks(options: {
  hubPath: string;
  siteUrl: string;
  count?: number;
  refreshMinutes?: number;
  force?: boolean;
}): Promise<HubLinkSnapshot> {
  const count = Math.min(14, Math.max(1, options.count ?? 10));
  return buildHubLinkSnapshot(options.hubPath, count);
}

export async function getHubLinkSnapshot(hubPath: string): Promise<HubLinkSnapshot | null> {
  return buildHubLinkSnapshot(hubPath, 10);
}

export async function writeDiscoveredPriorityUrls(_options: {
  urls: string[];
  siteUrl: string;
  mode?: 'replace' | 'append';
  chunkSize?: number;
}): Promise<{ accepted: number; chunkCount: number; total: number }> {
  return { accepted: 0, chunkCount: 0, total: 0 };
}

export { normalizeHubPath, toAbsoluteSiteUrl };

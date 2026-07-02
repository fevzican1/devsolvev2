import { guideRegistry } from '../../content/guides';
import { toolRegistry } from '../../tools/registry';

const ROTATION_STEP = 7919;

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
 * Editorial hub links — guides and tools only (no programmatic /k/* spam).
 * Reviewers and readers see real product pages, not SEO slug titles.
 */
function buildHubLinkSnapshot(hubPath: string, count: number): HubLinkSnapshot {
  const normalizedHubPath = normalizeHubPath(hubPath);
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const candidates = buildEditorialCandidates();

  if (candidates.length === 0) {
    return {
      hubPath: normalizedHubPath,
      generatedAt: new Date().toISOString(),
      rotationWeek: weekNumber,
      links: [],
    };
  }

  const links: DiscoveryLink[] = [];
  const selectedPaths = new Set<string>();
  const seed = fallbackSeedForHub(normalizedHubPath);
  let attempts = 0;

  while (links.length < count && attempts < candidates.length * 4) {
    const index = (seed + attempts * ROTATION_STEP) % candidates.length;
    attempts += 1;

    const candidate = candidates[index];
    if (candidate.href === normalizedHubPath || selectedPaths.has(candidate.href)) continue;

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
  const count = Math.min(12, Math.max(1, options.count ?? 6));
  return buildHubLinkSnapshot(options.hubPath, count);
}

export async function refreshHubLinks(options: {
  hubPath: string;
  siteUrl: string;
  count?: number;
  refreshMinutes?: number;
  force?: boolean;
}): Promise<HubLinkSnapshot> {
  const count = Math.min(12, Math.max(1, options.count ?? 6));
  return buildHubLinkSnapshot(options.hubPath, count);
}

export async function getHubLinkSnapshot(hubPath: string): Promise<HubLinkSnapshot | null> {
  return buildHubLinkSnapshot(hubPath, 6);
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

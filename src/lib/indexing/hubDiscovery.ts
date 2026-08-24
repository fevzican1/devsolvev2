import { guideRegistry } from '../../content/guides';
import { toolRegistry } from '../../tools/registry';
import { formatProgrammaticHubLabel } from '../programmatic/hub';
import { staticProgrammaticSlugs } from '../programmatic/staticPaths';

const ROTATION_STEP = 7919;

export const DEFAULT_HUB_PATHS = ['/', '/guides', '/tools', '/docs', '/about', '/contact', '/k'] as const;

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
 * Weekly-rotating /k/ seeds from the STATIC EXPORT set only (≤5k priority).
 * Never emit edge-only corpus URLs from hubs — those fail the static link audit.
 */
function buildCorpusCandidates(hubPath: string, count: number): DiscoveryLink[] {
  const pool = staticProgrammaticSlugs;
  if (pool.length === 0) return [];

  const seed = fallbackSeedForHub(hubPath);
  const links: DiscoveryLink[] = [];
  const seen = new Set<string>();
  for (let i = 0; links.length < count && i < count * 8; i += 1) {
    const index = (seed + i * ROTATION_STEP) % pool.length;
    const slug = pool[index];
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const label = formatProgrammaticHubLabel(slug);
    links.push({
      href: `/k/${slug}`,
      title: label,
      source: 'corpus',
    });
  }
  return links;
}

/**
 * Editorial hub links + a rotating slice of statically-exported /k/ URLs.
 */
function buildHubLinkSnapshot(hubPath: string, count: number): HubLinkSnapshot {
  const normalizedHubPath = normalizeHubPath(hubPath);
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const editorial = buildEditorialCandidates();
  const corpusBudget = Math.min(6, Math.max(3, Math.floor(count / 2)));
  const corpus = buildCorpusCandidates(normalizedHubPath, corpusBudget);

  const links: DiscoveryLink[] = [];
  const selectedPaths = new Set<string>();
  const selectedTitles = new Set<string>();
  const seed = fallbackSeedForHub(normalizedHubPath);

  for (const candidate of corpus) {
    if (links.length >= count) break;
    if (selectedPaths.has(candidate.href) || selectedTitles.has(candidate.title)) continue;
    selectedPaths.add(candidate.href);
    selectedTitles.add(candidate.title);
    links.push(candidate);
  }

  let attempts = 0;
  while (links.length < count && attempts < editorial.length * 4) {
    const index = (seed + attempts * ROTATION_STEP) % editorial.length;
    attempts += 1;
    const candidate = editorial[index];
    if (!candidate || candidate.href === normalizedHubPath || selectedPaths.has(candidate.href) || selectedTitles.has(candidate.title)) continue;
    selectedPaths.add(candidate.href);
    selectedTitles.add(candidate.title);
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

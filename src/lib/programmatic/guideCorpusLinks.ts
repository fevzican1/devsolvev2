/**
 * Guide ↔ /k/ corpus bridges using REAL canonical slugs from the programmatic
 * corpus. The previous clusterMapping helper invented ordinals (`counter % 162`)
 * that 301/404'd — those links burned crawl budget and never transferred equity.
 *
 * Pure, build-time only. Zero Cloudflare Function cost.
 */
import { buildGuideOutboundSlugs as legacyMappingShape, getMappingForGuide, type ClusterMapping } from '@/config/clusterMapping';
import { getSlugByIndex, getTotalPageCount } from '@/data/programmatic';

export interface GuideCorpusLink {
  slug: string;
  href: string;
  label: string;
}

/**
 * Resolve up to `maxLinks` real /k/ URLs for a guide by walking the corpus
 * with a deterministic stride seeded from the guide slug. Prefers pages whose
 * tool/intent appear in the guide's ClusterMapping when available.
 */
export function buildRealGuideOutboundLinks(
  guideSlug: string,
  maxLinks?: number,
): GuideCorpusLink[] {
  const mapping = getMappingForGuide(guideSlug);
  const limit = Math.max(1, Math.min(24, maxLinks ?? mapping?.linkCount ?? 12));
  const total = getTotalPageCount();
  if (total <= 0) return [];

  const seed = Math.abs(
    guideSlug.split('').reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0),
  );
  const stride = 1 + (seed % 9973) * 2;
  const tools = new Set(mapping?.programmaticTools ?? []);
  const intents = new Set(mapping?.mappedIntents ?? []);
  const clusters = new Set(mapping?.programmaticClusters ?? []);

  const preferred: GuideCorpusLink[] = [];
  const fallback: GuideCorpusLink[] = [];
  const seen = new Set<string>();

  // Prefer a dense scan of the first 500k (sitemap-public ramp) so hub→corpus
  // links reinforce the same URLs Google/Bing are being asked to crawl.
  const scanWindow = Math.min(total, 500_000);
  let cursor = seed % scanWindow;
  const maxAttempts = Math.min(scanWindow, limit * 64);

  for (let i = 0; preferred.length + fallback.length < limit * 3 && i < maxAttempts; i += 1) {
    cursor = (cursor + stride) % scanWindow;
    const slug = getSlugByIndex(cursor);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const label = humaniseSlug(slug);
    const link: GuideCorpusLink = { slug, href: `/k/${slug}`, label };
    const matchesMapping = mapping
      ? matchesMappingSlug(slug, tools, intents, clusters)
      : false;

    if (matchesMapping) preferred.push(link);
    else fallback.push(link);

    if (preferred.length >= limit) break;
  }

  const merged = [...preferred, ...fallback].slice(0, limit);
  // Absolute last resort: legacy shape (should be unused once corpus is live).
  if (merged.length === 0) {
    return legacyMappingShape(guideSlug, limit).map((l) => ({
      slug: l.slug,
      href: l.href,
      label: l.label,
    }));
  }
  return merged;
}

function matchesMappingSlug(
  slug: string,
  tools: Set<string>,
  intents: Set<string>,
  clusters: Set<string>,
): boolean {
  for (const tool of Array.from(tools)) {
    if (slug.includes(`-${tool}-`)) {
      for (const intent of Array.from(intents)) {
        if (slug.includes(`-${intent}-`)) return true;
      }
      for (const cluster of Array.from(clusters)) {
        if (slug.startsWith(`${cluster}-`)) return true;
      }
    }
  }
  return false;
}

function humaniseSlug(slug: string): string {
  const withoutOrdinal = slug.replace(/-\d+$/, '');
  const parts = withoutOrdinal.split('-').slice(0, 8);
  const text = parts.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type { ClusterMapping };

/**
 * Guide ↔ /k/ corpus bridges using ONLY statically-exported priority slugs.
 *
 * The static export pre-renders ≤5k priority /k/ pages. Linking anything else
 * from guides/hubs fails `internal-link-redirect-audit` (no `out/k/<slug>.html`)
 * and would 404 if the request ever missed the Pages Function. Edge-rendered
 * /k/ pages may still deep-link across the full 20M corpus.
 */
import { getMappingForGuide } from '@/config/clusterMapping';
import { staticProgrammaticSlugs } from '@/lib/programmatic/staticPaths';

export interface GuideCorpusLink {
  slug: string;
  href: string;
  label: string;
}

/**
 * Resolve up to `maxLinks` real, statically-exported /k/ URLs for a guide.
 * Prefers slugs whose tool/intent match the guide's ClusterMapping.
 */
export function buildRealGuideOutboundLinks(
  guideSlug: string,
  maxLinks?: number,
): GuideCorpusLink[] {
  const mapping = getMappingForGuide(guideSlug);
  const limit = Math.max(1, Math.min(24, maxLinks ?? mapping?.linkCount ?? 12));
  if (staticProgrammaticSlugs.length === 0) return [];

  const seed = Math.abs(
    guideSlug.split('').reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0),
  );
  const stride = 1 + (seed % 9973) * 2;
  const tools = mapping?.programmaticTools ?? [];
  const intents = mapping?.mappedIntents ?? [];
  const clusters = mapping?.programmaticClusters ?? [];

  const preferred: GuideCorpusLink[] = [];
  const fallback: GuideCorpusLink[] = [];
  const seen = new Set<string>();
  const pool = staticProgrammaticSlugs;
  const maxAttempts = Math.min(pool.length, limit * 64);
  let cursor = seed % pool.length;

  for (let i = 0; preferred.length + fallback.length < limit * 3 && i < maxAttempts; i += 1) {
    cursor = (cursor + stride) % pool.length;
    const slug = pool[cursor];
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const link: GuideCorpusLink = {
      slug,
      href: `/k/${slug}`,
      label: humaniseSlug(slug),
    };

    if (matchesMappingSlug(slug, tools, intents, clusters)) preferred.push(link);
    else fallback.push(link);

    if (preferred.length >= limit) break;
  }

  return [...preferred, ...fallback].slice(0, limit);
}

function matchesMappingSlug(
  slug: string,
  tools: string[],
  intents: string[],
  clusters: string[],
): boolean {
  for (const tool of tools) {
    if (!slug.includes(`-${tool}-`)) continue;
    for (const intent of intents) {
      if (slug.includes(`-${intent}-`)) return true;
    }
    for (const cluster of clusters) {
      if (slug.startsWith(`${cluster}-`)) return true;
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

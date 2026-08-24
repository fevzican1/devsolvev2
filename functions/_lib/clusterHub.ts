/**
 * Cluster graph hubs — Home → /g/{cluster} → /k/{slug} (2 clicks into the 20M).
 *
 * These pages are crawl chrome, not independent guides: robots noindex,follow
 * so they do not compete as thin content. Every hub samples the FULL cluster
 * range inside CORPUS_SIZE (not a 2M sitemap band). The 20M /k/ pages stay
 * 200 + index,follow and carry the rest of the graph.
 */
import {
  CLUSTERS,
  CORPUS_SIZE,
  PAIRS,
  PER_PAIR,
  pageForIndex,
  escapeHtml,
  title,
} from './programmaticPage';

export const CLUSTER_HUB_PREFIX = '/g';
const SAMPLE = 48;

export function clusterKeys(): string[] {
  return CLUSTERS.map(([cluster]) => cluster);
}

export function isClusterKey(value: string): boolean {
  return clusterKeys().includes(value);
}

function bounds(cluster: string): { start: number; end: number } {
  let start = -1;
  let end = -1;
  for (let i = 0; i < PAIRS.length; i += 1) {
    if (PAIRS[i]?.[0] !== cluster) continue;
    if (start < 0) start = i * PER_PAIR;
    end = Math.min((i + 1) * PER_PAIR, CORPUS_SIZE);
  }
  if (start < 0) return { start: 0, end: 0 };
  return { start, end };
}

function samplePages(cluster: string) {
  const { start, end } = bounds(cluster);
  const span = Math.max(0, end - start);
  if (span <= 0) return [];
  const out = [];
  const n = Math.min(SAMPLE, span);
  for (let i = 0; i < n; i += 1) {
    const index = start + Math.floor((i * span) / n);
    const page = pageForIndex(index);
    if (page) out.push(page);
  }
  return out;
}

export function renderClusterHub(cluster: string, origin: string): string | undefined {
  if (!isClusterKey(cluster)) return undefined;
  const pages = samplePages(cluster);
  const { start, end } = bounds(cluster);
  const label = title(cluster);
  const canonical = `${origin}${CLUSTER_HUB_PREFIX}/${cluster}`;
  const siblings = clusterKeys()
    .filter((key) => key !== cluster)
    .map((key) => `<a href="${CLUSTER_HUB_PREFIX}/${escapeHtml(key)}">${escapeHtml(title(key))}</a>`)
    .join(' · ');
  const items = pages.map((page, i) => (
    `<li><a href="/k/${escapeHtml(page.slug)}">${i + 1}. ${escapeHtml(title(page.intent))} for ${escapeHtml(page.audience.replace(/-/g, ' '))} (${escapeHtml(page.tool)})</a></li>`
  )).join('');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${label} workflow index`,
    numberOfItems: pages.length,
    itemListElement: pages.map((page, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${origin}/k/${page.slug}`,
      name: `${title(page.intent)} (${page.tool})`,
    })),
  }).replace(/</g, '\\u003c');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<title>${escapeHtml(label)} workflow index</title>`
    + `<meta name="robots" content="noindex,follow">`
    + `<link rel="canonical" href="${escapeHtml(canonical)}">`
    + `<script type="application/ld+json">${jsonLd}</script>`
    + `</head><body>`
    + `<nav><a href="/">Home</a> / <a href="/k">Guides</a> / ${escapeHtml(label)}</nav>`
    + `<h1>${escapeHtml(label)} workflows</h1>`
    + `<p>Entry points into the ${escapeHtml(label)} slice of the ${CORPUS_SIZE.toLocaleString('en-US')}-URL corpus (ordinals ${start.toLocaleString('en-US')}–${Math.max(0, end - 1).toLocaleString('en-US')}). This page is a directory. The linked guides are the indexable documents.</p>`
    + `<p>Other clusters: ${siblings}</p>`
    + `<ol>${items}</ol>`
    + `</body></html>`;
}

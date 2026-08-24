/**
 * Crawl-budget agent — Bing §21 + Google "Discovered - currently not indexed".
 *
 * The other-agent advice to 404/noindex the 18M unadvertised factory is wrong:
 * those URLs are live canonicals (200 + index,follow). Deleting them creates
 * GSC 404s and Bing §9 removal noise. The actual waste is advertising or
 * internally linking URLs outside the sitemap ramp.
 *
 * Cost: build CPU only.
 */
import {
  CORPUS_SIZE,
  PER_PAIR,
  SITEMAP_PUBLIC_LIMIT,
  pageForIndex,
  relatedCorpusLinks,
  renderProgrammaticPage,
} from '../../../functions/_lib/programmaticPage.ts';
import { QUALITY_CONTRACT } from '../ai-indexing-agent.mjs';
import {
  crawlSurfaceLeaksFromHtml,
  crawlSurfaceLeaksFromRelated,
  ORIGIN,
  samplePages,
} from './shared.mjs';

export const AGENT = {
  id: 'crawl-budget-agent',
  task: 'Keep the crawl graph inside the advertised sitemap ramp without 404ing the 20M factory',
};

function boundaryIndices() {
  const last = CORPUS_SIZE - 1;
  const surfaceLast = Math.max(0, SITEMAP_PUBLIC_LIMIT - 1);
  return [...new Set([
    0,
    1,
    PER_PAIR - 1,
    PER_PAIR,
    surfaceLast,
    SITEMAP_PUBLIC_LIMIT,
    Math.min(SITEMAP_PUBLIC_LIMIT + 1, last),
    Math.min(SITEMAP_PUBLIC_LIMIT + PER_PAIR, last),
    last,
  ])].filter((i) => i >= 0 && i < CORPUS_SIZE);
}

export async function run(opts = {}) {
  const count = opts.sample ?? 80;
  const failures = [];
  const pages = samplePages(count, 0x51ed270b);
  let minRelated = Infinity;
  let htmlChecked = 0;
  let relatedChecked = 0;

  for (const { page, html } of pages) {
    htmlChecked += 1;
    const leaks = crawlSurfaceLeaksFromHtml(html);
    if (leaks.length) {
      failures.push({ slug: page.slug, reason: `html leak: /k/${leaks[0].slug} (${leaks[0].reason})` });
    }
    const hops = (html.match(/data-rel="(?:next-task|observe|method|intent)"/g) || []).length;
    if (hops < QUALITY_CONTRACT.minSemanticHops) {
      failures.push({ slug: page.slug, reason: `only ${hops} required semantic hops` });
    }
    const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)].length;
    if (links < QUALITY_CONTRACT.minInternalLinks) {
      failures.push({ slug: page.slug, reason: `only ${links} internal links` });
    }
  }

  for (const index of boundaryIndices()) {
    const page = pageForIndex(index);
    if (!page) continue;
    relatedChecked += 1;
    const related = relatedCorpusLinks(page);
    minRelated = Math.min(minRelated, related.length);
    const leaks = crawlSurfaceLeaksFromRelated(page);
    if (leaks.length) {
      failures.push({ slug: page.slug, reason: `related leak at index ${index}: /k/${leaks[0].slug}` });
    }
    if (related.length < 8) {
      failures.push({ slug: page.slug, reason: `only ${related.length} related /k/ links at index ${index}` });
    }
    const html = renderProgrammaticPage(page, ORIGIN);
    const htmlLeaks = crawlSurfaceLeaksFromHtml(html);
    if (htmlLeaks.length) {
      failures.push({ slug: page.slug, reason: `boundary html leak: /k/${htmlLeaks[0].slug}` });
    }
    const hops = (html.match(/data-rel="(?:next-task|observe|method|intent)"/g) || []).length;
    if (hops < QUALITY_CONTRACT.minSemanticHops) {
      failures.push({ slug: page.slug, reason: `boundary page missing semantic hops (${hops})` });
    }
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1];
    if (canonical !== `${ORIGIN}/k/${page.slug}`) {
      failures.push({ slug: page.slug, reason: `canonical drifted to ${canonical}` });
    }
    if (/noindex/i.test(html)) {
      failures.push({ slug: page.slug, reason: 'factory URL is noindexed — crawl-budget fix must not noindex live canonicals' });
    }
  }

  const cheapN = Math.min(CORPUS_SIZE, opts.relatedSweep ?? 8_000);
  let rng = 0x85ebca6b >>> 0;
  const next = () => {
    rng = Math.imul(rng ^ (rng >>> 16), 0x7feb352d) >>> 0;
    rng = Math.imul(rng ^ (rng >>> 15), 0x846ca68b) >>> 0;
    return ((rng ^ (rng >>> 16)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < cheapN && failures.length < 25; i += 1) {
    const index = Math.floor(next() * CORPUS_SIZE);
    const page = pageForIndex(index);
    if (!page) continue;
    relatedChecked += 1;
    const leaks = crawlSurfaceLeaksFromRelated(page);
    if (leaks.length) {
      failures.push({ slug: page.slug, reason: `sweep leak: /k/${leaks[0].slug}` });
    }
  }

  return {
    agent: AGENT,
    ok: failures.length === 0,
    scanned: htmlChecked + relatedChecked,
    sitemapPublicLimit: SITEMAP_PUBLIC_LIMIT,
    corpusSize: CORPUS_SIZE,
    minRelated: Number.isFinite(minRelated) ? minRelated : 0,
    failures: failures.slice(0, 20),
    notes: [
      `Sitemap ramp ${SITEMAP_PUBLIC_LIMIT.toLocaleString()} of ${CORPUS_SIZE.toLocaleString()}.`,
      'Unadvertised URLs stay 200 + self-canonical + index,follow. They are not 404ed or noindexed.',
      'Google “Crawled – currently not indexed” is quality; “Discovered – currently not indexed” is this crawl graph.',
    ],
  };
}

/**
 * Google Indexing Agent — maps every Search Console "Page indexing" reason
 * that a website can actually fix onto the HTML we serve.
 *
 * Cost: build CPU only. No Google API key required for the HTML contract;
 * live GSC counts stay in scripts/check-gsc-gate.mjs when a service account
 * is present.
 */
import { TITLE_MAX, TITLE_MIN, DESCRIPTION_TARGET_MIN, DESCRIPTION_TARGET_MAX } from '../search-guidelines.mjs';
import { scorePage, MIN_INDEXABLE_SCORE } from '../ai-quality-scoring.mjs';
import { FORBIDDEN_SKELETON_HEADINGS } from '../../../functions/_lib/ownedHeading.ts';
import { headingOwnerClauseFor } from '../../../functions/_lib/programmaticPage.ts';
import { extract, extractHeadings, samplePages, wordCount } from './shared.mjs';

export const AGENT = {
  id: 'google-indexing-agent',
  task: 'Prove each /k/ URL would not land in a Website-sourced Page indexing error',
};

const REASONS = [
  {
    id: 'url-marked-noindex',
    gsc: 'URL marked noindex',
    check: (html) => /noindex/i.test(extract(html, /<meta name="robots"[^>]*content="([^"]*)"/i))
      ? 'robots meta contains noindex'
      : null,
  },
  {
    id: 'blocked-robots-txt',
    gsc: 'URL blocked by robots.txt',
    check: () => null, // robots.txt Allow: / for Googlebot is a file-level invariant
  },
  {
    id: 'canonical-self',
    gsc: 'Duplicate without user-selected canonical / Google chose different canonical',
    check: (html, ctx) => {
      const canonical = extract(html, /<link rel="canonical" href="([^"]+)"/i);
      if (!canonical) return 'missing canonical';
      if (canonical !== ctx.url) return `canonical ${canonical} != ${ctx.url}`;
      return null;
    },
  },
  {
    id: 'soft-404',
    gsc: 'Soft 404',
    check: (html) => (wordCount(html) < 400 ? 'thin page looks like a soft 404' : null),
  },
  {
    id: 'page-indexed-without-content',
    gsc: 'Page indexed without content',
    check: (html) => {
      if (!/<h1[\s>]/i.test(html)) return 'missing H1';
      if (!/<main[\s>]/i.test(html)) return 'missing <main>';
      return null;
    },
  },
  {
    id: 'title-window',
    gsc: 'Improve page experience / title issues',
    check: (html) => {
      const title = extract(html, /<title>([^<]*)<\/title>/i);
      if (title.length < TITLE_MIN) return `title ${title.length} < ${TITLE_MIN}`;
      if (title.length > TITLE_MAX) return `title ${title.length} > ${TITLE_MAX}`;
      return null;
    },
  },
  {
    id: 'description-window',
    gsc: 'Missing or short meta description',
    check: (html) => {
      const d = extract(html, /<meta name="description" content="([^"]*)"/i);
      if (d.length < DESCRIPTION_TARGET_MIN) return `description ${d.length} < ${DESCRIPTION_TARGET_MIN}`;
      if (d.length > DESCRIPTION_TARGET_MAX) return `description ${d.length} > ${DESCRIPTION_TARGET_MAX}`;
      return null;
    },
  },
  {
    id: 'crawled-not-indexed-quality',
    gsc: 'Crawled - currently not indexed (content quality / scaled content)',
    check: (html, ctx) => {
      if (!ctx.score?.passesIndexable) {
        return `score ${ctx.score?.score} < ${MIN_INDEXABLE_SCORE} or critical violations`;
      }
      if (/<h[4-6]\b/i.test(html)) return 'document outline uses H4+ (shared ad/chrome heading)';
      const h2 = extractHeadings(html, 'h2');
      const h3 = extractHeadings(html, 'h3');
      const headings = [...h2, ...h3].map((h) => h.toLowerCase());
      const skeleton = headings.filter((h) => FORBIDDEN_SKELETON_HEADINGS.includes(h));
      if (skeleton.length) return `shared heading skeleton still present: ${skeleton.join('; ')}`;
      const clause = headingOwnerClauseFor(ctx.page).toLowerCase();
      const missing = [...h2, ...h3].filter((h) => !h.toLowerCase().includes(clause));
      if (missing.length) return `heading missing unique owner clause: ${missing[0]}`;
      if (!ctx.score.signals?.hasIndependentOpening) {
        return 'opening does not name this page’s audience and job';
      }
      if (!ctx.score.signals?.hasCompatMatrix) return 'missing unique compat/error matrix';
      if (!ctx.score.signals?.hasExecutablePack) return 'missing Dockerfile/Bash information-gain pack';
      if (!ctx.score.signals?.hasBranchTree) return 'missing if/then edge-case tree';
      if (!ctx.score.signals?.hasSemanticHops) return 'missing semantic next-job / monitor hops';
      return null;
    },
  },
  {
    id: 'discovered-not-indexed',
    gsc: 'Discovered - currently not indexed',
    check: (html) => {
      const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)].length;
      if (links < 14) return `only ${links} internal links`;
      if (!html.includes('application/ld+json')) return 'no structured data for discovery';
      return null;
    },
  },
];

export async function run(opts = {}) {
  const count = opts.sample ?? 80;
  const pages = samplePages(count, 0x61c88647);
  const failures = [];
  const reasonHits = Object.fromEntries(REASONS.map((r) => [r.id, 0]));

  for (const { page, html } of pages) {
    const scored = scorePage(html, { expectedCanonical: `https://devsolvev2.com/k/${page.slug}` });
    const ctx = { url: `https://devsolvev2.com/k/${page.slug}`, score: scored, page };
    for (const reason of REASONS) {
      const hit = reason.check(html, ctx);
      if (hit) {
        reasonHits[reason.id] += 1;
        failures.push({ slug: page.slug, reason: reason.gsc, detail: hit });
      }
    }
  }

  return {
    agent: AGENT,
    ok: failures.length === 0,
    scanned: pages.length,
    reasonHits,
    failures: failures.slice(0, 20),
    notes: [
      'Server 5xx / 404 / 401 are routing invariants, not HTML. Phase D of verify-edge-corpus-quality.mjs covers them.',
      'Crawled - currently not indexed (content quality) is enforced here: score, independent opening, unique owner clause on every H2/H3, and no shared heading skeleton.',
    ],
  };
}

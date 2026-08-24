/**
 * Bing Webmaster Guidelines Agent — §1–§22 + abuse list, as HTML contracts.
 * Cost: build CPU only. No Bing API, no Cloudflare Function.
 */
import { QUALITY_CONTRACT } from '../ai-indexing-agent.mjs';
import { scorePage, MIN_INDEXABLE_SCORE } from '../ai-quality-scoring.mjs';
import { extract, samplePages } from './shared.mjs';
import { hasDuplicateContentTokens } from '../../../src/lib/seo/uniqueTokens.ts';

export const AGENT = {
  id: 'bing-guidelines-agent',
  task: 'Prove each /k/ URL is eligible under Bing Webmaster Guidelines for index + grounding',
};

const SECTION_HINTS = [
  { id: '§1-useful', test: (html, ctx) => ctx.score.wordCount >= QUALITY_CONTRACT.minWordCount, fail: 'not enough useful prose' },
  { id: '§5-links', test: (html, ctx) => ctx.score.details.internalLinks >= QUALITY_CONTRACT.minInternalLinks, fail: 'weak internal link structure' },
  { id: '§6-canonical', test: (html) => /rel="canonical"/.test(html), fail: 'no canonical' },
  { id: '§8-render', test: (html) => html.includes('<main') && html.includes('<h1'), fail: 'content not in raw HTML' },
  { id: '§10-robots', test: (html) => /content="index,follow/i.test(html) && !/noarchive|nosnippet|nocache/i.test(html), fail: 'robots block grounding' },
  { id: '§10-snippet', test: (html) => html.includes('data-snippet'), fail: 'no data-snippet for citations' },
  { id: '§11-focus', test: (html) => /id="decision"|data-decision/.test(html), fail: 'no decision guide' },
  { id: '§13-title', test: (html) => {
    const n = extract(html, /<title>([^<]*)<\/title>/i).length;
    return n >= QUALITY_CONTRACT.titleChars.min && n <= QUALITY_CONTRACT.titleChars.max;
  }, fail: 'title outside Bing window' },
  { id: '§13-description', test: (html) => {
    const n = extract(html, /<meta name="description" content="([^"]*)"/i).length;
    return n >= QUALITY_CONTRACT.descriptionChars.min && n <= QUALITY_CONTRACT.descriptionChars.max;
  }, fail: 'description outside 150–160' },
  { id: '§13-structure', test: (html) => (html.match(/<h2/gi) || []).length >= 4, fail: 'fewer than 4 H2s' },
  { id: '§14-jsonld', test: (html) => (html.match(/application\/ld\+json/g) || []).length >= 3, fail: 'fewer than 3 JSON-LD blocks' },
  { id: '§15-verify', test: (html) => /<pre|<code/i.test(html), fail: 'no worked example' },
  { id: '§15-matrix', test: (html) => /data-compat-matrix/.test(html) && (html.match(/data-error-code=/g) || []).length >= 3, fail: 'no unique error matrix' },
  { id: '§15-exec', test: (html) => /FROM\s+\S+/i.test(html) && /set -euo pipefail/.test(html), fail: 'no executable Dockerfile/Bash' },
  { id: '§11-branches', test: (html) => /data-branch-tree/.test(html), fail: 'no if/then forks' },
  { id: '§5-semantic-hops', test: (html) => (html.match(/data-rel="(?:next-task|observe|method|intent)"/g) || []).length >= 4, fail: 'related links are not a semantic graph' },
  { id: '§16-entity', test: (html) => html.includes('data-entity') || html.includes('id="entity"'), fail: 'entity block missing' },
  { id: '§17-topic', test: (html) => (html.match(/<h1/gi) || []).length === 1, fail: 'not a single H1' },
  { id: '§18-early', test: (html) => /\sdata-snippet(?=[\s>=])/i.test(html), fail: 'no early citable answer' },
  { id: 'abuse-unique-tokens', test: (html) => {
    const title = extract(html, /<title>([^<]*)<\/title>/i);
    const h1 = extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return !hasDuplicateContentTokens(title) && !hasDuplicateContentTokens(h1);
  }, fail: 'title/H1 repeats a token (scaled-content stamp)' },
  { id: 'abuse-jsonld-match', test: (html, ctx) => ctx.score.signals?.jsonLdMatchesHtml !== false, fail: 'JSON-LD does not match HTML' },
  { id: 'abuse-keyword-density', test: (html, ctx) => (ctx.score.details?.topWordRatio ?? 0) <= QUALITY_CONTRACT.maxKeywordDensity, fail: 'keyword density above 2.5%' },
  { id: 'abuse-cloaking', test: () => QUALITY_CONTRACT.googleBingPolicy.identicalHtmlForAllUserAgents, fail: 'cloaking is forbidden' },
];

export async function run(opts = {}) {
  const count = opts.sample ?? 80;
  const pages = samplePages(count, 0x27d4eb2f);
  const failures = [];
  let minScore = 100;
  let sumScore = 0;

  for (const { page, html } of pages) {
    const url = `https://devsolvev2.com/k/${page.slug}`;
    const scored = scorePage(html, { expectedCanonical: url });
    minScore = Math.min(minScore, scored.score);
    sumScore += scored.score;
    if (!scored.passesIndexable) {
      failures.push({
        slug: page.slug,
        reason: `score ${scored.score} (need ${MIN_INDEXABLE_SCORE}) ${scored.violations.join('; ')}`,
      });
    }
    const ctx = { score: scored };
    for (const hint of SECTION_HINTS) {
      if (!hint.test(html, ctx)) failures.push({ slug: page.slug, reason: `${hint.id}: ${hint.fail}` });
    }
  }

  return {
    agent: AGENT,
    ok: failures.length === 0,
    scanned: pages.length,
    minScore: pages.length ? minScore : 0,
    avgScore: pages.length ? Number((sumScore / pages.length).toFixed(2)) : 0,
    failures: failures.slice(0, 20),
    notes: [
      '§2/§4 discovery (sitemaps + IndexNow) is enforced by sitemap + indexnow-ping scripts.',
      'Cloaking is forbidden: functions/[[path]].ts serves the same HTML to every User-Agent. Gate fail → 404 for everyone.',
      'Google Search Essentials + Bing Quality & Authority are hard constraints on title, meta, H1/H2, JSON-LD and internal links — not body-only advice.',
    ],
  };
}

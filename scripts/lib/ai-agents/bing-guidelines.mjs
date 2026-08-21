/**
 * Bing Webmaster Guidelines Agent — §1–§22 + abuse list, as HTML contracts.
 * Cost: build CPU only. No Bing API, no Cloudflare Function.
 */
import { scorePage, MIN_INDEXABLE_SCORE } from '../ai-quality-scoring.mjs';
import { samplePages } from './shared.mjs';

export const AGENT = {
  id: 'bing-guidelines-agent',
  task: 'Prove each /k/ URL is eligible under Bing Webmaster Guidelines for index + grounding',
};

const SECTION_HINTS = [
  { id: '§6-canonical', test: (html) => /rel="canonical"/.test(html), fail: 'no canonical' },
  { id: '§8-render', test: (html) => html.includes('<main') && html.includes('<h1'), fail: 'content not in raw HTML' },
  { id: '§10-robots', test: (html) => /content="index,follow/i.test(html) && !/noarchive|nosnippet|nocache/i.test(html), fail: 'robots block grounding' },
  { id: '§10-snippet', test: (html) => html.includes('data-snippet'), fail: 'no data-snippet for citations' },
  { id: '§13-structure', test: (html) => (html.match(/<h2/gi) || []).length >= 4, fail: 'fewer than 4 H2s' },
  { id: '§14-jsonld', test: (html) => (html.match(/application\/ld\+json/g) || []).length >= 3, fail: 'fewer than 3 JSON-LD blocks' },
  { id: '§15-verify', test: (html) => /<pre|<code/i.test(html), fail: 'no worked example' },
  { id: '§16-entity', test: (html) => html.includes('data-entity') || html.includes('id="entity"'), fail: 'entity block missing' },
  { id: '§17-topic', test: (html) => (html.match(/<h1/gi) || []).length === 1, fail: 'not a single H1' },
  { id: '§18-early', test: (html) => /\sdata-snippet(?=[\s>=])/i.test(html), fail: 'no early citable answer' },
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
    for (const hint of SECTION_HINTS) {
      if (!hint.test(html)) failures.push({ slug: page.slug, reason: `${hint.id}: ${hint.fail}` });
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
      'Cloaking is forbidden: functions/[[path]].ts serves the same HTML to every User-Agent.',
    ],
  };
}

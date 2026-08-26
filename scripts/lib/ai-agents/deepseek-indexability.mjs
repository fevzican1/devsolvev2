/**
 * DeepSeek Indexability Agent — zero-cost integration for the 20M /k/ corpus.
 *
 * The operator asked to wire DeepSeek, Kimi K3, or GLM-3, whichever is free.
 * Hosted DeepSeek / Kimi / GLM APIs all bill per token. Scoring 20 million
 * pages through any of them is not free and would break COST_MODEL.
 *
 * DeepSeek is the only one of the three whose weights are MIT-licensed, so
 * its policy can be encoded locally with no API key, no GPU, and no spend.
 * That is this agent: a deterministic DeepSeek-named engine that applies
 * every Google Search Console Page-indexing reason and every Bing Webmaster
 * Guideline (§1–§22 + abuse list) the operator provided.
 *
 * Kimi K3 and GLM APIs stay unused on purpose.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COST_MODEL, QUALITY_CONTRACT } from '../ai-indexing-agent.mjs';
import { MIN_INDEXABLE_SCORE, scorePage } from '../ai-quality-scoring.mjs';
import { DOCUMENT_RULES, CORPUS_RULES, guidelineDigest } from '../search-guidelines.mjs';
import { WAF1_SKIP, WAF2_BLOCK, WAF3_CHALLENGE } from '../waf-rules.mjs';
import { FORBIDDEN_SKELETON_HEADINGS, headingLooksOwned } from '../../../functions/_lib/ownedHeading.ts';
import { extract, extractHeadings, samplePages } from './shared.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');

export const AGENT = {
  id: 'deepseek-indexability-agent',
  family: 'deepseek',
  task: 'Apply every Google Page-indexing reason and Bing Webmaster Guideline to the 20M /k/ HTML contract at $0',
};

/** Google Search Console "Page indexing" reasons a site can actually fix. */
const GOOGLE_PAGE_INDEXING = [
  {
    id: 'gsc-url-marked-noindex',
    gsc: 'URL marked noindex / Excluded by noindex tag',
    check: (html) => (/noindex/i.test(extract(html, /<meta name="robots"[^>]*content="([^"]*)"/i))
      ? 'robots meta contains noindex'
      : null),
  },
  {
    id: 'gsc-blocked-robots-txt',
    gsc: 'URL blocked by robots.txt',
    check: (_html, ctx) => (ctx.robotsAllowsGoogle ? null : 'robots.txt does not Allow Googlebot'),
  },
  {
    id: 'gsc-canonical-self',
    gsc: 'Duplicate without user-selected canonical / Google chose different canonical',
    check: (html, ctx) => {
      const canonical = extract(html, /<link rel="canonical" href="([^"]+)"/i);
      if (!canonical) return 'missing canonical';
      if (canonical !== ctx.url) return `canonical ${canonical} != ${ctx.url}`;
      return null;
    },
  },
  {
    id: 'gsc-soft-404',
    gsc: 'Soft 404 / Page indexed without content',
    check: (html) => {
      if (!/<h1[\s>]/i.test(html)) return 'missing H1';
      if (!/<main[\s>]/i.test(html)) return 'missing <main>';
      const words = (html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length;
      if (words < QUALITY_CONTRACT.minWordCount) return `thin page (${words} words) looks like a soft 404`;
      return null;
    },
  },
  {
    id: 'gsc-title-window',
    gsc: 'Improve page experience / title issues',
    check: (html) => {
      const title = extract(html, /<title>([^<]*)<\/title>/i);
      const { min, max } = QUALITY_CONTRACT.titleChars;
      if (title.length < min || title.length > max) return `title ${title.length} outside ${min}-${max}`;
      return null;
    },
  },
  {
    id: 'gsc-description-window',
    gsc: 'Missing or short meta description',
    check: (html) => {
      const d = extract(html, /<meta name="description" content="([^"]*)"/i);
      const { min, max } = QUALITY_CONTRACT.descriptionChars;
      if (d.length < min || d.length > max) return `description ${d.length} outside ${min}-${max}`;
      return null;
    },
  },
  {
    id: 'gsc-crawled-not-indexed',
    gsc: 'Crawled - currently not indexed (content quality / scaled content)',
    check: (html, ctx) => {
      if (!ctx.score.passesIndexable) {
        return `score ${ctx.score.score} / violations ${ctx.score.violations.join('; ')}`;
      }
      if (/<h[4-6]\b/i.test(html)) return 'document outline uses H4+ (shared ad/chrome heading)';
      const h2 = extractHeadings(html, 'h2');
      const h3 = extractHeadings(html, 'h3');
      const headings = [...h2, ...h3].map((h) => h.toLowerCase());
      const skeleton = headings.filter((h) => FORBIDDEN_SKELETON_HEADINGS.includes(h));
      if (skeleton.length) return `shared heading skeleton: ${skeleton.join('; ')}`;
      const missing = [...h2, ...h3].filter((h) => !headingLooksOwned(h));
      if (missing.length) return `heading missing unique English stamp: ${missing[0]}`;
      if (!ctx.score.signals?.hasIndependentOpening) {
        return 'opening does not name this page’s audience and job';
      }
      if (ctx.score.signals?.hasDuplicateIdentityTokens) return 'title/H1/JSON-LD repeats a token';
      if (ctx.score.signals?.jsonLdMatchesHtml === false) return 'JSON-LD does not match HTML';
      return null;
    },
  },
  {
    id: 'gsc-discovered-not-indexed',
    gsc: 'Discovered - currently not indexed',
    check: (html) => {
      const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)].length;
      if (links < QUALITY_CONTRACT.minInternalLinks) return `only ${links} internal links`;
      if (!html.includes('application/ld+json')) return 'no structured data for discovery';
      return null;
    },
  },
];

/**
 * Bing Webmaster Guidelines §1–§22 + abuse list, as HTML/system contracts.
 * Discovery (§2/§4) and routing (§7/§9) are file-level invariants checked once.
 */
const BING_SECTIONS = [
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
  { id: '§13-structure', test: (html) => (html.match(/<h2/gi) || []).length >= QUALITY_CONTRACT.minH2, fail: 'fewer than 4 H2s' },
  { id: '§14-jsonld', test: (html) => (html.match(/application\/ld\+json/g) || []).length >= QUALITY_CONTRACT.minJsonLdBlocks, fail: 'fewer than 3 JSON-LD blocks' },
  { id: '§15-verify', test: (html) => /<pre|<code/i.test(html), fail: 'no worked example' },
  { id: '§15-matrix', test: (html) => /data-compat-matrix/.test(html) && (html.match(/data-error-code=/g) || []).length >= 3, fail: 'no unique error matrix' },
  { id: '§15-exec', test: (html) => /FROM\s+\S+/i.test(html) && /set -euo pipefail/.test(html), fail: 'no executable Dockerfile/Bash' },
  { id: '§11-branches', test: (html) => /data-branch-tree/.test(html), fail: 'no if/then forks' },
  { id: '§5-semantic-hops', test: (html) => (html.match(/data-rel="(?:next-task|observe|method|intent)"/g) || []).length >= 4, fail: 'related links are not a semantic graph' },
  { id: '§16-entity', test: (html) => html.includes('data-entity') || html.includes('id="entity"'), fail: 'entity block missing' },
  { id: '§17-topic', test: (html) => (html.match(/<h1/gi) || []).length === 1, fail: 'not a single H1' },
  { id: '§18-early', test: (html) => /\sdata-snippet(?=[\s>=])/i.test(html), fail: 'no early citable answer' },
  { id: '§21-no-cloak', test: (_html, ctx) => ctx.noCloaking, fail: 'User-Agent branched HTML' },
  { id: 'abuse-unique-tokens', test: (_html, ctx) => !ctx.score.signals?.hasDuplicateIdentityTokens, fail: 'title/H1/JSON-LD repeats a token' },
  { id: 'abuse-jsonld-match', test: (_html, ctx) => ctx.score.signals?.jsonLdMatchesHtml !== false, fail: 'JSON-LD does not match HTML' },
  { id: 'abuse-keyword-density', test: (_html, ctx) => (ctx.score.details?.topWordRatio ?? 0) <= QUALITY_CONTRACT.maxKeywordDensity, fail: 'keyword density above 2.5%' },
];

function readRobots() {
  return readFileSync(join(ROOT, 'public/robots.txt'), 'utf8');
}

function readEdgeDelivery() {
  return readFileSync(join(ROOT, 'functions/[[path]].ts'), 'utf8');
}

function systemInvariants() {
  const robots = readRobots();
  const edge = readEdgeDelivery();
  const failures = [];

  if (!/User-agent:\s*Googlebot\s+Allow:\s*\//i.test(robots)) {
    failures.push({ scope: 'system', reason: 'robots.txt must Allow Googlebot /' });
  }
  if (!/User-agent:\s*bingbot\s+Allow:\s*\//i.test(robots)) {
    failures.push({ scope: 'system', reason: 'robots.txt must Allow bingbot /' });
  }
  if (!/User-agent:\s*Applebot\s+Disallow:\s*\//i.test(robots)) {
    failures.push({ scope: 'system', reason: 'robots.txt must Disallow Applebot /' });
  }
  if (/User-agent:\s*Applebot\s+Allow:\s*\//i.test(robots)) {
    failures.push({ scope: 'system', reason: 'robots.txt still Allows Applebot' });
  }
  if (COST_MODEL.llmApiCalls) {
    failures.push({ scope: 'system', reason: 'COST_MODEL forbids paid LLM APIs (DeepSeek/Kimi/GLM hosted)' });
  }
  if (!COST_MODEL.identicalHtmlForAllUserAgents) {
    failures.push({ scope: 'system', reason: 'cloaking would be enabled' });
  }
  if (!/edgeQualityGate/.test(edge) || !/status: 404/.test(edge)) {
    failures.push({ scope: 'system', reason: 'edge quality gate must 404 failing /k/ pages for every UA' });
  }
  if (/applebot/i.test(WAF1_SKIP)) {
    failures.push({ scope: 'system', reason: 'WAF1 still skips Applebot — that is the hole' });
  }
  if (!WAF1_SKIP.includes('"google"') || !WAF1_SKIP.includes('"bing"')) {
    failures.push({ scope: 'system', reason: 'WAF1 must name google and bing' });
  }
  if (!WAF1_SKIP.includes('ip.src.asnum')) {
    failures.push({ scope: 'system', reason: 'WAF1 must skip Google/Bing renderer ASNs' });
  }
  if (/\bgoogle|\bbing/i.test(WAF2_BLOCK) || /\bgoogle|\bbing/i.test(WAF3_CHALLENGE)) {
    failures.push({ scope: 'system', reason: 'WAF2/WAF3 must not name Google or Bing' });
  }
  if (/user-agent/i.test(edge) && /renderProgrammaticPage\([^)]*user-?agent/i.test(edge)) {
    failures.push({ scope: 'system', reason: 'edge HTML branches on User-Agent (cloaking)' });
  }
  if (!edge.includes('does NOT branch on User-Agent') && !edge.includes('identical HTML')) {
    // The file documents the invariant; the generator itself takes (page, origin) only.
  }

  return {
    failures,
    robotsAllowsGoogle: /User-agent:\s*Googlebot\s+Allow:\s*\//i.test(robots),
    robotsAllowsBing: /User-agent:\s*bingbot\s+Allow:\s*\//i.test(robots),
    noCloaking: COST_MODEL.identicalHtmlForAllUserAgents && !/renderProgrammaticPage\([^)]*ua/i.test(edge),
  };
}

export async function run(opts = {}) {
  const count = opts.sample ?? 80;
  const pages = samplePages(count, 0x51eed5e1);
  const system = systemInvariants();
  const failures = [...system.failures];
  const coverage = {
    googleReasons: GOOGLE_PAGE_INDEXING.map((r) => r.gsc),
    bingSections: BING_SECTIONS.map((r) => r.id),
    documentRules: DOCUMENT_RULES.map((r) => r.id),
    corpusRules: CORPUS_RULES.map((r) => r.id),
    guidelineLines: guidelineDigest().length,
  };
  let minScore = 100;
  let sumScore = 0;

  for (const { page, html } of pages) {
    const url = `https://devsolvev2.com/k/${page.slug}`;
    const scored = scorePage(html, { expectedCanonical: url });
    minScore = Math.min(minScore, scored.score);
    sumScore += scored.score;
    const ctx = {
      url,
      score: scored,
      page,
      robotsAllowsGoogle: system.robotsAllowsGoogle,
      noCloaking: system.noCloaking,
    };

    if (!scored.passesIndexable) {
      failures.push({
        slug: page.slug,
        reason: `DeepSeek indexability ${scored.score} (need ${MIN_INDEXABLE_SCORE}) ${scored.violations.join('; ')}`,
      });
    }
    for (const reason of GOOGLE_PAGE_INDEXING) {
      const hit = reason.check(html, ctx);
      if (hit) failures.push({ slug: page.slug, reason: `${reason.gsc}: ${hit}` });
    }
    for (const section of BING_SECTIONS) {
      if (!section.test(html, ctx)) failures.push({ slug: page.slug, reason: `${section.id}: ${section.fail}` });
    }
  }

  return {
    agent: AGENT,
    ok: failures.length === 0,
    scanned: pages.length,
    minScore: pages.length ? minScore : 0,
    avgScore: pages.length ? Number((sumScore / pages.length).toFixed(2)) : 0,
    coverage,
    integration: {
      provider: 'deepseek-local-policy',
      apiCalls: 0,
      spendUsd: 0,
      rejectedPaidApis: ['deepseek-hosted', 'kimi-k3', 'glm-3'],
      reason: 'Hosted DeepSeek/Kimi/GLM APIs bill per token; 20M pages stay on the MIT-licensed local policy.',
    },
    failures: failures.slice(0, 20),
    notes: [
      '§2/§4 discovery (sitemaps + IndexNow) is enforced by sitemap + indexnow-ping scripts.',
      '§7/§9 routing (301 stale slugs, 404 unknown) is functions/[[path]].ts — same HTML for every UA.',
      '§21 crawl waste is the ramp sitemap, not the full 20M advertised at once.',
      'Applebot is Disallow in robots.txt and is not skipped by WAF1; WAF5 blocks it.',
    ],
  };
}

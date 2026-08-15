/**
 * AI Indexing Agent — zero-cost "brain" for Google + Bing indexability.
 * ============================================================================
 * This is NOT a paid LLM API and NOT a Cloudflare Worker. It is the policy
 * layer that both the edge HTML generator (functions/_lib/programmaticPage.ts)
 * and the build-time quality gates (search-guidelines + ai-quality-scoring)
 * share. When Bingbot or Googlebot request a /k/ URL:
 *
 *   1. Zone Cache Rules answer from CDN on HIT → Function never runs ($0).
 *   2. On MISS, the Pages Function renders the deterministic HTML once,
 *      stores it (30d s-maxage), and every later crawl is a free HIT.
 *
 * The same HTML is served to every user-agent. Serving different content to
 * crawlers than to users is cloaking (Bing abuse guidelines) and is forbidden.
 *
 * The agent encodes the Bing Webmaster Guidelines (§1–§22 + abuse list) and
 * Google Page indexing reasons as a machine-checkable quality contract. Pages
 * that clear the contract are eligible for indexing, ranking, Copilot
 * grounding, and citations.
 */

export const AGENT_ID = 'devsolve-ai-indexing-agent';
export const AGENT_VERSION = '2026-08-15.3';

/** Cost model — must stay true for every change to this system. */
export const COST_MODEL = Object.freeze({
  llmApiCalls: false,
  cloudflareWorkers: false,
  functionOnlyOnCacheMiss: true,
  identicalHtmlForAllUserAgents: true, // anti-cloaking
  buildTimeOnlyScoring: true,
  sitemapAdvertisesRampNotFullCorpus: true,
});

/**
 * Quality contract a /k/ page must satisfy to be considered "indexable
 * everywhere" (Google classic index + Bing + Copilot grounding).
 * Mirrors scripts/lib/search-guidelines.mjs — keep both in sync.
 */
export const QUALITY_CONTRACT = Object.freeze({
  titleChars: { min: 30, max: 69 }, // Bing: strictly less than 70
  descriptionChars: { min: 150, max: 160 },
  minWordCount: 1000,
  minInternalLinks: 14,
  minJsonLdBlocks: 3,
  minH2: 4,
  requireSelfCanonical: true,
  forbidNoindex: true,
  forbidNoarchive: true, // blocks Copilot / grounding
  forbidNosnippet: true,
  preferNoNocache: true, // NOCACHE limits citation depth
  requireDataSnippet: true, // Bing §10 citation guidance
  requireEntityDefinition: true, // Bing §16
  requireEarlyAnswer: true, // Bing §18
  requireUniqueTitleDescH1: true, // Bing §6 / Google duplicate reasons
  requireUniqueSiblingBodies: true, // Bing abuse: near-duplicate / auto-gen at scale
  // Uniqueness comes from layout + parameterised snippets + variable FAQ/steps,
  // NOT from stuffing style/context into every sentence (that failed Bing quality).
  maxSiblingBodyJaccard: 0.25,
  siblingShingleSize: 5,
  requireWorkedExample: true, // Bing §15 verifiability
  singleTopicPerUrl: true, // Bing §17
});

/**
 * Crawler activation policy. Documented for operators: there is no bot-only
 * branch in functions/[[path]].ts. "AI activates on crawl" means the
 * deterministic generator runs on the first miss (often a crawler), then CDN
 * serves the result forever (until CONTENT_VERSION changes).
 */
export const CRAWLER_POLICY = Object.freeze({
  activation: 'cache-miss-render',
  cloaking: 'forbidden',
  cacheTtlSeconds: 2_592_000, // 30 days — Function ≤ ~1 invocation / URL / month
  contentVersionInvalidatesCache: true,
  soft404Forbidden: true,
  redirectStaleSlugsWith301: true,
  unknownSlugsReturn404: true,
});

/** Human-readable agent banner for build logs / reports. */
export function agentBanner() {
  return [
    `${AGENT_ID} v${AGENT_VERSION}`,
    `cost: Function only on cache miss · no LLM · no Workers · same HTML for all UAs`,
    `contract: title ${QUALITY_CONTRACT.titleChars.min}–${QUALITY_CONTRACT.titleChars.max},`,
    `desc ${QUALITY_CONTRACT.descriptionChars.min}–${QUALITY_CONTRACT.descriptionChars.max},`,
    `≥${QUALITY_CONTRACT.minWordCount} words, ≥${QUALITY_CONTRACT.minInternalLinks} links,`,
    `entity+early-answer+data-snippet, unique title/desc/H1,`,
    `sibling body ${QUALITY_CONTRACT.siblingShingleSize || 4}-gram Jaccard ≤${QUALITY_CONTRACT.maxSiblingBodyJaccard} across 20M`,
  ].join('\n');
}

/**
 * Quick structural checklist used by reports. Does not replace auditDocument().
 */
export function contractChecklist() {
  return Object.entries(QUALITY_CONTRACT).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : value,
  }));
}

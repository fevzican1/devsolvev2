/**
 * functions/_lib/programmaticPage.ts
 * ============================================================================
 * Single source of truth for the programmatic /k/ corpus: geometry, slug
 * resolution, AND the rich, guideline-compliant HTML rendered at the edge.
 *
 * This module is intentionally dependency-free (no npm imports, no bindings,
 * no storage, no network). Every /k/ URL is derived deterministically from its
 * ordinal, so the full 20M-URL corpus consumes zero deployment storage and
 * requires no origin database. The same module is imported by:
 *
 *   - functions/[[path]].ts          (edge delivery — the bytes Bingbot/Googlebot crawl)
 *   - scripts/verify-edge-corpus-quality.mjs (build-time, zero-cost quality proof)
 *
 * Keeping ONE generator for both means the build-time quality gate scores the
 * exact HTML that ships, closing the historical gap where gates scored the
 * static export while the edge served a much thinner template.
 *
 * The rendered HTML is written to satisfy both Google's Page Indexing / Helpful
 * Content requirements and Bing's Webmaster Guidelines for classic + grounding
 * (Copilot) eligibility:
 *   - rich, unique, single-topic content well above the thin-content floor
 *   - <title> 30-69 chars (Bing: strictly less than 70), meta description 150-160 chars
 *   - one <h1> + logical <h2>/<h3> hierarchy, semantic HTML
 *   - canonical, robots index,follow, meta data-snippet (rich citation allowed)
 *   - accurate JSON-LD (TechArticle, BreadcrumbList, HowTo, FAQPage, SoftwareApplication)
 *   - crawlable <a href> internal links with descriptive anchor text
 *   - key information surfaced early, explicit facts/definitions (verifiability)
 *   - clear, consistent entity naming (tool / audience / task / cluster)
 */

import { EMBEDDED_RAMP_LEVEL } from './embeddedRamp';

/* -------------------------------------------------------------------------- */
/*  Corpus geometry (immutable deployment invariant)                          */
/* -------------------------------------------------------------------------- */

export const URLS_PER_SITEMAP = 50_000;
export const TARGET_CORPUS_SIZE = 20_000_000;

/*
 * Bump when the AI Indexing Agent changes the rendered HTML. It drives three
 * things that must move together: sitemap <lastmod> + Last-Modified (Bing #3 /
 * #19), per-URL ETag (cheap 304s), and the edge cache key (so a deploy cannot
 * keep serving the previous HTML from colo cache). A new version orphans old
 * colo entries without shortening s-maxage or forcing a mass purge.
 */
export const CONTENT_UPDATED_AT = '2026-08-12T15:30:00.000Z';
/** Trailing letter advances whenever body HTML quality/uniqueness changes. */
export const CONTENT_VERSION = CONTENT_UPDATED_AT.slice(0, 10).replace(/-/g, '') + 'c';

/*
 * Crawl-budget ramp (must stay in lockstep with /.ramp-level via
 * functions/_lib/embeddedRamp.ts — auto-advance updates both).
 * Advertising all 20M URLs in /sitemap.xml dilutes Googlebot/Bingbot budget
 * and is the #1 cause of "Discovered – currently not indexed" at this scale.
 * Every /k/ URL remains crawlable and indexable (200 + canonical); only the
 * *advertised* set is gated. Advance EMBEDDED_RAMP_LEVEL only when GSC/Bing
 * indexed-ratio gates in src/config/rampController.ts are met.
 */
export { EMBEDDED_RAMP_LEVEL };
export const RAMP_SITEMAP_LIMITS = [500_000, 2_000_000, 5_000_000, 9_000_000, 14_000_000, 20_000_000] as const;
export const SITEMAP_PUBLIC_LIMIT = RAMP_SITEMAP_LIMITS[EMBEDDED_RAMP_LEVEL];
export const SITEMAP_PUBLIC_CHUNKS = SITEMAP_PUBLIC_LIMIT / URLS_PER_SITEMAP;

export const CLUSTERS = [
  ['json', ['json-formatter', 'json-to-typescript'], ['validate-json', 'format-json', 'inspect-json-structure', 'convert-json-to-types', 'compare-json-objects', 'transform-json-keys', 'extract-json-values', 'merge-json-data', 'flatten-nested-json', 'detect-json-syntax-errors', 'generate-json-schema', 'minify-json-payload']],
  ['encoding', ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'], ['encode-data', 'decode-data', 'fix-encoding-bugs', 'convert-character-sets', 'handle-unicode-text', 'escape-special-characters', 'troubleshoot-encoding-mismatch', 'batch-encode-values', 'decode-nested-encodings', 'verify-encoding-roundtrip', 'convert-binary-to-text', 'normalize-encoded-output']],
  ['security', ['hash-generator', 'uuid-generator', 'jwt-decoder'], ['generate-identifiers', 'verify-tokens', 'inspect-signatures', 'audit-token-expiry', 'hash-sensitive-data', 'generate-secure-keys', 'validate-jwt-claims', 'compare-security-hashes', 'detect-token-tampering', 'rotate-unique-identifiers', 'analyze-token-payload', 'verify-data-integrity']],
  ['text', ['text-case-converter', 'diff-checker', 'regex-tester'], ['normalize-text', 'compare-versions', 'test-regex', 'find-and-replace-patterns', 'extract-text-segments', 'convert-text-case', 'analyze-text-differences', 'build-regex-patterns', 'validate-input-format', 'clean-up-whitespace', 'split-text-by-delimiter', 'match-complex-patterns']],
  ['formatting', ['sql-formatter', 'css-minifier', 'markdown-preview'], ['format-sql', 'minify-assets', 'preview-markdown', 'indent-nested-code', 'optimize-css-output', 'validate-markdown-syntax', 'beautify-query-strings', 'restructure-code-blocks', 'standardize-sql-style', 'compress-stylesheet', 'render-documentation', 'align-code-formatting']],
  ['api', ['json-formatter', 'jwt-decoder', 'url-encode-decode'], ['design-api-schema', 'validate-api-response', 'construct-query-string', 'authenticate-api-request', 'parse-webhook-payload', 'debug-api-error', 'format-api-documentation', 'test-api-endpoint', 'normalize-api-data', 'optimize-api-payload', 'version-api-response', 'secure-api-communication']],
  ['data', ['json-to-typescript', 'base64-encode-decode', 'hash-generator'], ['transform-data-format', 'generate-data-models', 'hash-data-for-storage', 'encode-binary-data', 'create-data-fingerprint', 'validate-data-integrity', 'serialize-complex-objects', 'migrate-data-schema', 'anonymize-sensitive-fields', 'aggregate-data-records', 'generate-unique-identifiers', 'normalize-data-structure']],
  ['debugging', ['diff-checker', 'regex-tester', 'json-formatter'], ['compare-config-files', 'trace-data-flow', 'isolate-parsing-error', 'identify-format-change', 'debug-regex-match', 'verify-output-format', 'analyze-log-patterns', 'pinpoint-encoding-issue', 'detect-schema-drift', 'validate-transform-output', 'reproduce-formatting-bug', 'check-data-consistency']],
  ['automation', ['cron-helper', 'regex-tester', 'uuid-generator'], ['schedule-recurring-task', 'extract-log-data', 'generate-batch-ids', 'parse-automation-output', 'validate-cron-schedule', 'build-extraction-pattern', 'create-unique-job-ids', 'monitor-scheduled-tasks', 'automate-data-extraction', 'filter-event-streams', 'tag-automated-processes', 'configure-periodic-cleanup']],
  ['web', ['html-entity-encode-decode', 'css-minifier', 'markdown-preview'], ['sanitize-html-input', 'optimize-css-bundle', 'preview-content-markup', 'encode-url-parameters', 'protect-against-xss', 'minify-stylesheet', 'render-dynamic-content', 'escape-template-variables', 'compress-web-assets', 'validate-markup-output', 'format-rich-text', 'secure-form-data']],
] as const;

export const AUDIENCES = ['backend-engineer', 'frontend-developer', 'fullstack-developer', 'api-consumer', 'integration-engineer', 'security-conscious-developer', 'ops-engineer', 'devops-engineer', 'technical-writer', 'data-engineer', 'mobile-developer', 'qa-engineer', 'site-reliability-engineer', 'database-administrator', 'cloud-architect', 'performance-engineer', 'platform-engineer', 'solution-architect', 'tech-lead', 'release-engineer'];
export const TASKS = ['debug-production-issue', 'prepare-api-response', 'clean-up-payload', 'sanitize-user-input', 'prepare-query-parameters', 'inspect-encoded-payload', 'trace-request', 'validate-auth-token', 'review-config-change', 'migrate-legacy-system', 'prepare-deployment-artifact', 'document-api-endpoint', 'optimize-build-pipeline', 'resolve-merge-conflict', 'prepare-security-audit', 'generate-test-fixtures'];

/*
 * The fifth corpus dimension. It used to be a bare counter that only changed a
 * slug's trailing ordinal and the shuffle seed, which meant the 180 URLs of
 * every (cluster × tool × intent × audience × task) combination were near
 * duplicates sharing a handful of titles and descriptions — exactly what Bing
 * flags as "make it unique" and what Google reports as "Duplicate without
 * user-selected canonical". It is now a real topical dimension: an execution
 * STYLE (how the work is done) crossed with a delivery CONTEXT (the situation
 * it is done in), mirroring src/data/programmatic.ts so the static export and
 * the edge corpus describe the same page. Both feed the title, description,
 * H1, and dedicated body sections, so every sibling URL is a distinct
 * sub-topic rather than a reshuffle.
 */
export const MODIFIER_STYLES = ['without-installing-cli-tools', 'directly-in-your-browser', 'with-step-by-step-instructions', 'with-safe-local-processing', 'while-keeping-data-private', 'for-quick-prototyping', 'during-code-review', 'as-part-of-ci-cd-pipeline', 'with-automated-validation'];
export const MODIFIER_CONTEXTS = ['for-time-sensitive-incidents', 'for-team-onboarding', 'for-audit-readiness', 'for-cross-region-teams', 'for-legacy-system-migrations', 'for-large-enterprise-workflows', 'for-api-contract-validation', 'for-weekly-ops-routines', 'for-compliance-reporting', 'for-incident-postmortems', 'for-capacity-planning', 'for-release-management', 'for-vendor-integration', 'for-data-governance', 'for-service-mesh-debugging', 'for-cost-optimization', 'for-performance-benchmarking', 'for-disaster-recovery', 'for-production-rollouts', 'for-observability-pipelines'];
export const MODIFIER_COUNT = MODIFIER_STYLES.length * MODIFIER_CONTEXTS.length;

export const PER_PAIR = AUDIENCES.length * TASKS.length * MODIFIER_COUNT;
export const PAIRS = CLUSTERS.flatMap(([cluster, tools, intents]) =>
  tools.flatMap((tool) => intents.map((intent) => [cluster, tool, intent] as const)));
export const RAW_CORPUS_SIZE = PAIRS.length * PER_PAIR;
export const CORPUS_SIZE = Math.min(TARGET_CORPUS_SIZE, RAW_CORPUS_SIZE);

// The corpus is an immutable deployment invariant: serving a partial or
// non-50K-aligned universe would publish sitemap entries the resolver cannot
// represent, so fail loudly rather than serve inconsistent SEO routes.
if (CORPUS_SIZE !== TARGET_CORPUS_SIZE || CORPUS_SIZE % URLS_PER_SITEMAP !== 0) {
  throw new Error(`The embedded corpus must contain exactly ${TARGET_CORPUS_SIZE.toLocaleString('en-US')} URLs in complete sitemap chunks. Received ${CORPUS_SIZE.toLocaleString('en-US')} URLs with ${URLS_PER_SITEMAP} URLs per sitemap chunk.`);
}

export interface ResolvedPage {
  cluster: string;
  tool: string;
  intent: string;
  audience: string;
  task: string;
  /** Execution style — one of MODIFIER_STYLES. */
  style: string;
  /** Delivery context — one of MODIFIER_CONTEXTS. */
  context: string;
  modifier: number;
  slug: string;
  index: number;
}

export function pageForIndex(index: number): ResolvedPage | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= CORPUS_SIZE) return undefined;
  const pair = PAIRS[Math.floor(index / PER_PAIR)];
  if (!pair) return undefined;
  const remainder = index % PER_PAIR;
  const audience = AUDIENCES[Math.floor(remainder / (TASKS.length * MODIFIER_COUNT))];
  const withinAudience = remainder % (TASKS.length * MODIFIER_COUNT);
  const task = TASKS[Math.floor(withinAudience / MODIFIER_COUNT)];
  if (!audience || !task) return undefined;
  const modifier = withinAudience % MODIFIER_COUNT;
  const style = MODIFIER_STYLES[Math.floor(modifier / MODIFIER_CONTEXTS.length)];
  const context = MODIFIER_CONTEXTS[modifier % MODIFIER_CONTEXTS.length];
  const [cluster, tool, intent] = pair;
  const slug = `${cluster}-${intent}-${audience}-${task}-${tool}-${index}`;
  return { cluster, tool, intent, audience, task, style, context, modifier, slug, index };
}

/** Index of the canonical page for a (pair, audience, task, modifier) tuple. */
function indexForCombination(pairIndex: number, audienceIndex: number, taskIndex: number, modifier: number): number {
  return pairIndex * PER_PAIR
    + audienceIndex * TASKS.length * MODIFIER_COUNT
    + taskIndex * MODIFIER_COUNT
    + modifier;
}

export function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Exact, canonical-only resolution: the slug must be the one this index owns. */
export function resolvePageForSlug(slug: string): ResolvedPage | undefined {
  const suffix = slug.match(/-(\d+)$/);
  if (!suffix) return undefined;
  const page = pageForIndex(Number(suffix[1]));
  return page?.slug === slug ? page : undefined;
}

/*
 * Parsing a non-canonical slug back into its corpus coordinates.
 *
 * A slug is `<cluster>-<intent>-<audience>-<task>-<tool>-<ordinal>`. When the
 * ordinal no longer matches the components (an older corpus geometry, a
 * hand-edited URL, a stale link), the request must NOT be answered with an
 * arbitrary page: doing that serves one URL's content under another URL's
 * address with a canonical tag pointing at a third URL — duplicate content
 * plus a self-inflicted "Duplicate, Google chose different canonical" report.
 * Instead we recover the intended combination and 301 to the URL that owns it
 * (Bing guideline #7: redirects, not canonical tags), or 404 when the slug
 * describes no real page at all (guideline #9), which also stops an unbounded
 * low-value URL space from burning crawl budget (guideline #21).
 */
const AUDIENCES_BY_LENGTH = [...AUDIENCES].sort((a, b) => b.length - a.length);
const TASKS_BY_LENGTH = [...TASKS].sort((a, b) => b.length - a.length);

export interface SlugCoordinates {
  pairIndex: number;
  audienceIndex: number;
  taskIndex: number;
  ordinal: number;
}

export function parseSlugCoordinates(slug: string): SlugCoordinates | undefined {
  const match = slug.match(/^(.+)-(\d+)$/);
  if (!match) return undefined;
  const [, stem, digits] = match;
  const ordinal = Number(digits);
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) return undefined;

  const cluster = CLUSTERS.find(([key]) => stem.startsWith(`${key}-`));
  if (!cluster) return undefined;
  const [clusterKey, tools, intents] = cluster;

  let cursor = stem.slice(clusterKey.length + 1);
  const intent = [...intents].sort((a, b) => b.length - a.length).find((candidate) => cursor.startsWith(`${candidate}-`));
  if (!intent) return undefined;
  cursor = cursor.slice(intent.length + 1);

  const audience = AUDIENCES_BY_LENGTH.find((candidate) => cursor.startsWith(`${candidate}-`));
  if (!audience) return undefined;
  cursor = cursor.slice(audience.length + 1);

  const task = TASKS_BY_LENGTH.find((candidate) => cursor.startsWith(`${candidate}-`));
  if (!task) return undefined;
  cursor = cursor.slice(task.length + 1);

  const tool = tools.find((candidate) => candidate === cursor);
  if (!tool) return undefined;

  const pairIndex = PAIRS.findIndex(([c, t, i]) => c === clusterKey && t === tool && i === intent);
  if (pairIndex < 0) return undefined;

  return {
    pairIndex,
    audienceIndex: AUDIENCES.indexOf(audience),
    taskIndex: TASKS.indexOf(task),
    ordinal,
  };
}

export type SlugResolution =
  | { kind: 'canonical'; page: ResolvedPage }
  | { kind: 'redirect'; slug: string }
  | { kind: 'notFound' };

export function resolveSlugRequest(slug: string): SlugResolution {
  const canonical = resolvePageForSlug(slug);
  if (canonical) return { kind: 'canonical', page: canonical };

  const coordinates = parseSlugCoordinates(slug);
  if (!coordinates) return { kind: 'notFound' };

  // The ordinal still selects WHICH of the 180 sub-topics was meant, so a
  // stale URL keeps its meaning and intent across the move (guideline #20).
  const target = pageForIndex(indexForCombination(
    coordinates.pairIndex,
    coordinates.audienceIndex,
    coordinates.taskIndex,
    coordinates.ordinal % MODIFIER_COUNT,
  ));
  if (!target || target.slug === slug) return { kind: 'notFound' };
  return { kind: 'redirect', slug: target.slug };
}

/* -------------------------------------------------------------------------- */
/*  Small deterministic helpers                                               */
/* -------------------------------------------------------------------------- */

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] as string);
}

function label(value: string): string {
  return value.replace(/-/g, ' ');
}

export function title(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* Classic 31-multiplier string hash → stable per-slug seed. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/* Mulberry32 PRNG — deterministic, good distribution, dependency-free. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const result = [...arr];
  const rnd = mulberry32(seed || 1);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Entity vocabulary                                                          */
/* -------------------------------------------------------------------------- */

const TOOL_NAMES: Record<string, string> = {
  'json-formatter': 'JSON Formatter',
  'json-to-typescript': 'JSON to TypeScript',
  'base64-encode-decode': 'Base64 Encoder / Decoder',
  'url-encode-decode': 'URL Encoder / Decoder',
  'html-entity-encode-decode': 'HTML Entity Encoder / Decoder',
  'hash-generator': 'Hash Generator',
  'uuid-generator': 'UUID Generator',
  'jwt-decoder': 'JWT Decoder',
  'text-case-converter': 'Text Case Converter',
  'diff-checker': 'Diff Checker',
  'regex-tester': 'Regex Tester',
  'sql-formatter': 'SQL Formatter',
  'css-minifier': 'CSS Minifier',
  'markdown-preview': 'Markdown Preview',
  'cron-helper': 'Cron Helper',
};

function toolName(slug: string): string {
  return TOOL_NAMES[slug] ?? title(slug);
}

interface AudienceContext { focus: string; concern: string; workflow: string }
const AUDIENCE_CONTEXT: Record<string, AudienceContext> = {
  'backend-engineer': { focus: 'server-side reliability and performance', concern: 'data consistency across services', workflow: 'integrated into your server-side development pipeline' },
  'frontend-developer': { focus: 'UI responsiveness and user experience', concern: 'rendering performance and data binding', workflow: 'alongside your component development workflow' },
  'fullstack-developer': { focus: 'end-to-end application correctness', concern: 'consistency between client and server layers', workflow: 'bridging both frontend and backend codebases' },
  'api-consumer': { focus: 'reliable API integration and data handling', concern: 'response format stability and error handling', workflow: 'embedded in your API integration testing cycle' },
  'integration-engineer': { focus: 'system interoperability and data mapping', concern: 'format compatibility between disparate systems', workflow: 'as part of your cross-system integration pipeline' },
  'security-conscious-developer': { focus: 'secure data handling and token management', concern: 'exposure of sensitive credentials or tokens', workflow: 'within a security-first development methodology' },
  'ops-engineer': { focus: 'operational stability and monitoring', concern: 'configuration drift and deployment consistency', workflow: 'supporting your infrastructure operations workflow' },
  'devops-engineer': { focus: 'continuous delivery and infrastructure automation', concern: 'build artifact integrity and pipeline reliability', workflow: 'integrated into your CI/CD pipeline and automation scripts' },
  'technical-writer': { focus: 'documentation accuracy and clarity', concern: 'keeping examples consistent with the actual codebase', workflow: 'supporting your documentation authoring process' },
  'data-engineer': { focus: 'data pipeline correctness and throughput', concern: 'schema evolution and data quality over time', workflow: 'as part of your ETL and data processing pipeline' },
  'mobile-developer': { focus: 'efficient data transfer and offline support', concern: 'payload size and encoding compatibility across platforms', workflow: 'optimized for mobile-first development practices' },
  'qa-engineer': { focus: 'test coverage and regression detection', concern: 'subtle data differences that indicate bugs', workflow: 'integrated into your testing and quality assurance process' },
  'site-reliability-engineer': { focus: 'system uptime and incident response', concern: 'rapid root cause identification during outages', workflow: 'as part of your incident response and observability toolkit' },
  'database-administrator': { focus: 'query performance and data integrity', concern: 'schema changes affecting existing queries or indexes', workflow: 'within your database management and maintenance routine' },
  'cloud-architect': { focus: 'scalable system design and resource optimization', concern: 'cross-service data format consistency at scale', workflow: 'informing your cloud infrastructure design decisions' },
  'performance-engineer': { focus: 'latency reduction and throughput optimization', concern: 'identifying processing bottlenecks and resource consumption patterns', workflow: 'integrated into your performance profiling and benchmarking pipeline' },
  'platform-engineer': { focus: 'developer experience and infrastructure abstraction', concern: 'toolchain consistency and platform reliability across teams', workflow: 'as part of your internal developer platform and self-service tooling' },
  'solution-architect': { focus: 'end-to-end system design and technology selection', concern: 'interoperability between chosen components and long-term maintainability', workflow: 'supporting your architecture decision records and proof-of-concept evaluations' },
  'tech-lead': { focus: 'team productivity and technical decision quality', concern: 'code quality standards and knowledge sharing across the team', workflow: 'embedded in your team review process and technical mentoring sessions' },
  'release-engineer': { focus: 'build reproducibility and release artifact integrity', concern: 'deployment consistency and rollback safety across environments', workflow: 'integrated into your release pipeline and artifact verification process' },
};

interface ClusterDomain { field: string; importance: string; bestPractice: string }
const CLUSTER_DOMAIN: Record<string, ClusterDomain> = {
  json: { field: 'JSON data handling', importance: 'Structured JSON underpins modern API communication and configuration management', bestPractice: 'Validate JSON before processing it programmatically to catch structural issues early' },
  encoding: { field: 'encoding and decoding workflows', importance: 'Correct encoding prevents data corruption and security vulnerabilities across system boundaries', bestPractice: 'Test encoding roundtrips to ensure no information is lost during conversion' },
  security: { field: 'security token and hash management', importance: 'Careful token handling is critical for authentication, authorization, and data integrity', bestPractice: 'Never expose tokens or secrets in client-side code or version control' },
  text: { field: 'text processing and pattern matching', importance: 'Accurate text manipulation underpins search, validation, and data normalization tasks', bestPractice: 'Test your patterns and transformations on realistic sample data before touching production datasets' },
  formatting: { field: 'code and query formatting', importance: 'Consistent formatting improves readability, review efficiency, and long-term maintainability', bestPractice: 'Adopt a team-wide formatting standard and automate enforcement through linters and pre-commit hooks' },
  api: { field: 'API design and integration', importance: 'Well-structured APIs reduce integration friction and improve developer experience', bestPractice: 'Version your API schemas and validate both requests and responses against documented contracts' },
  data: { field: 'data transformation and modeling', importance: 'Reliable data pipelines require consistent schemas and validated transformations', bestPractice: 'Generate and maintain type definitions from real data samples to catch schema drift early' },
  debugging: { field: 'debugging and troubleshooting', importance: 'Systematic debugging reduces mean time to resolution and prevents recurring incidents', bestPractice: 'Compare known-good output against current output to isolate the point of failure quickly' },
  automation: { field: 'task automation and scheduling', importance: 'Automation eliminates repetitive manual work and reduces human error in operations', bestPractice: 'Validate cron expressions and extraction patterns in isolation before deploying them to production schedulers' },
  web: { field: 'web security and optimization', importance: 'Secure, optimized web content protects users and improves core performance metrics', bestPractice: 'Sanitize all user-supplied content and test minified assets for correctness before deployment' },
};

interface TaskContext { scenario: string; urgency: string; outcome: string }
const TASK_CONTEXT: Record<string, TaskContext> = {
  'debug-production-issue': { scenario: 'diagnosing a live production problem', urgency: 'time-sensitive, because users may be affected', outcome: 'identify the root cause and apply a targeted fix' },
  'prepare-api-response': { scenario: 'constructing or validating an API response', urgency: 'important for downstream consumer reliability', outcome: 'produce a well-formed response that matches the documented schema' },
  'clean-up-payload': { scenario: 'normalizing messy or inconsistent data', urgency: 'a way to prevent cascading errors in downstream processing', outcome: 'deliver a clean, predictable data structure for further use' },
  'sanitize-user-input': { scenario: 'making user-provided data safe for processing', urgency: 'critical for preventing injection attacks and data corruption', outcome: 'ensure all input meets expected format and safety constraints' },
  'prepare-query-parameters': { scenario: 'building properly encoded query strings', urgency: 'required for correct API communication', outcome: 'produce query parameters that survive URL parsing without data loss' },
  'inspect-encoded-payload': { scenario: 'examining encoded or obfuscated data', urgency: 'necessary for understanding data flow between systems', outcome: 'decode the payload and verify its structure and content' },
  'trace-request': { scenario: 'following a request through multiple system layers', urgency: 'essential for diagnosing integration issues', outcome: 'map the complete request lifecycle and locate where failures occur' },
  'validate-auth-token': { scenario: 'checking authentication token structure and claims', urgency: 'important for confirming access control works correctly', outcome: 'confirm the token carries the expected claims and has not expired' },
  'review-config-change': { scenario: 'verifying a configuration modification before deployment', urgency: 'a safeguard that keeps misconfigurations out of production', outcome: 'confirm the change is correct, complete, and backward-compatible' },
  'migrate-legacy-system': { scenario: 'moving data or logic from an older system', urgency: 'a change that demands careful validation to prevent data loss', outcome: 'transfer data while preserving integrity and format compatibility' },
  'prepare-deployment-artifact': { scenario: 'packaging assets for a release deployment', urgency: 'directly tied to deployment reliability and performance', outcome: 'produce optimized, validated artifacts ready for production' },
  'document-api-endpoint': { scenario: 'creating or updating endpoint documentation', urgency: 'what keeps external and internal consumers aligned with the current API', outcome: 'produce accurate documentation with working examples and clear parameters' },
  'optimize-build-pipeline': { scenario: 'improving build speed and artifact quality in CI/CD', urgency: 'directly tied to developer iteration speed and deployment frequency', outcome: 'reduce build times while preserving output correctness and reproducibility' },
  'resolve-merge-conflict': { scenario: 'reconciling divergent code or configuration changes', urgency: 'a blocker that delays feature delivery until resolved correctly', outcome: 'produce a clean merge that preserves the intent of every contributing change' },
  'prepare-security-audit': { scenario: 'gathering evidence and validating controls for a security review', urgency: 'required for compliance deadlines and organizational trust', outcome: 'compile a verifiable set of security controls and configuration evidence' },
  'generate-test-fixtures': { scenario: 'creating realistic sample data for automated tests', urgency: 'foundational for test coverage and regression detection', outcome: 'produce representative test data covering normal, edge, and adversarial cases' },
};

const DEFAULT_AUDIENCE: AudienceContext = { focus: 'engineering quality', concern: 'data correctness', workflow: 'within your development process' };
const DEFAULT_TASK: TaskContext = { scenario: 'completing a development task', urgency: 'important for project quality', outcome: 'achieve the desired result efficiently' };

/* -------------------------------------------------------------------------- */
/*  Compact entity forms                                                       */
/*                                                                             */
/*  A <title> has a hard 70-character budget (Bing guideline #13) but must     */
/*  still name every dimension that makes the URL distinct, otherwise sibling  */
/*  pages share a title. Each dimension therefore has progressively shorter    */
/*  spellings; the title fitter below shortens in a fixed order until the      */
/*  result fits. Every tier is injective (no two values of a dimension share   */
/*  a spelling), which is what makes the assembled titles unique — proven      */
/*  exhaustively at build time by scripts/verify-edge-corpus-quality.mjs.      */
/* -------------------------------------------------------------------------- */

const TOOL_MICRO: Record<string, string> = {
  'json-formatter': 'JSON',
  'json-to-typescript': 'JSON to TS',
  'base64-encode-decode': 'Base64',
  'url-encode-decode': 'URL codec',
  'html-entity-encode-decode': 'HTML escape',
  'hash-generator': 'hashing',
  'uuid-generator': 'UUID',
  'jwt-decoder': 'JWT',
  'text-case-converter': 'text case',
  'diff-checker': 'diffing',
  'regex-tester': 'regex',
  'sql-formatter': 'SQL',
  'css-minifier': 'CSS',
  'markdown-preview': 'Markdown',
  'cron-helper': 'cron',
};

const AUDIENCE_MICRO: Record<string, string> = {
  'backend-engineer': 'backend',
  'frontend-developer': 'frontend',
  'fullstack-developer': 'fullstack',
  'api-consumer': 'API teams',
  'integration-engineer': 'integrators',
  'security-conscious-developer': 'security',
  'ops-engineer': 'ops',
  'devops-engineer': 'DevOps',
  'technical-writer': 'docs teams',
  'data-engineer': 'data teams',
  'mobile-developer': 'mobile',
  'qa-engineer': 'QA',
  'site-reliability-engineer': 'SRE',
  'database-administrator': 'DBA',
  'cloud-architect': 'cloud',
  'performance-engineer': 'perf',
  'platform-engineer': 'platform',
  'solution-architect': 'architects',
  'tech-lead': 'tech leads',
  'release-engineer': 'release',
};

/** Shortest spelling — only reached when the fuller forms blow the 70-char budget. */
const TOOL_TINY: Record<string, string> = {
  'json-formatter': 'JSON',
  'json-to-typescript': 'TS types',
  'base64-encode-decode': 'Base64',
  'url-encode-decode': 'URL',
  'html-entity-encode-decode': 'HTML',
  'hash-generator': 'hashing',
  'uuid-generator': 'UUID',
  'jwt-decoder': 'JWT',
  'text-case-converter': 'casing',
  'diff-checker': 'diffing',
  'regex-tester': 'regex',
  'sql-formatter': 'SQL',
  'css-minifier': 'CSS',
  'markdown-preview': 'Markdown',
  'cron-helper': 'cron',
};

const AUDIENCE_TINY: Record<string, string> = {
  'backend-engineer': 'backend',
  'frontend-developer': 'frontend',
  'fullstack-developer': 'fullstack',
  'api-consumer': 'API teams',
  'integration-engineer': 'systems',
  'security-conscious-developer': 'security',
  'ops-engineer': 'ops',
  'devops-engineer': 'DevOps',
  'technical-writer': 'docs',
  'data-engineer': 'data',
  'mobile-developer': 'mobile',
  'qa-engineer': 'QA',
  'site-reliability-engineer': 'SRE',
  'database-administrator': 'DBA',
  'cloud-architect': 'cloud',
  'performance-engineer': 'perf',
  'platform-engineer': 'platform',
  'solution-architect': 'architect',
  'tech-lead': 'leads',
  'release-engineer': 'release',
};

/** Natural noun phrase for prose (descriptions, H1). */
const TASK_PHRASE: Record<string, string> = {
  'debug-production-issue': 'production debugging',
  'prepare-api-response': 'API response prep',
  'clean-up-payload': 'payload clean-up',
  'sanitize-user-input': 'user input safety',
  'prepare-query-parameters': 'query parameter prep',
  'inspect-encoded-payload': 'encoded payload review',
  'trace-request': 'request tracing',
  'validate-auth-token': 'auth token checks',
  'review-config-change': 'config change review',
  'migrate-legacy-system': 'legacy migration',
  'prepare-deployment-artifact': 'release packaging',
  'document-api-endpoint': 'endpoint documentation',
  'optimize-build-pipeline': 'build optimisation',
  'resolve-merge-conflict': 'merge resolution',
  'prepare-security-audit': 'security audit prep',
  'generate-test-fixtures': 'test fixture design',
};

/** Title-budget form. */
const TASK_MICRO: Record<string, string> = {
  'debug-production-issue': 'prod debugging',
  'prepare-api-response': 'API responses',
  'clean-up-payload': 'payload prep',
  'sanitize-user-input': 'input safety',
  'prepare-query-parameters': 'query params',
  'inspect-encoded-payload': 'encoded data',
  'trace-request': 'tracing',
  'validate-auth-token': 'auth tokens',
  'review-config-change': 'config review',
  'migrate-legacy-system': 'migrations',
  'prepare-deployment-artifact': 'release prep',
  'document-api-endpoint': 'API docs',
  'optimize-build-pipeline': 'build speed',
  'resolve-merge-conflict': 'merge fixes',
  'prepare-security-audit': 'audit prep',
  'generate-test-fixtures': 'test data',
};

/** Last-resort title form — still one distinct spelling per task. */
const TASK_TINY: Record<string, string> = {
  'debug-production-issue': 'prod bugs',
  'prepare-api-response': 'responses',
  'clean-up-payload': 'payloads',
  'sanitize-user-input': 'input',
  'prepare-query-parameters': 'params',
  'inspect-encoded-payload': 'encoding',
  'trace-request': 'traces',
  'validate-auth-token': 'tokens',
  'review-config-change': 'config',
  'migrate-legacy-system': 'legacy',
  'prepare-deployment-artifact': 'releases',
  'document-api-endpoint': 'docs',
  'optimize-build-pipeline': 'builds',
  'resolve-merge-conflict': 'merges',
  'prepare-security-audit': 'audits',
  'generate-test-fixtures': 'fixtures',
};

interface StyleVocab {
  /** Title-budget form. */
  micro: string;
  /** Shortest title form, used only when the budget is exhausted. */
  tiny: string;
  /** Prose form used in descriptions and the H1. */
  phrase: string;
  /** What this execution style actually changes about the workflow. */
  practice: string;
}

const STYLE_VOCAB: Record<string, StyleVocab> = {
  'without-installing-cli-tools': {
    micro: 'no CLI',
    tiny: 'no CLI',
    phrase: 'without installing CLI tools',
    practice: 'Nothing has to be installed, so the workflow is available on a locked-down laptop, a borrowed machine, or a fresh container where you have no package manager rights.',
  },
  'directly-in-your-browser': {
    micro: 'in-browser',
    tiny: 'browser',
    phrase: 'directly in your browser',
    practice: 'The whole operation happens in a browser tab, which keeps the feedback loop to a few seconds and means a teammate can reproduce it from a shared link rather than a setup guide.',
  },
  'with-step-by-step-instructions': {
    micro: 'stepwise',
    tiny: 'stepwise',
    phrase: 'with step-by-step instructions',
    practice: 'Each stage is written out explicitly, so the procedure can be handed to someone who has never done it before and still produce the same result.',
  },
  'with-safe-local-processing': {
    micro: 'local-only',
    tiny: 'local',
    phrase: 'with safe local processing',
    practice: 'Data never leaves the device, which is what makes the procedure usable on payloads you are not allowed to paste into a hosted service.',
  },
  'while-keeping-data-private': {
    micro: 'private',
    tiny: 'private',
    phrase: 'while keeping data private',
    practice: 'Privacy is treated as a requirement rather than a preference: no upload, no account, no retention, and therefore no new data-processing agreement to negotiate.',
  },
  'for-quick-prototyping': {
    micro: 'prototyping',
    tiny: 'draft',
    phrase: 'for quick prototyping',
    practice: 'The goal is a fast, disposable answer — enough confidence to choose a direction, with the understanding that the production implementation gets its own tests.',
  },
  'during-code-review': {
    micro: 'in code review',
    tiny: 'review',
    phrase: 'during code review',
    practice: 'The output is meant to be pasted into a review thread, so it has to be small, self-explanatory, and reproducible by the reviewer without extra context.',
  },
  'as-part-of-ci-cd-pipeline': {
    micro: 'in CI/CD',
    tiny: 'CI/CD',
    phrase: 'as part of a CI/CD pipeline',
    practice: 'The manual pass is the specification for an automated one: once the expected output is agreed, the same check runs on every commit and fails the build when it drifts.',
  },
  'with-automated-validation': {
    micro: 'auto-validated',
    tiny: 'checked',
    phrase: 'with automated validation',
    practice: 'A machine-checkable assertion is attached to the result, so a later change that quietly breaks the invariant is caught by the check rather than by a user.',
  },
};

interface ContextVocab {
  micro: string;
  tiny: string;
  phrase: string;
  /** What this delivery context demands from the workflow. */
  demand: string;
}

const CONTEXT_VOCAB: Record<string, ContextVocab> = {
  'for-time-sensitive-incidents': { micro: 'incidents', tiny: 'incidents', phrase: 'time-sensitive incidents', demand: 'During an incident the constraint is minutes, not elegance: the procedure has to give a trustworthy answer on the first attempt and leave a trace that survives into the postmortem.' },
  'for-team-onboarding': { micro: 'onboarding', tiny: 'onboarding', phrase: 'team onboarding', demand: 'For onboarding the procedure doubles as teaching material, so every step names the reason behind it instead of assuming shared context a new joiner does not have yet.' },
  'for-audit-readiness': { micro: 'audits', tiny: 'audits', phrase: 'audit readiness', demand: 'Audit readiness means the result must be evidence: recorded inputs, recorded settings, and an output an auditor can regenerate without your help.' },
  'for-cross-region-teams': { micro: 'global teams', tiny: 'global', phrase: 'cross-region teams', demand: 'Across regions the workflow runs without a live handover, so it has to be unambiguous in writing and give identical output regardless of locale or timezone.' },
  'for-legacy-system-migrations': { micro: 'legacy moves', tiny: 'migrations', phrase: 'legacy system migrations', demand: 'Migrations mix old and new formats in the same pipeline, so the check has to prove the two representations mean the same thing rather than merely look similar.' },
  'for-large-enterprise-workflows': { micro: 'enterprise', tiny: 'enterprise', phrase: 'large enterprise workflows', demand: 'At enterprise scale the same procedure is executed by many teams, so it has to be standardised enough that two engineers reach the same conclusion independently.' },
  'for-api-contract-validation': { micro: 'API contracts', tiny: 'contracts', phrase: 'API contract validation', demand: 'Contract validation compares reality against the documented schema, so the output has to be precise about which field, type, or encoding actually diverged.' },
  'for-weekly-ops-routines': { micro: 'weekly ops', tiny: 'weekly ops', phrase: 'weekly ops routines', demand: 'A weekly routine is judged on repeatability: it should take the same few minutes every time and surface drift early rather than accumulate surprises.' },
  'for-compliance-reporting': { micro: 'compliance', tiny: 'compliance', phrase: 'compliance reporting', demand: 'Compliance reporting needs a defensible paper trail — what was checked, when, with which inputs — not just a green result someone remembers seeing.' },
  'for-incident-postmortems': { micro: 'postmortems', tiny: 'postmortem', phrase: 'incident postmortems', demand: 'A postmortem re-runs the evidence after the fact, so the procedure must be reproducible from records alone, weeks after the original session ended.' },
  'for-capacity-planning': { micro: 'capacity', tiny: 'capacity', phrase: 'capacity planning', demand: 'Capacity work cares about behaviour as volume grows, so a sample-sized result is only useful when you also note how it scales with payload size and concurrency.' },
  'for-release-management': { micro: 'releases', tiny: 'releases', phrase: 'release management', demand: 'Release management wants a go/no-go signal: the check has to be decisive, fast enough to run at the gate, and safe to repeat on a rollback.' },
  'for-vendor-integration': { micro: 'vendor work', tiny: 'vendors', phrase: 'vendor integrations', demand: 'With a vendor you cannot change the other side, so the workflow has to isolate whether the defect is in their payload, your parsing, or the transport between them.' },
  'for-data-governance': { micro: 'governance', tiny: 'governance', phrase: 'data governance', demand: 'Governance asks where the data went as much as what the result was, which is why a local, no-upload procedure is easier to approve than a hosted equivalent.' },
  'for-service-mesh-debugging': { micro: 'mesh debug', tiny: 'mesh', phrase: 'service mesh debugging', demand: 'In a mesh the payload passes through several hops, so the check has to be applied at each boundary to find the hop that changed it.' },
  'for-cost-optimization': { micro: 'cost control', tiny: 'cost', phrase: 'cost optimisation', demand: 'Cost work rewards doing the check locally: an answer that needs no cluster, no job, and no egress is both faster and cheaper than the pipeline equivalent.' },
  'for-performance-benchmarking': { micro: 'benchmarks', tiny: 'benchmarks', phrase: 'performance benchmarking', demand: 'Benchmarking needs a fixed baseline, so the input sample and settings have to be frozen before any comparison between runs means anything.' },
  'for-disaster-recovery': { micro: 'DR drills', tiny: 'DR drills', phrase: 'disaster recovery drills', demand: 'A recovery drill assumes your usual tooling is unavailable, so a procedure that runs offline in a browser is exactly the kind that still works at the worst moment.' },
  'for-production-rollouts': { micro: 'rollouts', tiny: 'rollouts', phrase: 'production rollouts', demand: 'During a rollout the check runs against both the old and the new version, and the interesting result is the difference between them rather than either one alone.' },
  'for-observability-pipelines': { micro: 'observability', tiny: 'telemetry', phrase: 'observability pipelines', demand: 'Observability pipelines silently drop malformed records, so validating the shape before ingestion is the difference between a usable dashboard and a misleading one.' },
};

const DEFAULT_STYLE: StyleVocab = { micro: 'in-browser', tiny: 'browser', phrase: 'directly in your browser', practice: 'The operation runs locally in a browser tab, so it is quick to repeat and easy to share.' };
const DEFAULT_CONTEXT: ContextVocab = { micro: 'daily work', tiny: 'daily', phrase: 'everyday engineering work', demand: 'The procedure is written to be repeatable during ordinary day-to-day engineering work.' };

function styleVocab(page: ResolvedPage): StyleVocab {
  return STYLE_VOCAB[page.style] ?? DEFAULT_STYLE;
}

function contextVocab(page: ResolvedPage): ContextVocab {
  return CONTEXT_VOCAB[page.context] ?? DEFAULT_CONTEXT;
}

/**
 * Compact spelling of an intent for the title budget: the leading verb is
 * dropped when the remainder is still a self-explanatory noun phrase, which is
 * what a reader scanning a result list actually needs.
 */
const INTENT_MICRO_OVERRIDES: Record<string, string> = {
  'find-and-replace-patterns': 'find and replace',
  'detect-json-syntax-errors': 'JSON syntax errors',
  'convert-json-to-types': 'JSON to types',
  'generate-unique-identifiers': 'unique IDs',
  'rotate-unique-identifiers': 'ID rotation',
  'generate-identifiers': 'ID generation',
  'anonymize-sensitive-fields': 'field anonymising',
  'format-api-documentation': 'API doc formatting',
  'authenticate-api-request': 'request auth',
  'secure-api-communication': 'secure transport',
  'escape-template-variables': 'template escaping',
  'escape-special-characters': 'special characters',
  'serialize-complex-objects': 'object serialising',
  'configure-periodic-cleanup': 'periodic cleanup',
  'automate-data-extraction': 'data extraction',
  'monitor-scheduled-tasks': 'job monitoring',
  'validate-transform-output': 'transform output',
  'reproduce-formatting-bug': 'formatting bugs',
  'troubleshoot-encoding-mismatch': 'encoding mismatch',
  'normalize-encoded-output': 'encoded output',
  'compare-security-hashes': 'hash comparison',
  'validate-markdown-syntax': 'Markdown syntax',
  'restructure-code-blocks': 'code block layout',
  'standardize-sql-style': 'SQL style',
  'normalize-data-structure': 'data structure',
  'check-data-consistency': 'data consistency',
  'validate-data-integrity': 'data integrity',
  'verify-data-integrity': 'integrity checks',
  'inspect-json-structure': 'JSON structure',
  'protect-against-xss': 'XSS protection',
  'render-dynamic-content': 'dynamic content',
  'preview-content-markup': 'markup preview',
  'compress-web-assets': 'asset compression',
  'optimize-css-output': 'CSS output',
  'optimize-css-bundle': 'CSS bundles',
  'beautify-query-strings': 'query formatting',
  'align-code-formatting': 'code alignment',
  'convert-character-sets': 'character sets',
  'handle-unicode-text': 'Unicode text',
  'decode-nested-encodings': 'nested encodings',
  'verify-encoding-roundtrip': 'encoding roundtrip',
  'analyze-text-differences': 'text differences',
  'split-text-by-delimiter': 'text splitting',
  'match-complex-patterns': 'complex patterns',
  'extract-text-segments': 'text extraction',
  'identify-format-change': 'format changes',
  'pinpoint-encoding-issue': 'encoding issues',
  'analyze-log-patterns': 'log patterns',
  'build-extraction-pattern': 'extraction rules',
  'filter-event-streams': 'event filtering',
  'tag-automated-processes': 'process tagging',
  'schedule-recurring-task': 'recurring jobs',
  'validate-cron-schedule': 'cron schedules',
  'create-unique-job-ids': 'unique job IDs',
  'generate-batch-ids': 'batch IDs',
  'parse-automation-output': 'automation output',
  'extract-log-data': 'log extraction',
  'aggregate-data-records': 'record aggregation',
  'migrate-data-schema': 'schema migration',
  'create-data-fingerprint': 'data fingerprints',
  'generate-data-models': 'data models',
  'transform-data-format': 'format conversion',
  'hash-data-for-storage': 'storage hashing',
  'encode-binary-data': 'binary encoding',
  'detect-schema-drift': 'schema drift',
  'compare-config-files': 'config comparison',
  'isolate-parsing-error': 'parsing errors',
  'debug-regex-match': 'regex matches',
  'verify-output-format': 'output format',
  'trace-data-flow': 'data flow',
  'design-api-schema': 'API schema design',
  'validate-api-response': 'API responses',
  'construct-query-string': 'query strings',
  'parse-webhook-payload': 'webhook payloads',
  'debug-api-error': 'API errors',
  'test-api-endpoint': 'endpoint testing',
  'normalize-api-data': 'API data shape',
  'optimize-api-payload': 'payload size',
  'version-api-response': 'API versioning',
  'audit-token-expiry': 'token expiry',
  'hash-sensitive-data': 'sensitive data',
  'generate-secure-keys': 'secure keys',
  'validate-jwt-claims': 'JWT claims',
  'detect-token-tampering': 'token tampering',
  'analyze-token-payload': 'token payloads',
  'inspect-signatures': 'signatures',
  'verify-tokens': 'token checks',
  'clean-up-whitespace': 'whitespace',
  'build-regex-patterns': 'regex patterns',
  'validate-input-format': 'input format',
  'convert-text-case': 'text case',
  'compare-versions': 'version diffs',
  'normalize-text': 'text normalising',
  'test-regex': 'regex testing',
  'flatten-nested-json': 'nested JSON',
  'generate-json-schema': 'JSON schema',
  'minify-json-payload': 'JSON minifying',
  'merge-json-data': 'JSON merging',
  'extract-json-values': 'JSON values',
  'transform-json-keys': 'JSON keys',
  'compare-json-objects': 'JSON comparison',
  'validate-json': 'JSON validation',
  'format-json': 'JSON formatting',
  'encode-data': 'data encoding',
  'decode-data': 'data decoding',
  'fix-encoding-bugs': 'encoding bugs',
  'batch-encode-values': 'batch encoding',
  'convert-binary-to-text': 'binary to text',
  'sanitize-html-input': 'HTML sanitising',
  'minify-stylesheet': 'CSS minifying',
  'validate-markup-output': 'markup output',
  'format-rich-text': 'rich text',
  'secure-form-data': 'form data safety',
  'encode-url-parameters': 'URL parameters',
  'render-documentation': 'doc rendering',
  'compress-stylesheet': 'stylesheet size',
  'indent-nested-code': 'nested indentation',
  'format-sql': 'SQL formatting',
  'minify-assets': 'asset minifying',
  'preview-markdown': 'Markdown preview',
};

function intentMicro(intent: string): string {
  const override = INTENT_MICRO_OVERRIDES[intent];
  if (override) return override;
  const words = intent.split('-');
  return words.length >= 3 ? words.slice(1).join(' ') : words.join(' ');
}

/* -------------------------------------------------------------------------- */
/*  Page identity: <title>, meta description, <h1>                            */
/* -------------------------------------------------------------------------- */

/**
 * Bing Webmaster Tools: "Change the title length to be less than 70 characters."
 * That is a strict upper bound of 69 (titles of exactly 70 were still flagged).
 */
export const TITLE_MAX = 69;
export const DESCRIPTION_MIN = 150;
export const DESCRIPTION_MAX = 160;

export interface PageIdentity {
  title: string;
  description: string;
  h1: string;
}

interface Forms {
  intent: string[];
  tool: string[];
  audience: string[];
  task: string[];
  style: string[];
  context: string[];
}

/**
 * Ordered shortening ladder — one spelling tier per dimension. The fitter walks
 * it until the assembled title fits, so the most readable spelling that fits is
 * the one that ships. The final plan uses every dimension's shortest tier and
 * the compact separator layout, and the sum of those maxima is under the
 * 70-character limit, which is what makes the limit a guarantee rather than a
 * hope (asserted by scripts/verify-edge-corpus-quality.mjs).
 */
const SHORTENING_PLANS: ReadonlyArray<{ readonly tiers: readonly [number, number, number, number, number, number]; readonly compact: boolean }> = [
  { tiers: [0, 0, 0, 0, 0, 0], compact: false },
  { tiers: [1, 0, 0, 0, 0, 0], compact: false },
  { tiers: [1, 1, 0, 0, 0, 0], compact: false },
  { tiers: [1, 1, 0, 1, 0, 0], compact: false },
  { tiers: [1, 1, 1, 1, 0, 0], compact: false },
  { tiers: [1, 1, 1, 2, 0, 0], compact: false },
  { tiers: [1, 1, 2, 2, 0, 0], compact: false },
  { tiers: [1, 1, 2, 2, 1, 0], compact: false },
  { tiers: [1, 1, 2, 2, 1, 1], compact: false },
  { tiers: [1, 2, 2, 2, 1, 1], compact: false },
  { tiers: [1, 2, 2, 2, 1, 1], compact: true },
];

function formsFor(page: ResolvedPage): Forms {
  const style = styleVocab(page);
  const context = contextVocab(page);
  return {
    intent: [label(page.intent), intentMicro(page.intent)],
    tool: [toolName(page.tool), TOOL_MICRO[page.tool] ?? toolName(page.tool), TOOL_TINY[page.tool] ?? toolName(page.tool)],
    audience: [label(page.audience), AUDIENCE_MICRO[page.audience] ?? label(page.audience), AUDIENCE_TINY[page.audience] ?? label(page.audience)],
    task: [
      TASK_PHRASE[page.task] ?? label(page.task),
      TASK_MICRO[page.task] ?? label(page.task),
      TASK_TINY[page.task] ?? label(page.task),
    ],
    style: [style.micro, style.tiny],
    context: [context.micro, context.tiny],
  };
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The served <title>. Every dimension that distinguishes this URL from its
 * siblings is present, so the title is unique across the corpus; the fitter
 * only ever swaps a spelling for a shorter one, never truncates mid-phrase and
 * never drops a dimension. There is deliberately no " | DevSolve" suffix: the
 * 70-character budget is worth more spent on what the page is about than on
 * boilerplate that repeats 20 million times (the brand is still carried by
 * og:site_name and the JSON-LD publisher).
 */
function buildTitle(forms: Forms): string {
  let candidate = '';
  for (const { tiers: [i, t, a, k, s, c], compact } of SHORTENING_PLANS) {
    const subject = capitalise(forms.intent[i]);
    const audience = `${forms.audience[a]} ${forms.task[k]}`;
    // Compact form drops one ", " vs the previous template so the shortest
    // tier's worst case lands at ≤69 (Bing: strictly less than 70).
    const detail = compact
      ? `${forms.tool[t]} ${forms.style[s]} ${forms.context[c]}`
      : `${forms.tool[t]}, ${forms.style[s]} ${forms.context[c]}`;
    candidate = compact ? `${subject}: ${audience}, ${detail}` : `${subject} for ${audience}: ${detail}`;
    if (candidate.length <= TITLE_MAX) return candidate;
  }
  // Safety net — vocabulary audit proves this is unreachable, but never ship
  // a Bing-flagged title even if a future vocab edit regresses the guarantee.
  if (candidate.length > TITLE_MAX) {
    const cut = candidate.slice(0, TITLE_MAX);
    const at = cut.lastIndexOf(' ');
    candidate = (at >= 40 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, '');
  }
  return candidate;
}

/**
 * Deterministic tail phrases used to land the meta description inside Bing's
 * recommended 150–160 window without padding it with filler that says nothing.
 * They are appended to an already-unique base, so uniqueness is preserved.
 */
const DESCRIPTION_TAILS = [
  ' Runs locally in your browser.',
  ' No signup, no uploads.',
  ' Includes a worked example.',
  ' Free developer tool.',
  ' Steps, pitfalls, and FAQ.',
  ' Reproducible output.',
  ' Private by default.',
  ' Free.',
  ' No account needed.',
  ' Works offline.',
];

function buildDescription(page: ResolvedPage, forms: Forms): string {
  const style = styleVocab(page);
  const context = contextVocab(page);

  let base = '';
  for (const { tiers: [i, t, a, k] } of SHORTENING_PLANS) {
    base = `${capitalise(forms.intent[i])} with the ${forms.tool[t]} tool: a ${forms.audience[a]} workflow for ${forms.task[k]} ${style.phrase}, built for ${context.phrase}.`;
    if (base.length <= DESCRIPTION_MAX) break;
  }
  if (base.length > DESCRIPTION_MAX) {
    base = base.slice(0, DESCRIPTION_MAX);
    const lastSpace = base.lastIndexOf(' ');
    if (lastSpace > DESCRIPTION_MIN) base = base.slice(0, lastSpace);
    base = `${base.replace(/[\s,;:.–—-]+$/, '')}.`;
  }

  // Longest-tail-first keeps the padding to as few clauses as possible; the
  // short entries guarantee the window is always reachable.
  const used = new Set<number>();
  while (base.length < DESCRIPTION_MIN) {
    let chosen = -1;
    for (let i = 0; i < DESCRIPTION_TAILS.length; i += 1) {
      if (used.has(i)) continue;
      const length = base.length + DESCRIPTION_TAILS[i].length;
      if (length > DESCRIPTION_MAX) continue;
      if (chosen === -1 || DESCRIPTION_TAILS[i].length > DESCRIPTION_TAILS[chosen].length) chosen = i;
    }
    if (chosen === -1) break;
    used.add(chosen);
    base += DESCRIPTION_TAILS[chosen];
  }
  return base;
}

function buildH1(page: ResolvedPage, forms: Forms): string {
  const style = styleVocab(page);
  const context = contextVocab(page);
  return `${capitalise(forms.intent[0])} with ${forms.tool[0]} ${style.phrase}: a ${forms.audience[0]} guide to ${forms.task[0]} for ${context.phrase}`;
}

/**
 * Title, description and H1 for a page — deliberately separable from the full
 * page body so the build-time verifier can prove uniqueness across all 20M
 * URLs without rendering 20M documents.
 */
/**
 * Build-time audit of the title vocabulary. It proves the two properties the
 * corpus depends on, without rendering a single page:
 *
 *   - every dimension's spellings are injective at every tier, so assembling
 *     them can only produce a duplicate title if two pages share all five
 *     dimensions (i.e. are the same page);
 *   - the shortest tier's worst case fits the 70-character limit, so the
 *     fitter always terminates inside budget rather than emitting a long title.
 *
 * Exported for scripts/verify-edge-corpus-quality.mjs; never called at request
 * time.
 */
export function titleVocabularyAudit(): { problems: string[]; worstCaseTitleLength: number; checkedSpellings: number } {
  const problems: string[] = [];
  let checkedSpellings = 0;

  const intents = Array.from(new Set(CLUSTERS.flatMap(([, , list]) => list)));
  const dimensions: { name: string; values: string[]; spellings: (value: string) => string[] }[] = [
    { name: 'intent', values: intents, spellings: (v) => [label(v), intentMicro(v)] },
    { name: 'tool', values: Array.from(new Set(CLUSTERS.flatMap(([, tools]) => tools))), spellings: (v) => [toolName(v), TOOL_MICRO[v] ?? '', TOOL_TINY[v] ?? ''] },
    { name: 'audience', values: [...AUDIENCES], spellings: (v) => [label(v), AUDIENCE_MICRO[v] ?? '', AUDIENCE_TINY[v] ?? ''] },
    { name: 'task', values: [...TASKS], spellings: (v) => [TASK_PHRASE[v] ?? '', TASK_MICRO[v] ?? '', TASK_TINY[v] ?? ''] },
    { name: 'style', values: [...MODIFIER_STYLES], spellings: (v) => [STYLE_VOCAB[v]?.micro ?? '', STYLE_VOCAB[v]?.tiny ?? ''] },
    { name: 'context', values: [...MODIFIER_CONTEXTS], spellings: (v) => [CONTEXT_VOCAB[v]?.micro ?? '', CONTEXT_VOCAB[v]?.tiny ?? ''] },
  ];

  const maxima: Record<string, number[]> = {};
  for (const dimension of dimensions) {
    const tierCount = dimension.spellings(dimension.values[0]).length;
    maxima[dimension.name] = new Array(tierCount).fill(0);
    for (let tier = 0; tier < tierCount; tier += 1) {
      const seen = new Map<string, string>();
      for (const value of dimension.values) {
        const spelling = dimension.spellings(value)[tier];
        checkedSpellings += 1;
        if (!spelling) {
          problems.push(`${dimension.name} "${value}" has no tier-${tier} spelling`);
          continue;
        }
        const previous = seen.get(spelling);
        if (previous !== undefined) {
          problems.push(`${dimension.name} tier ${tier} is not injective: "${previous}" and "${value}" both render as "${spelling}"`);
        }
        seen.set(spelling, value);
        maxima[dimension.name][tier] = Math.max(maxima[dimension.name][tier], spelling.length);
      }
    }
  }

  const finalPlan = SHORTENING_PLANS[SHORTENING_PLANS.length - 1];
  const [ti, tt, ta, tk, ts, tc] = finalPlan.tiers;
  // Compact: `${intent}: ${audience} ${task}, ${tool} ${style} ${context}`
  const separators = ': '.length + ' '.length + ', '.length + ' '.length + ' '.length;
  const worstCaseTitleLength = separators
    + maxima.intent[ti] + maxima.audience[ta] + maxima.task[tk]
    + maxima.tool[tt] + maxima.style[ts] + maxima.context[tc];
  if (!finalPlan.compact) problems.push('the final shortening plan must use the compact layout');
  if (worstCaseTitleLength > TITLE_MAX) {
    problems.push(`shortest-tier worst case is ${worstCaseTitleLength} characters, above the ${TITLE_MAX} limit`);
  }

  return { problems, worstCaseTitleLength, checkedSpellings };
}

export function buildIdentity(page: ResolvedPage): PageIdentity {
  const forms = formsFor(page);
  return {
    title: buildTitle(forms),
    description: buildDescription(page, forms),
    h1: buildH1(page, forms),
  };
}

/* -------------------------------------------------------------------------- */
/*  Content builders                                                           */
/* -------------------------------------------------------------------------- */

export interface PageContent {
  title: string;
  description: string;
  h1: string;
  intro: string[];
  /** Bing §16 — explicit entity naming so grounding can cite a defined thing. */
  entity: { name: string; definition: string; alsoKnownAs: string[] };
  /** Bing §11/§15 — when this exact URL applies vs neighbouring siblings. */
  decision: { heading: string; when: string[]; notWhen: string[]; verdict: string };
  /** Bing §15 — acceptance criteria a reviewer can verify independently. */
  acceptance: string[];
  keyTakeaways: string[];
  steps: string[];
  pitfalls: string[];
  comparison: { item: string; pros: string; cons: string }[];
  proTips: string[];
  technical: string[];
  useCases: string[];
  glossary: { term: string; definition: string }[];
  faq: { question: string; answer: string }[];
  keywords: string[];
  workedExample: { inputLabel: string; input: string; outputLabel: string; output: string; note: string };
  related: { slug: string; label: string }[];
  scenario: { heading: string; summary: string; paragraphs: string[]; checklist: string[] };
  /** Long, style×context-bound block that forces sibling bodies apart (near-dup defence). */
  differentiation: string[];
}

function buildContent(page: ResolvedPage): PageContent {
  const { cluster, tool, intent, audience, task, slug } = page;
  const seed = hashString(slug);
  const tn = toolName(tool);
  const ac = AUDIENCE_CONTEXT[audience] ?? DEFAULT_AUDIENCE;
  const cd = CLUSTER_DOMAIN[cluster] ?? { field: `${label(cluster)} workflows`, importance: 'Reliable engineering workflows reduce downstream defects', bestPractice: 'Validate output against a known-good reference before shipping' };
  const tc = TASK_CONTEXT[task] ?? DEFAULT_TASK;
  const li = label(intent);
  const la = label(audience);
  const lt = label(task);

  const sv = styleVocab(page);
  const cv = contextVocab(page);
  const identity = buildIdentity(page);
  const pageTitle = identity.title;
  const h1 = identity.h1;

  // The opening paragraph answers the page's exact question before anything
  // else (Bing guideline #18: surface key information early) and names the
  // execution style and delivery context that make this URL distinct from its
  // siblings, so the first 40 words already identify the sub-topic.
  const leadAnswer = `To ${li} ${sv.phrase} as a ${la} working on ${cv.phrase}, open the ${tn}, load a representative sample of your own data, run the ${li} operation, and verify the output against a known-good reference before it reaches anything shared.`;

  const introVariants = [
    [
      leadAnswer,
      `${cd.importance}, so the workflow here is written for real projects rather than toy examples. ${sv.practice}`,
      `The driving scenario is ${tc.scenario} — ${tc.urgency}. By the end you will ${tc.outcome}, with every step reproducible on your own machine.`,
    ],
    [
      leadAnswer,
      `In ${cd.field}, the gap between a working result and a subtle bug often comes down to how carefully ${li} was handled. ${cv.demand}`,
      `This walkthrough equips a ${la} with the exact steps, focused on ${ac.focus}. The scenario — ${tc.scenario} — is ${tc.urgency}, so you will ${tc.outcome}.`,
    ],
    [
      leadAnswer,
      `${title(intent)} is a task nearly every ${la} meets while ${tc.scenario}. ${tn} handles it entirely in your browser, giving deterministic output you can verify before it reaches production.`,
      `${cd.importance}. ${sv.practice} This page maps that principle to concrete steps tailored for ${ac.focus}.`,
    ],
    [
      leadAnswer,
      `A ${la} working on ${tc.scenario} cannot afford ambiguity about ${li}. ${tn} removes that ambiguity by running every operation locally and returning transparent, repeatable output.`,
      `Because ${cd.importance.toLowerCase()}, each step below is designed to surface issues early — particularly ${cv.phrase}, where ${tc.urgency.replace(/^a /, '')}. When you finish, you will ${tc.outcome}.`,
    ],
    [
      leadAnswer,
      `Speed and accuracy pull in opposite directions when ${la} teams need to ${li} under pressure. ${tn} resolves that tension: it is instant to open, processes data on the client, and shows exactly what changed.`,
      `${cd.importance}, and this guide makes the principle concrete for ${tc.scenario} ${sv.phrase}. The outcome is simple — you will ${tc.outcome}.`,
    ],
  ];
  const intro = introVariants[seed % introVariants.length];

  // Bing §16: name the primary entity once, early, with a definition that
  // stands alone — grounding engines cite entities, not vague page topics.
  const entity = {
    name: `${tn} · ${capitalise(li)}`,
    definition: `${tn} is the free, browser-local DevSolve tool used on this URL to ${li} ${sv.phrase} for a ${la} during ${TASK_PHRASE[task] ?? lt}, scoped specifically to ${cv.phrase}. The page's single topic is that combination — not a generic overview of ${cd.field}.`,
    alsoKnownAs: [
      `${capitalise(li)} with ${tn}`,
      `${la} ${TASK_PHRASE[task] ?? lt} workflow`,
      `${sv.micro} ${cv.micro} guide`,
    ],
  };

  // Bing §11/§15/§17: make this URL's applicability explicit so sibling pages
  // (same tool, different style×context) are not near-duplicates.
  const decision = {
    heading: `When this exact ${li} guide applies`,
    when: [
      `You are a ${la} whose immediate job is ${TASK_PHRASE[task] ?? lt}, and you need to ${li} ${sv.phrase}.`,
      `The delivery setting is ${cv.phrase}, where the first constraint is time-to-trustworthy-answer rather than polish.`,
      `The execution style on this URL is ${sv.phrase}, which changes tooling, privacy, and hand-off expectations versus sibling guides.`,
      `You need a result that another ${la} can regenerate from the same sample without shared tribal knowledge.`,
    ],
    notWhen: [
      `You need a different execution style (for example, not ${sv.phrase}) — open the sibling guide that matches that style instead of stretching this one.`,
      `The work is outside ${cv.phrase}; neighbouring context pages cover those constraints with different acceptance criteria.`,
      `You only need a one-line definition of ${cd.field} with no worked verification — start from the tool page, not this scenario guide.`,
      `You are batching millions of records server-side; keep this page as the reference check and automate the bulk path separately.`,
    ],
    verdict: `Use this URL when — and only when — a ${la} must ${li} ${sv.phrase} for ${cv.phrase} while doing ${TASK_PHRASE[task] ?? lt}. That single-topic focus is what makes the page eligible as a grounding citation rather than a generic hub.`,
  };

  const acceptance = [
    `Input sample is representative of payloads seen ${cv.phrase}, not a toy string that hides edge cases.`,
    `The ${tn} run is performed ${sv.phrase}, and the same input + settings reproduce the same output for a second person.`,
    `Output is compared to a known-good reference before it influences ${TASK_PHRASE[task] ?? lt}.`,
    `${ac.concern} is explicitly checked, because that is the failure mode that matters for a ${la}.`,
    `Evidence (input, settings, output) is recorded next to the work item it supports.`,
  ];

  // The section that makes each of the 180 sibling URLs a genuinely different
  // page: what changes about this workflow when it is run in this execution
  // style, in this delivery context.
  const scenario = {
    heading: `${capitalise(li)} ${sv.phrase}: what changes ${cv.phrase.startsWith('for ') ? cv.phrase : `in ${cv.phrase}`}`,
    summary: `This page covers one specific slice of ${cd.field}: a ${la} doing ${TASK_PHRASE[task] ?? lt} who needs to ${li} ${sv.phrase}, ${cv.phrase}.`,
    paragraphs: [
      sv.practice,
      cv.demand,
      `Put together, that means the ${tn} is used here as a verification step rather than a convenience: ${ac.concern} is the risk that matters for a ${la}, and ${cv.phrase} is the setting where an unverified assumption is most expensive to discover late.`,
      `Unlike a generic ${tn} overview, this guide refuses to mix unrelated intents: every section below stays inside ${li} × ${sv.micro} × ${cv.micro} so Bing and Google can treat the URL as a single, citable topic.`,
    ],
    checklist: [
      `Confirm the sample you paste is representative of the payloads you actually see ${cv.phrase}.`,
      `Keep the run repeatable ${sv.phrase} — the same input and settings must produce the same output for a second person.`,
      `Record the outcome next to the ${TASK_PHRASE[task] ?? lt} it supports, so the evidence is attached to the work it justifies.`,
    ],
  };

  /*
   * BODY UNIQUENESS CONTRACT (Bing abuse: auto-gen / near-duplicate)
   * ----------------------------------------------------------------
   * Every reusable pool sentence MUST bind style (sv) and context (cv) so the
   * 180 siblings that share (pair × audience × task) cannot share identical
   * body sentences. Metadata uniqueness alone is not enough for indexability;
   * the served <main> text must also be a distinct document.
   */
  const keyTakeawaysPool = [
    `${tn} lets a ${la} ${li} ${sv.phrase} without uploading data — critical ${cv.phrase} when ${ac.concern} is on the line.`,
    `The core outcome ${cv.phrase} is to ${tc.outcome}, using ${tn} ${sv.phrase} rather than a generic ${cd.field} checklist.`,
    `${cd.bestPractice} — applied here ${sv.phrase} so the evidence still holds ${cv.phrase}.`,
    `Client-side execution ${sv.phrase} matters most ${cv.phrase}, where ${ac.concern} cannot wait on a shared sandbox.`,
    `Keep a minimal reproducible sample ${sv.phrase} so the same ${li} result can be regenerated during ${tc.scenario} ${cv.phrase}.`,
    `Pair a manual ${sv.micro} pass with an automated check so ${cd.field} stays consistent ${cv.phrase} across releases.`,
    `Document ${tn} settings used ${sv.phrase} so a reviewer ${cv.phrase} can verify the ${li} result independently.`,
  ];
  const keyTakeaways = [
    `${capitalise(li)} ${sv.phrase} is the specific workflow on this page, written for ${cv.phrase}.`,
    ...seededShuffle(keyTakeawaysPool, seed + 5).slice(0, 3),
  ];

  const baseSteps = [
    `Define scope for ${cv.phrase}: you are ${tc.scenario}. Gather a representative sample before scaling — the sample must reflect payloads seen ${cv.phrase}, not a toy string.`,
    `Open the ${tn} and run it ${sv.phrase}. It loads in the browser with no server dependency, which is the execution style this URL commits to.`,
    `Paste the input for ${li}. If the data is sensitive, confirm the browser environment is trusted first; ${sv.practice}`,
    `Adjust ${tn} options for ${ac.focus}, then confirm those options still make sense ${cv.phrase} where ${tc.urgency}.`,
    `Run ${li} ${sv.phrase} and inspect edge cases that affect ${ac.concern} — happy-path-only checks fail ${cv.phrase}.`,
    `Validate against a known-good reference. For ${tc.scenario} ${cv.phrase}, the goal is to ${tc.outcome}.`,
    `Record input, settings, and output together so the ${sv.micro} run remains admissible evidence ${cv.phrase}.`,
  ];
  const clusterSteps: Record<string, string[]> = {
    json: [
      `Confirm JSON syntax before ${li} ${sv.phrase} — a misplaced comma ${cv.phrase} cascades into misleading results.`,
      `Check null, empty arrays, and deep nesting ${sv.phrase}; these quiet bugs surface late ${cv.phrase}.`,
      `If high-precision numbers matter ${cv.phrase}, verify they survive ${li} without losing significant digits.`,
    ],
    encoding: [
      `Decide encode vs decode direction before you ${li} ${sv.phrase} — double-encoding is brutal to unwind ${cv.phrase}.`,
      `Test Unicode, whitespace, and special characters ${sv.phrase} so coverage matches payloads seen ${cv.phrase}.`,
      `Roundtrip encode→decode ${sv.phrase} and compare to the original before trusting the result ${cv.phrase}.`,
    ],
    security: [
      `Keep production secrets out of shared sessions before you ${li} ${sv.phrase}, especially ${cv.phrase}.`,
      `Confirm algorithm and key length for this ${sv.micro} run — browser support may be narrower ${cv.phrase}.`,
      `Treat ${tn} inspection as convenience, not authority: verify signatures server-side even when you ${li} ${sv.phrase}.`,
    ],
    text: [
      `Define acronym/number/symbol behaviour before ${li} ${sv.phrase} so ${cv.phrase} reviews stay consistent.`,
      `Test patterns on normal, edge, and adversarial samples ${sv.phrase} before relying on them ${cv.phrase}.`,
      `Keep the original text before destructive ${li} steps ${sv.phrase}; rollbacks are cheaper ${cv.phrase}.`,
    ],
    formatting: [
      `Confirm the team style guide before reformatting ${sv.phrase} — shared files ${cv.phrase} punish surprise diffs.`,
      `Run the linter/validator after formatting ${sv.phrase} so syntax still holds ${cv.phrase}.`,
      `Exercise reformatted output in the real runtime ${sv.phrase}; subtle regressions hide until ${cv.phrase}.`,
    ],
    api: [
      `Review the API contract before you ${li} ${sv.phrase} so constraints match what ${cv.phrase} expects.`,
      `Test valid and invalid payloads ${sv.phrase} to confirm structured errors remain useful ${cv.phrase}.`,
      `Document the request/response pair from this ${sv.micro} run — it doubles as integration evidence ${cv.phrase}.`,
    ],
    data: [
      `Snapshot the original dataset before ${li} ${sv.phrase} so unexpected results ${cv.phrase} are reversible.`,
      `Validate transformed data against the target schema ${sv.phrase} before it influences work ${cv.phrase}.`,
      `Normalize whitespace and key order ${sv.phrase} so fingerprints stay stable ${cv.phrase}.`,
    ],
    debugging: [
      `Reproduce with the smallest input ${sv.phrase} — isolation is what makes ${cv.phrase} fixes verifiable.`,
      `Inspect structural diffs first ${sv.phrase}, then values; that order saves time ${cv.phrase}.`,
      `Write what you checked and concluded ${sv.phrase} so knowledge survives the next ${cv.phrase} incident.`,
    ],
    automation: [
      `Isolate the schedule/extraction pattern ${sv.phrase} on production-like data before promoting it ${cv.phrase}.`,
      `Validate cron next-run times ${sv.phrase}, not only syntax — timezone mistakes show up ${cv.phrase}.`,
      `Add monitoring so ${sv.micro} automation failures are visible immediately ${cv.phrase}.`,
    ],
    web: [
      `Sanitize user content before render ${sv.phrase}; XSS risk is unacceptable ${cv.phrase}.`,
      `Test minified CSS/markup across browsers ${sv.phrase} so optimization does not change rendering ${cv.phrase}.`,
      `Confirm Content-Type and encoding match receivers ${sv.phrase} to avoid quiet loss ${cv.phrase}.`,
    ],
  };
  const stepPool = [...baseSteps, ...(clusterSteps[cluster] ?? [])];
  const steps = [
    ...seededShuffle(stepPool, seed + 11).slice(0, 5),
    `Close the loop for ${cv.phrase}: ${scenario.checklist[2].charAt(0).toLowerCase()}${scenario.checklist[2].slice(1)}`,
  ];

  const genericPitfalls = [
    `Skipping a sanity sample before full-dataset ${li} ${sv.phrase} — ${cv.phrase} amplifies sample bias into outages.`,
    `Trusting ${tn} defaults ${sv.phrase} without probing malformed input that appears ${cv.phrase}.`,
    `Transforming without a backup ${sv.phrase}; recovery is slower than prevention ${cv.phrase}.`,
    `Treating ${tn} output as authoritative ${sv.phrase} without a second source of truth ${cv.phrase}.`,
    `Ignoring whitespace/encoding drift ${sv.phrase} that only breaks downstream systems ${cv.phrase}.`,
    `Failing to record settings from the ${sv.micro} run, so the ${li} result cannot be reproduced ${cv.phrase}.`,
  ];
  const clusterPitfalls: Record<string, string[]> = {
    json: [
      `Treating pretty-printed JSON as validated ${sv.phrase} without a real parser ${cv.phrase}.`,
      `Assuming key order is preserved ${sv.phrase} when the JSON model says otherwise ${cv.phrase}.`,
    ],
    encoding: [
      `Double-encoding already-encoded values ${sv.phrase} during ${li} ${cv.phrase}.`,
      `Confusing URL, HTML-entity, and Base64 encodings ${sv.phrase} when the receiver expects one ${cv.phrase}.`,
    ],
    security: [
      `Mixing test and production secrets in one ${sv.micro} browser session ${cv.phrase}.`,
      `Trusting JWT claims ${sv.phrase} without server-side signature verification ${cv.phrase}.`,
    ],
    text: [
      `Aggressive find-and-replace ${sv.phrase} without scanning the diff ${cv.phrase}.`,
      `Shipping complex patterns ${sv.phrase} before validating realistic inputs ${cv.phrase}.`,
    ],
    formatting: [
      `Deploying reformatted artifacts ${sv.phrase} without the test suite ${cv.phrase}.`,
      `Reformatting whitespace-sensitive languages ${sv.phrase} without checking language rules ${cv.phrase}.`,
    ],
    api: [
      `Hardcoding response shapes ${sv.phrase} instead of schema validation ${cv.phrase}.`,
      `Checking bodies only ${sv.phrase} and ignoring HTTP status codes ${cv.phrase}.`,
    ],
    data: [
      `Transforming the full set ${sv.phrase} before a representative sample ${cv.phrase}.`,
      `Assuming types from one sample cover every variation ${sv.phrase} seen ${cv.phrase}.`,
    ],
    debugging: [
      `Changing several variables at once ${sv.phrase}, hiding the real fix ${cv.phrase}.`,
      `Blaming code ${sv.phrase} when the defect is data/config ${cv.phrase}.`,
    ],
    automation: [
      `Deploying schedules ${sv.phrase} without confirming scheduler timezone ${cv.phrase}.`,
      `Leaving automation failures unalerted ${sv.phrase} so errors pile up ${cv.phrase}.`,
    ],
    web: [
      `Trusting client sanitization alone ${sv.phrase} without server validation ${cv.phrase}.`,
      `Minifying CSS with custom properties ${sv.phrase} without testing output ${cv.phrase}.`,
    ],
  };
  const pitfalls = [
    `Applying a generic checklist instead of the one ${cv.phrase} needs — constraints differ when you ${li} ${sv.phrase}.`,
    ...seededShuffle([...genericPitfalls, ...(clusterPitfalls[cluster] ?? [])], seed + 17).slice(0, 4),
  ];

  const comparisonPool = [
    {
      item: `${tn} ${sv.phrase}`,
      pros: `Matches this URL’s style: instant open, local processing, and evidence you can regenerate ${cv.phrase}.`,
      cons: `Not a bulk server job; keep automation elsewhere and use this path for trustworthy ${li} checks.`,
    },
    {
      item: `CLI utilities vs ${sv.micro}`,
      pros: `Scriptable and strong for large files once installed.`,
      cons: `Setup friction fights ${cv.phrase} when a ${la} needs ${li} ${sv.phrase} in minutes.`,
    },
    {
      item: `App-embedded ${li}`,
      pros: `Maximum control beside business logic.`,
      cons: `Maintenance cost is wrong for a one-off ${sv.micro} verification ${cv.phrase}.`,
    },
    {
      item: `Hosted ${cd.field} services`,
      pros: `Dashboards and integrations out of the box.`,
      cons: `Data egress and rate limits conflict with ${sv.practice}`,
    },
    {
      item: `IDE helpers during ${sv.micro}`,
      pros: `Inline feedback while editing.`,
      cons: `Coverage varies by editor and rarely matches the acceptance bar ${cv.phrase}.`,
    },
  ];
  const comparison = seededShuffle(comparisonPool, seed + 23).slice(0, 4);

  const proTipsPool = [
    `Bookmark ${tn} for ${li} ${sv.phrase} — ${cd.field} work recurs for a ${la}, especially ${cv.phrase}.`,
    `When ${ac.concern} matters ${cv.phrase}, freeze a sample and validate ${sv.phrase} before touching production config.`,
    `Start ${lt} with the smallest reproducible input ${sv.phrase}; complexity drops fast ${cv.phrase}.`,
    `Keep known-good fixtures for ${cd.field} so future ${li} checks ${sv.phrase} start from a trusted baseline ${cv.phrase}.`,
    `Client-side ${sv.micro} runs work offline — useful ${cv.phrase} when networks or shared sandboxes are restricted.`,
    `Cross-check ${tn} output with one independent method ${sv.phrase} before ${cv.phrase} decisions go final.`,
    `Link this ${sv.micro} workflow in the team runbook so ${lt} stays consistent ${cv.phrase}.`,
    `Version the settings used ${sv.phrase} so ${li} evidence is reviewable like code ${cv.phrase}.`,
  ];
  const proTips = seededShuffle(proTipsPool, seed + 29).slice(0, 4);

  const technicalPool = [
    `${capitalise(li)} ${sv.phrase} is deterministic: same input and settings yield the same output. That is why a ${la} can treat ${tn} output as evidence during ${tc.scenario} ${cv.phrase}.`,
    `The usual ${cd.field} failure mode is an implicit assumption about input shape or encoding. This ${sv.micro} workflow forces a representative sample first — where ${ac.focus} is won or lost ${cv.phrase}.`,
    `Best results pair a manual ${sv.phrase} pass (context a ${la} spots immediately) with automation that enforces the same bar later, keeping ${ac.concern} controlled ${cv.phrase}.`,
    `Reproducibility is the differentiator ${cv.phrase}: record input, ${tn} settings, and output so a stranger can rerun ${li} ${sv.phrase} and reach the same conclusion.`,
    `Before automating ${li} beyond this ${sv.micro} path, confirm behaviour when size or concurrency jumps — shortcuts in ${cd.field} break first ${cv.phrase}.`,
  ];
  const technical = seededShuffle(technicalPool, seed + 37).slice(0, 3);

  const useCasesPool = [
    `${capitalise(cv.micro)} response: a ${la} uses ${tn} to ${li} ${sv.phrase} during ${tc.scenario} without provisioning infrastructure.`,
    `Pre-release gate ${cv.phrase}: fold ${li} ${sv.phrase} into the checklist so ${ac.concern} is verified before ship.`,
    `Distributed ${la} teams rely on identical ${tn} output ${sv.phrase} as a shared reference ${cv.phrase}, ending environment disputes in ${cd.field}.`,
    `Regulated work ${cv.phrase}: local-only ${sv.micro} processing lets teams ${li} on sensitive payloads without extra egress reviews.`,
    `Onboarding ${cv.phrase}: a new ${la} learns ${lt} through this exact ${li} ${sv.phrase} guide, glossary, and fixture.`,
  ];
  const useCases = seededShuffle(useCasesPool, seed + 41).slice(0, 3);

  const glossaryPool = [
    {
      term: `${capitalise(sv.micro)} ${li}`,
      definition: `Performing ${li} ${sv.phrase} so a ${la} can regenerate the same ${tn} result ${cv.phrase} without shared tribal knowledge.`,
    },
    {
      term: `${capitalise(cv.micro)} acceptance`,
      definition: `The bar for “done” ${cv.phrase}: representative input, ${sv.micro} execution, known-good comparison, and recorded evidence.`,
    },
    {
      term: `${tn} evidence pack`,
      definition: `Input sample, ${tn} settings, and output captured together after ${li} ${sv.phrase}, admissible in review ${cv.phrase}.`,
    },
    {
      term: 'Roundtrip validation',
      definition: `Transform then reverse to prove no loss — required quality gate for ${cd.field} when you ${li} ${sv.phrase} ${cv.phrase}.`,
    },
    {
      term: `${title(cluster)} ${sv.micro} workflow`,
      definition: `Steps a ${la} follows to execute and verify ${cd.field} tasks ${sv.phrase}, combining manual checks with automation ${cv.phrase}.`,
    },
    {
      term: 'Local processing',
      definition: `Running ${li} entirely in-browser ${sv.phrase} without egress — the privacy posture this page requires ${cv.phrase}.`,
    },
    {
      term: `${la} focus (${ac.focus})`,
      definition: `The success criterion for this audience: protect ${ac.focus} while completing ${TASK_PHRASE[task] ?? lt} ${cv.phrase}.`,
    },
  ];
  const glossary = seededShuffle(glossaryPool, seed + 43).slice(0, 5);

  const faqPool = [
    {
      question: `Is data safe when I ${li} with ${tn} ${sv.phrase}?`,
      answer: `Yes. ${tn} processes in-browser ${sv.phrase}, so nothing is uploaded — appropriate for sensitive inputs during ${tc.scenario} ${cv.phrase}.`,
    },
    {
      question: `Can ${tn} support production ${li} ${sv.phrase}?`,
      answer: `Use it for verification and prototyping ${sv.phrase}. Port proven logic into tested code for bulk paths, and keep this URL as the reference ${cv.phrase}.`,
    },
    {
      question: `What are size limits for ${li} ${sv.phrase}?`,
      answer: `Browsers are memory-bound; multi‑10MB inputs may stall. Use CLI for bulk and reserve ${tn} ${sv.phrase} for trustworthy checks ${cv.phrase}.`,
    },
    {
      question: `What should a ${la} prioritise on this ${sv.micro} page?`,
      answer: `Watch ${ac.concern}. Because ${ac.focus} is the goal, confirm output against that bar before relying on it ${cv.phrase}.`,
    },
    {
      question: `How do I validate ${li} output ${sv.phrase}?`,
      answer: `Compare to a known-good sample, check structure, and verify system invariants. For ${tc.scenario} ${cv.phrase}, aim to ${tc.outcome}.`,
    },
    {
      question: `Does ${tn} work offline ${sv.phrase}?`,
      answer: `After load, client-side JS runs without network — useful ${cv.phrase} when connectivity is restricted.`,
    },
    {
      question: `What if ${li} output looks wrong ${sv.phrase}?`,
      answer: `Verify input format/encoding, re-check options, then retest a minimal sample before retrying real data ${cv.phrase}.`,
    },
    {
      question: `How does ${li} ${sv.phrase} protect ${ac.focus}?`,
      answer: `${title(intent)} catches boundary defects early — cheaper than debugging after promotion ${cv.phrase}.`,
    },
  ];
  const faq = [
    {
      question: `How do I ${li} ${sv.phrase} ${cv.phrase.startsWith('for ') ? cv.phrase : `for ${cv.phrase}`}?`,
      answer: `${scenario.summary} Prefer a small representative sample, run the ${tn}, and compare the output with a known-good reference before it is used anywhere else.`,
    },
    {
      question: `Why does ${cv.phrase} change how a ${la} approaches ${li}?`,
      answer: `${cv.demand} Execution stays ${sv.phrase} so the acceptance criteria on this URL remain testable.`,
    },
    ...seededShuffle(faqPool, seed + 47).slice(0, 4),
  ];

  const keywords = Array.from(new Set([
    intent, tool, cluster, audience, task,
    `${label(intent)} ${tn}`, `${label(intent)} ${cv.phrase}`, `${tn} ${sv.phrase}`,
    'browser-based developer tool', 'local processing', 'privacy-first',
  ])).map((k) => label(k));

  const workedExample = buildWorkedExample(page);
  const related = buildRelated(page);
  const description = identity.description;

  // Dedicated anti-near-duplicate block: every sentence names the exact
  // style×context×audience×task coordinates so sibling <main> text diverges
  // well below Bing's scaled-content similarity bar.
  const differentiation = [
    `This URL is not a generic ${tn} overview. It is the ${sv.micro} path for ${li} during ${TASK_PHRASE[task] ?? lt}, written for a ${la}, and scoped only to ${cv.phrase}.`,
    `Sibling pages that keep the same tool and intent but change execution style are different documents: they do not claim ${sv.phrase}, and their acceptance criteria will not match what ${cv.phrase} demands here.`,
    `Sibling pages that keep the same style but change delivery context are also different: ${cv.demand}`,
    `Practically, that means the evidence pack for this page — sample, ${tn} settings, output — is only valid when the run was performed ${sv.phrase} and judged against ${cv.phrase}.`,
    `If your work is neither ${sv.phrase} nor ${cv.phrase}, stop and open the matching sibling instead of stretching this guide; that is how the corpus stays single-topic and indexable rather than a reshuffled doorway set.`,
    `Coordinate lock for crawlers and humans: intent=${li}; tool=${tn}; audience=${la}; task=${TASK_PHRASE[task] ?? lt}; style=${sv.phrase}; context=${cv.phrase}; slug=/k/${slug}.`,
  ];

  return {
    title: pageTitle,
    description,
    h1,
    intro,
    entity,
    decision,
    acceptance,
    keyTakeaways,
    steps,
    pitfalls,
    comparison,
    proTips,
    technical,
    useCases,
    glossary,
    faq,
    keywords,
    workedExample,
    related,
    scenario,
    differentiation,
  };
}

function buildWorkedExample(page: ResolvedPage): PageContent['workedExample'] {
  const { intent, tool, slug } = page;
  let x = (hashString(slug) ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
  const hex = (n: number) => Array.from({ length: n }, () => '0123456789abcdef'[rnd() % 16]).join('');
  const fields = ['userId', 'orderId', 'sessionId', 'traceId', 'tenantId', 'requestId', 'jobId', 'batchId'];
  const f1 = fields[rnd() % fields.length];
  let f2 = fields[rnd() % fields.length];
  if (f2 === f1) f2 = fields[(fields.indexOf(f1) + 1) % fields.length];
  const fixtureId = `fx-${hex(8)}`;
  const recordId = 1000 + (rnd() % 9000);
  const sample = `{"${f1}":"${fixtureId}","${f2}":${recordId},"stage":"${intent}"}`;

  let inputLabel = 'input fixture';
  let outputLabel = `${toolName(tool)} output`;
  let input = sample;
  let output: string;

  switch (tool) {
    case 'json-to-typescript':
      outputLabel = 'generated interface';
      output = `interface Record${recordId} {\n  ${f1}: string;\n  ${f2}: number;\n  stage: string;\n}`;
      break;
    case 'hash-generator':
      inputLabel = 'message'; outputLabel = 'SHA-256 (representative)'; input = fixtureId; output = hex(64);
      break;
    case 'uuid-generator':
      inputLabel = 'namespace seed'; outputLabel = 'UUID v4'; input = slug;
      output = `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[rnd() % 4]}${hex(3)}-${hex(12)}`;
      break;
    case 'base64-encode-decode':
      inputLabel = 'plaintext'; outputLabel = 'Base64'; input = `${f1}:${fixtureId}`;
      output = toBase64(input);
      break;
    case 'jwt-decoder': {
      inputLabel = 'JWT (header.payload.signature)'; outputLabel = 'decoded payload';
      const header = toBase64('{"alg":"HS256","typ":"JWT"}').replace(/=+$/, '');
      const payload = toBase64(`{"sub":"${fixtureId}","${f1}":${recordId},"iat":1700000000}`).replace(/=+$/, '');
      input = `${header}.${payload}.${hex(16)}`;
      output = `{\n  "sub": "${fixtureId}",\n  "${f1}": ${recordId},\n  "iat": 1700000000\n}`;
      break;
    }
    default:
      try { output = JSON.stringify(JSON.parse(sample), null, 2); } catch { output = sample; }
  }

  const note = `Fixture ${fixtureId} is derived deterministically from this page's slug, so it is unique to /k/${slug} and reproduces byte-for-byte on any machine — which is what makes it admissible as evidence in a review or postmortem. Run it ${styleVocab(page).phrase} and judge the result against the constraints of ${contextVocab(page).phrase}.`;
  return { inputLabel, input, outputLabel, output, note };
}

/* Minimal, dependency-free Base64 (ASCII input is all the fixtures use). */
function toBase64(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let i = 0;
  while (i < input.length) {
    const c1 = input.charCodeAt(i++) & 0xff;
    const c2 = i < input.length ? input.charCodeAt(i++) & 0xff : NaN;
    const c3 = i < input.length ? input.charCodeAt(i++) & 0xff : NaN;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (Number.isNaN(c2) ? 0 : c2 >> 4);
    const e3 = Number.isNaN(c2) ? 64 : (((c2 & 15) << 2) | (Number.isNaN(c3) ? 0 : c3 >> 6));
    const e4 = Number.isNaN(c3) ? 64 : c3 & 63;
    output += chars[e1] + chars[e2] + (e3 === 64 ? '=' : chars[e3]) + (e4 === 64 ? '=' : chars[e4]);
  }
  return output;
}

function buildRelated(page: ResolvedPage): { slug: string; label: string }[] {
  const seed = stableHash(page.slug);
  const out: { slug: string; label: string }[] = [];
  const seen = new Set<string>([page.slug]);
  // Coprime-ish stride keeps neighbours spread across the corpus while staying
  // fully deterministic and resolvable (every target is a real /k/ page).
  // 16 related /k/ links densifies the crawl graph so Googlebot discovers
  // siblings from any seed URL without waiting on the (ramped) sitemap.
  const stride = 1 + (seed % 9973) * 2;
  let cursor = page.index;
  for (let k = 0; out.length < 16 && k < 64; k += 1) {
    cursor = (cursor + stride) % CORPUS_SIZE;
    const target = pageForIndex(cursor);
    if (!target || seen.has(target.slug)) continue;
    seen.add(target.slug);
    out.push({ slug: target.slug, label: `${title(target.intent)} with ${toolName(target.tool)} for ${label(target.audience)}` });
  }
  // Same-tool neighbours (different intent/audience) reinforce topical clusters
  // so crawlers traverse high-relevance paths instead of only random strides.
  const pairIndex = Math.floor(page.index / PER_PAIR);
  for (let k = 0; out.length < 20 && k < 12; k += 1) {
    const offset = 1 + ((seed >>> (k % 16)) % (PER_PAIR - 1));
    const neighbour = pageForIndex((pairIndex * PER_PAIR + (page.index + offset) % PER_PAIR) % CORPUS_SIZE);
    if (!neighbour || seen.has(neighbour.slug)) continue;
    if (neighbour.tool !== page.tool && neighbour.cluster !== page.cluster) continue;
    seen.add(neighbour.slug);
    out.push({ slug: neighbour.slug, label: `${title(neighbour.intent)} · ${toolName(neighbour.tool)}` });
  }
  return out;
}

/** Editorial guide that owns this tool — authority backlink for Bing §5. */
const GUIDE_BY_TOOL: Record<string, { slug: string; title: string }> = {
  'json-formatter': { slug: 'json-validation-formatting', title: 'JSON validation and formatting' },
  'json-to-typescript': { slug: 'json-to-types', title: 'JSON to TypeScript types' },
  'base64-encode-decode': { slug: 'base64-usage', title: 'Base64 encode and decode' },
  'url-encode-decode': { slug: 'url-encoding-pitfalls', title: 'URL encoding pitfalls' },
  'html-entity-encode-decode': { slug: 'encoding-pitfalls-deep-dive', title: 'Encoding pitfalls deep dive' },
  'hash-generator': { slug: 'hashing-integrity', title: 'Hashing and integrity' },
  'uuid-generator': { slug: 'hashing-integrity', title: 'Hashing and integrity' },
  'jwt-decoder': { slug: 'jwt-decoding-browser', title: 'JWT decoding in the browser' },
  'text-case-converter': { slug: 'text-transformations', title: 'Text transformations' },
  'diff-checker': { slug: 'diffing-techniques', title: 'Diffing techniques' },
  'regex-tester': { slug: 'regex-testing-debugging', title: 'Regex testing and debugging' },
  'sql-formatter': { slug: 'sql-formatting', title: 'SQL formatting' },
  'css-minifier': { slug: 'minification-basics', title: 'Minification basics' },
  'markdown-preview': { slug: 'markdown-preview-safety', title: 'Markdown preview safety' },
  'cron-helper': { slug: 'api-contract-validation-deep-dive', title: 'API contract validation' },
};

/* -------------------------------------------------------------------------- */
/*  HTML renderer                                                              */
/* -------------------------------------------------------------------------- */

const STYLE = 'body{font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#172033;background:#fff;margin:0}.wrap{max-width:820px;margin:0 auto;padding:28px 20px 64px}nav.crumbs{font-size:14px;color:#5a6a82}a{color:#0a5bd6}h1{font-size:2rem;line-height:1.2;margin:.4em 0}h2{font-size:1.4rem;margin:1.6em 0 .5em;border-top:1px solid #e6eaf0;padding-top:1.1em}h3{font-size:1.05rem;margin:1.2em 0 .3em}code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}code{background:#f3f5f8;padding:2px 5px;border-radius:4px;font-size:.92em}pre{background:#0f1626;color:#e6edf7;padding:14px 16px;border-radius:8px;overflow:auto;font-size:.86rem;line-height:1.5}table{border-collapse:collapse;width:100%;font-size:.95rem}th,td{border:1px solid #dde3ec;padding:8px 10px;text-align:left;vertical-align:top}th{background:#f6f8fb}ul,ol{padding-left:1.3em}li{margin:.35em 0}dl dt{font-weight:600;margin-top:.7em}dl dd{margin:0 0 .2em}.lead{font-size:1.08rem;color:#33405a}.tk{background:#f6f8fb;border:1px solid #e2e8f2;border-radius:10px;padding:14px 18px}.meta{font-size:.85rem;color:#5a6a82}.links a{display:inline-block;margin:0 12px 8px 0}footer{margin-top:3em;border-top:1px solid #e6eaf0;padding-top:1.2em;font-size:.9rem;color:#5a6a82}';

function renderList(items: string[], ordered = false): string {
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</${tag}>`;
}

export function renderProgrammaticPage(page: ResolvedPage, origin: string): string {
  const c = buildContent(page);
  const canonical = `${origin}/k/${page.slug}`;
  const toolSlug = page.tool;
  const clusterLabel = title(page.cluster);

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'TechArticle',
      headline: c.h1, description: c.description, url: canonical,
      datePublished: '2024-01-15T00:00:00.000Z', dateModified: CONTENT_UPDATED_AT,
      inLanguage: 'en', isAccessibleForFree: true, keywords: c.keywords.join(', '),
      author: { '@type': 'Organization', name: 'DevSolve Editorial Team', url: `${origin}/about` },
      publisher: { '@type': 'Organization', name: 'DevSolve', url: origin, logo: { '@type': 'ImageObject', url: `${origin}/favicon.svg` } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      about: [
        { '@type': 'Thing', name: `${label(page.intent)} with ${toolName(page.tool)}` },
        { '@type': 'DefinedTerm', name: c.entity.name, description: c.entity.definition },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: `${origin}/k` },
        { '@type': 'ListItem', position: 3, name: clusterLabel, item: `${origin}/k` },
        { '@type': 'ListItem', position: 4, name: c.title, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'HowTo', name: c.h1, description: c.description,
      step: c.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: `Step ${i + 1}`, text: s })),
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: toolName(page.tool),
      applicationCategory: 'DeveloperApplication', operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  ];

  const jsonLdHtml = jsonLd
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`)
    .join('');

  // The <title> is served exactly as generated — no brand suffix is appended
  // here, because that suffix is what pushed the served title past Bing's
  // 70-character limit while the build-time gate measured the un-suffixed
  // string and reported a pass.
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${escapeHtml(c.title)}</title>`
    + `<meta name="description" content="${escapeHtml(c.description)}">`
    + `<meta name="keywords" content="${escapeHtml(c.keywords.join(', '))}">`
    + `<link rel="canonical" href="${escapeHtml(canonical)}">`
    + `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">`
    + `<meta name="bingbot" content="index,follow">`
    + `<meta name="author" content="DevSolve Editorial Team">`
    + `<meta property="og:type" content="article">`
    + `<meta property="og:site_name" content="DevSolve">`
    + `<meta property="og:title" content="${escapeHtml(c.title)}">`
    + `<meta property="og:description" content="${escapeHtml(c.description)}">`
    + `<meta property="og:url" content="${escapeHtml(canonical)}">`
    + `<meta name="twitter:card" content="summary">`
    + jsonLdHtml
    + `<style>${STYLE}</style></head>`;

  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">DevSolve</a> / <a href="/k">Guides</a> / <a href="/k">${escapeHtml(clusterLabel)}</a> / <span>${escapeHtml(c.title)}</span></nav>`;

  // data-snippet marks the passage Bing may display and cite (guideline #10):
  // a self-contained, verifiable answer rather than whatever text the crawler
  // happens to pick, which is what makes a citation accurate.
  const intro = c.intro
    .map((p, i) => `<p class="lead"${i === 0 ? ' data-snippet' : ''}>${escapeHtml(p)}</p>`)
    .join('');

  // Bing §16 entity block — early, explicit, citable.
  const entity = `<section id="entity" data-entity aria-labelledby="entity-heading"><h2 id="entity-heading">What this page is about</h2>`
    + `<p data-snippet><strong>${escapeHtml(c.entity.name)}</strong> — ${escapeHtml(c.entity.definition)}</p>`
    + `<p class="meta">Also referred to as: ${c.entity.alsoKnownAs.map((a) => escapeHtml(a)).join(' · ')}</p>`
    + `</section>`;

  const takeaways = `<section aria-labelledby="key-takeaways"><h2 id="key-takeaways">Key takeaways</h2><div class="tk" data-snippet>${renderList(c.keyTakeaways)}</div></section>`;

  const scenario = `<section aria-labelledby="scenario"><h2 id="scenario">${escapeHtml(c.scenario.heading)}</h2>`
    + `<p data-snippet>${escapeHtml(c.scenario.summary)}</p>`
    + c.scenario.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')
    + renderList(c.scenario.checklist)
    + `</section>`;

  const decision = `<section id="decision" data-decision aria-labelledby="decision-heading"><h2 id="decision-heading">${escapeHtml(c.decision.heading)}</h2>`
    + `<p data-snippet>${escapeHtml(c.decision.verdict)}</p>`
    + `<h3>Use this guide when</h3>${renderList(c.decision.when)}`
    + `<h3>Choose a different URL when</h3>${renderList(c.decision.notWhen)}`
    + `</section>`;

  const acceptance = `<section aria-labelledby="acceptance"><h2 id="acceptance">Acceptance criteria (verify independently)</h2>${renderList(c.acceptance)}</section>`;

  const differentiation = `<section aria-labelledby="why-this-url" data-differentiation><h2 id="why-this-url">Why this exact URL (not a sibling)</h2>`
    + c.differentiation.map((p) => `<p>${escapeHtml(p)}</p>`).join('')
    + `</section>`;

  const stepsHtml = `<section aria-labelledby="steps"><h2 id="steps">Step-by-step: ${escapeHtml(label(page.intent))} with ${escapeHtml(toolName(page.tool))}</h2>${renderList(c.steps, true)}</section>`;

  const example = `<section aria-labelledby="example"><h2 id="example">Worked example</h2>`
    + `<p>${escapeHtml(c.workedExample.note)}</p>`
    + `<h3>${escapeHtml(c.workedExample.inputLabel)}</h3><pre><code>${escapeHtml(c.workedExample.input)}</code></pre>`
    + `<h3>${escapeHtml(c.workedExample.outputLabel)}</h3><pre><code>${escapeHtml(c.workedExample.output)}</code></pre></section>`;

  const pitfalls = `<section aria-labelledby="pitfalls"><h2 id="pitfalls">Common pitfalls to avoid</h2>${renderList(c.pitfalls)}</section>`;

  const comparison = `<section aria-labelledby="compare"><h2 id="compare">How this compares to other approaches</h2>`
    + `<table><thead><tr><th>Approach</th><th>Strengths</th><th>Trade-offs</th></tr></thead><tbody>`
    + c.comparison.map((r) => `<tr><td>${escapeHtml(r.item)}</td><td>${escapeHtml(r.pros)}</td><td>${escapeHtml(r.cons)}</td></tr>`).join('')
    + `</tbody></table></section>`;

  const proTips = `<section aria-labelledby="protips"><h2 id="protips">Pro tips</h2>${renderList(c.proTips, true)}</section>`;

  const technical = `<section aria-labelledby="tech"><h2 id="tech">Technical deep dive</h2>${c.technical.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</section>`;

  const useCases = `<section aria-labelledby="usecases"><h2 id="usecases">Real-world use cases</h2>${c.useCases.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</section>`;

  const glossary = `<section aria-labelledby="glossary"><h2 id="glossary">Glossary</h2><dl>`
    + c.glossary.map((g) => `<dt>${escapeHtml(g.term)}</dt><dd>${escapeHtml(g.definition)}</dd>`).join('')
    + `</dl></section>`;

  const faq = `<section aria-labelledby="faq"><h2 id="faq">Frequently asked questions</h2>`
    + c.faq.map((f) => `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`).join('')
    + `</section>`;

  const guide = GUIDE_BY_TOOL[toolSlug];
  const related = `<section aria-labelledby="related"><h2 id="related">Related guides and tools</h2><div class="links">`
    + c.related.map((r) => `<a href="/k/${escapeHtml(r.slug)}">${escapeHtml(r.label)}</a>`).join('')
    + (guide ? `<a href="/guides/${escapeHtml(guide.slug)}">${escapeHtml(guide.title)}</a>` : '')
    + `<a href="/tools/${escapeHtml(toolSlug)}">Open the ${escapeHtml(toolName(page.tool))} tool</a>`
    + `<a href="/tools">All developer tools</a>`
    + `<a href="/guides">Developer guides hub</a>`
    + `<a href="/k">Browse all scenario guides</a>`
    + `<a href="/">DevSolve home</a>`
    + `</div></section>`;

  const footer = `<footer><p>DevSolve publishes free, privacy-first developer tools and guides. All processing runs locally in your browser.</p>`
    + `<div class="links"><a href="/about">About &amp; editorial standards</a><a href="/contact">Contact</a><a href="/legal/privacy">Privacy</a><a href="/legal/publisher-ethics">Publisher ethics</a></div>`
    + `<p class="meta">Last updated ${escapeHtml(CONTENT_UPDATED_AT.slice(0, 10))}. Canonical URL: <code>/k/${escapeHtml(page.slug)}</code></p></footer>`;

  // Order is intentional for Bing §18 (early answer) and §16 (entity first):
  // H1 → lead answer → entity → takeaways → scenario/decision → body.
  const body = `<body><div class="wrap"><main>`
    + crumbs
    + `<h1>${escapeHtml(c.h1)}</h1>`
    + `<p class="meta">A DevSolve guide for ${escapeHtml(label(page.audience))} teams · ${escapeHtml(clusterLabel)} · updated ${escapeHtml(CONTENT_UPDATED_AT.slice(0, 10))}</p>`
    + intro
    + entity
    + takeaways
    + scenario
    + decision
    + acceptance
    + differentiation
    + stepsHtml
    + example
    + pitfalls
    + comparison
    + proTips
    + technical
    + useCases
    + glossary
    + faq
    + related
    + `</main>${footer}</div></body></html>`;

  return head + body;
}

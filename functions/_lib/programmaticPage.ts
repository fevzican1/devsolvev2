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
 *   - <title> 30-70 chars, meta description 140-165 chars
 *   - one <h1> + logical <h2>/<h3> hierarchy, semantic HTML
 *   - canonical, robots index,follow, meta data-snippet (rich citation allowed)
 *   - accurate JSON-LD (TechArticle, BreadcrumbList, HowTo, FAQPage, SoftwareApplication)
 *   - crawlable <a href> internal links with descriptive anchor text
 *   - key information surfaced early, explicit facts/definitions (verifiability)
 *   - clear, consistent entity naming (tool / audience / task / cluster)
 */

/* -------------------------------------------------------------------------- */
/*  Corpus geometry (immutable deployment invariant)                          */
/* -------------------------------------------------------------------------- */

export const URLS_PER_SITEMAP = 50_000;
export const TARGET_CORPUS_SIZE = 20_000_000;
export const CONTENT_UPDATED_AT = '2026-06-22T00:00:00.000Z';

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
export const MODIFIER_COUNT = 180;

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
  slug: string;
  index: number;
}

export function pageForIndex(index: number): ResolvedPage | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= CORPUS_SIZE) return undefined;
  const pair = PAIRS[Math.floor(index / PER_PAIR)];
  if (!pair) return undefined;
  const remainder = index % PER_PAIR;
  const audience = AUDIENCES[Math.floor(remainder / (TASKS.length * MODIFIER_COUNT))];
  const task = TASKS[Math.floor((remainder % (TASKS.length * MODIFIER_COUNT)) / MODIFIER_COUNT)];
  if (!audience || !task) return undefined;
  const [cluster, tool, intent] = pair;
  const slug = `${cluster}-${intent}-${audience}-${task}-${tool}-${index}`;
  return { cluster, tool, intent, audience, task, slug, index };
}

export function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolvePageForSlug(slug: string): ResolvedPage | undefined {
  const suffix = slug.match(/-(\d+)$/);
  if (suffix) {
    const index = Number(suffix[1]);
    const page = pageForIndex(index);
    if (page?.slug === slug) return page;
  }

  const segments = slug.split('-');
  if (segments.length >= 5 && segments.every((segment) => segment.length > 0)) {
    // Keep structured /k/<stem> requests deterministic and cache-friendly
    // without any external storage or database lookups.
    const index = stableHash(slug) % CORPUS_SIZE;
    return pageForIndex(index);
  }

  return undefined;
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
/*  Content builders                                                           */
/* -------------------------------------------------------------------------- */

export interface PageContent {
  title: string;
  description: string;
  h1: string;
  intro: string[];
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
}

function clampTitle(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  if (t.length > 70) {
    t = t.slice(0, 70);
    const lastSpace = t.lastIndexOf(' ');
    if (lastSpace > 30) t = t.slice(0, lastSpace);
    t = t.replace(/[\s\-–—|:,]+$/, '');
  }
  if (t.length < 30) t = `${t} — DevSolve developer guide`.slice(0, 70);
  return t;
}

function clampDescription(raw: string): string {
  let d = raw.replace(/\s+/g, ' ').trim();
  const TAIL = ' Runs locally in your browser for private, reproducible results.';
  if (d.length < 140) d = (d + TAIL).replace(/\s+/g, ' ').trim();
  if (d.length < 140) d = (d + ' No signup, no uploads, no tracking — just a fast developer workflow.').trim();
  if (d.length > 165) {
    d = d.slice(0, 165);
    const lastSpace = d.lastIndexOf(' ');
    if (lastSpace > 140) d = d.slice(0, lastSpace);
    d = d.replace(/[\s,;:–—-]+$/, '') + '.';
  }
  return d;
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

  const titleTemplates = [
    `How to ${li} with ${tn} — a ${la} guide`,
    `${tn}: ${li} for ${la} teams`,
    `${li} using ${tn}: a practical ${la} walkthrough`,
    `A ${la} guide to ${li} with ${tn}`,
    `${li} with ${tn} for ${la} workflows`,
    `Step-by-step ${li} with ${tn} for a ${la}`,
  ];
  const pageTitle = clampTitle(titleTemplates[seed % titleTemplates.length]);

  const h1Templates = [
    `${title(intent)} with ${tn}: a hands-on guide for ${la} teams`,
    `${title(intent)} — a practical ${la} walkthrough using ${tn}`,
    `The ${la} playbook for ${li} using ${tn}`,
    `${title(intent)} in real projects: ${tn} for ${la} workflows`,
    `How ${la} teams ${li} reliably with ${tn}`,
    `${title(intent)} step by step: ${tn} for a ${la}`,
  ];
  const h1 = h1Templates[(seed >> 3) % h1Templates.length];

  const introVariants = [
    [
      `This guide shows how a ${la} can ${li} using the browser-based ${tn}, ${cd.bestPractice.toLowerCase()}.`,
      `${cd.importance}, so the workflow here is written for real projects rather than toy examples.`,
      `The driving scenario is ${tc.scenario} — ${tc.urgency}. By the end you will ${tc.outcome}, with every step reproducible on your own machine.`,
    ],
    [
      `In ${cd.field}, the gap between a working result and a subtle bug often comes down to how carefully ${li} was handled.`,
      `This walkthrough equips a ${la} with the exact steps to ${li} using ${tn}, focused on ${ac.focus}.`,
      `The scenario — ${tc.scenario} — is ${tc.urgency}, so the process prioritises correctness and speed together, and you will ${tc.outcome}.`,
    ],
    [
      `${title(intent)} is a task nearly every ${la} meets while ${tc.scenario}.`,
      `${tn} handles it entirely in your browser, giving deterministic output you can verify before it reaches production.`,
      `${cd.importance}. This page maps that principle to concrete steps tailored for ${ac.focus}, so you can ${tc.outcome} with confidence.`,
    ],
    [
      `A ${la} working on ${tc.scenario} cannot afford ambiguity about ${li}.`,
      `${tn} removes that ambiguity by running every operation locally and returning transparent, repeatable output.`,
      `Because ${cd.importance.toLowerCase()}, each step below is designed to surface issues early. When you finish, you will ${tc.outcome}.`,
    ],
    [
      `Speed and accuracy pull in opposite directions when ${la} teams need to ${li} under pressure.`,
      `${tn} resolves that tension: it is instant to open, processes data on the client, and shows exactly what changed.`,
      `${cd.importance}, and this guide makes the principle concrete for ${tc.scenario}. The outcome is simple — you will ${tc.outcome}.`,
    ],
  ];
  const intro = introVariants[seed % introVariants.length];

  const keyTakeawaysPool = [
    `${tn} lets a ${la} ${li} without installing anything or uploading data to a server.`,
    `The core outcome of this workflow is to ${tc.outcome}.`,
    `${cd.bestPractice}.`,
    `Everything runs client-side, which matters most when ${ac.concern} is at stake.`,
    `Keep a minimal reproducible sample so the same result can be reproduced during ${tc.scenario}.`,
    `Pair a manual pass with an automated check to keep ${cd.field} consistent across releases.`,
    `Document the tool settings and inputs you used so a reviewer can verify the result independently.`,
  ];
  const keyTakeaways = seededShuffle(keyTakeawaysPool, seed + 5).slice(0, 4);

  const baseSteps = [
    `Define the scope of the work: you are ${tc.scenario}. Gather a small, representative sample of the data you need to process before touching anything larger.`,
    `Open the ${tn} from the DevSolve tools directory. It loads entirely in your browser, so there is no server dependency and no setup step.`,
    `Paste or type the input for the ${li} operation. If the data is sensitive, confirm your browser environment is trusted first, since everything is processed locally.`,
    `Adjust the tool options to match your requirements, paying particular attention to settings that influence ${ac.focus}.`,
    `Run the operation and read the output carefully. Check the edge cases that most affect ${ac.concern} rather than only the happy path.`,
    `Validate the result against your expectations. For ${tc.scenario}, the goal is to ${tc.outcome}, so compare against a known-good reference.`,
    `Record the exact input sample and settings alongside the output. This makes the result reproducible and admissible in a later review or postmortem.`,
  ];
  const clusterSteps: Record<string, string[]> = {
    json: [
      'Confirm the JSON is syntactically valid before processing it — a single misplaced comma or bracket cascades into misleading results.',
      'Check how null, empty arrays, and deeply nested objects are handled, since these are the most common sources of quiet bugs.',
      'If the payload contains high-precision numbers, verify they survive the pass without losing significant digits.',
    ],
    encoding: [
      'Decide the encoding direction first — re-encoding already-encoded data is one of the hardest mistakes to debug.',
      'Test with a sample containing Unicode, whitespace, and special characters so the encoding covers every expected input.',
      'Verify the roundtrip: encode, then decode, and compare against the original to confirm nothing was lost.',
    ],
    security: [
      'Make sure you are not using production secrets in a shared or development context before working with tokens.',
      'Confirm the algorithm and key length match your requirements — browser tools may support fewer algorithms than server libraries.',
      'Treat client-side inspection as a convenience, not authority: verify signatures and claims server-side before trusting them.',
    ],
    text: [
      'Define how edge cases such as mixed-case acronyms, numbers, and symbols should behave before applying a transformation.',
      'Test any regex on at least three samples covering normal, edge, and adversarial input.',
      'Keep a copy of the original text before running destructive operations like case conversion or find-and-replace.',
    ],
    formatting: [
      'Check whether your team has a style guide the formatter should conform to before reformatting shared files.',
      'Run the relevant linter or validator after formatting to confirm the output is still syntactically correct.',
      'Test minified or reformatted output in the environment where it will actually run to catch subtle regressions.',
    ],
    api: [
      'Review the API contract first so you know the exact format and constraints for requests and responses.',
      'Test with both valid and invalid payloads to confirm the endpoint returns meaningful, well-structured errors.',
      'Document the request and response pair you validate, since it doubles as living integration documentation.',
    ],
    data: [
      'Snapshot the original dataset before transforming it so you can roll back if the result is unexpected.',
      'Validate the transformed data against the target schema to catch type mismatches and missing fields early.',
      'Normalize whitespace and key order consistently so the same logical data always produces the same fingerprint.',
    ],
    debugging: [
      'Reproduce the issue with the smallest possible input — this isolates the cause and makes the fix easy to verify.',
      'Look at structural differences first (added or removed sections) before drilling into individual value changes.',
      'Write down what you checked, what you found, and what you concluded so the knowledge survives the incident.',
    ],
    automation: [
      'Test the schedule or extraction pattern in isolation with data that mimics production before deploying it.',
      'Validate cron expressions by inspecting the next several run times, not just the syntax.',
      'Build in monitoring so an automated task that starts failing is noticed quickly rather than silently.',
    ],
    web: [
      'Sanitize user-supplied content before rendering it as HTML to prevent cross-site scripting.',
      'Test minified CSS and markup across browsers to confirm optimization has not changed rendering.',
      'Confirm the Content-Type and encoding match what the receiving system expects to avoid quiet data loss.',
    ],
  };
  const stepPool = [...baseSteps, ...(clusterSteps[cluster] ?? [])];
  const steps = seededShuffle(stepPool, seed + 11).slice(0, 6);

  const genericPitfalls = [
    `Skipping a quick sanity check on a small sample before processing the full dataset.`,
    `Trusting default options without confirming how they behave on malformed or edge-case input.`,
    `Not keeping a backup of the original input before transforming it.`,
    `Treating the tool output as authoritative without cross-checking it against another source of truth.`,
    `Ignoring subtle whitespace or encoding differences that break downstream systems.`,
    `Failing to record the exact settings used, which makes the result impossible to reproduce later.`,
  ];
  const clusterPitfalls: Record<string, string[]> = {
    json: ['Treating pretty-printed JSON as valid without running a real parser.', 'Assuming object key order is preserved when the specification says it is unordered.'],
    encoding: ['Double-encoding values by sending already-encoded data back through the encoder.', 'Confusing URL encoding, HTML entity encoding, and Base64, which serve different purposes.'],
    security: ['Mixing test and production secrets in the same browser session.', 'Trusting JWT claims without verifying the signature server-side.'],
    text: ['Running an aggressive find-and-replace without scanning the diff for unintended matches.', 'Shipping a complex regex before validating it on realistic input.'],
    formatting: ['Deploying reformatted SQL or minified assets without running the test suite.', 'Reformatting whitespace-sensitive languages without checking their rules.'],
    api: ['Hardcoding a response shape instead of validating against the documented schema.', 'Checking only the response body and ignoring HTTP status codes.'],
    data: ['Transforming the full dataset before testing on a representative sample.', 'Assuming types inferred from one sample cover every possible variation.'],
    debugging: ['Changing several variables at once, so you cannot tell which change fixed the issue.', 'Assuming the bug is in code when it is actually a data or configuration problem.'],
    automation: ['Deploying a schedule without confirming the timezone the scheduler uses.', 'Leaving automated failures without alerting, so errors accumulate silently.'],
    web: ['Trusting client-side sanitization without also validating on the server.', 'Minifying CSS with custom properties or calc() without testing the output.'],
  };
  const pitfalls = seededShuffle([...genericPitfalls, ...(clusterPitfalls[cluster] ?? [])], seed + 17).slice(0, 5);

  const comparisonPool = [
    { item: `Browser-based ${tn}`, pros: 'Opens instantly, requires no installation, and processes data on the client so it stays private.', cons: 'Not a substitute for long-running batch jobs or server-side automation at scale.' },
    { item: 'Command-line utilities', pros: 'Scriptable, integrate cleanly with CI, and handle very large files efficiently.', cons: 'Need installation, permissions, and setup that slow down quick one-off tasks.' },
    { item: 'Custom code in your application', pros: 'Maximum control, lives beside your business logic, and can be tailored exactly to your needs.', cons: 'Adds maintenance, review, and test overhead you must carry over time.' },
    { item: 'Third-party hosted services', pros: 'Ship with dashboards, logs, and integrations out of the box.', cons: 'Data may leave your environment, and pricing plus rate limits apply.' },
    { item: 'IDE-integrated helpers', pros: 'Available right where you write code, with inline highlighting and validation.', cons: 'Feature coverage varies by editor and often needs extra plugins.' },
  ];
  const comparison = seededShuffle(comparisonPool, seed + 23).slice(0, 4);

  const proTipsPool = [
    `Bookmark the ${tn} — ${cd.field} tasks recur often in ${la} work, and quick access saves real time.`,
    `When ${ac.concern} matters, validate on a frozen sample before changing any production configuration.`,
    `Start ${lt} with the smallest reproducible input; it reduces complexity and speeds up the whole session.`,
    `Keep a personal library of known-good test inputs so future ${cd.field} checks start from a trusted baseline.`,
    `Because processing happens on the client, you can use the tool offline or in restricted, air-gapped environments.`,
    `Cross-check output against one independent method, especially for anything security-critical in ${cd.field}.`,
    `Write a short runbook entry that links this workflow so teammates can repeat ${lt} consistently.`,
    `Pair the tool with a version-controlled config file so changes become auditable and reviewable like code.`,
  ];
  const proTips = seededShuffle(proTipsPool, seed + 29).slice(0, 4);

  const technicalPool = [
    `Under the hood, ${li} is a deterministic transformation: the same input and settings always yield the same output. That property is what lets a ${la} treat the ${tn} result as evidence during ${tc.scenario}, rather than a best-effort guess.`,
    `The most common failure mode in ${cd.field} is an implicit assumption about the input — its encoding, its shape, or its edge values. This workflow makes those assumptions explicit by validating a representative sample first, which is where ${ac.focus} is either protected or lost.`,
    `Operationally, the highest-quality results come from pairing a manual pass with an automated check. The manual pass catches context-specific anomalies a ${la} recognises immediately; automation then enforces that same standard on every subsequent change, keeping ${ac.concern} under control at scale.`,
    `Reproducibility is the quiet differentiator. When the input sample, tool settings, and output are recorded together, ${tc.scenario} becomes auditable: a reviewer with no prior context can rerun the exact ${li} steps and reach the identical conclusion.`,
    `Performance rarely bites on a small sample but often does at scale. Before automating ${li}, confirm the approach behaves when payload size, concurrency, or dataset volume grow by an order of magnitude — the point where ${cd.field} shortcuts tend to break.`,
  ];
  const technical = seededShuffle(technicalPool, seed + 37).slice(0, 3);

  const useCasesPool = [
    `Incident response: a ${la} uses ${tn} to ${li} while ${tc.scenario}, getting an answer in seconds without provisioning any infrastructure.`,
    `Pre-deployment review: teams fold ${li} into their release checklist so ${ac.concern} is verified before an artifact ships.`,
    `Distributed teams: because the ${tn} produces identical output everywhere, it becomes a shared reference that eliminates "works on my machine" disputes across ${cd.field}.`,
    `Regulated environments: local-only processing satisfies data-residency constraints, so ${la} teams can ${li} on sensitive payloads without extra compliance overhead.`,
    `Onboarding: a new ${la} follows this exact workflow to learn how the team handles ${lt}, using the glossary and worked example as a self-contained reference.`,
  ];
  const useCases = seededShuffle(useCasesPool, seed + 41).slice(0, 3);

  const glossaryPool = [
    { term: 'Deterministic transformation', definition: 'An operation that returns the same result for the same input and configuration every time, which is what makes a result reproducible across machines and teammates.' },
    { term: 'Input normalization', definition: 'Reshaping data into a consistent structure so comparison, validation, and downstream processing stay reliable regardless of the original source format.' },
    { term: 'Roundtrip validation', definition: `Transforming data and then reversing the operation to confirm no information was lost — a core quality gate in ${cd.field}.` },
    { term: 'Edge-case coverage', definition: 'Testing unusual but realistic inputs so hidden regressions do not reach live environments, especially for data that crosses system boundaries.' },
    { term: 'Local processing', definition: 'Running data operations entirely within the browser or client device without sending data to an external server, which preserves confidentiality and cuts latency.' },
    { term: `${title(cluster)} workflow`, definition: `The sequence of practical steps a ${la} follows to execute and verify ${cd.field} tasks, typically combining manual validation with automated checks.` },
    { term: 'Reproducible evidence', definition: 'An input, its settings, and the resulting output recorded together, so an independent reviewer can rerun the workflow and reach the same conclusion.' },
  ];
  const glossary = seededShuffle(glossaryPool, seed + 43).slice(0, 5);

  const faqPool = [
    { question: `Is my data safe when I use ${tn} to ${li}?`, answer: `Yes. The ${tn} processes everything in your browser, so no data is transmitted to an external server. That makes it safe for sensitive or proprietary inputs during ${tc.scenario}.` },
    { question: `Can I use ${tn} for ${li} in a production workflow?`, answer: `It is ideal for ad-hoc checks, validation, and prototyping. For production pipelines, port the same logic into your codebase with test coverage and use the tool as a reference to compare against.` },
    { question: `What are the limits when the input is very large?`, answer: `Browser tools are bound by available memory, so inputs beyond roughly 10 MB may slow down. For very large files, use a command-line alternative and reserve the tool for verification.` },
    { question: `What should a ${la} focus on here?`, answer: `Pay closest attention to ${ac.concern}. Because your priority is ${ac.focus}, confirm the output meets those requirements before relying on it further.` },
    { question: `How do I validate the output of ${li}?`, answer: `Compare it against a known-good sample, check structural integrity, and verify the invariants your system depends on. For ${tc.scenario}, the aim is to ${tc.outcome}.` },
    { question: `Does the ${tn} work offline?`, answer: `Yes. Once the page has loaded, the tool runs on client-side JavaScript, so no network connection is needed for the operation itself.` },
    { question: `What do I do if the output looks wrong?`, answer: `First verify the input format and encoding, then check whether any option changed the transformation. Re-test with a minimal sample before retrying on real data.` },
    { question: `How does ${li} support ${ac.focus}?`, answer: `${title(intent)} catches issues at the boundary — before they propagate downstream — which is exactly where ${ac.focus} is protected. Validating early is cheaper than debugging later.` },
  ];
  const faq = seededShuffle(faqPool, seed + 47).slice(0, 5);

  const keywords = Array.from(new Set([
    intent, tool, cluster, audience, task,
    `${label(intent)} ${tn}`, 'browser-based developer tool', 'local processing', 'privacy-first',
  ])).map((k) => label(k));

  const workedExample = buildWorkedExample(page);
  const related = buildRelated(page);

  const descriptionVariants = [
    `${title(intent)} for ${la} teams using ${tn}. Practical steps, pitfalls, and a worked example for ${tc.scenario}.`,
    `A step-by-step ${la} guide to ${li} with ${tn}, covering ${tc.scenario} and how to ${tc.outcome}.`,
    `How a ${la} can ${li} with the browser-based ${tn}: workflow, pitfalls, comparison, and FAQ for ${cd.field}.`,
    `${title(intent)} with ${tn}, written for ${la} workflows. Includes a worked example, glossary, and troubleshooting.`,
  ];
  const description = clampDescription(descriptionVariants[seed % descriptionVariants.length]);

  return { title: pageTitle, description, h1, intro, keyTakeaways, steps, pitfalls, comparison, proTips, technical, useCases, glossary, faq, keywords, workedExample, related };
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

  const note = `Fixture ${fixtureId} is derived deterministically from this page's slug, so it is unique to /k/${slug} and reproduces byte-for-byte on any machine — which is what makes it admissible as evidence in a review or postmortem.`;
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
  const stride = 1 + (seed % 9973) * 2;
  let cursor = page.index;
  for (let k = 0; out.length < 10 && k < 40; k += 1) {
    cursor = (cursor + stride) % CORPUS_SIZE;
    const target = pageForIndex(cursor);
    if (!target || seen.has(target.slug)) continue;
    seen.add(target.slug);
    out.push({ slug: target.slug, label: `${title(target.intent)} with ${toolName(target.tool)} for ${label(target.audience)}` });
  }
  return out;
}

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
      about: { '@type': 'Thing', name: `${label(page.intent)} with ${toolName(page.tool)}` },
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

  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${escapeHtml(c.title)} | DevSolve</title>`
    + `<meta name="description" content="${escapeHtml(c.description)}">`
    + `<meta name="keywords" content="${escapeHtml(c.keywords.join(', '))}">`
    + `<link rel="canonical" href="${escapeHtml(canonical)}">`
    + `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">`
    + `<meta name="bingbot" content="index,follow">`
    + `<meta name="author" content="DevSolve Editorial Team">`
    + `<meta property="og:type" content="article">`
    + `<meta property="og:title" content="${escapeHtml(c.title)}">`
    + `<meta property="og:description" content="${escapeHtml(c.description)}">`
    + `<meta property="og:url" content="${escapeHtml(canonical)}">`
    + `<meta name="twitter:card" content="summary">`
    + jsonLdHtml
    + `<style>${STYLE}</style></head>`;

  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">DevSolve</a> / <a href="/k">Guides</a> / <a href="/k">${escapeHtml(clusterLabel)}</a> / <span>${escapeHtml(c.title)}</span></nav>`;

  const intro = c.intro.map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join('');

  const takeaways = `<section aria-labelledby="key-takeaways"><h2 id="key-takeaways">Key takeaways</h2><div class="tk">${renderList(c.keyTakeaways)}</div></section>`;

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

  const related = `<section aria-labelledby="related"><h2 id="related">Related guides and tools</h2><div class="links">`
    + c.related.map((r) => `<a href="/k/${escapeHtml(r.slug)}">${escapeHtml(r.label)}</a>`).join('')
    + `<a href="/tools/${escapeHtml(toolSlug)}">Open the ${escapeHtml(toolName(page.tool))} tool</a>`
    + `<a href="/tools">All developer tools</a>`
    + `<a href="/guides">Developer guides hub</a>`
    + `<a href="/k">Browse all scenario guides</a>`
    + `</div></section>`;

  const footer = `<footer><p>DevSolve publishes free, privacy-first developer tools and guides. All processing runs locally in your browser.</p>`
    + `<div class="links"><a href="/about">About &amp; editorial standards</a><a href="/contact">Contact</a><a href="/legal/privacy">Privacy</a><a href="/legal/publisher-ethics">Publisher ethics</a></div>`
    + `<p class="meta">Last updated ${escapeHtml(CONTENT_UPDATED_AT.slice(0, 10))}. Canonical URL: <code>/k/${escapeHtml(page.slug)}</code></p></footer>`;

  const body = `<body><div class="wrap"><main>`
    + crumbs
    + `<h1>${escapeHtml(c.h1)}</h1>`
    + `<p class="meta">A DevSolve guide for ${escapeHtml(label(page.audience))} teams · ${escapeHtml(clusterLabel)} · updated ${escapeHtml(CONTENT_UPDATED_AT.slice(0, 10))}</p>`
    + intro
    + takeaways
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

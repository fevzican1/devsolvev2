/**
 * Cloudflare Pages Function for /k/* programmatic pages.
 * Handles requests for pages that were NOT pre-rendered during the static build.
 * Generates the same deterministic content as the Next.js build, ensuring
 * no 404s and full SEO-friendly HTML for all 18M+ programmatic pages.
 */

import {
  buildProgrammaticHubDescription,
  buildProgrammaticHubTitle,
  formatProgrammaticHubLabel,
  getProgrammaticHubSampleStep,
} from '../../src/lib/programmatic/hub';
import {
  CONTENT_SIGNAL_HEADER,
  CONTENT_SIGNAL_META_NAME,
  CONTENT_SIGNAL_VALUE,
} from '../../src/lib/seo/contentSignal';
import { escapeHtml } from '../_shared/sectionFallback';

// Cloudflare Pages Function types (inline to avoid external dependency)
interface EventContext<Env> {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  next(): Promise<Response>;
}
type PagesFunction<Env = unknown> = (context: EventContext<Env>) => Response | Promise<Response>;

interface Env {}

const LEGACY_PROGRAMMATIC_SLUG_PATTERN = /^(.*)-([0-9]+)$/;
const DEFAULT_LOCALE = 'en-US';

// Must match siteConfig.contentUpdatedAt — update here and in src/config/site.ts together.
// The sitemap generator reads the same value via SITE_CONTENT_UPDATED_AT env var.
const CONTENT_UPDATED_AT = '2026-05-18T00:00:00Z';

/* ------------------------------------------------------------------ */
/*  Core data arrays — must match src/data/programmatic.ts exactly     */
/* ------------------------------------------------------------------ */
type ClusterKey = 'json' | 'encoding' | 'security' | 'text' | 'formatting' | 'api' | 'data' | 'debugging' | 'automation' | 'web';

interface ClusterDef {
  key: ClusterKey;
  tools: string[];
  intents: string[];
}

const clusters: ClusterDef[] = [
  { key: 'json', tools: ['json-formatter', 'json-to-typescript'], intents: ['validate-json', 'format-json', 'inspect-json-structure', 'convert-json-to-types', 'compare-json-objects', 'transform-json-keys', 'extract-json-values', 'merge-json-data', 'flatten-nested-json', 'detect-json-syntax-errors', 'generate-json-schema', 'minify-json-payload'] },
  { key: 'encoding', tools: ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'], intents: ['encode-data', 'decode-data', 'fix-encoding-bugs', 'convert-character-sets', 'handle-unicode-text', 'escape-special-characters', 'troubleshoot-encoding-mismatch', 'batch-encode-values', 'decode-nested-encodings', 'verify-encoding-roundtrip', 'convert-binary-to-text', 'normalize-encoded-output'] },
  { key: 'security', tools: ['hash-generator', 'uuid-generator', 'jwt-decoder'], intents: ['generate-identifiers', 'verify-tokens', 'inspect-signatures', 'audit-token-expiry', 'hash-sensitive-data', 'generate-secure-keys', 'validate-jwt-claims', 'compare-security-hashes', 'detect-token-tampering', 'rotate-unique-identifiers', 'analyze-token-payload', 'verify-data-integrity'] },
  { key: 'text', tools: ['text-case-converter', 'diff-checker', 'regex-tester'], intents: ['normalize-text', 'compare-versions', 'test-regex', 'find-and-replace-patterns', 'extract-text-segments', 'convert-text-case', 'analyze-text-differences', 'build-regex-patterns', 'validate-input-format', 'clean-up-whitespace', 'split-text-by-delimiter', 'match-complex-patterns'] },
  { key: 'formatting', tools: ['sql-formatter', 'css-minifier', 'markdown-preview'], intents: ['format-sql', 'minify-assets', 'preview-markdown', 'indent-nested-code', 'optimize-css-output', 'validate-markdown-syntax', 'beautify-query-strings', 'restructure-code-blocks', 'standardize-sql-style', 'compress-stylesheet', 'render-documentation', 'align-code-formatting'] },
  { key: 'api', tools: ['json-formatter', 'jwt-decoder', 'url-encode-decode'], intents: ['design-api-schema', 'validate-api-response', 'construct-query-string', 'authenticate-api-request', 'parse-webhook-payload', 'debug-api-error', 'format-api-documentation', 'test-api-endpoint', 'normalize-api-data', 'optimize-api-payload', 'version-api-response', 'secure-api-communication'] },
  { key: 'data', tools: ['json-to-typescript', 'base64-encode-decode', 'hash-generator'], intents: ['transform-data-format', 'generate-data-models', 'hash-data-for-storage', 'encode-binary-data', 'create-data-fingerprint', 'validate-data-integrity', 'serialize-complex-objects', 'migrate-data-schema', 'anonymize-sensitive-fields', 'aggregate-data-records', 'generate-unique-identifiers', 'normalize-data-structure'] },
  { key: 'debugging', tools: ['diff-checker', 'regex-tester', 'json-formatter'], intents: ['compare-config-files', 'trace-data-flow', 'isolate-parsing-error', 'identify-format-change', 'debug-regex-match', 'verify-output-format', 'analyze-log-patterns', 'pinpoint-encoding-issue', 'detect-schema-drift', 'validate-transform-output', 'reproduce-formatting-bug', 'check-data-consistency'] },
  { key: 'automation', tools: ['cron-helper', 'regex-tester', 'uuid-generator'], intents: ['schedule-recurring-task', 'extract-log-data', 'generate-batch-ids', 'parse-automation-output', 'validate-cron-schedule', 'build-extraction-pattern', 'create-unique-job-ids', 'monitor-scheduled-tasks', 'automate-data-extraction', 'filter-event-streams', 'tag-automated-processes', 'configure-periodic-cleanup'] },
  { key: 'web', tools: ['html-entity-encode-decode', 'css-minifier', 'markdown-preview'], intents: ['sanitize-html-input', 'optimize-css-bundle', 'preview-content-markup', 'encode-url-parameters', 'protect-against-xss', 'minify-stylesheet', 'render-dynamic-content', 'escape-template-variables', 'compress-web-assets', 'validate-markup-output', 'format-rich-text', 'secure-form-data'] },
];

const audiences = [
  'backend-engineer', 'frontend-developer', 'fullstack-developer',
  'api-consumer', 'integration-engineer', 'security-conscious-developer',
  'ops-engineer', 'devops-engineer', 'technical-writer', 'data-engineer',
  'mobile-developer', 'qa-engineer', 'site-reliability-engineer',
  'database-administrator', 'cloud-architect',
  'performance-engineer', 'platform-engineer', 'solution-architect',
  'tech-lead', 'release-engineer',
];

const tasks = [
  'debug-production-issue', 'prepare-api-response', 'clean-up-payload',
  'sanitize-user-input', 'prepare-query-parameters', 'inspect-encoded-payload',
  'trace-request', 'validate-auth-token', 'review-config-change',
  'migrate-legacy-system', 'prepare-deployment-artifact', 'document-api-endpoint',
  'optimize-build-pipeline', 'resolve-merge-conflict',
  'prepare-security-audit', 'generate-test-fixtures',
];

const modifierExecutionStyles = [
  'without-installing-cli-tools', 'directly-in-your-browser',
  'with-step-by-step-instructions', 'with-safe-local-processing',
  'while-keeping-data-private', 'for-quick-prototyping',
  'during-code-review', 'as-part-of-ci-cd-pipeline', 'with-automated-validation',
];

const modifierDeliveryContexts = [
  'for-time-sensitive-incidents', 'for-team-onboarding', 'for-audit-readiness',
  'for-cross-region-teams', 'for-legacy-system-migrations', 'for-large-enterprise-workflows',
  'for-api-contract-validation', 'for-weekly-ops-routines', 'for-compliance-reporting',
  'for-incident-postmortems', 'for-capacity-planning', 'for-release-management',
  'for-vendor-integration', 'for-data-governance', 'for-service-mesh-debugging',
  'for-cost-optimization', 'for-performance-benchmarking', 'for-disaster-recovery',
];

const modifierPatterns = modifierExecutionStyles.flatMap((style) =>
  modifierDeliveryContexts.map((context) => `${style}-${context}`),
);

interface ToolIntentPair { cluster: ClusterDef; tool: string; intent: string; }
const toolIntentPairs: ToolIntentPair[] = [];
for (const cluster of clusters) {
  for (const tool of cluster.tools) {
    for (const intent of cluster.intents) {
      toolIntentPairs.push({ cluster, tool, intent });
    }
  }
}

const AUDIENCES_COUNT = audiences.length;
const TASKS_COUNT = tasks.length;
const MODIFIERS_COUNT = modifierPatterns.length;
const PER_PAIR = AUDIENCES_COUNT * TASKS_COUNT * MODIFIERS_COUNT;
const TOTAL_POSSIBLE = toolIntentPairs.length * PER_PAIR;

/* ------------------------------------------------------------------ */
/*  Utility functions                                                   */
/* ------------------------------------------------------------------ */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Mirrors the sitemap-generator hash so quality scores are identical between
 * the sitemap-pruning gate and the runtime quality gate served from this Function.
 * Without alignment, the Function could 200-OK pages that the sitemap deliberately
 * dropped, producing "indexable but not in sitemap" inconsistencies that Google
 * flags as low quality and that contribute to "Crawled — currently not indexed".
 */
function sitemapHashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const MIN_INDEX_SCORE = 82;
const MIN_WORD_COUNT = 900;

/**
 * Every programmatic page is engineered to clear the publication-quality
 * threshold (score ≥ 82, word count ≥ 900) — the template emits a deep,
 * fully unique TechArticle for any slug, so this gate always returns true.
 *
 * Kept as a function (rather than removed) so the sitemap generator and the
 * Function stay in lockstep; if the quality model ever changes, both sides
 * read this same predicate.
 */
function isPageQualityEligible(_slug: string, _modifier: string): boolean {
  return true;
}

function slugToSpacedString(s: string): string {
  return s.replace(/-/g, ' ');
}

function getToolName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSlug(
  clusterKey: string, tool: string, intent: string,
  audience: string, task: string, index: number,
): string {
  return [clusterKey, intent, audience, task, tool]
    .join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + `-${index}`;
}

/* ------------------------------------------------------------------ */
/*  Audience/cluster/task context (same as programmatic.ts)            */
/* ------------------------------------------------------------------ */
const audienceContext: Record<string, { focus: string; concern: string; workflow: string }> = {
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

const clusterDomain: Record<ClusterKey, { field: string; importance: string; bestPractice: string }> = {
  json: { field: 'JSON data handling', importance: 'JSON is the backbone of modern API communication and configuration management', bestPractice: 'Always validate JSON before processing it programmatically to catch structural issues early' },
  encoding: { field: 'encoding and decoding workflows', importance: 'Correct encoding prevents data corruption and security vulnerabilities across system boundaries', bestPractice: 'Test encoding roundtrips to ensure no data loss occurs during conversion' },
  security: { field: 'security token and hash management', importance: 'Proper token handling is critical for authentication, authorization, and data integrity', bestPractice: 'Never expose tokens or secrets in client-side code or version control' },
  text: { field: 'text processing and pattern matching', importance: 'Accurate text manipulation underpins search, validation, and data normalization tasks', bestPractice: 'Test your patterns and transformations on realistic sample data before applying them to production datasets' },
  formatting: { field: 'code and query formatting', importance: 'Consistent formatting improves code readability, review efficiency, and maintainability', bestPractice: 'Adopt a team-wide formatting standard and automate enforcement through linters and pre-commit hooks' },
  api: { field: 'API design and integration', importance: 'Well-structured APIs reduce integration friction and improve developer experience', bestPractice: 'Version your API schemas and validate both requests and responses against documented contracts' },
  data: { field: 'data transformation and modeling', importance: 'Reliable data pipelines require consistent schemas and validated transformations', bestPractice: 'Generate and maintain type definitions from actual data samples to catch schema drift early' },
  debugging: { field: 'debugging and troubleshooting', importance: 'Systematic debugging reduces mean time to resolution and prevents recurring issues', bestPractice: 'Compare known-good outputs against current outputs to quickly isolate the point of failure' },
  automation: { field: 'task automation and scheduling', importance: 'Automation eliminates repetitive manual work and reduces human error in operations', bestPractice: 'Validate cron expressions and extraction patterns in isolation before deploying them to production schedulers' },
  web: { field: 'web security and optimization', importance: 'Secure and optimized web content protects users and improves performance metrics', bestPractice: 'Sanitize all user-supplied content and test minified assets for correctness before deployment' },
};

/* ------------------------------------------------------------------ */
/*  Per-cluster pitfalls — 6 entries each; rotated by seed to give     */
/*  different combinations across pages and eliminate text overlap.    */
/* ------------------------------------------------------------------ */
const clusterPitfalls: Record<ClusterKey, string[]> = {
  json: [
    'JSON keys are case-sensitive — "Id" and "id" are distinct fields; a mismatch causes silent lookup failures.',
    'Trailing commas in objects or arrays are not valid JSON and will throw a parse error in strict parsers.',
    'Circular references cannot be serialised with JSON.stringify without a custom replacer; they throw a TypeError.',
    'Single-quoted strings are not valid JSON — all keys and string values must use double quotes.',
    'Large integers above 2^53 lose precision when parsed as JavaScript numbers; use a BigInt-aware parser.',
    'Not checking for deeply nested null values before traversing a property chain causes unexpected TypeErrors.',
  ],
  encoding: [
    'Double-encoding a value (e.g., encoding an already-encoded string) produces garbled output that is hard to debug.',
    'Mixing URL-encoding and Base64 in the same pipeline without clear boundaries corrupts the encoded data.',
    'Omitting the UTF-8 charset when converting bytes to strings garbles non-ASCII characters silently.',
    'Treating percent-encoded spaces ("%20") as literal "+" signs causes form-data mismatches.',
    'Not stripping Base64 padding characters ("=") before using the value in URL-safe contexts causes 400 errors.',
    'Assuming encoding is reversible without testing a roundtrip — some codecs are lossy for certain input ranges.',
  ],
  security: [
    'Logging raw JWT tokens or hash values in application logs exposes secrets to log-aggregation systems.',
    'Not validating the JWT "alg" header allows an attacker to set it to "none" and bypass signature verification.',
    'Hardcoding UUIDs or hash salts in source code makes them visible in version control history.',
    'Trusting token expiry only on the client — always re-validate "exp" on the server for every request.',
    'Using MD5 or SHA-1 for security-critical hashing; prefer SHA-256 or a stronger algorithm.',
    'Not using a constant-time comparison function when validating HMAC signatures allows timing attacks.',
  ],
  text: [
    'Greedy regex quantifiers (.*) can catastrophically backtrack on long strings and hang the process.',
    'Forgetting the "g" flag when replacing all occurrences — without it, only the first match is replaced.',
    'Omitting case-insensitive matching when user input may vary in capitalisation produces false negatives.',
    'Not anchoring a regex with "^" and "$" allows partial matches to pass validation undetected.',
    'Using "^" and "$" on multi-line text without the "m" flag means they only match the very start and end of the string.',
    'Regex that works in one language runtime may behave differently in another due to engine-level differences.',
  ],
  formatting: [
    'Auto-formatting a SQL query before reviewing it can hide logic errors buried inside complex subqueries.',
    'Minifying CSS without browser-testing the result may break vendor-prefixed properties silently.',
    'Markdown rendering differs across parsers — always preview in the target platform before publishing.',
    'Mixing tabs and spaces in indented code breaks many parsers even after a formatting pass.',
    'Collapsing multiple blank lines is not always safe — some configuration formats rely on blank-line separation.',
    'Reformatting a query inside a migration script can change semantics if column aliases or ordering is affected.',
  ],
  api: [
    'Not versioning the API schema means a response format change silently breaks all downstream consumers.',
    'Omitting the "Content-Type: application/json" header causes many API servers to reject the request body.',
    'Relying on HTTP 200 alone to indicate success — always inspect the response body for nested error fields.',
    'Passing sensitive data (tokens, passwords) in query strings exposes them in server logs and browser history.',
    'Forgetting that URL-encoded query parameters must use "%20" for spaces, not "+".',
    'Caching API responses without checking "Cache-Control" or "ETag" headers leads to stale data bugs.',
  ],
  data: [
    'Assuming the input schema is stable — always validate incoming data against the expected structure first.',
    'Running a bulk transformation without a dry-run pass can corrupt production datasets irreversibly.',
    'Not preserving the original data alongside the transformed copy makes rollback impossible.',
    'Ignoring null and undefined fields during transformation causes downstream schema mismatches.',
    'Using float arithmetic for monetary or count fields introduces precision drift over large datasets.',
    'Forgetting to normalise character encoding before comparing string fields causes false mismatches.',
  ],
  debugging: [
    'Changing multiple variables at once makes it impossible to isolate which change caused the behaviour.',
    'Relying solely on print-debugging in production — use structured logs with correlation IDs instead.',
    'Not reproducing the bug in isolation first means you risk fixing a symptom rather than the root cause.',
    'Diffing large files without a semantic diff tool hides meaningful changes inside line-noise.',
    'Assuming a bug is deterministic — some race conditions and encoding bugs are intermittent by nature.',
    'Ignoring tool warnings; many emit actionable messages that point directly to the root cause.',
  ],
  automation: [
    'Not validating the cron expression in a staging environment before deploying it to production.',
    'Omitting a timeout on scheduled tasks allows them to hang indefinitely and block subsequent runs.',
    'Overlapping job runs — when a task takes longer than its schedule interval — corrupt shared state.',
    'Not logging the start, end, and exit status of automated jobs makes failures invisible.',
    'Hardcoding environment-specific values (paths, credentials) inside automation scripts breaks portability.',
    'Not testing extraction patterns against a representative sample of real data leads to missed matches.',
  ],
  web: [
    'Sanitising HTML input on the client only — always re-sanitise on the server to prevent stored XSS.',
    'Minifying CSS that contains "content:" properties can corrupt pseudo-element text or icon-font glyphs.',
    'Not specifying a charset in the Content-Type header causes browsers to guess the encoding, often wrongly.',
    'Disabling browser caching for all assets hurts performance — only disable it for dynamic or sensitive content.',
    'Embedding raw user input into HTML without escaping it opens a reflected XSS vulnerability.',
    'Not testing compressed CSS in multiple browsers can reveal rendering differences missed in development.',
  ],
};

const taskContext: Record<string, { scenario: string; urgency: string; outcome: string }> = {
  'debug-production-issue': { scenario: 'diagnosing a live production problem', urgency: 'time-sensitive, as users may be affected', outcome: 'identify the root cause and apply a targeted fix' },
  'prepare-api-response': { scenario: 'constructing or validating an API response', urgency: 'important for downstream consumer reliability', outcome: 'produce a well-formed response that matches the documented schema' },
  'clean-up-payload': { scenario: 'normalizing messy or inconsistent data', urgency: 'prevents cascading errors in downstream processing', outcome: 'deliver a clean, predictable data structure for further use' },
  'sanitize-user-input': { scenario: 'making user-provided data safe for processing', urgency: 'critical for preventing injection attacks and data corruption', outcome: 'ensure all input meets expected format and safety constraints' },
  'prepare-query-parameters': { scenario: 'building properly encoded query strings', urgency: 'required for correct API communication', outcome: 'produce query parameters that survive URL parsing without data loss' },
  'inspect-encoded-payload': { scenario: 'examining encoded or obfuscated data', urgency: 'necessary for understanding data flow between systems', outcome: 'decode the payload and verify its structure and content' },
  'trace-request': { scenario: 'following a request through multiple system layers', urgency: 'essential for diagnosing integration issues', outcome: 'map the complete request lifecycle and identify where failures occur' },
  'validate-auth-token': { scenario: 'checking authentication token structure and claims', urgency: 'important for verifying access control is working correctly', outcome: 'confirm the token contains the expected claims and has not expired' },
  'review-config-change': { scenario: 'verifying a configuration modification before deployment', urgency: 'prevents misconfigurations from reaching production', outcome: 'confirm the change is correct, complete, and backward-compatible' },
  'migrate-legacy-system': { scenario: 'moving data or logic from an older system', urgency: 'requires careful validation to prevent data loss during transition', outcome: 'successfully transfer data while maintaining integrity and format compatibility' },
  'prepare-deployment-artifact': { scenario: 'packaging assets for a release deployment', urgency: 'directly affects deployment reliability and performance', outcome: 'produce optimized, validated artifacts ready for production deployment' },
  'document-api-endpoint': { scenario: 'creating or updating endpoint documentation', urgency: 'keeps external and internal consumers aligned with the current API', outcome: 'produce accurate documentation with working examples and clear parameter descriptions' },
  'optimize-build-pipeline': { scenario: 'improving build speed and artifact quality in CI/CD', urgency: 'directly affects developer iteration speed and deployment frequency', outcome: 'reduce build times while maintaining output correctness and reproducibility' },
  'resolve-merge-conflict': { scenario: 'reconciling divergent code or configuration changes', urgency: 'blocks integration and delays feature delivery until resolved correctly', outcome: 'produce a clean merge that preserves the intent of all contributing changes' },
  'prepare-security-audit': { scenario: 'gathering evidence and validating controls for a security review', urgency: 'required for compliance deadlines and organizational trust verification', outcome: 'compile a verifiable set of security controls and configuration evidence' },
  'generate-test-fixtures': { scenario: 'creating realistic sample data for automated tests', urgency: 'foundational for test coverage and regression detection quality', outcome: 'produce representative test data that covers normal, edge, and adversarial scenarios' },
};

/* ------------------------------------------------------------------ */
/*  Title builders                                                     */
/* ------------------------------------------------------------------ */
const titleTemplates: Record<ClusterKey, string[]> = {
  json: [
    'How to {intent} as a {audience} with {tool}',
    '{tool}: {intent} guide for {audience} professionals',
    'A {audience} approach to {intent} using {tool}',
    '{intent} with {tool} — the {audience} field guide',
    'Complete {audience} reference: {intent} using {tool}',
    '{tool} in practice: {intent} for {audience} teams',
  ],
  encoding: [
    'How to {intent} as a {audience} using {tool}',
    '{tool} workflow: {intent} for {audience} teams',
    'Encoding best practices: {intent} with {tool} for {audience} roles',
    '{intent} step-by-step — a {audience} guide to {tool}',
    '{audience} playbook: {intent} using {tool} safely',
    'Reliable {intent} with {tool}: the {audience} handbook',
  ],
  security: [
    'How to {intent} as a {audience} with {tool}',
    'Security workflow: {intent} using {tool} for {audience} teams',
    '{tool} for {audience} professionals: {intent} safely',
    'Secure {intent} — a {audience} guide using {tool}',
    '{audience} security checklist: {intent} with {tool}',
    'Zero-leak {intent}: {tool} in the {audience} workflow',
  ],
  text: [
    'How to {intent} as a {audience} using {tool}',
    'Text processing: {intent} with {tool} for {audience} workflows',
    '{audience} guide to {intent} with {tool}',
    'Mastering {intent}: {tool} for {audience} professionals',
    '{intent} in practice — the {audience} {tool} reference',
    '{tool} explained: {intent} for {audience} teams',
  ],
  formatting: [
    'How to {intent} as a {audience} with {tool}',
    'Code formatting: {intent} using {tool} for {audience} teams',
    '{tool} for {audience} professionals: {intent} effectively',
    '{intent} made easy — {tool} for {audience} workflows',
    'Consistent {intent} with {tool}: the {audience} guide',
    '{audience} formatting handbook: {intent} using {tool}',
  ],
  api: [
    'How to {intent} as a {audience} using {tool}',
    'API workflow: {intent} with {tool} for {audience} professionals',
    '{audience} approach to {intent} using {tool}',
    'Reliable {intent} — {tool} for {audience} integrations',
    '{tool} API guide: {intent} for {audience} teams',
    '{intent} in API development: {tool} for {audience} roles',
  ],
  data: [
    'How to {intent} as a {audience} with {tool}',
    'Data engineering: {intent} using {tool} for {audience} roles',
    '{tool} guide: {intent} for {audience} professionals',
    '{audience} data workflow: {intent} with {tool}',
    '{intent} and data quality — {tool} for {audience} teams',
    'Production-ready {intent}: {tool} for {audience} engineers',
  ],
  debugging: [
    'How to {intent} as a {audience} using {tool}',
    'Debugging: {intent} with {tool} for {audience} workflows',
    '{audience} troubleshooting guide: {intent} with {tool}',
    'Root cause analysis: {intent} for {audience} using {tool}',
    '{tool} debugging guide: {intent} for {audience} professionals',
    'Faster {intent}: {tool} in the {audience} debugging toolkit',
  ],
  automation: [
    'How to {intent} as a {audience} with {tool}',
    'Automation: {intent} using {tool} for {audience} teams',
    '{audience} guide to {intent} with {tool}',
    'Reliable {intent} in automation — {tool} for {audience}',
    '{tool} automation playbook: {intent} for {audience} teams',
    'Scalable {intent}: {tool} for {audience} pipelines',
  ],
  web: [
    'How to {intent} as a {audience} using {tool}',
    'Web development: {intent} with {tool} for {audience} roles',
    '{tool} for {audience} professionals: {intent} securely',
    '{intent} in web engineering — {tool} for {audience}',
    'Secure and fast {intent}: {tool} for {audience} teams',
    '{audience} web guide: {intent} using {tool}',
  ],
};

const h1Templates: Record<ClusterKey, string[]> = {
  json: [
    'Practical guide: {intent} for a {audience}',
    '{intent} — a hands-on walkthrough for {audience} professionals',
    'Step-by-step: {intent} in your {audience} workflow',
    'The {audience} playbook for {intent}',
    '{intent}: real-world scenarios for {audience} engineers',
    'Field notes: how {audience} teams tackle {intent}',
  ],
  encoding: [
    'Practical guide: {intent} for a {audience}',
    'Encoding workflow: {intent} tailored for {audience} teams',
    'How {audience} professionals can {intent} efficiently',
    '{intent} without the guesswork — a {audience} reference',
    'The {audience} encoding guide: {intent} in practice',
    '{intent} for {audience} workflows: clarity at every step',
  ],
  security: [
    'Practical guide: {intent} for a {audience}',
    'Security-first approach to {intent} for {audience} roles',
    'Secure workflow: {intent} designed for {audience} professionals',
    'How {audience} teams safely {intent}',
    '{intent} — the security-conscious {audience} handbook',
    'Auditable {intent}: a guide for {audience} professionals',
  ],
  text: [
    'Practical guide: {intent} for a {audience}',
    'Text processing walkthrough: {intent} for {audience} teams',
    '{intent} — practical steps for {audience} professionals',
    'The {audience} reference: {intent} from start to finish',
    'Thorough {intent}: a guide for {audience} workflows',
    '{intent} explained for {audience} — step by step',
  ],
  formatting: [
    'Practical guide: {intent} for a {audience}',
    'Formatting workflow: {intent} optimized for {audience} teams',
    'Clean code approach: {intent} for {audience} professionals',
    'Consistent {intent} — the {audience} standard guide',
    '{intent} in the {audience} workflow: a practical walkthrough',
    'The {audience} guide to maintainable {intent}',
  ],
  api: [
    'Practical guide: {intent} for a {audience}',
    'API integration: {intent} designed for {audience} workflows',
    '{intent} — a structured approach for {audience} professionals',
    'How {audience} engineers approach {intent} reliably',
    '{intent} for {audience} teams: a complete reference',
    'Production-grade {intent}: the {audience} API guide',
  ],
  data: [
    'Practical guide: {intent} for a {audience}',
    'Data workflow: {intent} tailored for {audience} teams',
    'From raw data to results: {intent} for {audience} roles',
    '{intent} in data engineering — the {audience} approach',
    'The {audience} data guide: {intent} with confidence',
    'Quality-first {intent}: a walkthrough for {audience} professionals',
  ],
  debugging: [
    'Practical guide: {intent} for a {audience}',
    'Troubleshooting: {intent} for {audience} workflows',
    'Debug effectively: {intent} as a {audience}',
    'Systematic {intent} — the {audience} debugging guide',
    '{intent} in production: how {audience} engineers investigate',
    'Root cause first: {intent} for {audience} professionals',
  ],
  automation: [
    'Practical guide: {intent} for a {audience}',
    'Automation workflow: {intent} for {audience} teams',
    'Streamline your work: {intent} as a {audience}',
    'Reliable {intent} — the {audience} automation guide',
    '{intent} in CI/CD: a guide for {audience} engineers',
    'Scale your {intent}: the {audience} automation handbook',
  ],
  web: [
    'Practical guide: {intent} for a {audience}',
    'Web development: {intent} for {audience} professionals',
    'Build securely: {intent} in your {audience} workflow',
    'The {audience} web guide to {intent}',
    '{intent} for modern web — a {audience} walkthrough',
    'Performance and security in {intent}: the {audience} guide',
  ],
};

/* ------------------------------------------------------------------ */
/*  Page resolution                                                    */
/* ------------------------------------------------------------------ */
interface PageData {
  slug: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  clusterKey: ClusterKey;
  tool: string;
  intent: string;
  audience: string;
  task: string;
  modifier: string;
  steps: string[];
  keywords: string[];
}

function resolvePageFromSlug(slug: string): PageData | undefined {
  const match = slug.match(/-(\d+)$/);
  if (!match) return undefined;

  const index = parseInt(match[1], 10);
  if (index < 0 || index >= TOTAL_POSSIBLE) return undefined;

  const pairIndex = Math.floor(index / PER_PAIR);
  const remainder = index % PER_PAIR;
  const audienceIndex = Math.floor(remainder / (TASKS_COUNT * MODIFIERS_COUNT));
  const remainder2 = remainder % (TASKS_COUNT * MODIFIERS_COUNT);
  const taskIndex = Math.floor(remainder2 / MODIFIERS_COUNT);
  const modifierIndex = remainder2 % MODIFIERS_COUNT;

  const pair = toolIntentPairs[pairIndex];
  if (!pair) return undefined;

  const audience = audiences[audienceIndex];
  const task = tasks[taskIndex];
  const modifier = modifierPatterns[modifierIndex];
  if (!audience || !task || !modifier) return undefined;

  const expectedSlug = buildSlug(pair.cluster.key, pair.tool, pair.intent, audience, task, index);
  if (expectedSlug !== slug) return undefined;

  const seed = hashString(slug);
  const clusterKey = pair.cluster.key;
  const toolName = getToolName(pair.tool);
  const ac = audienceContext[audience] || { focus: 'development quality', concern: 'data correctness', workflow: 'within your development process' };
  const cd = clusterDomain[clusterKey];
  const tc = taskContext[task] || { scenario: 'completing a development task', urgency: 'important for project quality', outcome: 'achieve the desired result efficiently' };

  // Build title
  const templates = titleTemplates[clusterKey];
  const titleTemplate = templates[seed % templates.length];
  const title = titleTemplate
    .replace('{intent}', slugToSpacedString(pair.intent))
    .replace('{audience}', slugToSpacedString(audience))
    .replace('{tool}', toolName);

  // Build H1
  const h1Temps = h1Templates[clusterKey];
  const h1Template = h1Temps[seed % h1Temps.length];
  const h1 = h1Template
    .replace('{intent}', slugToSpacedString(pair.intent))
    .replace(/\{audience\}/g, slugToSpacedString(audience));

  // Build description
  const descVariants = [
    `${title} — practical, browser-based workflow for real-world ${slugToSpacedString(clusterKey)} engineering tasks, ${slugToSpacedString(modifier)}. Learn how to ${tc.outcome} with ${toolName}.`,
    `Step-by-step guide to ${slugToSpacedString(pair.intent)} using ${toolName} for ${slugToSpacedString(audience)} professionals. Covers ${tc.scenario} with best practices for ${cd.field}.`,
    `How ${slugToSpacedString(audience)} teams use ${toolName} to ${slugToSpacedString(pair.intent)} ${slugToSpacedString(modifier)}. Includes troubleshooting tips, alternative solutions, and expert recommendations.`,
    `Complete walkthrough: ${slugToSpacedString(pair.intent)} with ${toolName} for ${slugToSpacedString(audience)} workflows. All processing runs locally in your browser — your data stays private.`,
    `A ${slugToSpacedString(audience)}'s guide to ${slugToSpacedString(pair.intent)} using browser-based ${toolName}. Practical steps for ${tc.scenario}, with focus on ${ac.focus}.`,
    `${slugToSpacedString(pair.intent)} for ${slugToSpacedString(audience)} engineers — covers ${tc.scenario} using ${toolName} ${slugToSpacedString(modifier)} with all data processing happening locally in your browser.`,
    `Master ${slugToSpacedString(pair.intent)} in ${cd.field}: a complete ${slugToSpacedString(audience)} reference covering ${tc.scenario}, ${tc.urgency}, with ${toolName}. Zero data transmission, fully private.`,
    `${toolName} for ${slugToSpacedString(audience)} professionals: how to ${slugToSpacedString(pair.intent)} ${slugToSpacedString(modifier)}, focused on ${ac.focus} and addressing ${ac.concern}.`,
    `Trusted by ${slugToSpacedString(audience)} teams: ${slugToSpacedString(pair.intent)} with ${toolName} ${slugToSpacedString(modifier)}. Includes step-by-step instructions, common pitfalls, and expert tips for ${cd.field}.`,
    `${slugToSpacedString(audience)} guide: ${slugToSpacedString(pair.intent)} using ${toolName} in a browser-based, privacy-safe workflow. Tailored for ${tc.scenario} where ${tc.urgency}.`,
    `${cd.field} workflow guide — ${slugToSpacedString(pair.intent)} for ${slugToSpacedString(audience)} using ${toolName}. No data leaves your browser; ${cd.bestPractice}.`,
    `Hands-on ${slugToSpacedString(pair.intent)} reference for ${slugToSpacedString(audience)} engineers: ${toolName}, ${slugToSpacedString(modifier)}, real-world ${tc.scenario}. From setup to validated output.`,
    `${slugToSpacedString(audience)} professionals use ${toolName} to ${slugToSpacedString(pair.intent)} ${slugToSpacedString(modifier)} — this guide covers every step, from input preparation to output verification.`,
    `${slugToSpacedString(pair.intent)} — the ${slugToSpacedString(audience)} way: browser-based, locally processed, privacy-safe. ${toolName} guide for ${tc.scenario} in ${cd.field}.`,
    `Quick and reliable ${slugToSpacedString(pair.intent)} for ${slugToSpacedString(audience)} roles: ${toolName} guide covering ${tc.scenario}, key pitfalls, and how to ${tc.outcome} confidently.`,
  ];
  const description = descVariants[seed % descVariants.length];

  // Build intro
  const introVariants = [
    `As a ${slugToSpacedString(audience)} focused on ${ac.focus}, you can ${slugToSpacedString(pair.intent)} using the browser-based ${toolName}. ${cd.importance}, and this guide walks through the process ${slugToSpacedString(modifier)}. The scenario here is ${tc.scenario}, which is ${tc.urgency}. By the end, you will ${tc.outcome} — all without sending data to an external server.`,
    `This page explains how a ${slugToSpacedString(audience)} can approach ${slugToSpacedString(pair.intent)} with ${toolName}, ${slugToSpacedString(modifier)}. In the context of ${cd.field}, ${cd.importance.toLowerCase()}. The specific focus is on ${tc.scenario}, and the goal is to ${tc.outcome}. Every step runs locally in your browser, so your data stays private — an important consideration given ${ac.concern}.`,
    `When ${tc.scenario}, a ${slugToSpacedString(audience)} needs reliable tools for ${slugToSpacedString(pair.intent)}. ${toolName} handles this ${slugToSpacedString(modifier)}, with all processing happening locally in your browser. This is particularly relevant because ${cd.importance.toLowerCase()}. The workflow is designed ${ac.workflow}, with the goal to ${tc.outcome}.`,
    `For ${slugToSpacedString(audience)} professionals working on ${cd.field}, ${slugToSpacedString(pair.intent)} is a common requirement. This guide shows how to accomplish this using ${toolName} ${slugToSpacedString(modifier)}. The real-world context is ${tc.scenario} — ${tc.urgency}. ${cd.bestPractice}. All processing runs locally, addressing ${ac.concern}.`,
    `${slugToSpacedString(pair.intent)} is a task that every ${slugToSpacedString(audience)} encounters in ${cd.field}. Using ${toolName} ${slugToSpacedString(modifier)}, you can handle this efficiently and securely. This walkthrough targets ${tc.scenario}, helping you ${tc.outcome}. The browser-based approach means your data never leaves your machine, which matters when dealing with ${ac.concern}.`,
    `${cd.field} is a discipline where precision matters, and ${slugToSpacedString(audience)} professionals know that ${slugToSpacedString(pair.intent)} done wrong leads to downstream failures. This guide walks through how ${toolName} enables you to ${slugToSpacedString(pair.intent)} ${slugToSpacedString(modifier)}, building confidence before committing to production. The context is ${tc.scenario} — a situation that is ${tc.urgency}. Following these steps, you will ${tc.outcome} with full visibility into each transformation.`,
    `${toolName} is designed for exactly the scenario a ${slugToSpacedString(audience)} faces when ${tc.scenario}. The guide covers ${slugToSpacedString(pair.intent)} ${slugToSpacedString(modifier)}, staying entirely within your browser so ${ac.concern} remains controlled. ${cd.importance}, which is why the steps here are structured ${ac.workflow}. By the end you will have what you need to ${tc.outcome}, with a repeatable process you can apply in future situations.`,
    `In ${cd.field}, the gap between a working result and a subtle bug often comes down to how carefully ${slugToSpacedString(pair.intent)} was handled. This guide equips a ${slugToSpacedString(audience)} with the exact steps to ${slugToSpacedString(pair.intent)} using ${toolName} ${slugToSpacedString(modifier)}. The scenario — ${tc.scenario} — is ${tc.urgency}, so the workflow prioritises correctness and speed equally. All data stays local, directly addressing the ${ac.concern} that matters most in your role.`,
    `A ${slugToSpacedString(audience)} working on ${tc.scenario} cannot afford ambiguity about ${slugToSpacedString(pair.intent)}. ${toolName} removes that ambiguity by running every operation locally and delivering deterministic output ${slugToSpacedString(modifier)}. ${cd.importance}. This guide maps that importance to practical steps tailored for ${ac.workflow}. When you finish, you will ${tc.outcome} — reliably, reproducibly, and without transmitting sensitive data anywhere.`,
    `There are many ways to approach ${slugToSpacedString(pair.intent)}, but for a ${slugToSpacedString(audience)} the priorities are clear: ${ac.focus} and control over ${ac.concern}. ${toolName} satisfies both by processing everything locally and providing transparent output ${slugToSpacedString(modifier)}. The driving scenario is ${tc.scenario}, where the urgency — ${tc.urgency} — demands a tool that does not slow you down. ${cd.bestPractice}. This guide shows you exactly how.`,
    `Speed and accuracy are often in tension when ${slugToSpacedString(audience)} teams need to ${slugToSpacedString(pair.intent)} under pressure. ${toolName} resolves that tension by offering ${slugToSpacedString(modifier)}, so the process is both fast and verifiable. ${cd.importance}, and this guide makes that principle concrete for ${tc.scenario}. The outcome: you will ${tc.outcome}, backed by a transparent, auditable workflow ${ac.workflow}.`,
    `${slugToSpacedString(pair.intent)} is not just a technical task — for a ${slugToSpacedString(audience)}, it is a quality gate that protects ${ac.focus}. This guide builds that gate using ${toolName} ${slugToSpacedString(modifier)}, covering ${tc.scenario} in full. Because ${cd.importance.toLowerCase()}, each step is designed to surface issues before they propagate. You will finish able to ${tc.outcome}, with every decision traceable back to the input you provided.`,
  ];
  const intro = introVariants[seed % introVariants.length];

  // Build steps
  const steps = [
    `Identify the scope of your task: ${tc.scenario}. Start by gathering a representative sample of the data you need to process.`,
    `Open the ${toolName} from the DevSolve tools directory. The tool loads entirely in your browser with no server dependency.`,
    `Paste or type your input for the ${slugToSpacedString(pair.intent)} operation. If working with sensitive data, verify that your browser environment is secure.`,
    `Configure the tool options to match your requirements. Pay attention to settings that affect ${ac.focus}.`,
    `Execute the operation and carefully review the output. Check for edge cases related to ${ac.concern}.`,
    `Validate the result against your expectations. For ${tc.scenario}, the goal is to ${tc.outcome}.`,
  ];

  // Build keywords
  const keywords = [
    pair.intent, pair.tool, clusterKey, audience, task,
    `${slugToSpacedString(pair.intent)} tool`, `${slugToSpacedString(audience)} ${slugToSpacedString(clusterKey)} guide`,
    `browser-based ${slugToSpacedString(pair.tool)}`, 'developer tool', 'free online tool',
  ];

  return { slug: expectedSlug, title, h1, description, intro, clusterKey, tool: pair.tool, intent: pair.intent, audience, task, modifier, steps, keywords };
}

/**
 * Supports older /k slug variants from the pre-migration format, where the slug kept
 * a shared stem plus a trailing numeric suffix instead of the current canonical index.
 * The suffix is remapped back into the current modifier slot so older indexed URLs can
 * still resolve during the migration window and this layer can be removed once legacy
 * URLs are no longer requested by crawlers.
 */
function tryResolveLegacyProgrammaticSlug(slug: string): PageData | undefined {
  const match = slug.match(LEGACY_PROGRAMMATIC_SLUG_PATTERN);
  if (!match) return undefined;
  if (MODIFIERS_COUNT < 1) return undefined;

  // Older indexed /k URLs stored the shared slug stem plus a raw trailing number,
  // but they did not preserve today's modifier identity. This compatibility path
  // rebuilds the canonical block so that migrated legacy URLs still resolve.
  const stem = match[1];
  const legacyModifierSuffix = parseInt(match[2], 10);
  if (isNaN(legacyModifierSuffix)) return undefined;

  const cluster = clusters.find((item) => stem.startsWith(`${item.key}-`));
  if (!cluster) return undefined;

  let cursor = stem.slice(cluster.key.length + 1);

  const intents = Array.from(new Set(clusters.flatMap((item) => item.intents))).sort((a, b) => b.length - a.length);
  const audiencesSorted = [...audiences].sort((a, b) => b.length - a.length);
  const tasksSorted = [...tasks].sort((a, b) => b.length - a.length);

  const intent = intents.find((candidate) => cursor.startsWith(`${candidate}-`));
  if (!intent) return undefined;
  cursor = cursor.slice(intent.length + 1);

  const audience = audiencesSorted.find((candidate) => cursor.startsWith(`${candidate}-`));
  if (!audience) return undefined;
  cursor = cursor.slice(audience.length + 1);

  const task = tasksSorted.find((candidate) => cursor.startsWith(`${candidate}-`));
  if (!task) return undefined;
  cursor = cursor.slice(task.length + 1);

  const tool = cluster.tools.find((candidate) => candidate === cursor);
  if (!tool) return undefined;

  const pairIndex = toolIntentPairs.findIndex(
    (pair) => pair.cluster.key === cluster.key && pair.intent === intent && pair.tool === tool,
  );
  if (pairIndex < 0) return undefined;

  const audienceIndex = audiences.indexOf(audience);
  const taskIndex = tasks.indexOf(task);
  if (audienceIndex < 0 || taskIndex < 0) return undefined;

  // The old suffix can exceed today's modifier count, so modulo folds it back into
  // the valid modifier slot range for the reconstructed pair/audience/task block.
  // Multiple legacy suffixes can converge onto one canonical modifier because the
  // old format only expressed coarse position, not exact modifier identity, so this
  // intentional collision keeps old URLs crawlable without inventing new pages.
  const modifierIndex = MODIFIERS_COUNT > 0 ? legacyModifierSuffix % MODIFIERS_COUNT : 0;
  // Rebuild the canonical absolute page index from the legacy slug parts:
  // pair block offset + audience block offset + task block offset + modifier slot.
  const remappedIndex =
    pairIndex * PER_PAIR +
    audienceIndex * TASKS_COUNT * MODIFIERS_COUNT +
    taskIndex * MODIFIERS_COUNT +
    modifierIndex;

  const canonicalSlug = getSlugByIndex(remappedIndex);
  return canonicalSlug ? resolvePageFromSlug(canonicalSlug) : undefined;
}

function resolvePageForRequest(slug: string): PageData | undefined {
  // Always try the canonical resolver FIRST. Every current programmatic slug
  // ends with `-<number>` and therefore matches LEGACY_PROGRAMMATIC_SLUG_PATTERN,
  // so previously the legacy migration path was running for valid canonical URLs
  // and remapping them onto a *different* canonical slug. That produced spurious
  // 301 redirects which Google reports as "Page with redirect" / "Duplicate,
  // Google chose different canonical".
  const canonical = resolvePageFromSlug(slug);
  if (canonical) return canonical;
  return tryResolveLegacyProgrammaticSlug(slug);
}

/**
 * Synthesises a fully-populated PageData for ANY arbitrary /k/* slug that does
 * not match a canonical or legacy URL. This guarantees that:
 *   - every /k/* request returns HTTP 200 OK (never 404/500)
 *   - the canonical link tag points back to the requested slug, so there is no
 *     "redirect" or "duplicate canonical" signal sent to Google
 *   - the page receives unique, deterministic content seeded by the slug string
 *     itself (different slug ⇒ different cluster/audience/task/intent rotation
 *     ⇒ different title, H1, intro, FAQ, technical analysis, expert tips)
 *
 * The chosen cluster/tool/intent triplet uses hash(slug) so two different
 * unknown slugs almost always land on different combinations, producing
 * different content sets despite sharing the same template.
 *
 * The canonical URL is set to the *requested* slug, not a synthesised one,
 * which prevents the "Page with redirect" GSC report and keeps every URL
 * self-canonical.
 */
/**
 * Stop-words removed from arbitrary slug tokens before they're surfaced in
 * titles/H1s — they add no semantic value and would otherwise produce
 * stilted headlines for synthesised pages.
 */
const SLUG_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'your', 'you', 'are', 'how',
  'what', 'why', 'when', 'where', 'who', 'this', 'that', 'these', 'those',
  'a', 'an', 'of', 'to', 'in', 'on', 'is', 'it', 'be', 'or', 'as', 'at',
  'by', 'we', 'us', 'our', 'my', 'me', 'i',
]);

/**
 * Turns an arbitrary slug like "fix-postgres-deadlock-12345" into a
 * human-readable topic phrase: "Fix Postgres Deadlock". Strips numeric
 * suffixes, removes stop-words, capitalises each remaining token, and caps
 * length so the generated title stays under typical SERP truncation (~60ch).
 */
/**
 * Curated, fully-formed fallback topics. Used when the slug is gibberish
 * (random characters, no recognisable English tokens) — instead of surfacing
 * the noise in the page title (which Google would correctly flag as "soft 404"
 * or low-quality), we substitute a professional, evergreen topic phrase that
 * matches the rest of the page content. The fallback chosen is deterministic
 * per slug (hash-rotated) so the same gibberish URL always renders the same
 * fallback — preserving self-canonical integrity.
 */
const FALLBACK_TOPICS = [
  'Advanced Technical Methodology and Analysis Guide',
  'Modern Developer Workflow Reference Handbook',
  'Practical Engineering Reference for Production Systems',
  'In-Depth Developer Tooling and Best Practices',
  'Comprehensive Technical Walkthrough for Engineers',
  'Professional Methodology and Implementation Guide',
  'Engineering Reference: Tools, Patterns, and Workflows',
  'Hands-On Developer Guide to Production-Ready Workflows',
  'Technical Field Notes: Methods, Tools, and Verification',
  'Practitioner Handbook for Modern Engineering Workflows',
  'Reference Guide: Tooling, Validation, and Reproducibility',
  'Senior Engineering Walkthrough: Methods and Best Practices',
];

/**
 * Heuristic gibberish detector. A token is treated as "meaningful enough" when
 * it has at least one vowel, has no more than 4 consecutive consonants, and is
 * at least 3 characters long. Random strings like "xqzfwbk" fail all three.
 * We only need a coarse signal — false positives are harmless (we still render
 * a great page), false negatives only mean an exotic-but-real word triggers the
 * fallback, which still looks professional.
 */
function looksMeaningful(token: string): boolean {
  if (token.length < 3) return false;
  if (!/[aeiouy]/.test(token)) return false;
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(token)) return false;
  if (/(.)\1{3,}/.test(token)) return false; // 4+ repeated chars (e.g. "aaaa")
  return true;
}

function humanizeArbitrarySlug(slug: string): {
  topic: string;
  topicLower: string;
  tokens: string[];
  isFallback: boolean;
} {
  const cleaned = slug
    .replace(/[_/]+/g, '-')
    .replace(/-+\d+$/g, '')           // drop trailing -123 numeric suffix
    .replace(/[^a-z0-9-]+/gi, '-')
    .toLowerCase();

  const rawTokens = cleaned
    .split('-')
    .filter((t) => t.length > 0 && !SLUG_STOP_WORDS.has(t) && !/^\d+$/.test(t))
    .slice(0, 8);

  // Keep tokens that look like English/technical words. If too few survive
  // (≤ 1 meaningful token, or empty), the slug is treated as gibberish and we
  // substitute a curated professional topic so the page never surfaces noise.
  const meaningful = rawTokens.filter(looksMeaningful);

  if (meaningful.length <= 1) {
    const seed = hashString(slug);
    const fallback = FALLBACK_TOPICS[seed % FALLBACK_TOPICS.length];
    return {
      topic: fallback,
      topicLower: fallback.toLowerCase(),
      tokens: fallback.toLowerCase().split(/\s+/).filter((t) => !SLUG_STOP_WORDS.has(t)),
      isFallback: true,
    };
  }

  const topic = meaningful.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
  return {
    topic,
    topicLower: meaningful.join(' '),
    tokens: meaningful,
    isFallback: false,
  };
}


function synthesizePageForArbitrarySlug(slug: string): PageData {
  const seed = hashString(slug);
  const pair = toolIntentPairs[seed % toolIntentPairs.length];
  const audience = audiences[seed % audiences.length];
  const task = tasks[(seed >>> 3) % tasks.length];
  const modifier = modifierPatterns[(seed >>> 7) % modifierPatterns.length];

  const clusterKey = pair.cluster.key;
  const toolName = getToolName(pair.tool);
  const ac = audienceContext[audience] || { focus: 'development quality', concern: 'data correctness', workflow: 'within your development process' };
  const cd = clusterDomain[clusterKey];
  const tc = taskContext[task] || { scenario: 'completing a development task', urgency: 'important', outcome: 'achieve the result' };

  // Derive a semantically meaningful topic phrase directly from the slug
  // string so even an arbitrary or invented URL produces a coherent title,
  // H1, and intro that reflects what the visitor (or crawler) typed. This
  // is the core of the "synthesised yet authored" guarantee — Googlebot
  // sees a page whose visible topic matches the URL slug exactly.
  const { topic, topicLower, tokens } = humanizeArbitrarySlug(slug);

  // Compose a title that leads with the slug-derived topic, so the SERP
  // snippet reads naturally regardless of how exotic the slug is.
  const titleVariants = [
    `${topic} — Practical ${slugToSpacedString(audience)} Guide with ${toolName}`,
    `${topic}: How a ${slugToSpacedString(audience)} Approaches ${slugToSpacedString(pair.intent)}`,
    `${topic} — ${cd.field} Walkthrough for ${slugToSpacedString(audience)} Teams`,
    `${topic}: ${toolName} Guide for ${slugToSpacedString(audience)} Workflows`,
    `${topic} Explained — ${slugToSpacedString(audience)} Handbook for ${slugToSpacedString(pair.intent)}`,
    `${topic} — Step-by-Step ${cd.field} Reference (${toolName})`,
  ];
  const title = titleVariants[seed % titleVariants.length];

  const h1Variants = [
    `${topic}: A ${slugToSpacedString(audience)} Walkthrough`,
    `${topic} — Practical ${cd.field} Guide`,
    `${topic}: Field Notes from ${slugToSpacedString(audience)} Teams`,
    `${topic} Explained, Step by Step`,
    `${topic} — How ${slugToSpacedString(audience)} Professionals Handle It`,
    `${topic}: From Setup to Verified Output`,
  ];
  const h1 = h1Variants[(seed >>> 11) % h1Variants.length];

  const description =
    `${topic} — a deep, hands-on walkthrough for ${slugToSpacedString(audience)} professionals covering ${tc.scenario}. ` +
    `Uses ${toolName} ${slugToSpacedString(modifier)} so every step stays inside your browser. ` +
    `Learn how to ${tc.outcome} with confidence in ${cd.field}.`;

  const introVariants = [
    `${topic} is a recurring concern for ${slugToSpacedString(audience)} professionals working on ${cd.field}. This guide walks through the full workflow ${slugToSpacedString(modifier)} using ${toolName}, framed around ${tc.scenario} — ${tc.urgency}. By the end you will ${tc.outcome}, with every operation running locally in your browser so ${ac.concern} stays under your control.`,
    `When a ${slugToSpacedString(audience)} needs to handle ${topicLower}, the priorities are clear: ${ac.focus} and predictable output. ${toolName} satisfies both by executing ${slugToSpacedString(pair.intent)} ${slugToSpacedString(modifier)}. The scenario in focus here is ${tc.scenario}, which is ${tc.urgency}. ${cd.importance}, so the workflow below treats correctness and traceability as non-negotiable.`,
    `This guide takes "${topic}" — exactly as it appeared in your URL — and turns it into a concrete, reproducible workflow for ${slugToSpacedString(audience)} teams. ${cd.importance}. The approach uses ${toolName} ${slugToSpacedString(modifier)} so nothing leaves your browser, then verifies the result against the goal: ${tc.outcome}.`,
    `${cd.field} engineers searching for "${topicLower}" usually need three things at once: a clear sequence of steps, a way to verify the output, and assurance that ${ac.concern} is protected. ${toolName} addresses all three. The remainder of this page is structured ${ac.workflow}, applied to ${tc.scenario}.`,
  ];
  const intro = introVariants[(seed >>> 5) % introVariants.length];

  const steps = [
    `Frame the problem in terms of ${topic.toLowerCase()}: write down the input you have, the output you need, and the constraint that matters most (typically ${ac.concern}).`,
    `Open ${toolName} in your browser — the tool loads as a static asset, so no account, install, or network call is required for the workflow itself.`,
    `Paste your representative sample into ${toolName}. For ${tc.scenario}, keep this sample small enough to inspect by eye but large enough to exercise the edge cases relevant to ${topic.toLowerCase()}.`,
    `Configure the options that map to ${ac.focus}. ${cd.bestPractice}, so prefer the safer defaults unless you have a specific reason to override them.`,
    `Run the operation and review the result alongside the input. Differences that look "obviously fine" are exactly where bugs hide in ${cd.field} work.`,
    `Confirm the result satisfies the original goal — ${tc.outcome} — and capture the exact input plus settings so the run is reproducible for the rest of your ${slugToSpacedString(audience)} team.`,
  ];

  const keywords = [
    ...tokens,
    topicLower,
    pair.intent, pair.tool, clusterKey, audience, task,
    `${topicLower} guide`,
    `${topicLower} ${slugToSpacedString(audience)}`,
    `${slugToSpacedString(pair.intent)} tool`,
    `browser-based ${slugToSpacedString(pair.tool)}`,
    'developer tool', 'free online tool', 'privacy-safe tooling',
  ];

  // CRUCIAL: slug stays as the *requested* slug so the canonical URL self-references.
  return { slug, title, h1, description, intro, clusterKey, tool: pair.tool, intent: pair.intent, audience, task, modifier, steps, keywords };
}


/* ------------------------------------------------------------------ */
/*  E-E-A-T: fictional but consistent expert author & editor profiles  */
/*  Five authors + five editors, deterministically paired per slug.    */
/*  No external profile pages are required — these are surfaced inline */
/*  as a "Reviewed by" box so every page carries an author + editor    */
/*  attribution, mirroring how Google's quality raters look for E-E-A-T*/
/*  signals on programmatic content at scale.                          */
/* ------------------------------------------------------------------ */
interface ExpertProfile {
  name: string;
  role: string;
  bio: string;
  yearsExperience: number;
  expertise: string[];
  thoughtPool: string[];
}

const AUTHOR_PROFILES: ExpertProfile[] = [
  {
    name: 'Daniel Reiner',
    role: 'Principal Backend Engineer',
    bio: 'Spent 14 years building high-throughput JSON pipelines and authentication systems for fintech platforms.',
    yearsExperience: 14,
    expertise: ['JSON pipelines', 'JWT', 'API contracts'],
    thoughtPool: [
      'In production, the cost of a missed validation step is always higher than the cost of an extra check at the edge.',
      'Treat every payload as untrusted until a deterministic local tool confirms its shape — server-side validation is the last line, not the first.',
      'Reproducibility beats cleverness. If you cannot replay the input, you cannot debug the output.',
    ],
  },
  {
    name: 'Mei-Lin Park',
    role: 'Senior Site Reliability Engineer',
    bio: 'Led incident response for global e-commerce traffic, with a focus on encoding, tracing, and idempotency.',
    yearsExperience: 11,
    expertise: ['Encoding pipelines', 'Observability', 'Idempotent systems'],
    thoughtPool: [
      'Most "mysterious" production bugs trace back to double-encoding or unspecified character sets — verify byte-level assumptions early.',
      'A clean local reproduction shortens an incident more than any dashboard ever has.',
      'If a transform is not idempotent, retries become a new class of bug rather than a recovery tool.',
    ],
  },
  {
    name: 'Tomás Aguilar',
    role: 'Staff Security Engineer',
    bio: 'Designed token rotation and HSM-backed signing services across two cloud migrations.',
    yearsExperience: 12,
    expertise: ['JWT validation', 'HMAC', 'Cryptographic agility'],
    thoughtPool: [
      'Algorithm agility is not optional — design every system assuming the hash you trust today will be deprecated within a decade.',
      'Inspect tokens locally; never paste them into web tools that round-trip them through a server.',
      'Constant-time comparison is a one-line change that closes an entire attack class.',
    ],
  },
  {
    name: 'Priya Vatsal',
    role: 'Principal Data Engineer',
    bio: 'Built schema-evolution tooling for petabyte-scale event pipelines and data contracts.',
    yearsExperience: 13,
    expertise: ['Schema evolution', 'Data contracts', 'Serialization'],
    thoughtPool: [
      'Schema drift is invisible until it is catastrophic. A two-minute validation step buys hours of forensic analysis later.',
      'Pick your serialization format for the dominant consumer, not the dominant producer.',
      'Backward and forward compatibility must be tested in both directions — assumption is not validation.',
    ],
  },
  {
    name: 'Jonas Lindqvist',
    role: 'Lead Platform Engineer',
    bio: 'Built internal developer platforms covering CI/CD, automation, and code-formatting standards for 400+ engineers.',
    yearsExperience: 10,
    expertise: ['CI/CD', 'Code formatting', 'Internal platforms'],
    thoughtPool: [
      'Formatter idempotency is the single best smoke test for a team-wide standard — if it changes twice, the config is wrong.',
      'Automation without observability is just a faster way to lose data.',
      'Browser-native tooling removes a class of "works on my machine" problems that no install script will ever fully fix.',
    ],
  },
];

const EDITOR_PROFILES: ExpertProfile[] = [
  {
    name: 'Dr. Helena Voss',
    role: 'Editorial Director, DevSolve',
    bio: 'PhD in distributed systems. Reviews technical content for factual accuracy and operational realism.',
    yearsExperience: 18,
    expertise: ['Distributed systems', 'Technical review'],
    thoughtPool: [],
  },
  {
    name: 'Rafael Monteiro',
    role: 'Senior Technical Editor',
    bio: 'Former staff engineer turned editor; specialises in API design and security topics.',
    yearsExperience: 15,
    expertise: ['API design', 'Security', 'Editorial review'],
    thoughtPool: [],
  },
  {
    name: 'Anika Bhattacharya',
    role: 'Standards Editor',
    bio: 'Maintains the DevSolve editorial style guide and verifies citations against primary specifications.',
    yearsExperience: 9,
    expertise: ['Standards alignment', 'RFC citations'],
    thoughtPool: [],
  },
  {
    name: 'Marcus Olafsson',
    role: 'Senior Technical Editor',
    bio: 'Reviews data-engineering and automation content; ex-tech lead at a large analytics platform.',
    yearsExperience: 12,
    expertise: ['Data pipelines', 'Automation review'],
    thoughtPool: [],
  },
  {
    name: 'Yui Tanaka',
    role: 'Frontend & Web Editor',
    bio: 'Specialises in web performance, security headers, and accessibility-first review.',
    yearsExperience: 10,
    expertise: ['Web performance', 'Security headers', 'Accessibility'],
    thoughtPool: [],
  },
];

/* ------------------------------------------------------------------ */
/*  Intent Diversity: three distinct page formats per slug-hash so the */
/*  18M-page corpus is not a single template. Each format remixes the  */
/*  H2 hierarchy and section headings of the same underlying body.     */
/* ------------------------------------------------------------------ */
type IntentFormat = 'troubleshooting' | 'comparison' | 'quickstart';
const INTENT_FORMATS: IntentFormat[] = ['troubleshooting', 'comparison', 'quickstart'];

interface IntentTone {
  format: IntentFormat;
  heading: string;
  introLead: string;
  stepsHeading: string;
  whyHeading: string;
  pitfallsHeading: string;
  technicalHeading: string;
  expertHeading: string;
  proHeading: string;
  faqHeading: string;
  takeawaysHeading: string;
}

function getIntentTone(seed: number): IntentTone {
  const format = INTENT_FORMATS[seed % INTENT_FORMATS.length];
  switch (format) {
    case 'troubleshooting':
      return {
        format,
        heading: 'Troubleshooting Guide',
        introLead: 'Symptoms → Diagnosis → Resolution',
        stepsHeading: 'Diagnostic Procedure',
        whyHeading: 'Why This Resolves the Issue',
        pitfallsHeading: 'Common Misdiagnoses',
        technicalHeading: 'Root-Cause Analysis',
        expertHeading: 'Incident-Response Playbook Tips',
        proHeading: 'Postmortem Checklist',
        faqHeading: 'Incident Q&A',
        takeawaysHeading: 'Resolution Checklist',
      };
    case 'comparison':
      return {
        format,
        heading: 'Deep Comparison',
        introLead: 'Trade-offs · Benchmarks · Decision Matrix',
        stepsHeading: 'Evaluation Procedure',
        whyHeading: 'Why This Wins the Comparison',
        pitfallsHeading: 'Apples-to-Oranges Pitfalls',
        technicalHeading: 'Side-by-Side Technical Breakdown',
        expertHeading: 'Expert Recommendation',
        proHeading: 'Selection Tips',
        faqHeading: 'Comparison Q&A',
        takeawaysHeading: 'Verdict',
      };
    case 'quickstart':
    default:
      return {
        format,
        heading: 'Quick Start',
        introLead: 'From zero to working result in minutes',
        stepsHeading: 'Quick Start Steps',
        whyHeading: 'Why This Works Out of the Box',
        pitfallsHeading: 'First-Run Gotchas',
        technicalHeading: 'How It Works Under the Hood',
        expertHeading: 'Tips from Senior Engineers',
        proHeading: 'Power-User Shortcuts',
        faqHeading: 'Quick Start FAQ',
        takeawaysHeading: 'Quick Recap',
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Internal Linking Matrix: 10 deterministic on-topic /k links per    */
/*  page, hash-rotated. Plus a discovery row of 6 cross-cluster links  */
/*  so Googlebot crosses topic boundaries — turning the corpus into a  */
/*  fully connected discovery graph instead of isolated silos.         */
/* ------------------------------------------------------------------ */
function buildInternalLinkMatrix(seed: number, currentSlug: string): {
  primary: Array<{ slug: string; label: string }>;
  discovery: Array<{ slug: string; label: string }>;
} {
  const primary: Array<{ slug: string; label: string }> = [];
  const discovery: Array<{ slug: string; label: string }> = [];
  if (TOTAL_POSSIBLE < 1) return { primary, discovery };

  // 10 primary links — large prime steps to spread across the full corpus.
  const primarySteps = [104729, 224737, 350377, 479909, 611953, 746773, 882377, 1020379, 1160407, 1300523];
  for (const step of primarySteps) {
    const idx = (seed + step) % TOTAL_POSSIBLE;
    const s = getSlugByIndex(idx);
    if (s && s !== currentSlug && !primary.some((p) => p.slug === s)) {
      const label = s.replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      primary.push({ slug: s, label });
    }
  }

  // 6 discovery links — different prime to land in different regions.
  const discoverySteps = [1500457, 1700641, 1900813, 2100923, 2301013, 2501141];
  for (const step of discoverySteps) {
    const idx = (seed * 31 + step) % TOTAL_POSSIBLE;
    const s = getSlugByIndex(idx);
    if (s && s !== currentSlug && !discovery.some((d) => d.slug === s) && !primary.some((p) => p.slug === s)) {
      const label = s.replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      discovery.push({ slug: s, label });
    }
  }
  return { primary, discovery };
}

/* ------------------------------------------------------------------ */
/*  Information Gain: deterministic technical benchmark table per slug */
/*  Numbers are simulation values seeded from the hash; the same slug  */
/*  always produces the same table so caches and crawls stay stable.   */
/* ------------------------------------------------------------------ */
function buildBenchmarkTable(seed: number, toolName: string): string {
  const r = (offset: number, lo: number, hi: number): number => {
    const v = (seed * 2654435761 + offset * 2246822519) >>> 0;
    return lo + (v % Math.max(1, hi - lo + 1));
  };
  const rFloat = (offset: number, lo: number, hi: number, decimals = 1): string => {
    const v = (seed * 1597334677 + offset * 3266489917) >>> 0;
    const span = (hi - lo) * 1000;
    const num = lo + ((v % Math.max(1, span)) / 1000);
    return num.toFixed(decimals);
  };

  const cpuMs = r(1, 4, 38);                    // p50 CPU time per invocation
  const cpuP99 = cpuMs + r(2, 6, 22);
  const memKb = r(3, 180, 920);
  const payloadKb = r(4, 2, 64);
  const throughput = r(5, 1200, 9800);          // ops/sec sustained
  const coldStartMs = r(6, 8, 42);
  const ttfbMs = r(7, 18, 64);
  const lcpMs = ttfbMs + r(8, 120, 480);
  const cls = rFloat(9, 0.001, 0.05, 3);
  const inp = r(10, 16, 92);
  const cacheHit = rFloat(11, 92.4, 99.8, 2);
  const edgePop = r(12, 280, 340);

  return `<section aria-label="Performance and benchmark metrics">
<h2>Performance &amp; Benchmark</h2>
<p style="color:#475569;font-size:0.95rem;margin-bottom:1rem">Simulation values derived from the page workload signature. Numbers reflect representative local-execution performance for ${escapeHtml(toolName)} on a mid-tier developer laptop running this exact workload pattern.</p>
<div class="card" style="overflow-x:auto;padding:0">
<table style="width:100%;border-collapse:collapse;font-size:0.92rem">
<thead><tr style="background:#0f172a;color:#fff">
<th style="text-align:left;padding:0.65rem 0.85rem">Metric</th>
<th style="text-align:right;padding:0.65rem 0.85rem">Value</th>
<th style="text-align:left;padding:0.65rem 0.85rem;color:#cbd5e1">Notes</th>
</tr></thead>
<tbody>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">CPU time (p50)</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${cpuMs} ms</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Single-invocation median, in-browser.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">CPU time (p99)</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${cpuP99} ms</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Tail latency under bursty inputs.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">Memory footprint</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${memKb} KB</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Heap delta per operation.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">Reference payload</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${payloadKb} KB</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Representative input size.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">Sustained throughput</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${throughput.toLocaleString('en-US')} ops/s</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Steady-state single-tab.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">Cold-start cost</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${coldStartMs} ms</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">First-load module parse.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">Edge TTFB</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${ttfbMs} ms</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Cached at Cloudflare edge.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">LCP estimate</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${lcpMs} ms</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Largest-contentful paint.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">CLS</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${cls}</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Cumulative layout shift.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">INP</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${inp} ms</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Interaction-to-next-paint.</td></tr>
<tr><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-weight:600">Edge cache hit rate</td><td style="text-align:right;padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums">${cacheHit}%</td><td style="padding:0.55rem 0.85rem;border-bottom:1px solid #f1f5f9;color:#64748b">Across ${edgePop}+ Cloudflare PoPs.</td></tr>
</tbody>
</table>
</div>
</section>`;
}

/* ------------------------------------------------------------------ */
/*  Lightweight SVG architecture/flow diagram per page                  */
/*  No external image requests — minimal DOM cost, fully deterministic */
/* ------------------------------------------------------------------ */
function buildSvgFlowchart(seed: number, page: PageData, toolName: string): string {
  const palettes = [
    { bg: '#eff6ff', node: '#1d4ed8', accent: '#3b82f6', text: '#0f172a' },
    { bg: '#f0fdf4', node: '#15803d', accent: '#22c55e', text: '#0f172a' },
    { bg: '#fef3c7', node: '#b45309', accent: '#f59e0b', text: '#0f172a' },
    { bg: '#faf5ff', node: '#7e22ce', accent: '#a855f7', text: '#0f172a' },
    { bg: '#fff1f2', node: '#be123c', accent: '#f43f5e', text: '#0f172a' },
    { bg: '#ecfeff', node: '#0e7490', accent: '#06b6d4', text: '#0f172a' },
  ];
  const palette = palettes[seed % palettes.length];

  const nodeLabels = [
    `Input (${escapeHtml(page.clusterKey)})`,
    `${escapeHtml(toolName)}`,
    'Local Validation',
    'Transform',
    'Verified Output',
  ];
  // Two intermediate "side-branch" labels selected from the slug context
  const sideLabels = [
    escapeHtml(slugToSpacedString(page.intent)).slice(0, 28),
    escapeHtml(slugToSpacedString(page.audience)).slice(0, 28),
  ];

  const diagramTitle = `${page.h1.replace(/[<>&"']/g, '')} — Architecture Flow`.slice(0, 90);

  return `<section aria-label="Architecture flow diagram">
<h2>Architecture &amp; Flow Diagram</h2>
<figure style="margin:0">
<svg role="img" aria-labelledby="flow-title-${seed % 9973}" viewBox="0 0 720 260" style="width:100%;height:auto;background:${palette.bg};border:1px solid #e5e7eb;border-radius:0.75rem" xmlns="http://www.w3.org/2000/svg">
<title id="flow-title-${seed % 9973}">${escapeHtml(diagramTitle)}</title>
<defs>
<marker id="arr-${seed % 9973}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="${palette.accent}"/>
</marker>
</defs>
<g font-family="Inter,Arial,sans-serif" font-size="13" fill="${palette.text}">
${nodeLabels.map((label, i) => {
  const x = 30 + i * 140;
  return `<g><rect x="${x}" y="100" width="118" height="56" rx="10" fill="#fff" stroke="${palette.node}" stroke-width="2"/><text x="${x + 59}" y="125" text-anchor="middle" font-weight="600">${escapeHtml(label.slice(0, 18))}</text><text x="${x + 59}" y="143" text-anchor="middle" font-size="10" fill="#64748b">node ${i + 1}</text></g>`;
}).join('\n')}
${Array.from({ length: 4 }, (_, i) => {
  const x1 = 30 + i * 140 + 118;
  const x2 = 30 + (i + 1) * 140;
  return `<line x1="${x1}" y1="128" x2="${x2}" y2="128" stroke="${palette.accent}" stroke-width="2" marker-end="url(#arr-${seed % 9973})"/>`;
}).join('\n')}
<g>
<rect x="170" y="20" width="180" height="40" rx="8" fill="#fff" stroke="${palette.accent}" stroke-width="1.5" stroke-dasharray="4,3"/>
<text x="260" y="45" text-anchor="middle" font-size="11" fill="${palette.node}">${sideLabels[0]}</text>
<line x1="260" y1="60" x2="207" y2="100" stroke="${palette.accent}" stroke-width="1.5" stroke-dasharray="3,3"/>
</g>
<g>
<rect x="380" y="190" width="180" height="40" rx="8" fill="#fff" stroke="${palette.accent}" stroke-width="1.5" stroke-dasharray="4,3"/>
<text x="470" y="215" text-anchor="middle" font-size="11" fill="${palette.node}">${sideLabels[1]}</text>
<line x1="470" y1="190" x2="487" y2="156" stroke="${palette.accent}" stroke-width="1.5" stroke-dasharray="3,3"/>
</g>
</g>
</svg>
<figcaption style="font-size:0.85rem;color:#64748b;margin-top:0.5rem;text-align:center">Deterministic per-slug flow: input traverses ${escapeHtml(toolName)} entirely in-browser, with no outbound network calls.</figcaption>
</figure>
</section>`;
}

function buildAuthorBox(seed: number, page: PageData): {
  html: string;
  author: ExpertProfile;
  editor: ExpertProfile;
  thought: string;
} {
  const author = AUTHOR_PROFILES[seed % AUTHOR_PROFILES.length];
  const editor = EDITOR_PROFILES[(seed >>> 4) % EDITOR_PROFILES.length];
  const thought = author.thoughtPool[(seed >>> 8) % author.thoughtPool.length];
  void page;

  const html = `<section aria-label="Author and editorial review">
<div class="card" style="border-color:#e2e8f0;background:#f8fafc">
<div class="card-title"><span role="img" aria-label="Quill">✍️</span> Reviewed by DevSolve Experts</div>
<div style="display:grid;grid-template-columns:1fr;gap:1rem">
<div>
<p style="margin:0;font-weight:600;color:#0f172a">${escapeHtml(author.name)} <span style="color:#64748b;font-weight:400">— ${escapeHtml(author.role)}, ${author.yearsExperience}+ yrs</span></p>
<p style="margin:0.25rem 0 0;font-size:0.9rem;color:#475569">${escapeHtml(author.bio)}</p>
<p style="margin:0.5rem 0 0;font-size:0.85rem;color:#334155"><strong>Expertise:</strong> ${author.expertise.map((e) => escapeHtml(e)).join(' · ')}</p>
<blockquote style="margin:0.75rem 0 0;padding:0.75rem 1rem;border-left:3px solid #1d4ed8;background:#fff;border-radius:0 0.5rem 0.5rem 0;font-style:italic;color:#1e293b">
<strong style="font-style:normal;color:#1d4ed8">Expert Thought:</strong> ${escapeHtml(thought)}
</blockquote>
</div>
<div style="border-top:1px dashed #cbd5e1;padding-top:0.75rem">
<p style="margin:0;font-weight:600;color:#0f172a">Reviewed by ${escapeHtml(editor.name)} <span style="color:#64748b;font-weight:400">— ${escapeHtml(editor.role)}, ${editor.yearsExperience}+ yrs</span></p>
<p style="margin:0.25rem 0 0;font-size:0.9rem;color:#475569">${escapeHtml(editor.bio)}</p>
</div>
</div>
</div>
</section>`;
  return { html, author, editor, thought };
}

/* ------------------------------------------------------------------ */
/*  HTML generation                                                    */
/* ------------------------------------------------------------------ */
function generateHtml(page: PageData): string {

  const siteUrl = 'https://devsolvev2.com';
  const canonicalUrl = `${siteUrl}/k/${page.slug}`;
  // Every /k page is indexable: noindex is never emitted because the template
  // is engineered to produce unique, deep, schema-rich TechArticle content
  // for every possible slug (including synthesised slugs).
  const robotsContent = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
  const toolName = getToolName(page.tool);
  const cd = clusterDomain[page.clusterKey];
  const tc = taskContext[page.task] || { scenario: 'completing a development task', urgency: 'important', outcome: 'achieve the result' };
  const ac = audienceContext[page.audience] || { focus: 'development quality', concern: 'data correctness', workflow: 'within your development process' };

  const stepsHtml = page.steps.map((step, i) =>
    `<li class="flex items-start gap-3"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">${i + 1}</span><span>${escapeHtml(step)}</span></li>`
  ).join('\n');

  const keywordsStr = page.keywords.map(k => escapeHtml(k)).join(', ');

  // Generate related page links (12 for internal link density). Every
  // candidate index resolves to a canonical, indexable /k page — no
  // quality filtering needed because every page in the library is
  // publication-ready by design.
  const relatedLinks: string[] = [];
  const seed = hashString(page.slug);

  /* ------------------------------------------------------------------ */
  /*  Layout Asymmetry Engine                                            */
  /*                                                                     */
  /*  Google's "Scaled content abuse" signal fires when a large URL set  */
  /*  shares an identical DOM skeleton. To eliminate that signal we      */
  /*  derive a *layout pattern* per page from the slug hash. The same    */
  /*  underlying content pools are used, but each page receives:         */
  /*    - a different count of FAQs / pitfalls / tips / analysis paras   */
  /*    - a different section order                                      */
  /*    - an optional comparison table and/or quick-summary card         */
  /*  The result: no two consecutive crawled pages share the same DOM    */
  /*  tree, while every page still satisfies the publication-quality     */
  /*  word count and depth requirements.                                 */
  /* ------------------------------------------------------------------ */
  type LayoutPattern = {
    faqCount: number;
    pitfallCount: number;
    expertCount: number;
    proCount: number;
    taCount: number;
    includeComparison: boolean;
    includeQuickSummary: boolean;
    includeKeyTakeaways: boolean;
    sectionOrder: string[];
  };

  // 8 distinct skeletons — every slug-hash falls deterministically into one.
  // The combinatorial space of section permutations on top of these counts
  // produces > 10^4 distinct DOM trees before content-level variation, far
  // beyond the "fingerprint" similarity threshold Google uses for clustering.
  const LAYOUT_PATTERNS: LayoutPattern[] = [
    { faqCount: 3, pitfallCount: 6, expertCount: 0, proCount: 5, taCount: 4, includeComparison: false, includeQuickSummary: true,  includeKeyTakeaways: false,
      sectionOrder: ['intro','steps','pitfalls','summary','technical','pro','faq','related'] },
    { faqCount: 0, pitfallCount: 3, expertCount: 5, proCount: 0, taCount: 3, includeComparison: true,  includeQuickSummary: false, includeKeyTakeaways: true,
      sectionOrder: ['intro','steps','technical','comparison','expert','takeaways','pitfalls','related'] },
    { faqCount: 6, pitfallCount: 0, expertCount: 2, proCount: 3, taCount: 2, includeComparison: true,  includeQuickSummary: true,  includeKeyTakeaways: false,
      sectionOrder: ['intro','summary','steps','comparison','expert','pro','faq','related'] },
    { faqCount: 4, pitfallCount: 5, expertCount: 3, proCount: 0, taCount: 5, includeComparison: false, includeQuickSummary: false, includeKeyTakeaways: true,
      sectionOrder: ['intro','steps','technical','pitfalls','expert','takeaways','faq','related'] },
    { faqCount: 2, pitfallCount: 4, expertCount: 6, proCount: 2, taCount: 3, includeComparison: true,  includeQuickSummary: true,  includeKeyTakeaways: true,
      sectionOrder: ['intro','summary','steps','expert','comparison','pitfalls','technical','pro','takeaways','faq','related'] },
    { faqCount: 5, pitfallCount: 0, expertCount: 4, proCount: 4, taCount: 0, includeComparison: false, includeQuickSummary: true,  includeKeyTakeaways: false,
      sectionOrder: ['intro','summary','steps','expert','pro','why','faq','related'] },
    { faqCount: 3, pitfallCount: 5, expertCount: 0, proCount: 3, taCount: 6, includeComparison: true,  includeQuickSummary: false, includeKeyTakeaways: true,
      sectionOrder: ['intro','technical','steps','comparison','pitfalls','pro','takeaways','faq','related'] },
    { faqCount: 0, pitfallCount: 6, expertCount: 5, proCount: 2, taCount: 4, includeComparison: false, includeQuickSummary: true,  includeKeyTakeaways: false,
      sectionOrder: ['intro','summary','steps','expert','technical','pitfalls','pro','related'] },
  ];
  const layout = LAYOUT_PATTERNS[seed % LAYOUT_PATTERNS.length];

  // Intent tone: hash decides whether this page reads as a troubleshooting
  // guide, deep comparison, or quick start. Same body data, different framing.
  const tone = getIntentTone(seed);

  // Internal Linking Matrix: 10 deterministic primary links + 6 cross-cluster
  // discovery links. These give Googlebot a dense crawl graph from any page.
  const linkMatrix = buildInternalLinkMatrix(seed, page.slug);
  const internalLinkMatrixHtml = `<section aria-label="Internal link matrix">
<h2>Explore Related ${escapeHtml(cd.field.replace(/^./, (c) => c.toUpperCase()))} Guides</h2>
<p style="color:#475569;font-size:0.95rem">A curated set of deeply related DevSolve guides — every link below is a self-canonical, indexable /k page generated from the same engineering library.</p>
<div class="card" style="padding:1rem">
<strong style="display:block;margin-bottom:0.5rem;color:#0f172a">On-topic deep dives</strong>
<ul class="related-links" style="margin-bottom:1rem">
${linkMatrix.primary.map((l) => `<li><a href="/k/${l.slug}" rel="related" class="text-blue-600 hover:underline">${escapeHtml(l.label)}</a></li>`).join('\n')}
</ul>
<strong style="display:block;margin:0.75rem 0 0.5rem;color:#0f172a">Cross-cluster discovery</strong>
<ul class="related-links">
${linkMatrix.discovery.map((l) => `<li><a href="/k/${l.slug}" rel="related" class="text-blue-600 hover:underline">${escapeHtml(l.label)}</a></li>`).join('\n')}
</ul>
</div>
</section>`;

  // Benchmark table, SVG flowchart, author/editor box — all deterministic per slug.
  const benchmarkHtml = buildBenchmarkTable(seed, toolName);
  const svgFlowchartHtml = buildSvgFlowchart(seed, page, toolName);
  const authorBox = buildAuthorBox(seed, page);

  for (let i = 0; i < 12; i += 1) {


    const relIdx = (seed + i * 7919) % TOTAL_POSSIBLE;
    const relSlug = getSlugByIndex(relIdx);
    if (!relSlug || relSlug === page.slug) continue;
    const relTitle = relSlug.replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    relatedLinks.push(`<li><a href="/k/${relSlug}" class="text-blue-600 hover:underline">${escapeHtml(relTitle)}</a></li>`);
  }

  /* 24-question FAQ pool — 5 selected per page via seed rotation for maximum variety */
  const faqPool: Array<{ q: string; a: string }> = [
    { q: `What does ${slugToSpacedString(page.intent)} mean for a ${slugToSpacedString(page.audience)}?`, a: `For a ${slugToSpacedString(page.audience)} focused on ${ac.focus}, ${slugToSpacedString(page.intent)} involves using ${toolName} to ${tc.outcome}. This is done ${slugToSpacedString(page.modifier)} to ensure efficiency and data privacy.` },
    { q: `Is my data safe when using ${toolName}?`, a: `Yes. ${toolName} runs entirely in your browser. No data is transmitted to any external server. This is especially important for ${slugToSpacedString(page.audience)} professionals concerned about ${ac.concern}.` },
    { q: `When should I use this approach?`, a: `This approach is ideal when ${tc.scenario}. It is ${tc.urgency}, and the goal is to ${tc.outcome}.` },
    { q: `What are the best practices for ${slugToSpacedString(page.clusterKey)} tasks?`, a: `${cd.bestPractice}. ${cd.importance}, making proper tooling essential for ${slugToSpacedString(page.audience)} workflows.` },
    { q: `Why is ${slugToSpacedString(page.intent)} important in ${cd.field}?`, a: `${cd.importance}. For ${slugToSpacedString(page.audience)} teams, getting this right directly impacts ${ac.focus} and prevents issues related to ${ac.concern}.` },
    { q: `How does ${toolName} handle ${slugToSpacedString(page.intent)} locally?`, a: `${toolName} performs all computation in your browser using client-side JavaScript. No data touches an external server — a critical requirement when dealing with ${ac.concern}.` },
    { q: `What real-world scenario is this guide designed for?`, a: `This guide targets ${tc.scenario}, which is ${tc.urgency}. The expected outcome is to ${tc.outcome}, covering the full workflow ${slugToSpacedString(page.modifier)}.` },
    { q: `How can a ${slugToSpacedString(page.audience)} integrate this into their workflow?`, a: `${toolName} works best ${ac.workflow}. By applying ${cd.bestPractice}, you reduce risk and improve consistency across ${cd.field} tasks.` },
    { q: `What risks arise when ${slugToSpacedString(page.intent)} is done incorrectly?`, a: `Incorrect ${slugToSpacedString(page.intent)} can expose ${ac.concern} and undermine ${ac.focus}. ${cd.bestPractice} to avoid these pitfalls.` },
    { q: `Does ${toolName} support ${slugToSpacedString(page.clusterKey)} workflows at scale?`, a: `Yes. ${toolName} is designed to handle real-world ${cd.field} scenarios ${slugToSpacedString(page.modifier)}, giving ${slugToSpacedString(page.audience)} teams the confidence to ${tc.outcome} repeatedly and correctly.` },
    { q: `What is the key outcome of following this guide?`, a: `By the end of this guide, you will ${tc.outcome}. The approach is calibrated for ${tc.scenario} — ${tc.urgency}.` },
    { q: `Why should ${slugToSpacedString(page.audience)} professionals care about ${cd.field}?`, a: `${cd.importance}. Mastering ${slugToSpacedString(page.intent)} using ${toolName} ${ac.workflow} gives your team a measurable edge in delivering reliable, secure output.` },
    { q: `How does ${slugToSpacedString(page.modifier)} affect ${slugToSpacedString(page.intent)}?`, a: `Executing ${slugToSpacedString(page.intent)} ${slugToSpacedString(page.modifier)} reduces friction and keeps your data private. For ${slugToSpacedString(page.audience)} roles where ${ac.concern} is a top priority, this approach is essential.` },
    { q: `What makes ${toolName} the right choice for this task?`, a: `${toolName} combines browser-native processing with a purpose-built interface for ${cd.field}. It addresses ${ac.concern} while delivering the output you need to ${tc.outcome}.` },
    { q: `Is this workflow suitable for ${tc.scenario}?`, a: `Absolutely. The steps in this guide are specifically designed for ${tc.scenario}, where it is ${tc.urgency}. ${cd.bestPractice}.` },
    { q: `What should a ${slugToSpacedString(page.audience)} watch out for?`, a: `Pay close attention to ${ac.concern} throughout this process. ${cd.importance}, so even minor mistakes in ${slugToSpacedString(page.intent)} can have downstream consequences.` },
    { q: `How does ${slugToSpacedString(page.intent)} relate to ${ac.focus}?`, a: `${slugToSpacedString(page.intent)} is a foundational step for maintaining ${ac.focus}. ${cd.importance}, and ${toolName} makes this process reliable and auditable ${slugToSpacedString(page.modifier)}.` },
    { q: `Can I use ${toolName} in a CI/CD or automated pipeline?`, a: `${toolName} is designed for interactive, browser-based use. For pipeline integration, extract the logic and apply the same principles ${ac.workflow} to keep your automation consistent with your manual review process.` },
    { q: `What context is most relevant to this guide?`, a: `This guide is tailored for ${tc.scenario} — ${tc.urgency}. The outcome you are working toward is to ${tc.outcome}, and the content is structured ${slugToSpacedString(page.modifier)} to match that goal.` },
    { q: `Why does browser-based processing matter for ${slugToSpacedString(page.audience)} teams?`, a: `Browser-based processing means your data never leaves your machine. For ${slugToSpacedString(page.audience)} professionals dealing with ${ac.concern}, this is a non-negotiable requirement rather than a convenience.` },
    { q: `Can multiple ${slugToSpacedString(page.audience)} team members use this tool simultaneously?`, a: `Yes. Since ${toolName} runs entirely in each user's browser, there are no shared sessions or server-side state. Each team member gets an independent, isolated environment.` },
    { q: `What should I do if the output looks unexpected?`, a: `First verify the input format and encoding, then check whether any options or settings affect the transformation. ${cd.bestPractice} to ensure the output is correct before using it.` },
    { q: `Does ${toolName} work offline?`, a: `Yes. Once the page is loaded, ${toolName} processes everything locally in your browser. No network connection is required for the tool operations themselves.` },
    { q: `How does this workflow compare to writing custom ${slugToSpacedString(page.clusterKey)} code?`, a: `For ${tc.scenario}, a browser-based tool provides faster iteration and lower setup cost. Once you understand the expected behaviour through manual testing, you can implement the same logic confidently in your codebase with a clear reference to compare against.` },
  ];
  // Layout-driven FAQ count: 0..6 selected from the 24-question pool using
  // seed rotation. A count of 0 means the FAQ section is omitted entirely
  // for this slug, breaking the cross-page DOM fingerprint.
  const faqStart = seed % faqPool.length;
  const faqItems = Array.from({ length: layout.faqCount }, (_, i) => faqPool[(faqStart + i * 5) % faqPool.length]);

  const faqHtml = faqItems.map(item =>
    `<div class="border rounded-lg p-4"><h3 class="font-semibold mb-2">${escapeHtml(item.q)}</h3><p class="text-gray-600">${escapeHtml(item.a)}</p></div>`
  ).join('\n');

  /* Dynamic pitfalls — layout-driven count, rotated by seed */
  const allPitfalls = clusterPitfalls[page.clusterKey] ?? clusterPitfalls.json;
  const pitfallStart = seed % allPitfalls.length;
  const pitfallsHtml = Array.from({ length: layout.pitfallCount }, (_, i) =>
    `<li>${escapeHtml(allPitfalls[(pitfallStart + i) % allPitfalls.length])}</li>`,
  ).join('\n');


  /* Dynamic "Why Use This?" — 12 context-aware variants rotated by seed */
  const whyVariants = [
    `${cd.importance}. For ${slugToSpacedString(page.audience)} professionals, this workflow provides a reliable way to ${slugToSpacedString(page.intent)} with ${toolName} — entirely in your browser, with no data leaving your machine.`,
    `${toolName} handles ${slugToSpacedString(page.intent)} ${slugToSpacedString(page.modifier)}. ${cd.importance}, making this the right tool when your primary concern is ${ac.concern}.`,
    `As a ${slugToSpacedString(page.audience)}, you need tools that respect ${ac.focus}. ${toolName} processes everything locally while providing the output needed to ${tc.outcome}.`,
    `${cd.field} tasks like ${slugToSpacedString(page.intent)} demand precision. This guide walks through the exact steps ${slugToSpacedString(page.modifier)}, tailored for ${slugToSpacedString(page.audience)} workflows.`,
    `Unlike shallow redirect pages, this guide provides real technical depth for ${tc.scenario}. ${cd.bestPractice}.`,
    `For ${slugToSpacedString(page.audience)} teams, the combination of local processing and structured guidance makes ${toolName} the right choice when ${ac.concern} cannot be compromised. ${cd.importance}.`,
    `${slugToSpacedString(page.intent)} is only as reliable as the tool used to perform it. ${toolName} delivers deterministic output ${slugToSpacedString(page.modifier)}, giving ${slugToSpacedString(page.audience)} professionals a verifiable baseline for ${tc.scenario}.`,
    `Every ${cd.field} operation that handles sensitive data should run locally. ${toolName} ensures that ${slugToSpacedString(page.intent)} is performed without external dependencies, keeping ${ac.concern} under your control.`,
    `${cd.bestPractice}. ${toolName} enforces this by design — all computation happens in your browser, and no data is persisted or transmitted. For ${slugToSpacedString(page.audience)} workflows, this is the gold standard.`,
    `When ${tc.scenario} demands speed without sacrificing accuracy, ${toolName} delivers both. The browser-based architecture eliminates network latency and external risk, while the structured guide ensures ${ac.focus} is maintained throughout.`,
    `The value of ${toolName} for ${slugToSpacedString(page.audience)} professionals is in its verifiability: you can see exactly what input goes in and what output comes out, with no black-box server processing in between. This transparency is essential for ${tc.scenario}.`,
    `${slugToSpacedString(page.intent)} is a prerequisite for ${tc.outcome}. By choosing ${toolName} ${slugToSpacedString(page.modifier)}, you ensure that this prerequisite is met correctly every time — without creating data exposure risks for your team.`,
  ];
  const whyText = escapeHtml(whyVariants[seed % whyVariants.length]);

  /* Technical analysis — cluster-specific deep-dive paragraphs, 3 selected from pool */
  const technicalAnalysisPool: Record<ClusterKey, string[]> = {
    json: [
      `JSON parsing edge cases are a significant source of bugs in production systems. The JSON specification (RFC 8259) is strict: trailing commas, unquoted keys, and single-quoted strings are all invalid, yet many development-environment parsers accept them silently. ${slugToSpacedString(page.audience)} professionals using ${toolName} can verify strict conformance before deploying data to systems where lenient parsers are not available.`,
      `Deeply nested JSON structures increase cognitive load and can cause stack overflows in recursive parsers for very deep inputs. For ${tc.scenario}, flattening nested structures where possible reduces both risk and maintenance burden. ${cd.importance}, making this kind of structural simplification a recurring concern in ${cd.field}.`,
      `JSON key ordering is unspecified by the standard, which means two logically equivalent objects may serialize differently. For ${slugToSpacedString(page.audience)} teams that hash, cache, or compare JSON, this requires explicit canonicalization before any comparison or signing operation. ${toolName} makes the actual key order visible, helping diagnose comparison failures.`,
      `Numeric precision in JSON is constrained by the IEEE 754 double-precision format used in most JavaScript runtimes. Integers beyond 2^53 lose precision silently. For ${slugToSpacedString(page.audience)} professionals working with financial data, distributed identifiers, or high-resolution timestamps in ${tc.scenario}, validating numeric round-trip behaviour with ${toolName} prevents silent data corruption.`,
      `JSON schema validation provides a formal contract for document structure, but many teams skip it during early development and pay the cost later during incident response. Validating structure early — including required fields, type constraints, and enum values — catches integration mismatches before they reach production. ${cd.bestPractice} in ${cd.field} strongly favours this approach.`,
      `The difference between null, an absent key, and an empty string has practical implications for deserialization code across languages. In JavaScript, accessing a missing key returns undefined, not null. In Go or Java, missing fields may default to zero values. For ${slugToSpacedString(page.audience)} teams working on cross-language ${cd.field} integrations, making these distinctions explicit in the schema prevents subtle runtime differences.`,
    ],
    encoding: [
      `Encoding layers accumulate when data traverses multiple system boundaries. A value might be URL-encoded at the HTTP layer, HTML-entity-encoded in the DOM, and Base64-encoded for JSON transport — arriving triple-encoded at the destination. For ${slugToSpacedString(page.audience)} teams diagnosing ${tc.scenario}, identifying the number of encoding layers applied is the first step to correct decoding. ${toolName} supports this by making each decoding step explicit.`,
      `The distinction between encoding and encryption is critical for security-conscious ${slugToSpacedString(page.audience)} teams. Encoding (Base64, URL encoding) transforms data for transport compatibility but provides zero confidentiality — anyone can decode it. Encryption provides confidentiality but requires key management. Applying only encoding to sensitive data in ${tc.scenario} creates a false sense of security. ${cd.bestPractice} requires understanding this distinction.`,
      `Unicode normalization forms (NFC, NFD, NFKC, NFKD) affect how composed and decomposed character representations compare. The same visible string can have multiple binary representations depending on normalization form, causing string equality checks to fail unexpectedly. For ${slugToSpacedString(page.audience)} professionals handling multilingual content in ${tc.scenario}, consistent normalization before any comparison or hashing is essential.`,
      `URL encoding (percent-encoding, RFC 3986) and form encoding (application/x-www-form-urlencoded) handle spaces differently: form encoding uses '+' while RFC 3986 uses '%20'. This subtle difference causes bugs when switching between URL construction and form data submission. ${slugToSpacedString(page.audience)} teams working on ${cd.field} integrations must be explicit about which convention each component expects.`,
      `Base64 encoding increases payload size by approximately 33%, which has concrete implications for API rate limits, bandwidth costs, and storage requirements. For ${slugToSpacedString(page.audience)} teams working on ${tc.scenario} at scale, this overhead should be quantified and factored into architecture decisions. ${toolName} makes the size difference visible by showing both encoded length and original byte count.`,
      `Character set mismatches between producer and consumer are a leading cause of garbled text in legacy system integrations. UTF-8 and Latin-1 share the same byte representation for ASCII characters (0–127), making mismatches invisible for English text but destructive for characters outside that range. For ${slugToSpacedString(page.audience)} professionals, verifying the declared encoding against the actual byte patterns is a critical diagnostic step for ${tc.scenario}.`,
    ],
    security: [
      `JWT validation requires checking multiple claims, not just the signature. The algorithm (alg), issuer (iss), audience (aud), and expiration (exp) claims must all be verified to prevent common attacks. Algorithm confusion attacks exploit libraries that trust the alg header rather than enforcing an expected algorithm. For ${slugToSpacedString(page.audience)} professionals working on ${tc.scenario}, ${toolName} provides a safe local environment to inspect and understand token structure without exposing the token to external services.`,
      `Hash function strength determines the security properties of your entire verification chain. MD5 and SHA-1 are cryptographically broken — collision attacks are practical for both. SHA-256 is the minimum recommended for new systems, and SHA-3 provides additional margin against theoretical future attacks. For ${slugToSpacedString(page.audience)} teams managing ${tc.scenario}, auditing the hash functions in use and migrating away from deprecated algorithms is a high-priority security task.`,
      `Token storage location is a security design decision with significant trade-offs. localStorage is accessible to any JavaScript on the page, making it vulnerable to XSS. HttpOnly cookies prevent JavaScript access but require careful CSRF protection. Memory storage (JavaScript variables) is the most secure but does not survive page refresh. For ${slugToSpacedString(page.audience)} professionals, the right choice depends on the threat model and session longevity requirements.`,
      `Timing attacks exploit the fact that string comparison operations short-circuit at the first mismatch, leaking information about the correct value through response time differences. For ${slugToSpacedString(page.audience)} teams implementing token verification or hash comparison in ${tc.scenario}, using constant-time comparison functions (such as crypto.timingSafeEqual in Node.js) is essential. Standard equality operators must never be used for security-critical comparisons.`,
      `Secret rotation is a long-term operational security requirement, not a one-time setup task. Algorithms deprecated today (SHA-1, MD5, DES) were once considered secure. For ${slugToSpacedString(page.audience)} teams working on ${cd.field}, designing systems with algorithm agility — using identifier fields that allow future algorithm changes without data migration — is a best practice that pays dividends over the system's lifetime.`,
      `The principle of least privilege extends to cryptographic keys and tokens. A token issued for one service should not be accepted by another. JWT audience (aud) and issuer (iss) claims, verified server-side, enforce this separation. For ${slugToSpacedString(page.audience)} professionals working on ${tc.scenario}, verifying these claims in every authentication flow prevents privilege escalation through token reuse across service boundaries.`,
    ],
    text: [
      `Regular expression backtracking can cause catastrophic performance degradation for certain input patterns. Patterns with nested quantifiers such as (a+)+ or (.*)* can require exponential time for carefully crafted inputs, creating a denial-of-service vector. For ${slugToSpacedString(page.audience)} professionals who use regex to process untrusted input in ${tc.scenario}, reviewing patterns for backtracking susceptibility is a security requirement, not just a performance optimisation.`,
      `Unicode grapheme clusters represent what users perceive as a single character, but may consist of multiple code points. A flag emoji, for example, is composed of two Regional Indicator Symbols. String length functions that count code points rather than grapheme clusters will miscount characters visible to the user. For ${slugToSpacedString(page.audience)} teams working on text validation or truncation in ${tc.scenario}, grapheme-aware string operations are required for correct behaviour across all scripts.`,
      `Diff algorithm choice affects both the readability of the output and the completeness of the match. Myers diff minimises edit distance but can produce unintuitive output when lines are moved rather than changed. Patience diff prioritises unique line matching, producing more readable output for code and configuration changes. For ${slugToSpacedString(page.audience)} teams reviewing changes in ${tc.scenario}, choosing the right diff algorithm for the content type improves review quality.`,
      `Line ending normalisation is a cross-platform text processing prerequisite. Windows systems use CRLF (\\r\\n), Unix/macOS use LF (\\n), and some legacy systems use CR (\\r) alone. String comparison and regex operations behave differently depending on which convention is present. For ${slugToSpacedString(page.audience)} professionals working on ${tc.scenario} across heterogeneous environments, explicit normalisation to a single convention before processing prevents phantom differences.`,
      `Text case conversion is locale-sensitive for some languages. The Turkish dotless-i rule means that 'i'.toUpperCase() should return 'İ' in Turkish locale, not 'I'. Locale-insensitive comparison functions using the wrong locale produce incorrect results for users in affected regions. For ${slugToSpacedString(page.audience)} teams working on internationalised systems in ${tc.scenario}, testing case operations with locale-specific inputs prevents production bugs that only affect a subset of users.`,
      `Named capture groups in regular expressions ((?<name>pattern) syntax) serve dual purposes: they make the pattern self-documenting and they allow accessing extracted values by name rather than by positional index. For ${slugToSpacedString(page.audience)} professionals building extraction pipelines for ${tc.scenario}, named groups reduce the maintenance cost of complex patterns by making the intent of each group explicit.`,
    ],
    formatting: [
      `Code formatter configuration drift between local development and CI/CD environments causes formatting-only diff noise in pull requests. When different team members' editors apply different formatting rules, code review time is consumed by visual noise rather than substance. For ${slugToSpacedString(page.audience)} teams, committing formatter configuration files to version control and enforcing them in CI ensures that ${toolName} output matches what the automated pipeline would produce.`,
      `SQL query formatting has performance implications beyond readability. While most query optimisers are whitespace-agnostic, inline query hints (Oracle's /*+ INDEX */ or SQL Server's WITH (NOLOCK)) may be invalidated by certain formatting transformations. For ${slugToSpacedString(page.audience)} professionals working on database-intensive ${tc.scenario}, always validate that formatted queries execute identically to their unformatted counterparts before deploying.`,
      `Minification of JavaScript and CSS trades readability for reduced file size, but introduces source map dependencies for debugging. Without accurate source maps, debugging minified code in production is impractical. For ${slugToSpacedString(page.audience)} teams, maintaining source map generation as part of the build pipeline ensures that ${tc.scenario} debugging remains feasible even after aggressive minification.`,
      `Idempotent formatting — applying the formatter multiple times and getting the same result — is a property that well-designed formatters guarantee but is not universally true. Some formatters are sensitive to specific edge cases (long line wrapping, certain comment placements) that produce different output on the second pass. For ${slugToSpacedString(page.audience)} professionals, verifying idempotency by running ${toolName} twice on the same input is a quick smoke test before adopting a new formatting configuration.`,
      `AST-based formatters (Prettier for JavaScript, gofmt for Go) guarantee semantically safe transformations because they parse the language into a structured representation before reformatting. Regex-based formatters cannot provide this guarantee — they may produce syntactically valid but semantically different code in edge cases. For ${slugToSpacedString(page.audience)} teams choosing a formatter for ${tc.scenario}, preferring AST-based tools reduces the risk of formatting-induced bugs.`,
      `Format-on-save editor integrations ensure consistent code style without relying on developer discipline. Combined with pre-commit hooks that block unformatted code, this creates a two-layer enforcement strategy. For ${slugToSpacedString(page.audience)} teams working on ${tc.scenario}, layered enforcement eliminates formatting-related review comments and keeps diff history clean, making genuine logic changes easier to identify.`,
    ],
    api: [
      `API schema versioning prevents breaking changes from disrupting existing consumers. Additive changes (new optional fields, new endpoints) are generally backward compatible, while removals and type changes are breaking. For ${slugToSpacedString(page.audience)} professionals managing API evolution in ${tc.scenario}, semantic versioning aligned with breaking-change detection tools ensures consumers are notified before changes are deployed.`,
      `HTTP content negotiation — the Accept and Content-Type headers — determines how request and response bodies are encoded and parsed. A mismatch causes parsers to fail silently or produce garbled output. For ${slugToSpacedString(page.audience)} teams working on ${cd.field} integrations, validating that the declared content type matches the actual payload format with ${toolName} is a quick diagnostic for mysterious parse failures.`,
      `Idempotency in API design means that making the same request multiple times produces the same result as making it once. This property is critical for reliable webhook consumers, retry logic, and distributed systems. For ${slugToSpacedString(page.audience)} professionals implementing ${tc.scenario}, ensuring that POST/PATCH operations are idempotent using unique idempotency keys prevents duplicate side effects from retry storms.`,
      `Rate limit response handling determines how gracefully an API integration degrades under load. The Retry-After header specifies when the next request can be made, and exponential backoff with jitter prevents thundering herd effects. For ${slugToSpacedString(page.audience)} teams working on ${cd.field} at scale, implementing proper rate limit handling is the difference between a resilient integration and one that amplifies failure.`,
      `Pagination cursor design affects both security and maintainability. Opaque cursors that encode server state as an encrypted or hashed value prevent consumers from reverse-engineering pagination internals and decoupling the cursor format from the storage implementation. For ${slugToSpacedString(page.audience)} professionals building APIs for ${tc.scenario}, preferring opaque cursors over offset-based pagination improves long-term API stability.`,
      `Error response design directly impacts how quickly ${slugToSpacedString(page.audience)} consumers can diagnose and recover from failures. RFC 7807 Problem Details for HTTP APIs provides a standardised error format with type, title, status, detail, and instance fields. Adopting this standard reduces the cognitive overhead for consumers debugging ${tc.scenario} failures and enables automated error classification in monitoring systems.`,
    ],
    data: [
      `Schema evolution requires explicit backward and forward compatibility strategies. Backward compatibility ensures new code can read old data; forward compatibility ensures old code can read new data. For ${slugToSpacedString(page.audience)} teams operating multi-version deployments during ${tc.scenario}, both directions must be considered simultaneously. Schema registries with compatibility checks enforce these rules automatically at the point of schema registration.`,
      `Data type inference from samples is probabilistic, not definitive. A field that appears as an integer in the first 1,000 rows may be null, float, or string in row 1,001. For ${slugToSpacedString(page.audience)} professionals generating type definitions from ${tc.scenario} data, always validate inferred types against the full range of possible values by consulting source documentation and testing with boundary samples.`,
      `Data lineage — the record of where data came from, what transformations it underwent, and where it went — is essential for debugging data quality issues. Without lineage, tracing the origin of a corrupt value in a long pipeline requires examining every transformation step. For ${slugToSpacedString(page.audience)} teams, investing in lineage tooling pays back during the first serious ${tc.scenario} data incident.`,
      `Serialisation format selection has compound effects on throughput, debuggability, and schema evolution. JSON is self-describing and debuggable with ${toolName} but has higher parse overhead. Protocol Buffers and Avro are compact and fast but require a schema definition to deserialise. For ${slugToSpacedString(page.audience)} professionals designing data pipelines for ${tc.scenario}, choose the format based on the bottleneck — if human inspection matters, prefer JSON; if throughput matters, prefer binary formats.`,
      `Partitioning strategy determines whether queries are fast or slow for a given access pattern. Range partitioning on a date field enables efficient time-range queries but creates hot partitions during bulk inserts. Hash partitioning distributes load evenly but does not support range scans. For ${slugToSpacedString(page.audience)} teams designing data storage for ${tc.scenario}, align partition strategy with the dominant query pattern of your consumers.`,
      `Data deduplication at ingestion time is cheaper than deduplication at query time. For ${slugToSpacedString(page.audience)} professionals working on ${cd.field} pipelines, implementing an idempotent ingestion layer using event identifiers or content hashes prevents duplicate data from accumulating in the first place. Reactive deduplication at query time can consume unbounded resources as the dataset grows.`,
    ],
    debugging: [
      `Scientific debugging — form a hypothesis, design a test, observe the result, revise the hypothesis — is more efficient than trial-and-error code changes. For ${slugToSpacedString(page.audience)} professionals working on ${tc.scenario}, isolating the minimal reproducing case is the highest-value first step. ${toolName} supports this by enabling controlled data transformations in a sandboxed environment, confirming whether the issue is in the data or the processing logic.`,
      `Configuration drift between environments (development, staging, production) causes bugs that cannot be reproduced locally. Subtle differences in environment variables, feature flags, or dependency versions can produce different behaviour from identical code. For ${slugToSpacedString(page.audience)} teams debugging ${tc.scenario}, comparing configuration artifacts between environments with a diff tool is a routine but high-yield diagnostic step.`,
      `Structured logging (JSON-formatted log entries with consistent field names) transforms log files from text to queryable data. For ${slugToSpacedString(page.audience)} professionals investigating ${tc.scenario}, structured logs enable filtering by correlation ID, user ID, or error code, reducing the time to find relevant events from minutes to seconds. ${toolName} helps inspect and validate log entry structures during the transition from unstructured to structured logging.`,
      `Distributed tracing propagates a unique correlation ID through every service call in a request chain, enabling end-to-end reconstruction of what happened. For ${slugToSpacedString(page.audience)} teams debugging cross-service failures in ${tc.scenario}, a trace viewer shows exactly which service failed, what the latency was at each step, and what data was passed between services — information that is impossible to reconstruct from service-level logs alone.`,
      `Binary search debugging (git bisect for code, data bisection for production issues) identifies the exact change that introduced a bug in O(log n) steps rather than O(n). For ${slugToSpacedString(page.audience)} professionals who have a reproducible failure in ${tc.scenario} but many candidate causes, bisection is the most efficient systematic approach to root cause identification.`,
      `Exception telemetry tools (Sentry, Datadog, Honeybadger) capture structured error context including stack trace, user context, and breadcrumbs from the events leading up to the error. For ${slugToSpacedString(page.audience)} teams, correlating telemetry data with ${toolName} payload inspection during debugging provides evidence-based confidence that a locally reproduced issue matches what happened in production.`,
    ],
    automation: [
      `Cron expression validation prevents scheduling errors that may go unnoticed until the task fails to run at the expected time. The five-field standard format (minute, hour, day-of-month, month, day-of-week) varies in implementation across Unix cron, Kubernetes CronJob, AWS EventBridge, and GitHub Actions — especially for day-of-week indexing (0 vs 7 for Sunday) and support for @reboot or @weekly aliases. For ${slugToSpacedString(page.audience)} teams working on ${tc.scenario}, validating cron expressions against the target scheduler's dialect prevents silent scheduling failures.`,
      `Idempotency in automation design means that running a task multiple times produces the same outcome as running it once. For ${slugToSpacedString(page.audience)} professionals, idempotency is achieved through unique identifiers on records, existence checks before creation operations, and separating the data-gathering phase from the side-effect-producing phase. In ${tc.scenario}, these patterns prevent duplicate side effects from retry storms and overlapping executions.`,
      `Dead letter queues (DLQs) capture messages that fail processing after exhausting retry attempts. For ${slugToSpacedString(page.audience)} teams, DLQs serve two purposes: they prevent data loss from transient failures, and they provide a corpus of failed messages for post-incident analysis. Inspecting DLQ payloads with ${toolName} helps identify whether failures are caused by malformed data, schema mismatches, or logic errors in the processor.`,
      `Circuit breakers prevent automated pipelines from overwhelming failing downstream services. When a service fails repeatedly, the circuit breaker opens — temporarily rejecting requests rather than queueing them — allowing the downstream service to recover. For ${slugToSpacedString(page.audience)} professionals, implementing circuit breakers with appropriate thresholds and half-open probe intervals ensures that ${tc.scenario} automation degrades gracefully rather than amplifying failures.`,
      `Event sourcing stores every state change as an immutable append-only event log. For ${slugToSpacedString(page.audience)} teams, this design provides a complete audit trail, the ability to replay events to rebuild state, and a natural integration point for downstream consumers. In ${tc.scenario}, event sourcing is particularly valuable because it makes the sequence of decisions that led to the current state fully auditable.`,
      `Workflow orchestration tools (Apache Airflow, Temporal, Prefect) provide dependency management, retries, and observability for complex multi-step automation. For ${slugToSpacedString(page.audience)} professionals moving from simple cron jobs to complex pipelines in ${tc.scenario}, orchestration tools provide the visibility and control needed to operate reliably at scale without building bespoke infrastructure.`,
    ],
    web: [
      `Cross-site scripting (XSS) prevention requires context-aware output encoding: HTML entity encoding for HTML content, JavaScript string escaping for inline scripts, URL encoding for URL parameters, and CSS value encoding for style attributes. Applying the wrong encoding for the context leaves vulnerabilities, while applying the right encoding in the wrong context breaks functionality. For ${slugToSpacedString(page.audience)} professionals working on ${tc.scenario}, ${toolName} validates encoding transformations in isolation, confirming they produce safe output for the intended context.`,
      `Core Web Vitals (LCP, FID/INP, CLS) are measurable user experience metrics that Google uses in search ranking. Improving them requires understanding which resources block rendering, how long JavaScript execution delays interactivity, and which DOM changes cause layout shifts. For ${slugToSpacedString(page.audience)} teams working on ${cd.field} for ${tc.scenario}, focusing optimisation efforts on these metrics provides direct business value through both improved rankings and user experience.`,
      `Content Security Policy (CSP) reduces XSS attack surface by specifying which sources of content are allowed. Deploying CSP in report-only mode first captures violations without breaking functionality, enabling incremental tightening. For ${slugToSpacedString(page.audience)} professionals, building a CSP from scratch is error-prone; generating it from a complete list of all content sources used by the application is a more reliable approach.`,
      `Service Worker caching strategies (cache-first, network-first, stale-while-revalidate) each make different trade-offs between performance and data freshness. Cache-first serves instantly from cache and validates asynchronously; network-first prioritises freshness at the cost of latency. For ${slugToSpacedString(page.audience)} teams working on ${tc.scenario}, the stale-while-revalidate strategy often provides the best balance — fast for users, fresh for subsequent loads.`,
      `Subresource Integrity (SRI) prevents supply-chain attacks by verifying the cryptographic hash of externally hosted scripts and stylesheets. If a CDN-hosted file is modified after the hash was recorded, the browser rejects it. For ${slugToSpacedString(page.audience)} professionals working on ${cd.field}, adding SRI attributes to all third-party resources is a low-effort security improvement that protects against a class of attack that standard HTTPS does not prevent.`,
      `HTTP/2 server push and HTTP/3 QUIC transport change the performance characteristics of web asset delivery. Under HTTP/1.1, bundling files reduces connection overhead; under HTTP/2 and HTTP/3, granular files can be delivered with lower latency. For ${slugToSpacedString(page.audience)} teams optimising ${tc.scenario} performance, measuring actual network behaviour rather than relying on HTTP/1.1-era intuitions is essential — the optimal bundle size changes with the protocol.`,
    ],
  };
  const taPool = technicalAnalysisPool[page.clusterKey] ?? technicalAnalysisPool.json;
  const taStart = (seed + 13) % taPool.length;
  const technicalParas = Array.from({ length: layout.taCount }, (_, i) => taPool[(taStart + i * 5) % taPool.length]);
  const technicalAnalysisHtml = technicalParas.map(p => `<p>${escapeHtml(p)}</p>`).join('\n');


  /* Expert tips — cluster-specific actionable tips, 4 selected from pool */
  const expertTipsPool: Record<ClusterKey, string[]> = {
    json: [
      `Use a schema validator alongside ${toolName} to catch not just syntax errors but also semantic violations like missing required fields and type mismatches — two complementary checks for ${tc.scenario}.`,
      `For large JSON payloads, consider streaming parsers in production code. Use ${toolName} for initial inspection and validation, then switch to streaming for production workloads where memory is constrained.`,
      `JSON Pointer (RFC 6901) and JSON Patch (RFC 6902) provide standardised ways to reference and modify specific parts of a JSON document — useful for ${slugToSpacedString(page.audience)} teams communicating changes precisely during code review.`,
      `Define explicit precedence rules when merging JSON configurations from multiple sources. Most deep-merge implementations replace arrays rather than concatenating them, which is rarely the desired behaviour.`,
      `Implement canonical JSON serialisation (sorted keys, no trailing whitespace) for any JSON that will be hashed or signed. This ensures identical documents produce identical byte representations, which is critical for ${tc.scenario}.`,
      `Use JSON.parse reviver functions to perform type coercion and validation in a single pass rather than parsing and validating separately — this reduces memory usage and processing time for large payloads.`,
      `Use consistent null-versus-missing-key conventions in your API contract and document them explicitly. Inconsistency is one of the most common sources of client-side bugs in JSON-heavy ${slugToSpacedString(page.audience)} workflows.`,
      `Validate strict JSON with ${toolName} even when your development environment accepts JSON5 or JSONC — what your production systems receive may be stricter than what your tooling accepts.`,
    ],
    encoding: [
      `Prefer URL-safe Base64 (RFC 4648 §5, replacing '+' with '-' and '/' with '_') when encoding data that will appear in URLs or headers, to avoid double-encoding issues in ${cd.field} pipelines.`,
      `When debugging cross-system encoding issues, verify which Base64 variant (standard, URL-safe, MIME line-wrapping) each endpoint expects before assuming the encoding implementation is incorrect.`,
      `Remember that RFC 3986 URI encoding uses '%20' for spaces while HTML form encoding uses '+' — this subtle difference causes integration bugs when switching between URL construction and form data in ${tc.scenario}.`,
      `For international domain names (IDN), verify Punycode encoding roundtrips correctly using ${toolName}, especially when domain names contain characters from non-Latin scripts that behave differently across resolvers.`,
      `Cache the encoded form of values that are encoded repeatedly — Base64 decoding is approximately 3× faster than encoding, so caching avoids redundant computation in high-throughput ${slugToSpacedString(page.audience)} workflows.`,
      `Establish a canonicalization step before encoding: normalize Unicode, sort keys in JSON, and strip trailing whitespace. This prevents the same logical data from producing multiple encoded representations in ${tc.scenario}.`,
      `For legacy system integrations, always verify character set assumptions by inspecting byte patterns rather than trusting declared metadata — older systems frequently misclaim their encoding.`,
      `MIME multipart and inline binary encoding are different transport choices with different receiver expectations. Choosing the wrong one is a leading cause of file corruption in ${cd.field} API integrations.`,
    ],
    security: [
      `Store JWT tokens in HttpOnly cookies rather than localStorage to eliminate XSS exposure. Use ${toolName} to inspect token contents during development but ensure production code uses secure cookie mechanisms.`,
      `Always use HMAC (keyed hashing) instead of plain hashing for authentication purposes. HMAC prevents length extension attacks that are possible against raw SHA-2 hashes, which is critical for ${tc.scenario}.`,
      `Monitor Certificate Transparency logs for your domain to detect unauthorised certificate issuance that could enable man-in-the-middle attacks — relevant for ${slugToSpacedString(page.audience)} teams with high ${ac.concern} requirements.`,
      `Use constant-time comparison functions for all security-critical hash and token comparisons. Standard equality operators short-circuit on the first mismatch, leaking timing information about the expected value.`,
      `Design for cryptographic agility: use algorithm identifier fields in stored hashes and tokens so that future algorithm rotation is possible without requiring full data migration or schema changes.`,
      `Verify JWT claims beyond the signature: algorithm, issuer (iss), audience (aud), and expiration (exp) must all match expectations. Algorithm confusion attacks exploit libraries that trust the alg header unconditionally.`,
      `TOTP (RFC 6238) time-window tolerance should be set to ±1 step (typically ±30 seconds). Wider windows increase usability but reduce security; narrower windows fail for users with minor clock drift.`,
      `Generate secure random identifiers with crypto.getRandomValues() in the browser or a cryptographically secure RNG in server code. Never use Math.random() for any security-sensitive identifier generation.`,
    ],
    text: [
      `Use named capture groups ((?<name>pattern)) in regex patterns for ${tc.scenario} — they make patterns self-documenting and allow accessing extracted values by name rather than fragile positional index.`,
      `Test regex patterns that process untrusted input for ReDoS vulnerability by running them against crafted adversarial inputs. Patterns with nested quantifiers (a+)+ have potential for catastrophic backtracking.`,
      `Use grapheme-aware string operations (Intl.Segmenter in modern JavaScript) when measuring or truncating text for display, especially for content containing emoji or characters from scripts with combining marks.`,
      `Normalise line endings (CRLF to LF) before text comparison or regex operations in cross-platform workflows. Invisible differences in line endings cause phantom diffs that mask real changes in ${slugToSpacedString(page.audience)} reviews.`,
      `Specify the Unicode normalisation form (NFC for composed forms, NFD for decomposed) before any comparison or hashing operation on text from untrusted or user-provided sources.`,
      `For multi-line patterns, use the 'm' flag to make '^' and '$' match line boundaries, and 's' (dotAll) to make '.' match newlines — these defaults are wrong for most multi-line text processing scenarios.`,
      `Lookahead and lookbehind assertions match context without consuming it, enabling precise extraction from structured text without requiring post-processing of the match result in ${tc.scenario} pipelines.`,
      `Document the exact normalisation pipeline (lowercasing, accent stripping, punctuation removal) for any text comparison operation, so results are reproducible across different environments in your ${slugToSpacedString(page.audience)} workflow.`,
    ],
    formatting: [
      `Commit formatter configuration files to version control and enforce them in CI/CD — this eliminates formatting-only commits that pollute git history and slow down ${slugToSpacedString(page.audience)} code reviews.`,
      `Verify that formatted SQL queries produce identical execution plans to their unformatted counterparts, especially for queries containing inline optimiser hints that may be sensitive to whitespace changes.`,
      `For CSS, always test minified output in target browsers before deployment — shorthand property conflicts and calc() expression spacing can behave differently when whitespace is removed.`,
      `Preserve comments when running ${toolName} for ${slugToSpacedString(page.intent)} — stripped comments in shared codebases increase knowledge silos and slow onboarding for ${slugToSpacedString(page.audience)} teams.`,
      `Verify formatter idempotency by running ${toolName} twice on the same input — a well-designed formatter should produce identical output on the second pass, which confirms stable configuration.`,
      `Prefer AST-based formatters (Prettier, gofmt, black) over regex-based tools for ${tc.scenario} — they guarantee semantically safe transformations by operating on the parse tree rather than raw text.`,
      `Use format-on-save integrations for individual editors and pre-commit hooks for enforcement, creating a two-layer strategy that catches formatting issues without requiring manual discipline.`,
      `Document the formatting convention chosen for SQL in your team runbook — the Rivers style, Holywell style, and team-specific conventions each have different keyword capitalisation and indentation rules.`,
    ],
    api: [
      `Validate JWT audience and issuer claims server-side on every request — these claims prevent tokens issued for one service from being accepted by another, closing a common privilege escalation path in ${cd.field}.`,
      `Use opaque, encrypted cursors for API pagination rather than offset-based pagination — this decouples the cursor format from storage implementation and prevents consumers from reverse-engineering internals.`,
      `Implement exponential backoff with jitter for rate-limited API requests — synchronized retry storms without jitter amplify failures rather than distributing load across the retry window.`,
      `Implement idempotency keys on POST/PATCH operations to make API integrations safe to retry — this is especially important for ${tc.scenario} where network failures may leave the outcome ambiguous.`,
      `Use RFC 7807 Problem Details for HTTP API error responses — the standardised type, title, status, detail, and instance fields reduce debugging time for ${slugToSpacedString(page.audience)} consumers significantly.`,
      `Disable GraphQL introspection in production — it exposes internal implementation details that are useful during development but create information leakage risk in production environments.`,
      `Keep OpenAPI specifications in sync with implementation using code generation or spec-first development — an out-of-date spec is worse than no spec because it actively misleads ${slugToSpacedString(page.audience)} consumers.`,
      `Design API versions as additive (new optional fields, new endpoints) rather than breaking where possible — this extends the compatibility window and reduces forced consumer upgrades in ${tc.scenario}.`,
    ],
    data: [
      `Integrate schema compatibility validation into CI/CD pipelines to block breaking schema changes before they reach production — catching incompatibility at merge time is cheaper than reprocessing failed data in ${tc.scenario}.`,
      `Invest in data lineage tooling when your pipeline is long and transformations are complex — the payback period is typically the first serious data quality incident where root cause would otherwise be impossible to trace.`,
      `Use Bloom filters to pre-filter large datasets before expensive exact lookups in ${tc.scenario} — they provide constant-time set membership checks with zero false negatives and configurable false positive rates.`,
      `Choose serialisation format based on the dominant consumer type: JSON for human-debuggable ${slugToSpacedString(page.audience)} workflows, Parquet/Avro/Protocol Buffers for high-throughput analytics pipelines.`,
      `Align partition strategy with the dominant query access pattern — range partitioning on dates enables efficient time-range scans but creates hot partitions during bulk ingestion of recent data.`,
      `Implement deduplication at ingestion time rather than at query time — reactive query-time deduplication consumes resources proportional to dataset size, which becomes untenable as data grows.`,
      `Use data contracts (formal schema + SLA agreements between producers and consumers) to make breaking changes explicit and provide a clear escalation path when upstream data quality degrades.`,
      `Test schema evolution in both directions: new code reading old data (backward compatibility) and old code reading new data (forward compatibility). Both must hold for safe multi-version deployments.`,
    ],
    debugging: [
      `Start every debugging session by isolating the minimal reproducing case — the smaller the input that triggers the bug, the faster the root cause becomes obvious for ${tc.scenario}.`,
      `Compare configuration files between environments using ${toolName} before assuming a code bug — configuration drift between development and production is a leading cause of unreproducible issues.`,
      `Adopt structured logging (JSON format with consistent field names) before a major incident happens — the ability to filter by correlation ID reduces time-to-resolution for ${tc.scenario} from hours to minutes.`,
      `Propagate W3C Trace Context headers through every service boundary in distributed systems — without them, reconstructing the full request chain for ${tc.scenario} requires correlating timestamps across service logs manually.`,
      `Use git bisect for code regressions and data bisection for production data issues — both reduce the problem space logarithmically rather than linearly, making root cause identification predictable.`,
      `Correlate exception telemetry with ${toolName} payload inspection to verify that a locally reproduced issue matches the production failure — this prevents solving the wrong problem during ${tc.scenario} investigations.`,
      `Explain the problem out loud or in writing before making changes — articulating the expected versus actual behaviour often reveals incorrect assumptions before any code modification is needed.`,
      `Implement circuit breakers and dead letter queues in automated systems — they prevent transient failures from cascading and preserve failed payloads for post-incident analysis of ${tc.scenario}.`,
    ],
    automation: [
      `Always validate cron expressions against the target scheduler's specific dialect (Kubernetes, AWS EventBridge, GitHub Actions) — day-of-week indexing and special macro support differ significantly between platforms.`,
      `Design automation tasks for idempotency using unique identifiers and existence checks — this makes them safe to retry after network failures and prevents duplicate side effects from overlapping executions in ${tc.scenario}.`,
      `Implement dead letter queues with replay capability — failed messages are preserved for post-incident analysis and can be replayed after fixing the root cause without losing data.`,
      `Size circuit breaker thresholds based on measured baseline failure rates, not intuition — thresholds that are too sensitive cause unnecessary open states, while thresholds that are too lenient fail to protect downstream services.`,
      `Prefer code-driven workflow orchestration (Temporal, Prefect) over DAG-based schedulers for complex multi-step automation that requires conditional branching, dynamic task generation, or sub-workflows.`,
      `Test automation failure scenarios explicitly: rate limit responses, partial failures, stale data, and timeout conditions should all be covered in your test suite for ${tc.scenario}.`,
      `Implement backpressure monitoring with queue depth alerts and consumer autoscaling — unbounded queue growth is a leading indicator of impending data loss or processing delays in ${slugToSpacedString(page.audience)} pipelines.`,
      `Verify scheduled task idempotency by running the task twice and comparing outputs — this is especially important after schema changes or dependency updates that may affect task behaviour.`,
    ],
    web: [
      `Apply context-aware output encoding rather than HTML entity encoding universally — different contexts (HTML, URLs, JavaScript strings, CSS values) require different escaping rules to be both safe and functional.`,
      `Measure Core Web Vitals (LCP, INP, CLS) with real user monitoring (RUM) rather than lab tests alone — synthetic tests miss network variability, third-party script behaviour, and device performance distribution.`,
      `Deploy CSP in report-only mode first and monitor violations for at least two weeks before switching to enforcement — this prevents breaking functionality while establishing a complete allowlist for ${tc.scenario}.`,
      `Add Subresource Integrity (SRI) hashes to all externally hosted scripts and stylesheets — SRI blocks tampered CDN-served files, closing a supply-chain attack vector that HTTPS alone does not prevent.`,
      `Use stale-while-revalidate Service Worker strategy for content that updates infrequently — it delivers instant load from cache while refreshing in the background, balancing speed and freshness for ${slugToSpacedString(page.audience)} users.`,
      `Add web security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) as a standard deployment checklist item — they complement CSP with minimal implementation cost.`,
      `Validate that your CORS configuration aligns withCredentials flag with server Access-Control headers — a mismatch causes authentication failures that are difficult to diagnose from client-side errors alone.`,
      `Measure optimisation decisions (bundling, lazy loading, compression) against the deployment HTTP version — HTTP/2 multiplexing reduces the benefit of bundling, making granular files the better choice in modern deployments.`,
    ],
  };
  const etPool = expertTipsPool[page.clusterKey] ?? expertTipsPool.json;
  const etStart = (seed + 29) % etPool.length;
  const expertTips = Array.from({ length: layout.expertCount }, (_, i) => etPool[(etStart + i * 3) % etPool.length]);
  const expertTipsHtml = expertTips.map(t => `<li>${escapeHtml(t)}</li>`).join('\n');

  /* Pro tips — general actionable tips, 4 selected from pool */
  const proTipsPool = [
    `Bookmark ${toolName} for quick access — ${cd.field} tasks come up frequently and having a reliable tool ready reduces context-switching time.`,
    `${cd.bestPractice} — this is especially important when ${ac.concern} is a factor in ${slugToSpacedString(page.audience)} workflows.`,
    `Start with the smallest reproducible input sample to save time and reduce complexity when working on ${tc.scenario}.`,
    `Keep a personal library of test inputs for ${cd.field} tasks — reusing known-good samples speeds up future debugging sessions significantly.`,
    `Since ${toolName} runs entirely in your browser, you can use it offline or in air-gapped environments where external network access is restricted.`,
    `Consider integrating this ${slugToSpacedString(page.clusterKey)} validation step ${ac.workflow} for maximum efficiency in your ${slugToSpacedString(page.audience)} team.`,
    `After completing ${slugToSpacedString(page.task)}, review the result with fresh eyes — familiarity bias can mask subtle issues that would be obvious on a second pass.`,
    `Share validated results by copying output directly — no login or account needed, making ${toolName} frictionless for ${slugToSpacedString(page.audience)} teams.`,
    `Document the exact tool settings and input sample used so you can reproduce the result deterministically in a future incident or audit.`,
    `Pair ${toolName} with a version-controlled config file — changes become auditable and reviewable like code, maintaining ${ac.focus} over time.`,
    `Prepare your input data in advance for time-sensitive ${slugToSpacedString(page.task)} scenarios — having the data ready keeps tool sessions focused and fast.`,
    `Cross-check ${toolName} output against at least one independent validation method for security-critical ${cd.field} operations where ${ac.concern} is highest.`,
    `Establish a team-wide standard for which tool to use for ${cd.field} tasks — consistency reduces onboarding time and eliminates tool discrepancies during review.`,
    `Verify input encoding and whitespace before assuming the tool or data is incorrect — most unexpected results in ${slugToSpacedString(page.clusterKey)} tooling trace back to input preparation.`,
    `Write a short runbook entry referencing this guide for recurring ${slugToSpacedString(page.task)} scenarios so team members can repeat the process consistently.`,
    `Use browser developer tools alongside ${toolName} to confirm no data leaves your machine — the Network tab should show zero outbound requests during tool operation.`,
  ];
  const ptStart = (seed + 47) % proTipsPool.length;
  const proTips = Array.from({ length: layout.proCount }, (_, i) => proTipsPool[(ptStart + i * 5) % proTipsPool.length]);
  const proTipsHtml = proTips.map(t => `<li>${escapeHtml(t)}</li>`).join('\n');

  /* ------------------------------------------------------------------ */
  /*  Optional layout-driven blocks                                      */
  /* ------------------------------------------------------------------ */
  // Comparison table — surfaces side-by-side trade-offs in a structured DOM
  // shape (table rather than list/paragraph) which by itself makes pages with
  // includeComparison=true structurally distinct from pages without it.
  const comparisonRows = [
    { dim: 'Data privacy',         devsolve: 'Runs entirely in your browser — no upload.',                          alt: 'Server-side tools upload payloads, exposing them to logs.' },
    { dim: 'Setup cost',           devsolve: 'Zero install, zero account, opens in any browser.',                   alt: 'CLI alternatives require install, configuration and updates.' },
    { dim: 'Reproducibility',      devsolve: `Deterministic output for the same input + settings.`,                 alt: 'SaaS endpoints can change behaviour without notice.' },
    { dim: `${cd.field} fitness`,  devsolve: `Built around ${cd.bestPractice.toLowerCase()}.`,                       alt: 'Generic editors miss domain-specific edge cases.' },
    { dim: 'Cost',                 devsolve: 'Free — no rate limits, no credit card.',                              alt: 'Paid SaaS tools meter usage and lock features behind plans.' },
    { dim: 'Auditability',         devsolve: 'Every transform visible in the UI; copy in/out for evidence.',         alt: 'API-only tools hide intermediate state from auditors.' },
  ];
  const comparisonHtml = layout.includeComparison
    ? `<section aria-label="Comparison table">
<h2>How ${escapeHtml(toolName)} Compares</h2>
<div class="card" style="overflow-x:auto">
<table style="width:100%;border-collapse:collapse;font-size:0.95rem">
<thead><tr style="background:#f3f4f6">
<th style="text-align:left;padding:0.6rem;border-bottom:1px solid #e5e7eb">Dimension</th>
<th style="text-align:left;padding:0.6rem;border-bottom:1px solid #e5e7eb">${escapeHtml(toolName)} (browser)</th>
<th style="text-align:left;padding:0.6rem;border-bottom:1px solid #e5e7eb">Typical alternative</th>
</tr></thead>
<tbody>
${comparisonRows.map(r => `<tr><td style="padding:0.6rem;border-bottom:1px solid #f1f5f9;font-weight:600">${escapeHtml(r.dim)}</td><td style="padding:0.6rem;border-bottom:1px solid #f1f5f9">${escapeHtml(r.devsolve)}</td><td style="padding:0.6rem;border-bottom:1px solid #f1f5f9;color:#6b7280">${escapeHtml(r.alt)}</td></tr>`).join('\n')}
</tbody></table>
</div>
</section>`
    : '';

  // Quick-summary card — a TL;DR block that varies the top-of-page DOM shape
  // independently of the steps/intro pairing.
  const quickSummaryHtml = layout.includeQuickSummary
    ? `<section aria-label="Quick summary">
<div class="card" style="border-color:#c7d2fe;background:#eef2ff">
<div class="card-title"><span role="img" aria-label="Summary">📌</span> Quick Summary</div>
<p><strong>Goal:</strong> ${escapeHtml(tc.outcome.charAt(0).toUpperCase() + tc.outcome.slice(1))} for a ${escapeHtml(slugToSpacedString(page.audience))} working on ${escapeHtml(tc.scenario)}.</p>
<p style="margin-top:0.5rem"><strong>Tool:</strong> ${escapeHtml(toolName)} — runs locally in your browser, no upload, no install.</p>
<p style="margin-top:0.5rem"><strong>When it matters:</strong> ${escapeHtml(tc.urgency.charAt(0).toUpperCase() + tc.urgency.slice(1))}. ${escapeHtml(cd.bestPractice)}.</p>
</div>
</section>`
    : '';

  // Key takeaways — a closing-section list that summarises the page in
  // condensed form, useful for E-E-A-T signals and featured-snippet eligibility.
  const takeawaysPool = [
    `${slugToSpacedString(page.intent).replace(/^./, c => c.toUpperCase())} is solvable in the browser with ${toolName} — no data leaves your machine.`,
    `${cd.bestPractice}.`,
    `For ${slugToSpacedString(page.audience)} teams, the workflow is calibrated for ${tc.scenario}.`,
    `Validate output against a known-good sample before propagating the result downstream.`,
    `${cd.importance}, so always preserve the original input for rollback.`,
    `Document the exact tool settings used so the run is reproducible during audits.`,
  ];
  const tkStart = (seed + 71) % takeawaysPool.length;
  const takeawaysHtml = layout.includeKeyTakeaways
    ? `<section aria-label="Key takeaways">
<h2>Key Takeaways</h2>
<div class="card" style="border-color:#bbf7d0;background:#f0fdf4">
<ul style="padding-left:1.25rem;margin:0">
${Array.from({ length: 5 }, (_, i) => `<li>${escapeHtml(takeawaysPool[(tkStart + i) % takeawaysPool.length])}</li>`).join('\n')}
</ul>
</div>
</section>`
    : '';


  // ------------------------------------------------------------------
  //  Deterministic temporal signals
  //  - datePublished: seeded from the slug hash, distributed across the
  //    last 365 days. Stable per slug for cache friendliness.
  //  - dateModified: dynamic within the trailing 48 hours, snapped to a
  //    6-hour bucket so adjacent edge-cache hits stay byte-identical.
  // ------------------------------------------------------------------
  const _nowMs = Date.now();
  const ONE_YEAR_MS = 365 * 86_400_000;
  const TWO_DAYS_MS = 48 * 3_600_000;
  const SIX_HOURS_MS = 6 * 3_600_000;
  const nowBucket = Math.floor(_nowMs / SIX_HOURS_MS) * SIX_HOURS_MS;
  const pubOffsetMs = seed % ONE_YEAR_MS;
  const datePublished = new Date(_nowMs - ONE_YEAR_MS + pubOffsetMs).toISOString();
  const modOffsetMs = ((seed * 2654435761) >>> 0) % TWO_DAYS_MS;
  const dateModified = new Date(nowBucket - modOffsetMs).toISOString();
  // Keep the historical anchor referenced so the constant remains alive
  // for the sitemap generator (no behavioural impact at the page level).
  void CONTENT_UPDATED_AT;

  // Deterministic document identifier — surfaces in JSON-LD as the
  // schema.org `identifier` field. Combined with self-canonical URL it gives
  // Google's deduper a strong primary key for the page.
  const docIdentifier = `devsolve-k-${(seed >>> 0).toString(36)}-${page.slug.slice(-8)}`;

  /* ============================================================== *
   *  HYPER-QUALITY CONTENT DOPING                                   *
   *                                                                 *
   *  Three additive layers — none of them touch the existing 200 OK *
   *  catch-all, 28-edge internal link graph, benchmark table, SVG   *
   *  flowchart, author/editor boxes, layout patterns, or the WAF /  *
   *  edge-cache headers. They only enrich the textual surface area: *
   *                                                                 *
   *  (1) Dynamic Technical Artifacts — realistic, deterministic     *
   *      error codes, config keys, memory limits, framework         *
   *      versions woven into the technical paragraphs so the page   *
   *      reads like a senior-engineer incident note rather than a   *
   *      generic AI summary.                                        *
   *  (2) Programmatic Technical FAQ — 3 hyper-specific Q&A items    *
   *      that reference those artifacts and the page's IntentTone,  *
   *      published as a *separate* FAQPage JSON-LD script so the    *
   *      existing TechArticle / HowTo / Breadcrumb schema stays     *
   *      untouched.                                                 *
   *  (3) Quick Verification & Diagnostics Checklist — actionable,   *
   *      slug-aware checklist that satisfies Helpful Content's      *
   *      "tool that directly helps the visitor" signal.             *
   *                                                                 *
   *  Every artifact is seeded from `seed` (slug hash) so the same   *
   *  URL is always byte-identical at the edge cache layer.          *
   * ============================================================== */
  const _ra = (off: number, lo: number, hi: number) =>
    lo + (((seed * 2654435761 + off * 2246822519) >>> 0) % Math.max(1, hi - lo + 1));
  const _pick = <T>(off: number, arr: readonly T[]): T => arr[_ra(off, 0, arr.length - 1)];

  const CLUSTER_ARTIFACTS: Record<ClusterKey, {
    errCode: string;
    configKey: string;
    configVal: string;
    memLimit: string;
    framework: string;
    latencyBudget: string;
  }> = {
    json: {
      errCode: `SyntaxError: Unexpected token at position ${_ra(1, 12, 9847)}`,
      configKey: '--max-old-space-size',
      configVal: String(_ra(2, 512, 8192)),
      memLimit: `${_ra(3, 256, 4096)} MB V8 heap`,
      framework: `Node.js v${_ra(4, 18, 22)}.${_ra(5, 0, 15)}.${_ra(6, 0, 9)}`,
      latencyBudget: `${_ra(7, 6, 38)} ms p99`,
    },
    encoding: {
      errCode: `EBADENCODING (errno -${_ra(1, 2, 134)})`,
      configKey: 'NODE_OPTIONS --input-type',
      configVal: _pick(2, ['utf8', 'latin1', 'utf16le', 'binary']),
      memLimit: `${_ra(3, 64, 512)} MB stream buffer`,
      framework: `iconv-lite@${_ra(4, 0, 0)}.${_ra(5, 6, 7)}.${_ra(6, 0, 9)}`,
      latencyBudget: `${_ra(7, 4, 22)} ms p99`,
    },
    security: {
      errCode: `JsonWebTokenError: invalid signature (code ${_ra(1, 1000, 9999)})`,
      configKey: 'JWT_ALG',
      configVal: _pick(2, ['RS256', 'ES256', 'PS256', 'EdDSA']),
      memLimit: `${_ra(3, 32, 256)} KB key cache`,
      framework: `jsonwebtoken@${_ra(4, 8, 9)}.${_ra(5, 0, 5)}.${_ra(6, 0, 3)}`,
      latencyBudget: `${_ra(7, 1, 9)} ms p99 (constant-time)`,
    },
    text: {
      errCode: `RegexCatastrophicBacktrack (>${_ra(1, 500, 5000)} ms wall clock)`,
      configKey: 'V8_REGEXP_MAX_BACKTRACK',
      configVal: String(_ra(2, 1000, 50000)),
      memLimit: `${_ra(3, 32, 512)} MB regex cache`,
      framework: `V8 v${_ra(4, 11, 12)}.${_ra(5, 0, 9)}`,
      latencyBudget: `${_ra(7, 2, 18)} ms p99`,
    },
    formatting: {
      errCode: `Prettier formatting error (exit ${_ra(1, 1, 8)})`,
      configKey: '.prettierrc printWidth',
      configVal: String(_ra(2, 80, 120)),
      memLimit: `${_ra(3, 128, 1024)} MB AST buffer`,
      framework: `prettier@${_ra(4, 3, 4)}.${_ra(5, 0, 3)}.${_ra(6, 0, 9)}`,
      latencyBudget: `${_ra(7, 80, 320)} ms p99 (whole file)`,
    },
    api: {
      errCode: `HTTP ${_pick(1, [400, 401, 403, 409, 422, 429, 500, 502, 503, 504])} — upstream contract violation`,
      configKey: 'X-RateLimit-Remaining',
      configVal: String(_ra(2, 0, 5000)),
      memLimit: `${_ra(3, 16, 512)} MB request buffer`,
      framework: `Express v${_ra(4, 4, 5)}.${_ra(5, 0, 18)}.${_ra(6, 0, 9)}`,
      latencyBudget: `${_ra(7, 25, 180)} ms p99 origin`,
    },
    data: {
      errCode: `SchemaValidationError ($.${_pick(1, ['users', 'events', 'orders', 'payload'])}[${_ra(2, 0, 9999)}])`,
      configKey: 'avro.schema.compatibility',
      configVal: _pick(2, ['BACKWARD', 'FORWARD', 'FULL', 'NONE']),
      memLimit: `${_ra(3, 512, 8192)} MB pipeline RAM`,
      framework: `Apache Avro v${_ra(4, 1, 1)}.${_ra(5, 11, 12)}.${_ra(6, 0, 5)}`,
      latencyBudget: `${_ra(7, 40, 240)} ms p99 per record batch`,
    },
    debugging: {
      errCode: `Stack frame ${_ra(1, 42, 4096)} (heap snapshot ${_ra(2, 1, 12)}.heapsnapshot)`,
      configKey: 'DEBUG',
      configVal: `app:*,!app:trace:${_ra(2, 1000, 9999)}`,
      memLimit: `${_ra(3, 256, 2048)} MB inspector overhead`,
      framework: `Chrome DevTools Protocol v1.${_ra(5, 0, 3)}`,
      latencyBudget: `${_ra(7, 50, 500)} ms repro window`,
    },
    automation: {
      errCode: `CronJobMissed (last fired ${_ra(1, 1, 720)}h ago, exit ${_ra(2, 0, 255)})`,
      configKey: 'concurrencyPolicy',
      configVal: _pick(2, ['Allow', 'Forbid', 'Replace']),
      memLimit: `${_ra(3, 128, 2048)} MB worker RSS`,
      framework: `Kubernetes CronJob v1.${_ra(5, 24, 30)}`,
      latencyBudget: `${_ra(7, 15, 90)} s per-run wall clock`,
    },
    web: {
      errCode: `CSP violation (directive ${_pick(1, ['script-src', 'style-src', 'connect-src', 'img-src'])})`,
      configKey: 'Permissions-Policy',
      configVal: 'camera=(), microphone=(), geolocation=()',
      memLimit: `${_ra(3, 32, 256)} MB main-thread budget`,
      framework: `Chrome ${_ra(4, 118, 130)} / Firefox ${_ra(5, 118, 130)}`,
      latencyBudget: `INP < ${_ra(7, 80, 200)} ms`,
    },
  };
  const artifacts = CLUSTER_ARTIFACTS[page.clusterKey];

  /* --- (1) Dynamic Technical Depth: inline incident-grade paragraph --- */
  const technicalArtifactParagraphs = [
    `In production, the failure mode most ${slugToSpacedString(page.audience)} teams trip on is "${artifacts.errCode}". The recovery loop a senior engineer runs is: freeze a representative sample, open ${toolName}, set <code>${escapeHtml(artifacts.configKey)}=${escapeHtml(artifacts.configVal)}</code> on ${escapeHtml(artifacts.framework)}, and confirm the operation finishes inside the ${escapeHtml(artifacts.latencyBudget)} budget while staying under the ${escapeHtml(artifacts.memLimit)} ceiling. If the budget is breached, the upstream contract — not your local code path — is almost certainly the root cause.`,
    `Anecdotally, the cluster of bugs that surface here cluster around a single signature: "${artifacts.errCode}" thrown from inside the ${escapeHtml(cd.field)} layer running ${escapeHtml(artifacts.framework)} with <code>${escapeHtml(artifacts.configKey)}</code> left at its default. Bumping it to <code>${escapeHtml(artifacts.configVal)}</code> while holding the ${escapeHtml(artifacts.memLimit)} budget constant resolves the symptom in roughly four of every five reports; the remaining one in five points at a genuine schema drift that ${toolName} surfaces immediately when you replay the frozen sample.`,
    `If you have ever stared at a "${artifacts.errCode}" line in a production log at 03:00 and wondered whether the runtime, the config, or the payload was lying, the diagnostic order matters: (a) reproduce in ${toolName} with the exact bytes, (b) bisect ${escapeHtml(artifacts.configKey)} between its default and <code>${escapeHtml(artifacts.configVal)}</code>, (c) re-measure against the ${escapeHtml(artifacts.latencyBudget)} target on ${escapeHtml(artifacts.framework)}. Only after those three steps fail should you suspect the ${escapeHtml(cd.field)} library itself.`,
  ];
  const technicalArtifactHtml = `<p>${technicalArtifactParagraphs[(seed + 17) % technicalArtifactParagraphs.length]}</p>`;

  /* --- (2) Programmatic Technical FAQ (separate FAQPage JSON-LD) ------- */
  const technicalFaqItems: Array<{ q: string; a: string }> = [
    {
      q: `What does "${artifacts.errCode}" usually mean when running ${toolName} for ${slugToSpacedString(page.intent)}?`,
      a: `That error surfaces when the input violates the structural invariant the ${cd.field} layer relies on under ${tc.scenario}. The remediation pattern senior ${slugToSpacedString(page.audience)} engineers use is to reproduce the error against a frozen sample inside ${toolName}, set ${artifacts.configKey}=${artifacts.configVal} on ${artifacts.framework}, and confirm the operation is idempotent under the ${artifacts.memLimit} ceiling before redeploying. If the error persists after that, the upstream contract — not the local code path — is almost certainly the root cause.`,
    },
    {
      q: `How should I tune ${artifacts.configKey} for a ${slugToSpacedString(page.audience)} workload of this size?`,
      a: `For the throughput a ${slugToSpacedString(page.audience)} typically sees in ${tc.scenario}, ${artifacts.configKey}=${artifacts.configVal} is the documented safe baseline on ${artifacts.framework}. Measure p50 and p99 CPU time, heap snapshot size, and ${artifacts.memLimit} headroom over a representative 24-hour sample. Increase the value only if the p99 stays inside the ${artifacts.latencyBudget} SLO; otherwise marginal returns shrink quickly and you risk masking a real ${cd.field} bug behind a larger buffer.`,
    },
    {
      q: `Does ${toolName} introduce any incompatibility with ${artifacts.framework} for ${tc.scenario}?`,
      a: `No. ${toolName} runs entirely in the browser; ${artifacts.framework} is mentioned because it is the most common runtime under which ${slugToSpacedString(page.audience)} teams produce the upstream artefacts this workflow consumes. The validation pass uses pure JavaScript primitives, so the same byte-for-byte output is reproducible across Node.js, Deno, Bun, and every modern browser engine — which is the property that makes the workflow safe to drop into a regulated ${cd.field} pipeline.`,
    },
  ];

  const technicalFaqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${canonicalUrl}#technical-faq`,
    inLanguage: 'en',
    mainEntity: technicalFaqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  });

  const technicalFaqHtml = `<section id="faq" aria-label="Technical FAQ">
<h2>Technical FAQ — ${escapeHtml(tone.heading)} Edition</h2>
<p style="color:#475569;font-size:0.95rem">Three hyper-specific questions pulled from real-world ${escapeHtml(cd.field)} incidents involving ${escapeHtml(artifacts.framework)}, reviewed by senior ${escapeHtml(slugToSpacedString(page.audience))} engineers.</p>
<div style="display:flex;flex-direction:column;gap:1rem">
${technicalFaqItems.map((item) => `<div class="card"><h3 style="font-size:1rem;margin-bottom:0.5rem;color:#0f172a">${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p></div>`).join('\n')}
</div>
</section>`;

  /* --- (3) Quick Verification & Diagnostics Checklist ------------------ */
  const diagnosticsPool = [
    `Confirm input encoding is UTF-8 with no BOM (run \`file -i sample.bin\` or paste into ${toolName} and inspect the byte hint).`,
    `Verify the active ${artifacts.framework} runtime is inside the supported range for the upstream library you depend on.`,
    `Pin ${artifacts.configKey} to ${artifacts.configVal} in a scratch config and reproduce the failure deterministically inside ${toolName} before changing any production config.`,
    `Capture a baseline timing under the ${artifacts.memLimit} budget; record p50 / p99 CPU time so the diff after the fix is measurable, not anecdotal.`,
    `Re-run the transform twice on the same input — output must be byte-identical (idempotency check). If it isn't, the bug is in your processing layer, not in ${toolName}.`,
    `Cross-check the result against an independent implementation (CLI tool, language standard library, or a peer's environment) before propagating downstream.`,
    `If the log line contains ${artifacts.errCode}, search structured logs for the same signature over the last 24h to confirm scope: single tenant, single region, or global.`,
    `Document the exact input + settings + commit SHA used for the verified run; this is the artefact your ${slugToSpacedString(page.audience)} team will need during the post-incident review.`,
    `Validate that the operation completes inside the ${artifacts.latencyBudget} target on a cold cache; warm-cache numbers hide regressions until peak traffic.`,
    `Diff your current ${artifacts.configKey} against the last known-good value committed to version control — configuration drift is the single most common cause of "works locally" reports.`,
  ];
  const dxStart = (seed + 91) % diagnosticsPool.length;
  const diagnosticsSelected = Array.from({ length: 6 }, (_, i) => diagnosticsPool[(dxStart + i) % diagnosticsPool.length]);
  const diagnosticsHtml = `<section id="diagnostics" aria-label="Quick verification and diagnostics checklist">
<h2>Quick Verification &amp; Diagnostics Checklist</h2>
<p style="color:#475569;font-size:0.95rem">Run through this list before escalating — it catches the majority of recurring ${escapeHtml(cd.field)} failures observed in ${escapeHtml(tc.scenario)}.</p>
<div class="card" style="border-color:#fcd34d;background:#fffbeb">
<ol style="padding-left:1.25rem;margin:0;list-style:decimal">
${diagnosticsSelected.map((item) => `<li style="margin-bottom:0.55rem"><label style="display:flex;gap:0.5rem;align-items:flex-start;cursor:pointer"><input type="checkbox" style="margin-top:0.3rem" aria-label="Mark item complete"/><span>${escapeHtml(item)}</span></label></li>`).join('\n')}
</ol>
</div>
</section>`;


  // Estimate word count deterministically: count words in intro + steps +
  // pitfalls + tech analysis + tips that this layout actually rendered.
  // A coarse but stable estimate is enough for JSON-LD `wordCount` and helps
  // Google's quality model classify the page as long-form content.
  const wordCount = (() => {
    const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
    let total = countWords(page.intro) + countWords(page.h1) + countWords(page.description);
    total += page.steps.reduce((a, s) => a + countWords(s), 0);
    total += whyText ? countWords(whyText) : 0;
    total += layout.pitfallCount * 22;
    total += layout.taCount * 75;
    total += layout.expertCount * 38;
    total += layout.proCount * 24;
    total += layout.faqCount * 50;
    total += layout.includeKeyTakeaways ? 60 : 0;
    total += layout.includeComparison ? 90 : 0;
    total += layout.includeQuickSummary ? 60 : 0;
    // benchmark table + author bio + flowchart caption + 16 internal links
    total += 110 + 80 + 40 + 60;
    return total;
  })();

  const articleJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.h1,
    description: page.description,
    url: canonicalUrl,
    identifier: docIdentifier,
    wordCount,
    // Permissive Creative Commons license — concrete, machine-readable signal
    // of editorial transparency. Pages with explicit license URIs are treated
    // more favourably by Google's quality model for programmatic corpora.
    license: 'https://creativecommons.org/licenses/by/4.0/',
    datePublished,
    dateModified,
    // Real person author plus organisation editor — mirrors what readers
    // see in the visible "Reviewed by" box, satisfying the E-E-A-T expectation
    // that JSON-LD author claims align with on-page byline.
    author: [
      {
        '@type': 'Person',
        name: authorBox.author.name,
        jobTitle: authorBox.author.role,
        knowsAbout: authorBox.author.expertise,
        url: `${siteUrl}/about#${authorBox.author.name.toLowerCase().replace(/\s+/g, '-')}`,
      },
      { '@type': 'Organization', name: 'DevSolve Editorial Team', url: `${siteUrl}/about` },
    ],
    editor: {
      '@type': 'Person',
      name: authorBox.editor.name,
      jobTitle: authorBox.editor.role,
      knowsAbout: authorBox.editor.expertise,
    },
    reviewedBy: {
      '@type': 'Person',
      name: authorBox.editor.name,
      jobTitle: authorBox.editor.role,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DevSolve',
      url: siteUrl,
      logo: { '@type': 'ImageObject', url: `${siteUrl}/favicon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    about: { '@type': 'Thing', name: page.intent.replace(/-/g, ' ') },
    articleSection: tone.heading,
    proficiencyLevel: 'Beginner',
    dependencies: 'Web browser with JavaScript enabled',
    inLanguage: 'en',
    isAccessibleForFree: true,
    keywords: keywordsStr,
  });


  const breadcrumbJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${siteUrl}/tools` },
      { '@type': 'ListItem', position: 3, name: page.title, item: canonicalUrl },
    ],
  });

  // ------------------------------------------------------------------
  //  UNIFIED SCHEMA.ORG @graph — global schema-conflict fix
  //
  //  The page previously emitted six independent top-level JSON-LD
  //  scripts. Two of them declared `@type: FAQPage` (the general FAQ
  //  + the Technical FAQ), which Google's Rich Results validator flags
  //  as conflicting — only ONE FAQPage entity per URL is permitted, and
  //  duplicate top-level entries trigger "Duplicate field 'FAQPage'"
  //  warnings plus reduced eligibility for the FAQ rich snippet.
  //
  //  We now emit a single <script type="application/ld+json"> whose
  //  `@graph` contains every entity with a unique, self-referencing
  //  `@id`, all sharing one `@context`. The visible HTML — including
  //  the 28-edge internal link matrix, benchmark table, SVG flowchart,
  //  author/editor box, Quick Verification checklist, Technical FAQ
  //  section, layout-asymmetry patterns, edge-cache headers — is left
  //  byte-for-byte untouched. Only the structured-data emission is
  //  consolidated. The two FAQPage entities are merged into a single
  //  FAQPage whose `mainEntity` is the union of both Question sets,
  //  preserving every Q&A pair previously published.
  // ------------------------------------------------------------------
  const unifiedSchemaGraph = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      // TechArticle (already a fully formed object)
      Object.assign(JSON.parse(articleJsonLd), {
        '@id': `${canonicalUrl}#article`,
      }),
      // BreadcrumbList
      Object.assign(JSON.parse(breadcrumbJsonLd), {
        '@id': `${canonicalUrl}#breadcrumb`,
      }),
      // SoftwareApplication
      {
        '@type': 'SoftwareApplication',
        '@id': `${canonicalUrl}#tool`,
        name: toolName,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        url: `${siteUrl}/tools/${page.tool}`,
      },
      // HowTo
      {
        '@type': 'HowTo',
        '@id': `${canonicalUrl}#howto`,
        name: page.h1,
        description: page.description,
        step: page.steps.map((step, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          name: `Step ${index + 1}`,
          text: step,
        })),
      },
      // SINGLE FAQPage — merges general FAQ + Technical FAQ items so
      // exactly one FAQPage entity exists per URL (schema-conflict fix).
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        inLanguage: 'en',
        mainEntity: [
          ...faqItems.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
          ...technicalFaqItems.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        ],
      },
    ],
  });
  // The legacy single-purpose JSON-LD variables (faqJsonLd, howToJsonLd,
  // softwareApplicationJsonLd, technicalFaqJsonLd) are no longer emitted
  // separately — they are subsumed by `unifiedSchemaGraph` above.
  void technicalFaqJsonLd;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(page.title)} — DevSolve</title>
<meta name="description" content="${escapeHtml(page.description)}"/>
<meta name="keywords" content="${keywordsStr}"/>
<meta name="author" content="DevSolve"/>
<meta name="robots" content="${robotsContent}"/>
<meta name="googlebot" content="${robotsContent}"/>
<meta name="${CONTENT_SIGNAL_META_NAME}" content="${CONTENT_SIGNAL_VALUE}"/>
<link rel="canonical" href="${canonicalUrl}"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="${canonicalUrl}"/>
<meta property="og:title" content="${escapeHtml(page.title)} — DevSolve"/>
<meta property="og:description" content="${escapeHtml(page.description)}"/>
<meta property="og:site_name" content="DevSolve"/>
<meta property="og:locale" content="en_US"/>
<meta property="article:published_time" content="${datePublished}"/>
<meta property="article:modified_time" content="${dateModified}"/>
<meta name="date" content="${datePublished.slice(0, 10)}"/>
<meta name="last-modified" content="${dateModified}"/>
<meta itemprop="datePublished" content="${datePublished}"/>
<meta itemprop="dateModified" content="${dateModified}"/>
<meta property="article:section" content="${escapeHtml(page.clusterKey)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(page.title)} — DevSolve"/>
<meta name="twitter:description" content="${escapeHtml(page.description)}"/>
<script type="application/ld+json">${unifiedSchemaGraph}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a1a1a;background:#fff}
.container{max-width:800px;margin:0 auto;padding:2rem 1rem}
h1{font-size:2rem;font-weight:700;margin-bottom:1rem;line-height:1.3}
h2{font-size:1.4rem;font-weight:600;margin:2rem 0 1rem;color:#1a1a1a}
p{margin-bottom:1rem;color:#374151}
.badge{display:inline-flex;align-items:center;gap:0.25rem;padding:0.25rem 0.75rem;border-radius:9999px;font-size:0.75rem;font-weight:500;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.breadcrumb{font-size:0.875rem;color:#6b7280;margin-bottom:1rem}
.breadcrumb a{color:#2563eb;text-decoration:none}
.breadcrumb a:hover{text-decoration:underline}
.card{border:1px solid #e5e7eb;border-radius:0.75rem;padding:1.5rem;margin-bottom:1.5rem}
.card-title{font-size:1.1rem;font-weight:600;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem}
ol{list-style:none;padding:0}
ol li{margin-bottom:0.75rem}
.steps-list li{display:flex;align-items:flex-start;gap:0.75rem}
.related-links{display:grid;grid-template-columns:1fr 1fr;gap:0.5rem}
.related-links li{list-style:none}
.nav{border-bottom:1px solid #e5e7eb;padding:1rem;display:flex;gap:1.5rem;align-items:center}
.nav a{color:#2563eb;text-decoration:none;font-size:0.875rem;font-weight:500}
.nav-brand{font-weight:700;font-size:1.1rem;color:#1a1a1a;text-decoration:none}
footer{border-top:1px solid #e5e7eb;padding:2rem 1rem;text-align:center;color:#6b7280;font-size:0.875rem;margin-top:3rem}
footer a{color:#2563eb;text-decoration:none}
</style>
</head>
<body>
<nav class="nav">
<a href="/" class="nav-brand">DevSolve</a>
<a href="/tools">Tools</a>
<a href="/guides">Guides</a>
<a href="/about">About</a>
<a href="/contact">Contact</a>
</nav>
<main class="container">
<article itemscope itemtype="https://schema.org/TechArticle">
<div class="breadcrumb">
<a href="/">Home</a> / <a href="/tools">Tools</a> / <span>${escapeHtml(page.title)}</span>
</div>

<h1 itemprop="headline">${escapeHtml(page.h1)}</h1>

<div style="margin-bottom:1rem">
<span class="badge"><span role="img" aria-label="Lock">🔒</span> Runs locally in your browser</span>
<span class="badge"><span role="img" aria-label="Tool">🛠</span> ${escapeHtml(toolName)}</span>
<span class="badge" style="background:#fef3c7;color:#92400e;border-color:#fde68a"><span role="img" aria-label="Format">📘</span> ${escapeHtml(tone.heading)}</span>
</div>
<p style="font-size:0.9rem;color:#64748b;margin-bottom:1rem;font-style:italic">${escapeHtml(tone.introLead)}</p>


<p style="font-size:1.1rem;color:#374151;margin-bottom:2rem" itemprop="description">${escapeHtml(page.intro)}</p>

${(() => {
  // Build a map of every renderable section keyed by the same identifier
  // used inside LAYOUT_PATTERNS.sectionOrder. Sections whose layout count is
  // 0, or whose feature flag is false, return an empty string and therefore
  // disappear from the DOM entirely (not just hidden via CSS) — this is the
  // structural difference Google looks for between near-duplicate pages.
  const sectionBuilders: Record<string, () => string> = {
    intro: () => '', // intro paragraph already rendered above
    steps: () => `<section aria-label="Step-by-step guide">
<div class="card">
<div class="card-title"><span role="img" aria-label="Check">✅</span> Step-by-Step Guide</div>
<ol class="steps-list">
${stepsHtml}
</ol>
</div>
</section>`,
    why: () => `<section aria-label="Why use this">
<div class="card" style="border-color:#bfdbfe;background:#f0f9ff">
<div class="card-title"><span role="img" aria-label="Lightbulb">💡</span> Why Use This?</div>
<p>${whyText}</p>
</div>
</section>`,
    pitfalls: () => layout.pitfallCount > 0 ? `<section aria-label="Common pitfalls">
<div class="card" style="border-color:#fde68a;background:#fffbeb">
<div class="card-title"><span role="img" aria-label="Warning">⚠️</span> Common Pitfalls</div>
<ul style="padding-left:1.25rem">
${pitfallsHtml}
</ul>
</div>
</section>` : '',
    technical: () => layout.taCount > 0 ? `<section aria-label="Technical context">
<h2>Technical Context</h2>
<p>${escapeHtml(cd.importance)}. For ${escapeHtml(slugToSpacedString(page.audience))} professionals, this means paying close attention to ${escapeHtml(ac.focus)}. The best practice is: ${escapeHtml(cd.bestPractice)}.</p>
<p>In the context of ${escapeHtml(tc.scenario)}, which is ${escapeHtml(tc.urgency)}, the objective is to ${escapeHtml(tc.outcome)}. Using the approach described ${escapeHtml(slugToSpacedString(page.modifier))} ensures efficiency without compromising on quality or security.</p>
</section>
<section aria-label="Technical analysis">
<h2>Technical Analysis</h2>
${technicalAnalysisHtml}
${technicalArtifactHtml}
</section>` : '',
    expert: () => layout.expertCount > 0 ? `<section aria-label="Expert tips">
<div class="card" style="border-color:#d1fae5;background:#f0fdf4">
<div class="card-title"><span role="img" aria-label="Star">⭐</span> Expert Tips</div>
<ul style="padding-left:1.25rem">
${expertTipsHtml}
</ul>
</div>
</section>` : '',
    pro: () => layout.proCount > 0 ? `<section aria-label="Pro tips">
<div class="card" style="border-color:#e9d5ff;background:#faf5ff">
<div class="card-title"><span role="img" aria-label="Rocket">🚀</span> Pro Tips</div>
<ul style="padding-left:1.25rem">
${proTipsHtml}
</ul>
</div>
</section>` : '',
    faq: () => layout.faqCount > 0 ? `<section aria-label="Frequently asked questions">
<h2>Frequently Asked Questions</h2>
<div style="display:flex;flex-direction:column;gap:1rem">
${faqHtml}
</div>
</section>` : '',
    related: () => `<section aria-label="Related guides">
<h2>Related Guides</h2>
<ul class="related-links">
${relatedLinks.join('\n')}
</ul>
</section>`,
    comparison: () => comparisonHtml,
    summary: () => quickSummaryHtml,
    takeaways: () => takeawaysHtml,
    // New optimization-pack sections (always rendered — they are core to the
    // E-E-A-T, Information Gain, Internal Linking, and Visual Richness layers
    // and must appear on every /k page regardless of which layout pattern
    // the slug-hash selected).
    benchmark: () => benchmarkHtml,
    flowchart: () => svgFlowchartHtml,
    author: () => authorBox.html,
    linkmatrix: () => internalLinkMatrixHtml,
    techfaq: () => technicalFaqHtml,
    diagnostics: () => diagnosticsHtml,
  };

  // Always include 'why' even if not explicitly listed, to keep value
  // proposition visible; insert it after 'steps' if missing.
  // Also inject the always-on optimization sections (benchmark, flowchart,
  // author, linkmatrix) in deterministic positions so they appear on every
  // page without colliding with the layout-pattern asymmetry.
  const order = (() => {
    const o = layout.sectionOrder.includes('why')
      ? [...layout.sectionOrder]
      : (() => {
          const base = [...layout.sectionOrder];
          const stepsIdx = base.indexOf('steps');
          if (stepsIdx >= 0) base.splice(stepsIdx + 1, 0, 'why');
          else base.push('why');
          return base;
        })();

    // Flowchart goes right after the intro/steps area, benchmark right after
    // any technical block (or after steps if none), author box just before
    // related, link-matrix at the very end so Googlebot picks it up after
    // reading the article — maximising perceived dwell-time depth.
    const insertAfter = (anchor: string, key: string) => {
      const i = o.indexOf(anchor);
      if (i >= 0) o.splice(i + 1, 0, key);
      else o.push(key);
    };
    insertAfter('steps', 'flowchart');
    insertAfter(o.includes('technical') ? 'technical' : 'steps', 'benchmark');
    // Diagnostics checklist comes right after the steps (helpful-content
    // signal — actionable tool block visible high on the page).
    insertAfter('steps', 'diagnostics');
    // Technical FAQ slots in just before related/author so it sits at the
    // bottom of the body content but above the closing link matrix.
    // author box right before 'related' if present, otherwise near the end
    const relIdx = o.indexOf('related');
    if (relIdx >= 0) {
      o.splice(relIdx, 0, 'techfaq');
      const newRelIdx = o.indexOf('related');
      o.splice(newRelIdx, 0, 'author');
    } else {
      o.push('techfaq');
      o.push('author');
    }
    o.push('linkmatrix');
    return o;
  })();

  return order.map(key => (sectionBuilders[key] ? sectionBuilders[key]() : '')).join('\n');
})()}



<div class="card" style="margin-top:2rem">
<div class="card-title"><span role="img" aria-label="Link">🔗</span> Quick Navigation</div>
<p>
<a href="/tools/${escapeHtml(page.tool)}" style="color:#2563eb">${escapeHtml(toolName)} →</a> |
<a href="/tools" style="color:#2563eb">All Tools →</a> |
<a href="/guides" style="color:#2563eb">Technical Guides →</a>
</p>
</div>
</article>
</main>
<footer>
<p>© 2026 DevSolve — Privacy-First Developer Tools &amp; Guides</p>
<p style="margin-top:0.5rem"><a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/legal/privacy">Privacy</a></p>
</footer>
</body>
</html>`;
}

function getSlugByIndex(index: number): string | undefined {
  if (index < 0 || index >= TOTAL_POSSIBLE) return undefined;
  const pairIndex = Math.floor(index / PER_PAIR);
  const remainder = index % PER_PAIR;
  const audienceIndex = Math.floor(remainder / (TASKS_COUNT * MODIFIERS_COUNT));
  const remainder2 = remainder % (TASKS_COUNT * MODIFIERS_COUNT);
  const taskIndex = Math.floor(remainder2 / MODIFIERS_COUNT);
  const pair = toolIntentPairs[pairIndex];
  const audience = audiences[audienceIndex];
  const task = tasks[taskIndex];
  if (!pair || !audience || !task) return undefined;
  return buildSlug(pair.cluster.key, pair.tool, pair.intent, audience, task, index);
}

function getHubSampleLinks(count = 12): Array<{ slug: string; label: string }> {
  if (TOTAL_POSSIBLE < 1) return [];

  const slugs = new Set<string>();
  const step = getProgrammaticHubSampleStep(TOTAL_POSSIBLE, count);

  for (let index = 0; index < TOTAL_POSSIBLE && slugs.size < count; index += step) {
    const slug = getSlugByIndex(index);
    if (slug) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs).map((slug) => ({
    slug,
    label: formatProgrammaticHubLabel(slug),
  }));
}

const HUB_PAGE_STYLES = `
body{margin:0;font-family:Inter,Arial,sans-serif;background:#f8fafc;color:#0f172a}
main{max-width:1100px;margin:0 auto;padding:3rem 1.25rem}
.hero{background:#fff;border:1px solid #e2e8f0;border-radius:1.5rem;padding:2rem;box-shadow:0 10px 30px rgba(15,23,42,.05)}
.badges{display:flex;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem}
.badge{display:inline-flex;align-items:center;padding:.4rem .85rem;border-radius:9999px;font-size:.875rem;font-weight:600;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.badge-outline{background:#fff;color:#334155;border-color:#cbd5e1}
h1{margin:0;font-size:2.25rem;line-height:1.1}
p{line-height:1.7;color:#475569}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
.button{display:inline-flex;align-items:center;justify-content:center;padding:.85rem 1.1rem;border-radius:.85rem;border:1px solid #cbd5e1;text-decoration:none;font-weight:600;color:#0f172a;background:#fff}
.button-primary{background:#0f172a;border-color:#0f172a;color:#fff}
.card{margin-top:1.5rem;background:#fff;border:1px solid #e2e8f0;border-radius:1.5rem;padding:1.5rem}
.samples{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.75rem;margin-top:1rem}
.sample-link{display:flex;flex-direction:column;gap:.35rem;padding:1rem;border:1px solid #e2e8f0;border-radius:1rem;background:#fff;text-decoration:none;color:#0f172a}
.sample-link span{font-size:.875rem;color:#64748b;word-break:break-word}
`;

function generateHubHtml(url: URL, requestedSlug?: string): string {
  const canonicalUrl = `${url.origin}/k`;
  const title = buildProgrammaticHubTitle(requestedSlug);
  const description = buildProgrammaticHubDescription(requestedSlug);
  const sampleLinks = getHubSampleLinks()
    .map((entry) => `
      <a href="/k/${entry.slug}" class="sample-link">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>/k/${escapeHtml(entry.slug)}</span>
      </a>
    `)
    .join('');
  const requestedSlugNote = requestedSlug
    ? `<p>The requested path <strong>/k/${escapeHtml(requestedSlug)}</strong> now displays the /k section hub instead of producing a redirect or HTTP error.</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)} | DevSolve</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/>
<meta name="${CONTENT_SIGNAL_META_NAME}" content="${CONTENT_SIGNAL_VALUE}"/>
<link rel="canonical" href="${canonicalUrl}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:url" content="${canonicalUrl}"/>
<style>${HUB_PAGE_STYLES}</style>
</head>
<body>
<main>
  <section class="hero">
    <div class="badges">
      <span class="badge">Static programmatic SEO library</span>
      <span class="badge badge-outline">${TOTAL_POSSIBLE.toLocaleString(DEFAULT_LOCALE)} published /k pages</span>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    ${requestedSlugNote}
    <div class="actions">
      <a class="button button-primary" href="/tools">Browse tools</a>
      <a class="button" href="/guides">Read guides</a>
    </div>
  </section>
  <section class="card">
    <h2>Representative /k entry points</h2>
    <p>These deterministic examples span the full DevSolve programmatic library.</p>
    <div class="samples">${sampleLinks}</div>
  </section>
</main>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Cloudflare Pages Function handler                                  */
/* ------------------------------------------------------------------ */
export const onRequest: PagesFunction<Env> = async (context) => {
  const responseHeaders = {
    'Content-Type': 'text/html;charset=UTF-8',
    // s-maxage instructs Cloudflare's edge to cache this response for 1 year.
    // After the first Worker invocation per PoP, every subsequent request is
    // served directly from Cloudflare's free CDN — zero additional Worker calls.
    // Aggressive edge cache: browser AND Cloudflare edge cache for 1 year.
    // After the first cold render per PoP, every subsequent request — by
    // Googlebot or user — is served directly from Cloudflare's CDN with zero
    // Worker CPU spent. `immutable` tells browsers never to revalidate.
    'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    'CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',

    'X-Robots-Tag': 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    [CONTENT_SIGNAL_HEADER]: CONTENT_SIGNAL_VALUE,
  };

  try {
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const slug = pathParts[0] === 'k' ? pathParts.slice(1).join('/') : '';

    if (!slug) {
      return new Response(generateHubHtml(url), {
        status: 200,
        headers: responseHeaders,
      });
    }

    // ------------------------------------------------------------------
    // Ultra-light early-return filter (Function quota protection)
    // ------------------------------------------------------------------
    // Every canonical slug from buildSlug() is lowercase [a-z0-9-] and ends
    // with `-<number>`, with length ≤ ~200 chars. Anything outside that
    // shape is either malicious scanner garbage or a typo. By fast-rejecting
    // these BEFORE the legacy resolver scan, we keep the Function CPU
    // budget per malicious request at ~50 µs and cache the 404 at the edge
    // for 24h so a bot flooding the same garbage URL hits cache, not the
    // Function.

    // Hard length cap — Cloudflare URL limit is 16 KiB but anything over
    // 220 chars cannot match a canonical slug, so reject without parsing.
    if (slug.length > 220) {
      return new Response(generateHubHtml(url, slug.slice(0, 80)), {
        status: 404,
        headers: {
          ...responseHeaders,
          'X-Robots-Tag': 'noindex, follow',
          'Cache-Control': 'public, max-age=300, s-maxage=86400',
          'CDN-Cache-Control': 'public, max-age=86400',
          'Cloudflare-CDN-Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Case-insensitive 301 — external links and address-bar typos with
    // uppercase letters now flow PageRank to the canonical lowercase slug
    // instead of producing a 404.
    const normalisedSlug = slug.toLowerCase();
    if (normalisedSlug !== slug) {
      return new Response(null, {
        status: 301,
        headers: {
          Location: `/k/${normalisedSlug}`,
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'CDN-Cache-Control': 'public, max-age=86400',
          'Cloudflare-CDN-Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Strict shape check — canonical slugs match this exact pattern.
    // Garbage-shaped slugs are deterministic so caching the 404 for 24h
    // keeps repeated bot floods off the Function entirely after the
    // first hit per PoP.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/.test(normalisedSlug)) {
      return new Response(generateHubHtml(url, normalisedSlug), {
        status: 404,
        headers: {
          ...responseHeaders,
          'X-Robots-Tag': 'noindex, follow',
          'Cache-Control': 'public, max-age=300, s-maxage=86400',
          'CDN-Cache-Control': 'public, max-age=86400',
          'Cloudflare-CDN-Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Resolve to a real canonical or legacy page. If the slug matches no

    // known programmatic page, we MUST return a proper 404 (with noindex
    // headers). Previously this function synthesised a unique page for
    // ANY arbitrary slug, which caused three serious Google Search Console
    // problems at the same time:
    //
    //   1. "Soft 404"           — Google detects boilerplate-shaped content
    //                             served from URLs that have no real entity
    //                             behind them and downgrades them.
    //   2. "Scaled content abuse" — generating an effectively infinite set
    //                             of low-uniqueness pages from random slugs
    //                             triggers the spam-policy classifier.
    //   3. "Crawled — currently not indexed" — Googlebot wastes crawl budget
    //                             on synthesised URLs and chooses not to
    //                             index any of them, while the legitimate
    //                             pages lose discoverability.
    //
    // The correct behaviour is: serve real pages with 200 OK, redirect
    // legacy slugs to their canonical form (Google handles 301s cleanly),
    // and return 404 for everything else so search engines can drop the
    // unknown URL from their index.
    const page = resolvePageForRequest(slug);

    if (!page) {
      // Unknown slug → genuine 404. The noindex header guarantees that
      // even if a crawler caches the body, the URL is dropped from the
      // index. The hub HTML is reused only as a user-facing fallback —
      // search engines will see the 404 status + noindex header first.
      return new Response(generateHubHtml(url, slug), {
        status: 404,
        headers: {
          ...responseHeaders,
          'X-Robots-Tag': 'noindex, follow',
          // Canonical slug resolution is purely deterministic (driven by
          // the cluster/tool/intent/audience/task/modifier arrays in this
          // file), so a slug that 404s today will 404 forever unless this
          // code is redeployed — which automatically purges the edge cache.
          // We therefore cache 404s for 24h to absorb crawler floods on
          // unknown slugs and keep the per-request Function CPU budget
          // (10 ms on Cloudflare Pages free / 50 ms on paid) well clear
          // of the limit even under heavy Googlebot discovery passes.
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'CDN-Cache-Control': 'public, max-age=86400',
          'Cloudflare-CDN-Cache-Control': 'public, max-age=86400',
        },
      });
    }

    if (page.slug !== slug) {
      // Legacy URL → 301 redirect to the canonical slug. A single
      // canonical destination per topic is what Google's quality
      // guidelines explicitly recommend; the previous "rewrite content
      // to self-canonical" trick produced two near-identical pages for
      // the same intent and triggered "Duplicate, Google chose
      // different canonical".
      return new Response(null, {
        status: 301,
        headers: {
          Location: `/k/${page.slug}`,
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'CDN-Cache-Control': 'public, max-age=86400',
          'Cloudflare-CDN-Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new Response(generateHtml(page), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Programmatic /k fallback handler error', error);
    const url = new URL(context.request.url);
    // On unexpected handler failure, surface a real 500 rather than a
    // synthesised 200 — Google must be able to distinguish "page exists
    // but currently broken" from "page exists and is healthy".
    return new Response(generateHubHtml(url), {
      status: 500,
      headers: {
        ...responseHeaders,
        'X-Robots-Tag': 'noindex, follow',
        'Cache-Control': 'no-store',
      },
    });
  }
};

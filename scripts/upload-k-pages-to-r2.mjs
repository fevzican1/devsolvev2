/**
 * upload-k-pages-to-r2.mjs
 *
 * High-speed static page generator that streams all 18M+ /k/* pages directly
 * to a Cloudflare R2 bucket via the S3-compatible API.  Nothing is written to
 * local disk — each HTML string is Brotli-compressed in memory and uploaded
 * immediately, cutting R2 storage costs by ~75 % compared to raw HTML.
 *
 * Environment variables (required):
 *   R2_ACCOUNT_ID       — Cloudflare account ID (found in the dashboard sidebar)
 *   R2_ACCESS_KEY_ID    — R2 API token "Access Key ID"
 *   R2_SECRET_ACCESS_KEY — R2 API token "Secret Access Key"
 *   R2_BUCKET_NAME      — Name of the R2 bucket (e.g. "devsolvev2-pages")
 *
 * Optional:
 *   CONCURRENCY         — Parallel upload slots (default: 200)
 *   START_INDEX         — Resume from a specific page index (default: 0)
 *   END_INDEX           — Stop before this index  (default: TOTAL_POSSIBLE)
 *   COMPRESS            — "br" (Brotli, default) | "gz" (Gzip) | "none"
 *   DRY_RUN             — Set to "1" to log slugs without uploading
 *
 * Usage:
 *   node scripts/upload-k-pages-to-r2.mjs
 *
 * The object key in R2 is:  k/<slug>.html
 * Canonical URL stays:      https://devsolvev2.com/k/<slug>
 * Files are served from:    https://files.devsolvev2.com/k/<slug>.html
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { brotliCompress, gzip, constants as zlibConstants } from 'node:zlib';
import { promisify } from 'node:util';

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync           = promisify(gzip);

/* ------------------------------------------------------------------ */
/*  Configuration                                                       */
/* ------------------------------------------------------------------ */
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET     = process.env.R2_BUCKET_NAME;
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '200', 10);
const COMPRESS    = (process.env.COMPRESS ?? 'br').toLowerCase();
const DRY_RUN     = process.env.DRY_RUN === '1';

if (!DRY_RUN && (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY || !BUCKET)) {
  console.error(
    'Missing required environment variables.\n' +
    'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
  );
  process.exit(1);
}

const s3 = DRY_RUN
  ? null
  : new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    });

/* ------------------------------------------------------------------ */
/*  Core data — must match functions/k/[[slug]].ts exactly             */
/* ------------------------------------------------------------------ */
const clusters = [
  { key: 'json',       tools: ['json-formatter', 'json-to-typescript'],                   intents: ['validate-json','format-json','inspect-json-structure','convert-json-to-types','compare-json-objects','transform-json-keys','extract-json-values','merge-json-data','flatten-nested-json','detect-json-syntax-errors','generate-json-schema','minify-json-payload'] },
  { key: 'encoding',   tools: ['base64-encode-decode','url-encode-decode','html-entity-encode-decode'], intents: ['encode-data','decode-data','fix-encoding-bugs','convert-character-sets','handle-unicode-text','escape-special-characters','troubleshoot-encoding-mismatch','batch-encode-values','decode-nested-encodings','verify-encoding-roundtrip','convert-binary-to-text','normalize-encoded-output'] },
  { key: 'security',   tools: ['hash-generator','uuid-generator','jwt-decoder'],          intents: ['generate-identifiers','verify-tokens','inspect-signatures','audit-token-expiry','hash-sensitive-data','generate-secure-keys','validate-jwt-claims','compare-security-hashes','detect-token-tampering','rotate-unique-identifiers','analyze-token-payload','verify-data-integrity'] },
  { key: 'text',       tools: ['text-case-converter','diff-checker','regex-tester'],      intents: ['normalize-text','compare-versions','test-regex','find-and-replace-patterns','extract-text-segments','convert-text-case','analyze-text-differences','build-regex-patterns','validate-input-format','clean-up-whitespace','split-text-by-delimiter','match-complex-patterns'] },
  { key: 'formatting', tools: ['sql-formatter','css-minifier','markdown-preview'],        intents: ['format-sql','minify-assets','preview-markdown','indent-nested-code','optimize-css-output','validate-markdown-syntax','beautify-query-strings','restructure-code-blocks','standardize-sql-style','compress-stylesheet','render-documentation','align-code-formatting'] },
  { key: 'api',        tools: ['json-formatter','jwt-decoder','url-encode-decode'],       intents: ['design-api-schema','validate-api-response','construct-query-string','authenticate-api-request','parse-webhook-payload','debug-api-error','format-api-documentation','test-api-endpoint','normalize-api-data','optimize-api-payload','version-api-response','secure-api-communication'] },
  { key: 'data',       tools: ['json-to-typescript','base64-encode-decode','hash-generator'], intents: ['transform-data-format','generate-data-models','hash-data-for-storage','encode-binary-data','create-data-fingerprint','validate-data-integrity','serialize-complex-objects','migrate-data-schema','anonymize-sensitive-fields','aggregate-data-records','generate-unique-identifiers','normalize-data-structure'] },
  { key: 'debugging',  tools: ['diff-checker','regex-tester','json-formatter'],           intents: ['compare-config-files','trace-data-flow','isolate-parsing-error','identify-format-change','debug-regex-match','verify-output-format','analyze-log-patterns','pinpoint-encoding-issue','detect-schema-drift','validate-transform-output','reproduce-formatting-bug','check-data-consistency'] },
  { key: 'automation', tools: ['cron-helper','regex-tester','uuid-generator'],            intents: ['schedule-recurring-task','extract-log-data','generate-batch-ids','parse-automation-output','validate-cron-schedule','build-extraction-pattern','create-unique-job-ids','monitor-scheduled-tasks','automate-data-extraction','filter-event-streams','tag-automated-processes','configure-periodic-cleanup'] },
  { key: 'web',        tools: ['html-entity-encode-decode','css-minifier','markdown-preview'], intents: ['sanitize-html-input','optimize-css-bundle','preview-content-markup','encode-url-parameters','protect-against-xss','minify-stylesheet','render-dynamic-content','escape-template-variables','compress-web-assets','validate-markup-output','format-rich-text','secure-form-data'] },
];

const audiences = [
  'backend-engineer','frontend-developer','fullstack-developer','api-consumer',
  'integration-engineer','security-conscious-developer','ops-engineer','devops-engineer',
  'technical-writer','data-engineer','mobile-developer','qa-engineer',
  'site-reliability-engineer','database-administrator','cloud-architect',
  'performance-engineer','platform-engineer','solution-architect','tech-lead','release-engineer',
];

const tasks = [
  'debug-production-issue','prepare-api-response','clean-up-payload','sanitize-user-input',
  'prepare-query-parameters','inspect-encoded-payload','trace-request','validate-auth-token',
  'review-config-change','migrate-legacy-system','prepare-deployment-artifact',
  'document-api-endpoint','optimize-build-pipeline','resolve-merge-conflict',
  'prepare-security-audit','generate-test-fixtures',
];

const modifierExecutionStyles = [
  'without-installing-cli-tools','directly-in-your-browser','with-step-by-step-instructions',
  'with-safe-local-processing','while-keeping-data-private','for-quick-prototyping',
  'during-code-review','as-part-of-ci-cd-pipeline','with-automated-validation',
];

const modifierDeliveryContexts = [
  'for-time-sensitive-incidents','for-team-onboarding','for-audit-readiness',
  'for-cross-region-teams','for-legacy-system-migrations','for-large-enterprise-workflows',
  'for-api-contract-validation','for-weekly-ops-routines','for-compliance-reporting',
  'for-incident-postmortems','for-capacity-planning','for-release-management',
  'for-vendor-integration','for-data-governance','for-service-mesh-debugging',
  'for-cost-optimization','for-performance-benchmarking','for-disaster-recovery',
];

const modifierPatterns = modifierExecutionStyles.flatMap((s) =>
  modifierDeliveryContexts.map((c) => `${s}-${c}`),
);

/* Pre-computed index structures */
const toolIntentPairs = [];
for (const cluster of clusters) {
  for (const tool of cluster.tools) {
    for (const intent of cluster.intents) {
      toolIntentPairs.push({ cluster, tool, intent });
    }
  }
}

const AUDIENCES_COUNT  = audiences.length;
const TASKS_COUNT      = tasks.length;
const MODIFIERS_COUNT  = modifierPatterns.length;
const PER_PAIR         = AUDIENCES_COUNT * TASKS_COUNT * MODIFIERS_COUNT;
const TOTAL_POSSIBLE   = toolIntentPairs.length * PER_PAIR;

const START_INDEX = parseInt(process.env.START_INDEX || '0', 10);
const END_INDEX   = parseInt(process.env.END_INDEX || String(TOTAL_POSSIBLE), 10);

/* ------------------------------------------------------------------ */
/*  Audience / cluster / task context maps                             */
/* ------------------------------------------------------------------ */
const audienceContext = {
  'backend-engineer':             { focus: 'server-side reliability and performance',          concern: 'data consistency across services',                        workflow: 'integrated into your server-side development pipeline' },
  'frontend-developer':           { focus: 'UI responsiveness and user experience',            concern: 'rendering performance and data binding',                  workflow: 'alongside your component development workflow' },
  'fullstack-developer':          { focus: 'end-to-end application correctness',               concern: 'consistency between client and server layers',            workflow: 'bridging both frontend and backend codebases' },
  'api-consumer':                 { focus: 'reliable API integration and data handling',        concern: 'response format stability and error handling',            workflow: 'embedded in your API integration testing cycle' },
  'integration-engineer':         { focus: 'system interoperability and data mapping',         concern: 'format compatibility between disparate systems',          workflow: 'as part of your cross-system integration pipeline' },
  'security-conscious-developer': { focus: 'secure data handling and token management',        concern: 'exposure of sensitive credentials or tokens',             workflow: 'within a security-first development methodology' },
  'ops-engineer':                 { focus: 'operational stability and monitoring',             concern: 'configuration drift and deployment consistency',          workflow: 'supporting your infrastructure operations workflow' },
  'devops-engineer':              { focus: 'continuous delivery and infrastructure automation', concern: 'build artifact integrity and pipeline reliability',       workflow: 'integrated into your CI/CD pipeline and automation scripts' },
  'technical-writer':             { focus: 'documentation accuracy and clarity',               concern: 'keeping examples consistent with the actual codebase',   workflow: 'supporting your documentation authoring process' },
  'data-engineer':                { focus: 'data pipeline correctness and throughput',         concern: 'schema evolution and data quality over time',             workflow: 'as part of your ETL and data processing pipeline' },
  'mobile-developer':             { focus: 'efficient data transfer and offline support',      concern: 'payload size and encoding compatibility across platforms', workflow: 'optimized for mobile-first development practices' },
  'qa-engineer':                  { focus: 'test coverage and regression detection',           concern: 'subtle data differences that indicate bugs',              workflow: 'integrated into your testing and quality assurance process' },
  'site-reliability-engineer':    { focus: 'system uptime and incident response',              concern: 'rapid root cause identification during outages',          workflow: 'as part of your incident response and observability toolkit' },
  'database-administrator':       { focus: 'query performance and data integrity',             concern: 'schema changes affecting existing queries or indexes',    workflow: 'within your database management and maintenance routine' },
  'cloud-architect':              { focus: 'scalable system design and resource optimization', concern: 'cross-service data format consistency at scale',          workflow: 'informing your cloud infrastructure design decisions' },
  'performance-engineer':         { focus: 'latency reduction and throughput optimization',    concern: 'identifying processing bottlenecks and resource consumption patterns', workflow: 'integrated into your performance profiling and benchmarking pipeline' },
  'platform-engineer':            { focus: 'developer experience and infrastructure abstraction', concern: 'toolchain consistency and platform reliability across teams', workflow: 'as part of your internal developer platform and self-service tooling' },
  'solution-architect':           { focus: 'end-to-end system design and technology selection', concern: 'interoperability between chosen components and long-term maintainability', workflow: 'supporting your architecture decision records and proof-of-concept evaluations' },
  'tech-lead':                    { focus: 'team productivity and technical decision quality',  concern: 'code quality standards and knowledge sharing across the team', workflow: 'embedded in your team review process and technical mentoring sessions' },
  'release-engineer':             { focus: 'build reproducibility and release artifact integrity', concern: 'deployment consistency and rollback safety across environments', workflow: 'integrated into your release pipeline and artifact verification process' },
};

const clusterDomain = {
  json:       { field: 'JSON data handling',                importance: 'JSON is the backbone of modern API communication and configuration management', bestPractice: 'Always validate JSON before processing it programmatically to catch structural issues early' },
  encoding:   { field: 'encoding and decoding workflows',   importance: 'Correct encoding prevents data corruption and security vulnerabilities across system boundaries', bestPractice: 'Test encoding roundtrips to ensure no data loss occurs during conversion' },
  security:   { field: 'security token and hash management', importance: 'Proper token handling is critical for authentication, authorization, and data integrity', bestPractice: 'Never expose tokens or secrets in client-side code or version control' },
  text:       { field: 'text processing and pattern matching', importance: 'Accurate text manipulation underpins search, validation, and data normalization tasks', bestPractice: 'Test your patterns and transformations on realistic sample data before applying them to production datasets' },
  formatting: { field: 'code and query formatting',         importance: 'Consistent formatting improves code readability, review efficiency, and maintainability', bestPractice: 'Adopt a team-wide formatting standard and automate enforcement through linters and pre-commit hooks' },
  api:        { field: 'API design and integration',        importance: 'Well-structured APIs reduce integration friction and improve developer experience', bestPractice: 'Version your API schemas and validate both requests and responses against documented contracts' },
  data:       { field: 'data transformation and modeling',  importance: 'Reliable data pipelines require consistent schemas and validated transformations', bestPractice: 'Generate and maintain type definitions from actual data samples to catch schema drift early' },
  debugging:  { field: 'debugging and troubleshooting',     importance: 'Systematic debugging reduces mean time to resolution and prevents recurring issues', bestPractice: 'Compare known-good outputs against current outputs to quickly isolate the point of failure' },
  automation: { field: 'task automation and scheduling',    importance: 'Automation eliminates repetitive manual work and reduces human error in operations', bestPractice: 'Validate cron expressions and extraction patterns in isolation before deploying them to production schedulers' },
  web:        { field: 'web security and optimization',     importance: 'Secure and optimized web content protects users and improves performance metrics', bestPractice: 'Sanitize all user-supplied content and test minified assets for correctness before deployment' },
};

const taskContext = {
  'debug-production-issue':      { scenario: 'diagnosing a live production problem',                       urgency: 'time-sensitive, as users may be affected',                         outcome: 'identify the root cause and apply a targeted fix' },
  'prepare-api-response':        { scenario: 'constructing or validating an API response',                 urgency: 'important for downstream consumer reliability',                    outcome: 'produce a well-formed response that matches the documented schema' },
  'clean-up-payload':            { scenario: 'normalizing messy or inconsistent data',                     urgency: 'prevents cascading errors in downstream processing',               outcome: 'deliver a clean, predictable data structure for further use' },
  'sanitize-user-input':         { scenario: 'making user-provided data safe for processing',              urgency: 'critical for preventing injection attacks and data corruption',    outcome: 'ensure all input meets expected format and safety constraints' },
  'prepare-query-parameters':    { scenario: 'building properly encoded query strings',                    urgency: 'required for correct API communication',                           outcome: 'produce query parameters that survive URL parsing without data loss' },
  'inspect-encoded-payload':     { scenario: 'examining encoded or obfuscated data',                       urgency: 'necessary for understanding data flow between systems',             outcome: 'decode the payload and verify its structure and content' },
  'trace-request':               { scenario: 'following a request through multiple system layers',         urgency: 'essential for diagnosing integration issues',                      outcome: 'map the complete request lifecycle and identify where failures occur' },
  'validate-auth-token':         { scenario: 'checking authentication token structure and claims',         urgency: 'important for verifying access control is working correctly',      outcome: 'confirm the token contains the expected claims and has not expired' },
  'review-config-change':        { scenario: 'verifying a configuration modification before deployment',   urgency: 'prevents misconfigurations from reaching production',              outcome: 'confirm the change is correct, complete, and backward-compatible' },
  'migrate-legacy-system':       { scenario: 'moving data or logic from an older system',                  urgency: 'requires careful validation to prevent data loss during transition', outcome: 'successfully transfer data while maintaining integrity and format compatibility' },
  'prepare-deployment-artifact': { scenario: 'packaging assets for a release deployment',                  urgency: 'directly affects deployment reliability and performance',           outcome: 'produce optimized, validated artifacts ready for production deployment' },
  'document-api-endpoint':       { scenario: 'creating or updating endpoint documentation',                urgency: 'keeps external and internal consumers aligned with the current API', outcome: 'produce accurate documentation with working examples and clear parameter descriptions' },
  'optimize-build-pipeline':     { scenario: 'improving build speed and artifact quality in CI/CD',        urgency: 'directly affects developer iteration speed and deployment frequency', outcome: 'reduce build times while maintaining output correctness and reproducibility' },
  'resolve-merge-conflict':      { scenario: 'reconciling divergent code or configuration changes',        urgency: 'blocks integration and delays feature delivery until resolved correctly', outcome: 'produce a clean merge that preserves the intent of all contributing changes' },
  'prepare-security-audit':      { scenario: 'gathering evidence and validating controls for a security review', urgency: 'required for compliance deadlines and organizational trust verification', outcome: 'compile a verifiable set of security controls and configuration evidence' },
  'generate-test-fixtures':      { scenario: 'creating realistic sample data for automated tests',         urgency: 'foundational for test coverage and regression detection quality',   outcome: 'produce representative test data that covers normal, edge, and adversarial scenarios' },
};

/* ------------------------------------------------------------------ */
/*  Title / H1 / description templates (per-cluster, 3 variants each)  */
/* ------------------------------------------------------------------ */
const titleTemplates = {
  json:       ['How to {intent} as a {audience} with {tool}', '{tool}: {intent} guide for {audience} professionals', 'A {audience} approach to {intent} using {tool}'],
  encoding:   ['How to {intent} as a {audience} using {tool}', '{tool} workflow: {intent} for {audience} teams', 'Encoding best practices: {intent} with {tool} for {audience} roles'],
  security:   ['How to {intent} as a {audience} with {tool}', 'Security workflow: {intent} using {tool} for {audience} teams', '{tool} for {audience} professionals: {intent} safely'],
  text:       ['How to {intent} as a {audience} using {tool}', 'Text processing: {intent} with {tool} for {audience} workflows', '{audience} guide to {intent} with {tool}'],
  formatting: ['How to {intent} as a {audience} with {tool}', 'Code formatting: {intent} using {tool} for {audience} teams', '{tool} for {audience} professionals: {intent} effectively'],
  api:        ['How to {intent} as a {audience} using {tool}', 'API workflow: {intent} with {tool} for {audience} professionals', '{audience} approach to {intent} using {tool}'],
  data:       ['How to {intent} as a {audience} with {tool}', 'Data engineering: {intent} using {tool} for {audience} roles', '{tool} guide: {intent} for {audience} professionals'],
  debugging:  ['How to {intent} as a {audience} using {tool}', 'Debugging: {intent} with {tool} for {audience} workflows', '{audience} troubleshooting guide: {intent} with {tool}'],
  automation: ['How to {intent} as a {audience} with {tool}', 'Automation: {intent} using {tool} for {audience} teams', '{audience} guide to {intent} with {tool}'],
  web:        ['How to {intent} as a {audience} using {tool}', 'Web development: {intent} with {tool} for {audience} roles', '{tool} for {audience} professionals: {intent} securely'],
};

const h1Templates = {
  json:       ['Practical guide: {intent} for a {audience}', '{intent} — a hands-on walkthrough for {audience} professionals', 'Step-by-step: {intent} in your {audience} workflow'],
  encoding:   ['Practical guide: {intent} for a {audience}', 'Encoding workflow: {intent} tailored for {audience} teams', 'How {audience} professionals can {intent} efficiently'],
  security:   ['Practical guide: {intent} for a {audience}', 'Security-first approach to {intent} for {audience} roles', 'Secure workflow: {intent} designed for {audience} professionals'],
  text:       ['Practical guide: {intent} for a {audience}', 'Text processing walkthrough: {intent} for {audience} teams', '{intent} — practical steps for {audience} professionals'],
  formatting: ['Practical guide: {intent} for a {audience}', 'Formatting workflow: {intent} optimized for {audience} teams', 'Clean code approach: {intent} for {audience} professionals'],
  api:        ['Practical guide: {intent} for a {audience}', 'API integration: {intent} designed for {audience} workflows', '{intent} — a structured approach for {audience} professionals'],
  data:       ['Practical guide: {intent} for a {audience}', 'Data workflow: {intent} tailored for {audience} teams', 'From raw data to results: {intent} for {audience} roles'],
  debugging:  ['Practical guide: {intent} for a {audience}', 'Troubleshooting: {intent} for {audience} workflows', 'Debug effectively: {intent} as a {audience}'],
  automation: ['Practical guide: {intent} for a {audience}', 'Automation workflow: {intent} for {audience} teams', 'Streamline your work: {intent} as a {audience}'],
  web:        ['Practical guide: {intent} for a {audience}', 'Web development: {intent} for {audience} professionals', 'Build securely: {intent} in your {audience} workflow'],
};

/* ------------------------------------------------------------------ */
/*  Per-cluster pitfalls — 6 entries each; rotated by seed to give     */
/*  different combinations across pages and eliminate text overlap.    */
/* ------------------------------------------------------------------ */
const clusterPitfalls = {
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

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                     */
/* ------------------------------------------------------------------ */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugToSpacedString(s) {
  return s.replace(/-/g, ' ');
}

function getToolName(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSlug(clusterKey, tool, intent, audience, task, index) {
  return [clusterKey, intent, audience, task, tool]
    .join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + `-${index}`;
}

/* ------------------------------------------------------------------ */
/*  Page resolver (identical logic to functions/k/[[slug]].ts)         */
/* ------------------------------------------------------------------ */
function resolvePageByIndex(index) {
  if (index < 0 || index >= TOTAL_POSSIBLE) return null;

  const pairIndex    = Math.floor(index / PER_PAIR);
  const remainder    = index % PER_PAIR;
  const audienceIndex = Math.floor(remainder / (TASKS_COUNT * MODIFIERS_COUNT));
  const remainder2   = remainder % (TASKS_COUNT * MODIFIERS_COUNT);
  const taskIndex    = Math.floor(remainder2 / MODIFIERS_COUNT);
  const modifierIndex = remainder2 % MODIFIERS_COUNT;

  const pair     = toolIntentPairs[pairIndex];
  const audience = audiences[audienceIndex];
  const task     = tasks[taskIndex];
  const modifier = modifierPatterns[modifierIndex];
  if (!pair || !audience || !task || !modifier) return null;

  const slug       = buildSlug(pair.cluster.key, pair.tool, pair.intent, audience, task, index);
  const seed       = hashString(slug);
  const clusterKey = pair.cluster.key;
  const toolName   = getToolName(pair.tool);
  const ac = audienceContext[audience] || { focus: 'development quality', concern: 'data correctness', workflow: 'within your development process' };
  const cd = clusterDomain[clusterKey];
  const tc = taskContext[task] || { scenario: 'completing a development task', urgency: 'important', outcome: 'achieve the result' };

  const titleTemplate = titleTemplates[clusterKey][seed % titleTemplates[clusterKey].length];
  const title = titleTemplate
    .replace('{intent}',   slugToSpacedString(pair.intent))
    .replace('{audience}', slugToSpacedString(audience))
    .replace('{tool}',     toolName);

  const h1Template = h1Templates[clusterKey][seed % h1Templates[clusterKey].length];
  const h1 = h1Template
    .replace('{intent}',    slugToSpacedString(pair.intent))
    .replace(/\{audience\}/g, slugToSpacedString(audience));

  const descVariants = [
    `${title} — practical, browser-based workflow for real-world ${slugToSpacedString(clusterKey)} engineering tasks, ${slugToSpacedString(modifier)}. Learn how to ${tc.outcome} with ${toolName}.`,
    `Step-by-step guide to ${slugToSpacedString(pair.intent)} using ${toolName} for ${slugToSpacedString(audience)} professionals. Covers ${tc.scenario} with best practices for ${cd.field}.`,
    `How ${slugToSpacedString(audience)} teams use ${toolName} to ${slugToSpacedString(pair.intent)} ${slugToSpacedString(modifier)}. Includes troubleshooting tips, alternative solutions, and expert recommendations.`,
    `Complete walkthrough: ${slugToSpacedString(pair.intent)} with ${toolName} for ${slugToSpacedString(audience)} workflows. All processing runs locally in your browser — your data stays private.`,
    `A ${slugToSpacedString(audience)}'s guide to ${slugToSpacedString(pair.intent)} using browser-based ${toolName}. Practical steps for ${tc.scenario}, with focus on ${ac.focus}.`,
  ];
  const description = descVariants[seed % descVariants.length];

  const introVariants = [
    `As a ${slugToSpacedString(audience)} focused on ${ac.focus}, you can ${slugToSpacedString(pair.intent)} using the browser-based ${toolName}. ${cd.importance}, and this guide walks through the process ${slugToSpacedString(modifier)}. The scenario here is ${tc.scenario}, which is ${tc.urgency}. By the end, you will ${tc.outcome} — all without sending data to an external server.`,
    `This page explains how a ${slugToSpacedString(audience)} can approach ${slugToSpacedString(pair.intent)} with ${toolName}, ${slugToSpacedString(modifier)}. In the context of ${cd.field}, ${cd.importance.toLowerCase()}. The specific focus is on ${tc.scenario}, and the goal is to ${tc.outcome}. Every step runs locally in your browser, so your data stays private — an important consideration given ${ac.concern}.`,
    `When ${tc.scenario}, a ${slugToSpacedString(audience)} needs reliable tools for ${slugToSpacedString(pair.intent)}. ${toolName} handles this ${slugToSpacedString(modifier)}, with all processing happening locally in your browser. This is particularly relevant because ${cd.importance.toLowerCase()}. The workflow is designed ${ac.workflow}, with the goal to ${tc.outcome}.`,
    `For ${slugToSpacedString(audience)} professionals working on ${cd.field}, ${slugToSpacedString(pair.intent)} is a common requirement. This guide shows how to accomplish this using ${toolName} ${slugToSpacedString(modifier)}. The real-world context is ${tc.scenario} — ${tc.urgency}. ${cd.bestPractice}. All processing runs locally, addressing ${ac.concern}.`,
    `${slugToSpacedString(pair.intent)} is a task that every ${slugToSpacedString(audience)} encounters in ${cd.field}. Using ${toolName} ${slugToSpacedString(modifier)}, you can handle this efficiently and securely. This walkthrough targets ${tc.scenario}, helping you ${tc.outcome}. The browser-based approach means your data never leaves your machine, which matters when dealing with ${ac.concern}.`,
  ];
  const intro = introVariants[seed % introVariants.length];

  const steps = [
    `Identify the scope of your task: ${tc.scenario}. Start by gathering a representative sample of the data you need to process.`,
    `Open the ${toolName} from the DevSolve tools directory. The tool loads entirely in your browser with no server dependency.`,
    `Paste or type your input for the ${slugToSpacedString(pair.intent)} operation. If working with sensitive data, verify that your browser environment is secure.`,
    `Configure the tool options to match your requirements. Pay attention to settings that affect ${ac.focus}.`,
    `Execute the operation and carefully review the output. Check for edge cases related to ${ac.concern}.`,
    `Validate the result against your expectations. For ${tc.scenario}, the goal is to ${tc.outcome}.`,
  ];

  const keywords = [
    pair.intent, pair.tool, clusterKey, audience, task,
    `${slugToSpacedString(pair.intent)} tool`,
    `${slugToSpacedString(audience)} ${slugToSpacedString(clusterKey)} guide`,
    `browser-based ${slugToSpacedString(pair.tool)}`,
    'developer tool', 'free online tool',
  ];

  return { slug, title, h1, description, intro, clusterKey, tool: pair.tool, intent: pair.intent, audience, task, modifier, steps, keywords };
}

/* ------------------------------------------------------------------ */
/*  HTML generator (mirrors functions/k/[[slug]].ts generateHtml)      */
/* ------------------------------------------------------------------ */
function generateHtml(page) {
  const siteUrl    = 'https://devsolvev2.com';
  const canonical  = `${siteUrl}/k/${page.slug}`;
  const toolName   = getToolName(page.tool);
  const cd = clusterDomain[page.clusterKey];
  const tc = taskContext[page.task] || { scenario: 'completing a development task', urgency: 'important', outcome: 'achieve the result' };
  const ac = audienceContext[page.audience] || { focus: 'development quality', concern: 'data correctness', workflow: 'within your development process' };

  const stepsHtml = page.steps.map((step, i) =>
    `<li class="flex items-start gap-3"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">${i + 1}</span><span>${escapeHtml(step)}</span></li>`,
  ).join('\n');

  const keywordsStr = page.keywords.map((k) => escapeHtml(k)).join(', ');

  /* Related page links — deterministic from slug hash */
  const seed = hashString(page.slug);
  const relatedLinks = [];
  for (let i = 0; i < 8; i++) {
    const relIdx  = (seed + i * 7919) % TOTAL_POSSIBLE;
    const relPair = toolIntentPairs[Math.floor(relIdx / PER_PAIR)];
    const relAudienceIdx = Math.floor((relIdx % PER_PAIR) / (TASKS_COUNT * MODIFIERS_COUNT));
    const relTaskIdx     = Math.floor((relIdx % (TASKS_COUNT * MODIFIERS_COUNT)) / MODIFIERS_COUNT);
    if (!relPair || !audiences[relAudienceIdx] || !tasks[relTaskIdx]) continue;
    const relSlug = buildSlug(relPair.cluster.key, relPair.tool, relPair.intent, audiences[relAudienceIdx], tasks[relTaskIdx], relIdx);
    if (relSlug !== page.slug) {
      const relTitle = relSlug.replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      relatedLinks.push(`<li><a href="/k/${relSlug}" class="text-blue-600 hover:underline">${escapeHtml(relTitle)}</a></li>`);
    }
  }

  const faqItems = [
    { q: `What does ${slugToSpacedString(page.intent)} mean for a ${slugToSpacedString(page.audience)}?`,  a: `For a ${slugToSpacedString(page.audience)} focused on ${ac.focus}, ${slugToSpacedString(page.intent)} involves using ${toolName} to ${tc.outcome}. This is done ${slugToSpacedString(page.modifier)} to ensure efficiency and data privacy.` },
    { q: `Is my data safe when using ${toolName}?`,                                                        a: `Yes. ${toolName} runs entirely in your browser. No data is transmitted to any external server. This is especially important for ${slugToSpacedString(page.audience)} professionals concerned about ${ac.concern}.` },
    { q: `When should I use this approach?`,                                                               a: `This approach is ideal when ${tc.scenario}. It is ${tc.urgency}, and the goal is to ${tc.outcome}.` },
    { q: `What are the best practices for ${slugToSpacedString(page.clusterKey)} tasks?`,                  a: `${cd.bestPractice}. ${cd.importance}, making proper tooling essential for ${slugToSpacedString(page.audience)} workflows.` },
  ];

  const faqHtml = faqItems.map((item) =>
    `<div class="border rounded-lg p-4"><h3 class="font-semibold mb-2">${escapeHtml(item.q)}</h3><p class="text-gray-600">${escapeHtml(item.a)}</p></div>`,
  ).join('\n');

  /* Dynamic pitfalls — rotated by seed so different pages within a cluster get different subsets */
  const allPitfalls = clusterPitfalls[page.clusterKey] || clusterPitfalls.json;
  const pitfallStart = seed % allPitfalls.length;
  const pitfallsHtml = Array.from({ length: 5 }, (_, i) =>
    `<li>${escapeHtml(allPitfalls[(pitfallStart + i) % allPitfalls.length])}</li>`,
  ).join('\n');

  /* Dynamic "Why Use This?" — 5 context-aware variants rotated by seed */
  const whyVariants = [
    `${cd.importance}. For ${slugToSpacedString(page.audience)} professionals, this workflow provides a reliable way to ${slugToSpacedString(page.intent)} with ${toolName} — entirely in your browser, with no data leaving your machine.`,
    `${toolName} handles ${slugToSpacedString(page.intent)} ${slugToSpacedString(page.modifier)}. ${cd.importance.toLowerCase()}, making this the right tool when your primary concern is ${ac.concern}.`,
    `As a ${slugToSpacedString(page.audience)}, you need tools that respect ${ac.focus}. ${toolName} processes everything locally while providing the output needed to ${tc.outcome}.`,
    `${cd.field} tasks like ${slugToSpacedString(page.intent)} demand precision. This guide walks through the exact steps ${slugToSpacedString(page.modifier)}, tailored for ${slugToSpacedString(page.audience)} workflows.`,
    `Unlike shallow redirect pages, this guide provides real technical depth for ${tc.scenario}. ${cd.bestPractice}.`,
  ];
  const whyText = escapeHtml(whyVariants[seed % whyVariants.length]);

  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  });

  const articleJsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: page.h1, description: page.description, url: canonical,
    datePublished: '2026-01-15T00:00:00Z', dateModified: '2026-04-06T00:00:00Z',
    author: { '@type': 'Organization', name: 'DevSolve Editorial Team', url: `${siteUrl}/about` },
    publisher: { '@type': 'Organization', name: 'DevSolve', url: siteUrl },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    inLanguage: 'en', isAccessibleForFree: true, keywords: keywordsStr,
  });

  const breadcrumbJsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${siteUrl}/tools` },
      { '@type': 'ListItem', position: 3, name: page.title, item: canonical },
    ],
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(page.title)} — DevSolve</title>
<meta name="description" content="${escapeHtml(page.description)}"/>
<meta name="keywords" content="${keywordsStr}"/>
<meta name="author" content="DevSolve"/>
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/>
<meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/>
<meta name="devsolve-content-signal" content="search=yes, ai-train=no"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:title" content="${escapeHtml(page.title)} — DevSolve"/>
<meta property="og:description" content="${escapeHtml(page.description)}"/>
<meta property="og:site_name" content="DevSolve"/>
<meta property="og:locale" content="en_US"/>
<meta property="article:published_time" content="2026-01-15T00:00:00Z"/>
<meta property="article:modified_time" content="2026-04-06T00:00:00Z"/>
<meta property="article:section" content="${escapeHtml(page.clusterKey)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(page.title)} — DevSolve"/>
<meta name="twitter:description" content="${escapeHtml(page.description)}"/>
<script type="application/ld+json">${faqJsonLd}</script>
<script type="application/ld+json">${articleJsonLd}</script>
<script type="application/ld+json">${breadcrumbJsonLd}</script>
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
</div>

<p style="font-size:1.1rem;color:#374151;margin-bottom:2rem" itemprop="description">${escapeHtml(page.intro)}</p>

<section aria-label="Step-by-step guide">
<div class="card">
<div class="card-title"><span role="img" aria-label="Check">✅</span> Step-by-Step Guide</div>
<ol class="steps-list">
${stepsHtml}
</ol>
</div>
</section>

<section aria-label="Why use this">
<div class="card" style="border-color:#bfdbfe;background:#f0f9ff">
<div class="card-title"><span role="img" aria-label="Lightbulb">💡</span> Why Use This?</div>
<p>${whyText}</p>
</div>
</section>

<section aria-label="Common pitfalls">
<div class="card" style="border-color:#fde68a;background:#fffbeb">
<div class="card-title"><span role="img" aria-label="Warning">⚠️</span> Common Pitfalls</div>
<ul style="padding-left:1.25rem">
${pitfallsHtml}
</ul>
</div>
</section>

<section aria-label="Technical context">
<h2>Technical Context</h2>
<p>${escapeHtml(cd.importance)}. For ${escapeHtml(slugToSpacedString(page.audience))} professionals, this means paying close attention to ${escapeHtml(ac.focus)}. The best practice is: ${escapeHtml(cd.bestPractice)}.</p>
<p>In the context of ${escapeHtml(tc.scenario)}, which is ${escapeHtml(tc.urgency)}, the objective is to ${escapeHtml(tc.outcome)}. Using the approach described ${escapeHtml(slugToSpacedString(page.modifier))} ensures efficiency without compromising on quality or security.</p>
</section>

<section aria-label="Frequently asked questions">
<h2>Frequently Asked Questions</h2>
<div style="display:flex;flex-direction:column;gap:1rem">
${faqHtml}
</div>
</section>

<section aria-label="Related guides">
<h2>Related Guides</h2>
<ul class="related-links">
${relatedLinks.join('\n')}
</ul>
</section>

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

/* ------------------------------------------------------------------ */
/*  Compression helper                                                  */
/* ------------------------------------------------------------------ */
async function compressHtml(html) {
  const raw = Buffer.from(html, 'utf-8');
  if (COMPRESS === 'gz') {
    const buf = await gzipAsync(raw, { level: 9 });
    return { body: buf, encoding: 'gzip' };
  }
  if (COMPRESS === 'none') {
    return { body: raw, encoding: null };
  }
  // Default: Brotli — best ratio for repetitive static HTML
  const buf = await brotliCompressAsync(raw, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  });
  return { body: buf, encoding: 'br' };
}

/* ------------------------------------------------------------------ */
/*  R2 upload                                                           */
/* ------------------------------------------------------------------ */
async function uploadToR2(slug, html) {
  const key = `k/${slug}.html`;
  if (DRY_RUN) {
    process.stdout.write(`[DRY-RUN] Would upload: ${key}\n`);
    return;
  }
  const { body, encoding } = await compressHtml(html);
  const params = {
    Bucket:       BUCKET,
    Key:          key,
    Body:         body,
    ContentType:  'text/html; charset=utf-8',
    // Immutable + 1-year TTL: Cloudflare caches at edge indefinitely;
    // R2 "Class B" read requests drop to near-zero after the first fetch.
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      'x-content-signal': 'search=yes, ai-train=no',
    },
  };
  if (encoding) params.ContentEncoding = encoding;
  await s3.send(new PutObjectCommand(params));
}

/* ------------------------------------------------------------------ */
/*  Concurrency pool — runs `concurrency` tasks in parallel            */
/* ------------------------------------------------------------------ */
async function runWithConcurrency(total, concurrency, worker) {
  let next = START_INDEX;
  let completed = 0;
  let errors = 0;
  const startTime = Date.now();
  const REPORT_INTERVAL = 10_000;

  async function runOne() {
    while (next < total) {
      const index = next++;
      try {
        await worker(index);
        completed++;
      } catch (err) {
        errors++;
        process.stderr.write(`ERROR index=${index}: ${err.message}\n`);
      }
      if (completed % REPORT_INTERVAL === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate    = (completed / (Date.now() - startTime) * 1000).toFixed(0);
        const pct     = ((completed / (total - START_INDEX)) * 100).toFixed(2);
        process.stdout.write(`[${elapsed}s] ${completed.toLocaleString()} uploaded (${pct}%) — ${rate}/s — errors: ${errors}\n`);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(runOne());
  await Promise.all(workers);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  process.stdout.write(`\nDone. ${completed.toLocaleString()} pages in ${elapsed}s — ${errors} errors.\n`);
}

/* ------------------------------------------------------------------ */
/*  Entry point                                                         */
/* ------------------------------------------------------------------ */
const rangeTotal = END_INDEX - START_INDEX;

console.log(`DevSolve R2 Uploader — Cost-optimised mode`);
console.log(`  Pages       : ${rangeTotal.toLocaleString()} (index ${START_INDEX} – ${END_INDEX - 1})`);
console.log(`  Concurrency : ${CONCURRENCY}`);
console.log(`  Compression : ${COMPRESS === 'none' ? 'none (raw HTML)' : COMPRESS === 'gz' ? 'Gzip  (level 9)' : 'Brotli (quality 11)'}`);
console.log(`  Cache-Control: public, max-age=31536000, immutable`);
console.log(`  Bucket      : ${DRY_RUN ? '(dry-run)' : BUCKET}`);
console.log(`  Endpoint    : ${DRY_RUN ? '(dry-run)' : `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`}`);
console.log('');

await runWithConcurrency(END_INDEX, CONCURRENCY, async (index) => {
  const page = resolvePageByIndex(index);
  if (!page) return;
  const html = generateHtml(page);
  await uploadToR2(page.slug, html);
});

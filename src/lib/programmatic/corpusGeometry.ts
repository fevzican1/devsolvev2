/**
 * Shared 20M factory geometry. Next.js hubs and the edge renderer must resolve
 * the same slug → (cluster, intent, audience, task, tool, style, context)
 * coordinates so /k/ anchors never invent a second title vocabulary.
 *
 * Tables only — no HTML renderer, no body copy. Safe to import from the
 * static export without pulling functions/_lib/programmaticPage.ts.
 */

export const URLS_PER_SITEMAP = 50_000;
export const TARGET_CORPUS_SIZE = 20_000_000;

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

export const MODIFIER_STYLES = ['without-installing-cli-tools', 'directly-in-your-browser', 'with-step-by-step-instructions', 'with-safe-local-processing', 'while-keeping-data-private', 'for-quick-prototyping', 'during-code-review', 'as-part-of-ci-cd-pipeline', 'with-automated-validation'];
export const MODIFIER_CONTEXTS = ['for-time-sensitive-incidents', 'for-team-onboarding', 'for-audit-readiness', 'for-cross-region-teams', 'for-legacy-system-migrations', 'for-large-enterprise-workflows', 'for-api-contract-validation', 'for-weekly-ops-routines', 'for-compliance-reporting', 'for-incident-postmortems', 'for-capacity-planning', 'for-release-management', 'for-vendor-integration', 'for-data-governance', 'for-service-mesh-debugging', 'for-cost-optimization', 'for-performance-benchmarking', 'for-disaster-recovery', 'for-production-rollouts', 'for-observability-pipelines'];
export const MODIFIER_COUNT = MODIFIER_STYLES.length * MODIFIER_CONTEXTS.length;

export const PER_PAIR = AUDIENCES.length * TASKS.length * MODIFIER_COUNT;
export const PAIRS = CLUSTERS.flatMap(([cluster, tools, intents]) =>
  tools.flatMap((tool) => intents.map((intent) => [cluster, tool, intent] as const)));
export const RAW_CORPUS_SIZE = PAIRS.length * PER_PAIR;
export const CORPUS_SIZE = Math.min(TARGET_CORPUS_SIZE, RAW_CORPUS_SIZE);

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
export function indexForCombination(pairIndex: number, audienceIndex: number, taskIndex: number, modifier: number): number {
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

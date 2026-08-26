/**
 * Shared 5-atom factory identity for Title/H1 and every /k/ hub anchor.
 *
 * Formula (one whitespace token per atom; style+context fused):
 *   [Job]: [Audience] [Task] [Style]-[Context] via-[Tool]
 *
 * uniqueTokens() runs after assembly and before any length clamp. Tool atoms
 * are stem-disjoint (`fmt`, `jose`, …) so uniqueTokens() cannot drop the
 * fifth atom when the job already contains JSON/SQL/JWT.
 *
 * This module is tables + string assembly only. It does not import the edge
 * HTML renderer.
 */

import {
  resolvePageForSlug,
  type ResolvedPage,
} from '../programmatic/corpusGeometry';
import { tokenAtom, uniqueTokens } from './uniqueTokens';

export const TITLE_MAX = 66;

const CANONICAL_WORDS: Record<string, string> = {
  json: 'JSON',
  sql: 'SQL',
  css: 'CSS',
  html: 'HTML',
  url: 'URL',
  urls: 'URLs',
  uri: 'URI',
  uuid: 'UUID',
  uuids: 'UUIDs',
  jwt: 'JWT',
  jwts: 'JWTs',
  api: 'API',
  apis: 'APIs',
  xss: 'XSS',
  csrf: 'CSRF',
  id: 'ID',
  ids: 'IDs',
  ts: 'TypeScript',
  http: 'HTTP',
  https: 'HTTPS',
  csv: 'CSV',
  xml: 'XML',
  yaml: 'YAML',
  pii: 'PII',
  ci: 'CI',
  cd: 'CD',
  pr: 'PR',
  prs: 'PRs',
  utf: 'UTF',
  ascii: 'ASCII',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  markdown: 'Markdown',
  unicode: 'Unicode',
  base64: 'Base64',
  sha256: 'SHA-256',
  qa: 'QA',
  sre: 'SRE',
  dba: 'DBA',
  devops: 'DevOps',
  ui: 'UI',
  ux: 'UX',
  cli: 'CLI',
  os: 'OS',
  aws: 'AWS',
  dns: 'DNS',
  tls: 'TLS',
  seo: 'SEO',
  hmac: 'HMAC',
  kdf: 'KDF',
  nan: 'NaN',
  dr: 'DR',
};

const COMPOUND_MODIFIERS: [RegExp, string][] = [
  [/\bsecurity conscious\b/g, 'security-conscious'],
  [/\btime sensitive\b/g, 'time-sensitive'],
  [/\bcross region\b/g, 'cross-region'],
  [/\bstep by step\b/g, 'step-by-step'],
  [/\bend to end\b/g, 'end-to-end'],
  [/\bno install\b/g, 'no-install'],
  [/\bround trip\b/g, 'round-trip'],
];

/** Slug segment as reader-facing prose. Must match functions/_lib/language.ts prose(). */
export function identityLabel(value: string): string {
  const spaced = value
    .replace(/-/g, ' ')
    .split(' ')
    .map((word) => {
      if (!word) return word;
      const bare = word.replace(/[^a-zA-Z0-9]/g, '');
      const fixed = CANONICAL_WORDS[bare.toLowerCase()];
      if (!fixed) return word;
      return word.replace(bare, fixed);
    })
    .join(' ');
  return COMPOUND_MODIFIERS.reduce((text, [pattern, fixed]) => text.replace(pattern, fixed), spaced);
}

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

export function identityToolName(slug: string): string {
  return TOOL_NAMES[slug] ?? identityLabel(slug);
}

export const TOOL_MICRO: Record<string, string> = {
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

export const TOOL_TINY: Record<string, string> = {
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

/**
 * Fifth title/H1 atom. Must not share a uniqueTokens() stem with the job
 * atom — "JSON" on a JSON-validation page is the duplicate-concatenation
 * fingerprint Google reads first.
 */
export const IDENTITY_TOOL: Record<string, string> = {
  'json-formatter': 'fmt',
  'json-to-typescript': 'iface',
  'base64-encode-decode': 'b64',
  'url-encode-decode': 'codec',
  'html-entity-encode-decode': 'ents',
  'hash-generator': 'digest',
  'uuid-generator': 'guid',
  'jwt-decoder': 'jose',
  'text-case-converter': 'caps',
  'diff-checker': 'delta',
  'regex-tester': 'rx',
  'sql-formatter': 'dml',
  'css-minifier': 'sheet',
  'markdown-preview': 'md',
  'cron-helper': 'sched',
};

export const AUDIENCE_MICRO: Record<string, string> = {
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
  'release-engineer': 'releng',
};

export const AUDIENCE_TINY: Record<string, string> = {
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
  'release-engineer': 'releng',
};

export const TASK_PHRASE: Record<string, string> = {
  'debug-production-issue': 'production debugging',
  'prepare-api-response': 'wire-body prep',
  'clean-up-payload': 'payload clean-up',
  'sanitize-user-input': 'user input safety',
  'prepare-query-parameters': 'query parameter prep',
  'inspect-encoded-payload': 'encoded payload review',
  'trace-request': 'request tracing',
  'validate-auth-token': 'auth token checks',
  'review-config-change': 'config change review',
  'migrate-legacy-system': 'legacy migration',
  'prepare-deployment-artifact': 'artifact packaging',
  'document-api-endpoint': 'endpoint documentation',
  'optimize-build-pipeline': 'build optimisation',
  'resolve-merge-conflict': 'merge resolution',
  'prepare-security-audit': 'control audit prep',
  'generate-test-fixtures': 'test fixture design',
};

export const TASK_MICRO: Record<string, string> = {
  'debug-production-issue': 'prod debugging',
  'prepare-api-response': 'wire bodies',
  'clean-up-payload': 'payload prep',
  'sanitize-user-input': 'input safety',
  'prepare-query-parameters': 'query params',
  'inspect-encoded-payload': 'encoded data',
  'trace-request': 'tracing',
  'validate-auth-token': 'auth tokens',
  'review-config-change': 'config review',
  'migrate-legacy-system': 'migrations',
  'prepare-deployment-artifact': 'ship prep',
  'document-api-endpoint': 'spec write',
  'optimize-build-pipeline': 'build speed',
  'resolve-merge-conflict': 'merge fixes',
  'prepare-security-audit': 'audit prep',
  'generate-test-fixtures': 'test data',
};

export const TASK_TINY: Record<string, string> = {
  'debug-production-issue': 'prod bugs',
  'prepare-api-response': 'wire-out',
  'clean-up-payload': 'payloads',
  'sanitize-user-input': 'input',
  'prepare-query-parameters': 'params',
  'inspect-encoded-payload': 'encoding',
  'trace-request': 'traces',
  'validate-auth-token': 'tokens',
  'review-config-change': 'config',
  'migrate-legacy-system': 'legacy',
  'prepare-deployment-artifact': 'artifacts',
  'document-api-endpoint': 'spec',
  'optimize-build-pipeline': 'builds',
  'resolve-merge-conflict': 'merges',
  'prepare-security-audit': 'audits',
  'generate-test-fixtures': 'fixtures',
};

export const STYLE_IDENTITY: Record<string, { micro: string; tiny: string }> = {
  'without-installing-cli-tools': { micro: 'no CLI', tiny: 'no CLI' },
  'directly-in-your-browser': { micro: 'in-browser', tiny: 'browser' },
  'with-step-by-step-instructions': { micro: 'stepwise', tiny: 'step' },
  'with-safe-local-processing': { micro: 'local-only', tiny: 'local' },
  'while-keeping-data-private': { micro: 'private', tiny: 'private' },
  'for-quick-prototyping': { micro: 'prototyping', tiny: 'draft' },
  'during-code-review': { micro: 'in code review', tiny: 'review' },
  'as-part-of-ci-cd-pipeline': { micro: 'in CI/CD', tiny: 'CI/CD' },
  'with-automated-validation': { micro: 'auto-validated', tiny: 'checked' },
};

export const CONTEXT_IDENTITY: Record<string, { micro: string; tiny: string }> = {
  'for-time-sensitive-incidents': { micro: 'incidents', tiny: 'incident' },
  'for-team-onboarding': { micro: 'onboarding', tiny: 'joiners' },
  'for-audit-readiness': { micro: 'audits', tiny: 'audits' },
  'for-cross-region-teams': { micro: 'global teams', tiny: 'global' },
  'for-legacy-system-migrations': { micro: 'legacy moves', tiny: 'legacy' },
  'for-large-enterprise-workflows': { micro: 'enterprise', tiny: 'scale' },
  'for-api-contract-validation': { micro: 'API contracts', tiny: 'API spec' },
  'for-weekly-ops-routines': { micro: 'weekly ops', tiny: 'weekly' },
  'for-compliance-reporting': { micro: 'compliance', tiny: 'policy' },
  'for-incident-postmortems': { micro: 'postmortems', tiny: 'retro' },
  'for-capacity-planning': { micro: 'capacity', tiny: 'capacity' },
  'for-release-management': { micro: 'cutover', tiny: 'cutover' },
  'for-vendor-integration': { micro: 'vendor work', tiny: 'vendors' },
  'for-data-governance': { micro: 'governance', tiny: 'lineage' },
  'for-service-mesh-debugging': { micro: 'mesh debug', tiny: 'mesh' },
  'for-cost-optimization': { micro: 'cost control', tiny: 'cost' },
  'for-performance-benchmarking': { micro: 'benchmarks', tiny: 'bench' },
  'for-disaster-recovery': { micro: 'DR drills', tiny: 'DR' },
  'for-production-rollouts': { micro: 'rollouts', tiny: 'rollouts' },
  'for-observability-pipelines': { micro: 'observability', tiny: 'logs' },
};

const DEFAULT_STYLE_IDENTITY = { micro: 'in-browser', tiny: 'browser' };
const DEFAULT_CONTEXT_IDENTITY = { micro: 'daily work', tiny: 'daily' };

export function styleIdentity(style: string): { micro: string; tiny: string } {
  return STYLE_IDENTITY[style] ?? DEFAULT_STYLE_IDENTITY;
}

export function contextIdentity(context: string): { micro: string; tiny: string } {
  return CONTEXT_IDENTITY[context] ?? DEFAULT_CONTEXT_IDENTITY;
}

const INTENT_MICRO_OVERRIDES: Record<string, string> = {
  'find-and-replace-patterns': 'find and replace',
  'detect-json-syntax-errors': 'syntax errors',
  'convert-json-to-types': 'JSON to types',
  'generate-unique-identifiers': 'unique IDs',
  'rotate-unique-identifiers': 'ID rotation',
  'generate-identifiers': 'ID generation',
  'anonymize-sensitive-fields': 'field anonymising',
  'format-api-documentation': 'API doc format',
  'authenticate-api-request': 'request auth',
  'secure-api-communication': 'secure transport',
  'escape-template-variables': 'template escaping',
  'escape-special-characters': 'char escaping',
  'serialize-complex-objects': 'serialising',
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
  'verify-encoding-roundtrip': 'roundtrip check',
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
  'aggregate-data-records': 'aggregation',
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
  'indent-nested-code': 'indentation',
  'format-sql': 'SQL formatting',
  'minify-assets': 'asset minifying',
  'preview-markdown': 'Markdown preview',
};

export function intentMicro(intent: string): string {
  const override = INTENT_MICRO_OVERRIDES[intent];
  if (override) return override;
  const words = intent.split('-');
  return words.length >= 3 ? words.slice(1).join(' ') : words.join(' ');
}

export interface IdentityForms {
  intent: string[];
  tool: string[];
  audience: string[];
  task: string[];
  style: string[];
  context: string[];
}

const SHORTENING_PLANS: ReadonlyArray<{ readonly tiers: readonly [number, number, number, number, number, number] }> = [
  { tiers: [0, 0, 0, 0, 0, 0] },
  { tiers: [1, 0, 0, 0, 0, 0] },
  { tiers: [1, 1, 0, 0, 0, 0] },
  { tiers: [1, 1, 0, 1, 0, 0] },
  { tiers: [1, 1, 1, 1, 0, 0] },
  { tiers: [1, 1, 1, 2, 0, 0] },
  { tiers: [1, 1, 2, 2, 0, 0] },
  { tiers: [1, 1, 2, 2, 1, 0] },
  { tiers: [1, 1, 2, 2, 1, 1] },
  { tiers: [1, 2, 2, 2, 1, 1] },
  { tiers: [1, 2, 2, 2, 1, 1] },
];

export function identityFormsFor(page: Pick<ResolvedPage, 'tool' | 'intent' | 'audience' | 'task' | 'style' | 'context'>): IdentityForms {
  const style = styleIdentity(page.style);
  const context = contextIdentity(page.context);
  return {
    intent: [identityLabel(page.intent), intentMicro(page.intent)],
    tool: [identityToolName(page.tool), TOOL_MICRO[page.tool] ?? identityToolName(page.tool), TOOL_TINY[page.tool] ?? identityToolName(page.tool)],
    audience: [identityLabel(page.audience), AUDIENCE_MICRO[page.audience] ?? identityLabel(page.audience), AUDIENCE_TINY[page.audience] ?? identityLabel(page.audience)],
    task: [
      TASK_PHRASE[page.task] ?? identityLabel(page.task),
      TASK_MICRO[page.task] ?? identityLabel(page.task),
      TASK_TINY[page.task] ?? identityLabel(page.task),
    ],
    style: [style.micro, style.tiny],
    context: [context.micro, context.tiny],
  };
}

function identityAtoms(
  page: Pick<ResolvedPage, 'tool' | 'intent' | 'audience' | 'task' | 'style' | 'context'>,
  forms: IdentityForms,
  tiers: readonly [number, number, number, number, number, number],
): [string, string, string, string, string] {
  const [i, , a, k, s, c] = tiers;
  const job = tokenAtom(forms.intent[i]);
  const audience = tokenAtom(forms.audience[a]);
  const task = tokenAtom(forms.task[k]);
  const setting = `${tokenAtom(forms.style[s])}-${tokenAtom(forms.context[c])}`;
  const tool = `via-${tokenAtom(IDENTITY_TOOL[page.tool] ?? forms.tool[2] ?? page.tool)}`;
  return [job, audience, task, setting, tool];
}

function assembleIdentityLine(atoms: readonly [string, string, string, string, string]): string {
  const [job, audience, task, setting, tool] = atoms;
  const jobShown = job.charAt(0).toUpperCase() + job.slice(1);
  return uniqueTokens(`${jobShown}: ${audience} ${task} ${setting} ${tool}`);
}

function keepsFiveAtoms(line: string): boolean {
  return line.trim().split(/\s+/).filter(Boolean).length === 5;
}

/**
 * Pipeline: 1. assemble atoms → 2. uniqueTokens() → 3. shortening-plan
 * rotation until TITLE_MAX → 4. word-boundary clamp only if still long.
 * Never pad or clamp before uniqueTokens(). Reject a candidate that
 * uniqueTokens() collapsed below five atoms (that is how prepare-api-response
 * and document-api-endpoint shared a title on docs-teams).
 */
export function buildFiveAtomTitle(
  page: Pick<ResolvedPage, 'tool' | 'intent' | 'audience' | 'task' | 'style' | 'context'>,
): string {
  const forms = identityFormsFor(page);
  let candidate = '';
  let fallback = '';
  for (const { tiers } of SHORTENING_PLANS) {
    candidate = assembleIdentityLine(identityAtoms(page, forms, tiers));
    if (!keepsFiveAtoms(candidate)) continue;
    if (!fallback) fallback = candidate;
    if (candidate.length <= TITLE_MAX) return candidate;
  }
  if (!keepsFiveAtoms(candidate)) candidate = fallback || candidate;
  if (candidate.length > TITLE_MAX) {
    const cut = candidate.slice(0, TITLE_MAX);
    const at = cut.lastIndexOf(' ');
    candidate = uniqueTokens((at >= 40 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, ''));
  }
  return candidate;
}

export function fiveAtomTitleForSlug(slug: string): string | undefined {
  const page = resolvePageForSlug(slug);
  if (!page) return undefined;
  return buildFiveAtomTitle(page);
}

/**
 * Factory identity line: a colon-separated job plus a via-{tool} atom.
 * Editorial tool/guide names ("Hash Generator") are not 5-atom and must not
 * be forced through this check.
 */
export function isFiveAtomIdentityTitle(label: string): boolean {
  const text = label.trim();
  if (!text) return false;
  if (!/:/.test(text)) return false;
  if (!/\bvia-[a-z0-9]+\b/i.test(text)) return false;
  return true;
}

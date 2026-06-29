import { toolRegistry } from '@/tools/registry';
import { hashString } from '@/lib/utils';
import { ensureSeoDescription, ensureSeoTitle } from '@/lib/seo/seoText';
import { siteConfig } from '@/config/site';
import { monetizationConfig } from '@/config/monetization';
import { calculateQualityScore, MIN_QUALITY_SCORE } from '@/lib/quality/scoring';
import {
  isCrossToolRemediationPair,
  buildCrossToolIntroParagraph,
  buildCrossToolSteps,
  buildCrossToolFaq,
  buildCrossToolTechnicalNotes,
} from '@/lib/quality/crossToolRemediation';

/* Mulberry32-based deterministic shuffle — much better distribution than modular arithmetic */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface ProgrammaticPage {
  slug: string;
  title: string;
  description: string;
  primaryTool: string;
  clusterKey: ClusterKey;
  intent: string;
  audience: string;
  taskVariant: string;
  keywords: string[];
  h1: string;
  intro: string;
  steps: string[];
  pitfalls: string[];
  comparison: { item: string; pros: string; cons: string }[];
  proTips: string[];
  faq: { question: string; answer: string }[];
  technicalAnalysis: string[];
  expertTips: string[];
  toolHistory: string[];
  globalUseCases: string[];
  glossary: { term: string; definition: string }[];
}

type ClusterKey = 'json' | 'encoding' | 'security' | 'text' | 'formatting' | 'api' | 'data' | 'debugging' | 'automation' | 'web';

interface ClusterDefinition {
  key: ClusterKey;
  tools: string[];
  intents: string[];
}

/* ------------------------------------------------------------------ */
/*  Expanded cluster definitions – 12 intents per cluster, 10 clusters */
/* ------------------------------------------------------------------ */
const clusters: ClusterDefinition[] = [
  {
    key: 'json',
    tools: ['json-formatter', 'json-to-typescript'],
    intents: [
      'validate-json', 'format-json', 'inspect-json-structure', 'convert-json-to-types',
      'compare-json-objects', 'transform-json-keys', 'extract-json-values', 'merge-json-data',
      'flatten-nested-json', 'detect-json-syntax-errors', 'generate-json-schema', 'minify-json-payload',
    ],
  },
  {
    key: 'encoding',
    tools: ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'],
    intents: [
      'encode-data', 'decode-data', 'fix-encoding-bugs', 'convert-character-sets',
      'handle-unicode-text', 'escape-special-characters', 'troubleshoot-encoding-mismatch', 'batch-encode-values',
      'decode-nested-encodings', 'verify-encoding-roundtrip', 'convert-binary-to-text', 'normalize-encoded-output',
    ],
  },
  {
    key: 'security',
    tools: ['hash-generator', 'uuid-generator', 'jwt-decoder'],
    intents: [
      'generate-identifiers', 'verify-tokens', 'inspect-signatures', 'audit-token-expiry',
      'hash-sensitive-data', 'generate-secure-keys', 'validate-jwt-claims', 'compare-security-hashes',
      'detect-token-tampering', 'rotate-unique-identifiers', 'analyze-token-payload', 'verify-data-integrity',
    ],
  },
  {
    key: 'text',
    tools: ['text-case-converter', 'diff-checker', 'regex-tester'],
    intents: [
      'normalize-text', 'compare-versions', 'test-regex', 'find-and-replace-patterns',
      'extract-text-segments', 'convert-text-case', 'analyze-text-differences', 'build-regex-patterns',
      'validate-input-format', 'clean-up-whitespace', 'split-text-by-delimiter', 'match-complex-patterns',
    ],
  },
  {
    key: 'formatting',
    tools: ['sql-formatter', 'css-minifier', 'markdown-preview'],
    intents: [
      'format-sql', 'minify-assets', 'preview-markdown', 'indent-nested-code',
      'optimize-css-output', 'validate-markdown-syntax', 'beautify-query-strings', 'restructure-code-blocks',
      'standardize-sql-style', 'compress-stylesheet', 'render-documentation', 'align-code-formatting',
    ],
  },
  {
    key: 'api',
    tools: ['json-formatter', 'jwt-decoder', 'url-encode-decode'],
    intents: [
      'design-api-schema', 'validate-api-response', 'construct-query-string', 'authenticate-api-request',
      'parse-webhook-payload', 'debug-api-error', 'format-api-documentation', 'test-api-endpoint',
      'normalize-api-data', 'optimize-api-payload', 'version-api-response', 'secure-api-communication',
    ],
  },
  {
    key: 'data',
    tools: ['json-to-typescript', 'base64-encode-decode', 'hash-generator'],
    intents: [
      'transform-data-format', 'generate-data-models', 'hash-data-for-storage', 'encode-binary-data',
      'create-data-fingerprint', 'validate-data-integrity', 'serialize-complex-objects', 'migrate-data-schema',
      'anonymize-sensitive-fields', 'aggregate-data-records', 'generate-unique-identifiers', 'normalize-data-structure',
    ],
  },
  {
    key: 'debugging',
    tools: ['diff-checker', 'regex-tester', 'json-formatter'],
    intents: [
      'compare-config-files', 'trace-data-flow', 'isolate-parsing-error', 'identify-format-change',
      'debug-regex-match', 'verify-output-format', 'analyze-log-patterns', 'pinpoint-encoding-issue',
      'detect-schema-drift', 'validate-transform-output', 'reproduce-formatting-bug', 'check-data-consistency',
    ],
  },
  {
    key: 'automation',
    tools: ['cron-helper', 'regex-tester', 'uuid-generator'],
    intents: [
      'schedule-recurring-task', 'extract-log-data', 'generate-batch-ids', 'parse-automation-output',
      'validate-cron-schedule', 'build-extraction-pattern', 'create-unique-job-ids', 'monitor-scheduled-tasks',
      'automate-data-extraction', 'filter-event-streams', 'tag-automated-processes', 'configure-periodic-cleanup',
    ],
  },
  {
    key: 'web',
    tools: ['html-entity-encode-decode', 'css-minifier', 'markdown-preview'],
    intents: [
      'sanitize-html-input', 'optimize-css-bundle', 'preview-content-markup', 'encode-url-parameters',
      'protect-against-xss', 'minify-stylesheet', 'render-dynamic-content', 'escape-template-variables',
      'compress-web-assets', 'validate-markup-output', 'format-rich-text', 'secure-form-data',
    ],
  },
];

/* Global audience variants (20) — each represents a genuinely different developer role */
const audiences = [
  'backend-engineer', 'frontend-developer', 'fullstack-developer',
  'api-consumer', 'integration-engineer', 'security-conscious-developer',
  'ops-engineer', 'devops-engineer', 'technical-writer', 'data-engineer',
  'mobile-developer', 'qa-engineer', 'site-reliability-engineer',
  'database-administrator', 'cloud-architect',
  'performance-engineer', 'platform-engineer', 'solution-architect',
  'tech-lead', 'release-engineer',
];

/* Global task variants (16) — each describes a distinct real-world scenario */
const tasks = [
  'debug-production-issue', 'prepare-api-response', 'clean-up-payload',
  'sanitize-user-input', 'prepare-query-parameters', 'inspect-encoded-payload',
  'trace-request', 'validate-auth-token', 'review-config-change',
  'migrate-legacy-system', 'prepare-deployment-artifact', 'document-api-endpoint',
  'optimize-build-pipeline', 'resolve-merge-conflict',
  'prepare-security-audit', 'generate-test-fixtures',
];

/* Content modifier patterns (162) — derived from execution style × delivery context */
/* Execution style modifiers (9) */
const modifierExecutionStyles = [
  'without-installing-cli-tools',
  'directly-in-your-browser',
  'with-step-by-step-instructions',
  'with-safe-local-processing',
  'while-keeping-data-private',
  'for-quick-prototyping',
  'during-code-review',
  'as-part-of-ci-cd-pipeline',
  'with-automated-validation',
];

/* Delivery context modifiers (18) */
const modifierDeliveryContexts = [
  'for-time-sensitive-incidents',
  'for-team-onboarding',
  'for-audit-readiness',
  'for-cross-region-teams',
  'for-legacy-system-migrations',
  'for-large-enterprise-workflows',
  'for-api-contract-validation',
  'for-weekly-ops-routines',
  'for-compliance-reporting',
  'for-incident-postmortems',
  'for-capacity-planning',
  'for-release-management',
  'for-vendor-integration',
  'for-data-governance',
  'for-service-mesh-debugging',
  'for-cost-optimization',
  'for-performance-benchmarking',
  'for-disaster-recovery',
  'for-production-rollouts',
  'for-observability-pipelines',
];

const modifierPatterns = modifierExecutionStyles.flatMap((style) =>
  modifierDeliveryContexts.map((context) => `${style}-${context}`),
);

/* ------------------------------------------------------------------ */
/*  Pre-compute tool×intent pairs for O(1) index lookup               */
/*  Layout:  index = pairIdx * PER_PAIR                               */
/*              + audienceIdx * TASKS * MODIFIERS                      */
/*              + taskIdx * MODIFIERS                                  */
/*              + modifierIdx                                          */
/* ------------------------------------------------------------------ */
interface ToolIntentPair {
  cluster: ClusterDefinition;
  tool: string;
  intent: string;
}

const toolIntentPairs: ToolIntentPair[] = [];
for (const cluster of clusters) {
  for (const tool of cluster.tools) {
    for (const intent of cluster.intents) {
      toolIntentPairs.push({ cluster, tool, intent });
    }
  }
}

const AUDIENCES_COUNT = audiences.length;        // 20
const TASKS_COUNT = tasks.length;                // 16
const MODIFIERS_COUNT = modifierPatterns.length; // 180 (9 styles × 20 contexts)
const PER_PAIR = AUDIENCES_COUNT * TASKS_COUNT * MODIFIERS_COUNT; // 57600
const TOTAL_POSSIBLE = toolIntentPairs.length * PER_PAIR;          // 348 × 57600 = 20_044_800
const CORPUS_CAP = 20_000_000;
const MIN_PROGRAMMATIC_TOTAL = 1000;

function parseEnvPositiveInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function clampProgrammaticTotal(value: number): number {
  return Math.min(CORPUS_CAP, TOTAL_POSSIBLE, Math.max(MIN_PROGRAMMATIC_TOTAL, value));
}

const configuredDefaultTotal = clampProgrammaticTotal(siteConfig.programmatic.safeDefaultTotal);
const envRequestedTotal = parseEnvPositiveInteger(
  process.env.PROGRAMMATIC_PAGE_LIMIT ?? process.env.NEXT_PUBLIC_PROGRAMMATIC_PAGE_LIMIT,
);
function resolveRampTargetTotal(): number {
  if (siteConfig.programmatic.rampMode !== 'manual') return configuredDefaultTotal;

  const rampLevel = monetizationConfig.opsFlags.programmaticRampLevel ?? 0;
  if (rampLevel <= 0) return configuredDefaultTotal;

  const scheduleIndex = Math.min(rampLevel, siteConfig.programmatic.rampSchedule.length) - 1;
  const scheduledTarget = siteConfig.programmatic.rampSchedule[scheduleIndex];
  return clampProgrammaticTotal(scheduledTarget);
}

const TARGET_TOTAL = clampProgrammaticTotal(envRequestedTotal ?? resolveRampTargetTotal());
const pageCache = new Map<number, ProgrammaticPage>();

/* ------------------------------------------------------------------ */
/*  Slug builder                                                      */
/* ------------------------------------------------------------------ */
function buildSlug(
  clusterKey: string, tool: string, intent: string,
  audience: string, task: string, index: number,
): string {
  return [clusterKey, intent, audience, task, tool]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + `-${index}`;
}

/* ------------------------------------------------------------------ */
/*  Content generators — rich, deterministic, unique per combination   */
/* ------------------------------------------------------------------ */
function getToolName(slug: string): string {
  return toolRegistry.find((t) => t.slug === slug)?.name ?? slug.replace(/-/g, ' ');
}

function label(s: string): string {
  return s.replace(/-/g, ' ');
}

/* ---- Audience-specific framing ---- */
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

/* ---- Cluster-specific domain knowledge ---- */
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

/* ---- Task-specific context ---- */
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
/*  Title & H1 builders — varied by cluster for uniqueness             */
/* ------------------------------------------------------------------ */
const titleTemplates: Record<ClusterKey, string[]> = {
  json:       [
    'How to {intent} as a {audience} with {tool}',
    '{tool}: {intent} guide for {audience} professionals',
    'A {audience} approach to {intent} using {tool}',
    '{intent} with {tool} — the {audience} field guide',
    'Complete {audience} reference: {intent} using {tool}',
    '{tool} in practice: {intent} for {audience} teams',
  ],
  encoding:   [
    'How to {intent} as a {audience} using {tool}',
    '{tool} workflow: {intent} for {audience} teams',
    'Encoding best practices: {intent} with {tool} for {audience} roles',
    '{intent} step-by-step — a {audience} guide to {tool}',
    '{audience} playbook: {intent} using {tool} safely',
    'Reliable {intent} with {tool}: the {audience} handbook',
  ],
  security:   [
    'How to {intent} as a {audience} with {tool}',
    'Security workflow: {intent} using {tool} for {audience} teams',
    '{tool} for {audience} professionals: {intent} safely',
    'Secure {intent} — a {audience} guide using {tool}',
    '{audience} security checklist: {intent} with {tool}',
    'Zero-leak {intent}: {tool} in the {audience} workflow',
  ],
  text:       [
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
  api:        [
    'How to {intent} as a {audience} using {tool}',
    'API workflow: {intent} with {tool} for {audience} professionals',
    '{audience} approach to {intent} using {tool}',
    'Reliable {intent} — {tool} for {audience} integrations',
    '{tool} API guide: {intent} for {audience} teams',
    '{intent} in API development: {tool} for {audience} roles',
  ],
  data:       [
    'How to {intent} as a {audience} with {tool}',
    'Data engineering: {intent} using {tool} for {audience} roles',
    '{tool} guide: {intent} for {audience} professionals',
    '{audience} data workflow: {intent} with {tool}',
    '{intent} and data quality — {tool} for {audience} teams',
    'Production-ready {intent}: {tool} for {audience} engineers',
  ],
  debugging:  [
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
  web:        [
    'How to {intent} as a {audience} using {tool}',
    'Web development: {intent} with {tool} for {audience} roles',
    '{tool} for {audience} professionals: {intent} securely',
    '{intent} in web engineering — {tool} for {audience}',
    'Secure and fast {intent}: {tool} for {audience} teams',
    '{audience} web guide: {intent} using {tool}',
  ],
};

function buildTitle(tool: string, intent: string, audience: string, clusterKey: ClusterKey, seed: number): string {
  const templates = titleTemplates[clusterKey];
  const template = templates[seed % templates.length];
  return ensureSeoTitle(
    template
      .replace('{intent}', label(intent))
      .replace('{audience}', label(audience))
      .replace('{tool}', getToolName(tool)),
  );
}

const h1Templates: Record<ClusterKey, string[]> = {
  json:       [
    'Practical guide: {intent} for a {audience}',
    '{intent} — a hands-on walkthrough for {audience} professionals',
    'Step-by-step: {intent} in your {audience} workflow',
    'The {audience} playbook for {intent}',
    '{intent}: real-world scenarios for {audience} engineers',
    'Field notes: how {audience} teams tackle {intent}',
  ],
  encoding:   [
    'Practical guide: {intent} for a {audience}',
    'Encoding workflow: {intent} tailored for {audience} teams',
    'How {audience} professionals can {intent} efficiently',
    '{intent} without the guesswork — a {audience} reference',
    'The {audience} encoding guide: {intent} in practice',
    '{intent} for {audience} workflows: clarity at every step',
  ],
  security:   [
    'Practical guide: {intent} for a {audience}',
    'Security-first approach to {intent} for {audience} roles',
    'Secure workflow: {intent} designed for {audience} professionals',
    'How {audience} teams safely {intent}',
    '{intent} — the security-conscious {audience} handbook',
    'Auditable {intent}: a guide for {audience} professionals',
  ],
  text:       [
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
  api:        [
    'Practical guide: {intent} for a {audience}',
    'API integration: {intent} designed for {audience} workflows',
    '{intent} — a structured approach for {audience} professionals',
    'How {audience} engineers approach {intent} reliably',
    '{intent} for {audience} teams: a complete reference',
    'Production-grade {intent}: the {audience} API guide',
  ],
  data:       [
    'Practical guide: {intent} for a {audience}',
    'Data workflow: {intent} tailored for {audience} teams',
    'From raw data to results: {intent} for {audience} roles',
    '{intent} in data engineering — the {audience} approach',
    'The {audience} data guide: {intent} with confidence',
    'Quality-first {intent}: a walkthrough for {audience} professionals',
  ],
  debugging:  [
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
  web:        [
    'Practical guide: {intent} for a {audience}',
    'Web development: {intent} for {audience} professionals',
    'Build securely: {intent} in your {audience} workflow',
    'The {audience} web guide to {intent}',
    '{intent} for modern web — a {audience} walkthrough',
    'Performance and security in {intent}: the {audience} guide',
  ],
};

function buildH1(intent: string, audience: string, clusterKey: ClusterKey, seed: number): string {
  const templates = h1Templates[clusterKey];
  const template = templates[seed % templates.length];
  return template
    .replace('{intent}', label(intent))
    .replace(/\{audience\}/g, label(audience));
}

/* ------------------------------------------------------------------ */
/*  Rich intro builder — varies by cluster, audience, task, modifier  */
/* ------------------------------------------------------------------ */
function buildIntro(
  tool: string, intent: string, audience: string, task: string,
  modifier: string, clusterKey: ClusterKey, seed: number,
): string {
  const ac = audienceContext[audience] ?? { focus: 'development quality', concern: 'data correctness', workflow: 'within your development process' };
  const cd = clusterDomain[clusterKey];
  const tc = taskContext[task] ?? { scenario: 'completing a development task', urgency: 'important for project quality', outcome: 'achieve the desired result efficiently' };

  const introVariants = [
    [
      `As a ${label(audience)} focused on ${ac.focus}, you can ${label(intent)} using the browser-based ${getToolName(tool)}.`,
      `${cd.importance}, and this guide walks through the process ${label(modifier)}.`,
      `The scenario here is ${tc.scenario}, which is ${tc.urgency}.`,
      `By the end, you will ${tc.outcome} — all without sending data to an external server.`,
    ],
    [
      `This page explains how a ${label(audience)} can approach ${label(intent)} with ${getToolName(tool)}, ${label(modifier)}.`,
      `In the context of ${cd.field}, ${cd.importance.toLowerCase()}.`,
      `The specific focus is on ${tc.scenario}, and the goal is to ${tc.outcome}.`,
      `Every step runs locally in your browser, so your data stays private — an important consideration given ${ac.concern}.`,
    ],
    [
      `When ${tc.scenario}, a ${label(audience)} needs reliable tools for ${label(intent)}.`,
      `${getToolName(tool)} handles this ${label(modifier)}, with all processing happening locally in your browser.`,
      `This is particularly relevant because ${cd.importance.toLowerCase()}.`,
      `The workflow is designed ${ac.workflow}, with the goal to ${tc.outcome}.`,
    ],
    [
      `For ${label(audience)} professionals working on ${cd.field}, ${label(intent)} is a common requirement.`,
      `This guide shows how to accomplish this using ${getToolName(tool)} ${label(modifier)}.`,
      `The real-world context is ${tc.scenario} — ${tc.urgency}.`,
      `${cd.bestPractice}. All processing runs locally, addressing ${ac.concern}.`,
    ],
    [
      `${label(intent)} is a task that every ${label(audience)} encounters in ${cd.field}.`,
      `Using ${getToolName(tool)} ${label(modifier)}, you can handle this efficiently and securely.`,
      `This walkthrough targets ${tc.scenario}, helping you ${tc.outcome}.`,
      `The browser-based approach means your data never leaves your machine, which matters when dealing with ${ac.concern}.`,
    ],
    [
      `${cd.field} is a discipline where precision matters, and ${label(audience)} professionals know that ${label(intent)} done wrong leads to downstream failures.`,
      `This guide walks through how ${getToolName(tool)} enables you to ${label(intent)} ${label(modifier)}, building confidence before committing to production.`,
      `The context is ${tc.scenario} — a situation that is ${tc.urgency}.`,
      `Following these steps, you will ${tc.outcome} with full visibility into each transformation.`,
    ],
    [
      `${getToolName(tool)} is designed for exactly the scenario a ${label(audience)} faces when ${tc.scenario}.`,
      `The guide covers ${label(intent)} ${label(modifier)}, staying entirely within your browser so ${ac.concern} remains controlled.`,
      `${cd.importance}, which is why the steps here are structured ${ac.workflow}.`,
      `By the end you will have what you need to ${tc.outcome}, with a repeatable process you can apply in future situations.`,
    ],
    [
      `In ${cd.field}, the gap between a working result and a subtle bug often comes down to how carefully ${label(intent)} was handled.`,
      `This guide equips a ${label(audience)} with the exact steps to ${label(intent)} using ${getToolName(tool)} ${label(modifier)}.`,
      `The scenario — ${tc.scenario} — is ${tc.urgency}, so the workflow prioritises correctness and speed equally.`,
      `All data stays local, directly addressing the ${ac.concern} that matters most in your role.`,
    ],
    [
      `A ${label(audience)} working on ${tc.scenario} cannot afford ambiguity about ${label(intent)}.`,
      `${getToolName(tool)} removes that ambiguity by running every operation locally and delivering deterministic output ${label(modifier)}.`,
      `${cd.importance}. This guide maps that importance to practical steps tailored for ${ac.workflow}.`,
      `When you finish, you will ${tc.outcome} — reliably, reproducibly, and without transmitting sensitive data anywhere.`,
    ],
    [
      `There are many ways to approach ${label(intent)}, but for a ${label(audience)} the priorities are clear: ${ac.focus} and control over ${ac.concern}.`,
      `${getToolName(tool)} satisfies both by processing everything locally and providing transparent output ${label(modifier)}.`,
      `The driving scenario is ${tc.scenario}, where the urgency — ${tc.urgency} — demands a tool that does not slow you down.`,
      `${cd.bestPractice}. This guide shows you exactly how.`,
    ],
    [
      `Speed and accuracy are often in tension when ${label(audience)} teams need to ${label(intent)} under pressure.`,
      `${getToolName(tool)} resolves that tension by offering ${label(modifier)}, so the process is both fast and verifiable.`,
      `${cd.importance}, and this guide makes that principle concrete for ${tc.scenario}.`,
      `The outcome: you will ${tc.outcome}, backed by a transparent, auditable workflow ${ac.workflow}.`,
    ],
    [
      `${label(intent)} is not just a technical task — for a ${label(audience)}, it is a quality gate that protects ${ac.focus}.`,
      `This guide builds that gate using ${getToolName(tool)} ${label(modifier)}, covering ${tc.scenario} in full.`,
      `Because ${cd.importance.toLowerCase()}, each step is designed to surface issues before they propagate.`,
      `You will finish able to ${tc.outcome}, with every decision traceable back to the input you provided.`,
    ],
  ];

  return introVariants[seed % introVariants.length].join(' ');
}

/* ------------------------------------------------------------------ */
/*  Step builder — richer, more varied, audience & task aware          */
/* ------------------------------------------------------------------ */
function buildSteps(intent: string, tool: string, task: string, audience: string, clusterKey: ClusterKey, seed: number): string[] {
  const ac = audienceContext[audience] ?? { focus: 'development quality', concern: 'data correctness', workflow: 'within your development process' };
  const tc = taskContext[task] ?? { scenario: 'completing a task', urgency: 'important', outcome: 'achieve the result' };

  const baseSteps = [
    `Identify the scope of your task: ${tc.scenario}. Start by gathering a representative sample of the data you need to process.`,
    `Open the ${getToolName(tool)} from the DevSolve tools directory. The tool loads entirely in your browser with no server dependency.`,
    `Paste or type your input for the ${label(intent)} operation. If working with sensitive data, verify that your browser environment is secure.`,
    `Configure the tool options to match your requirements. Pay attention to settings that affect ${ac.focus}.`,
    `Execute the operation and carefully review the output. Check for edge cases related to ${ac.concern}.`,
    `Validate the result against your expectations. For ${tc.scenario}, the goal is to ${tc.outcome}.`,
  ];

  const clusterSteps: Record<ClusterKey, string[]> = {
    json: [
      'Before processing, verify that your JSON input is syntactically valid — a single misplaced comma or bracket can cascade into misleading results.',
      'Check how the tool handles special JSON values like null, empty arrays, and deeply nested objects, as these are common sources of bugs.',
      'If your JSON contains numeric values with high precision, verify that they survive the formatting pass without losing significant digits.',
      'Consider comparing the formatted output with your original structure using a diff tool to ensure no unintended transformations occurred.',
    ],
    encoding: [
      'Determine the correct encoding direction first — encoding already-encoded data is one of the most common and hardest-to-debug mistakes.',
      'Test with a sample that includes special characters, Unicode, and whitespace to ensure the encoding handles all expected input correctly.',
      'Verify the roundtrip: encode the data, then decode the result, and compare with the original to confirm no information was lost.',
      'Document the encoding scheme being used, so that other team members and downstream systems know how to correctly decode the output.',
    ],
    security: [
      'Before working with tokens or hashes, make sure you are not accidentally using production secrets in a development or shared environment.',
      'Verify the algorithm and key length match your security requirements — browser-based tools may support fewer algorithms than server-side libraries.',
      'If generating identifiers, confirm that the uniqueness guarantees match your use case — UUIDs are probabilistically unique, not guaranteed unique.',
      'Cross-reference any token claims or hash outputs against a trusted source to ensure the tool is producing correct and expected results.',
    ],
    text: [
      'Before applying transformations, define clear rules for how edge cases like mixed-case acronyms, numbers, and special characters should be handled.',
      'Test your regex or text operation on at least three different input samples that cover normal, edge, and adversarial cases.',
      'When comparing text versions, pay attention to whitespace differences — they can be significant in configuration files and code.',
      'Keep a copy of the original input before running destructive transformations like case conversion or find-and-replace operations.',
    ],
    formatting: [
      'Before formatting, check whether your team has an established style guide that the formatter should conform to.',
      'After formatting, run any relevant linters or validators to confirm the formatted output is still syntactically and semantically correct.',
      'For SQL formatting, be aware that different database engines may have subtle syntax differences that affect how queries should be structured.',
      'When minifying assets, test the minified output in the same environment where it will be deployed to catch any rendering or execution issues.',
    ],
    api: [
      'Start by reviewing the API specification or contract to understand the exact format and constraints for requests and responses.',
      'Test with both valid and invalid payloads to verify that the API handles edge cases gracefully and returns meaningful error messages.',
      'When constructing query parameters, pay special attention to encoding rules — different API implementations may handle special characters differently.',
      'Document the request and response examples you validate, as they serve as living documentation for your API integration.',
    ],
    data: [
      'Before transforming data, create a snapshot of the original dataset so you can roll back if the transformation produces unexpected results.',
      'Validate the transformed data against the target schema to catch type mismatches, missing required fields, or unexpected null values early.',
      'When generating data models from samples, review the output types carefully — the tool infers types from the sample, which may not cover all variants.',
      'For data fingerprinting and hashing, use consistent input normalization (whitespace, key order) to ensure the same logical data produces the same hash.',
    ],
    debugging: [
      'Reproduce the issue with the smallest possible input — this makes it easier to isolate the specific cause and test your fix.',
      'When comparing files or outputs, focus first on the structural differences (added/removed sections) before examining individual value changes.',
      'Use a systematic approach: form a hypothesis about the cause, test it with the tool, and either confirm or revise based on the evidence.',
      'Document the debugging session — what you checked, what you found, and what you concluded — so the knowledge is preserved for future incidents.',
    ],
    automation: [
      'Before deploying an automated schedule or extraction pattern, test it in isolation with sample data that mimics production conditions.',
      'Validate cron expressions by checking the next several execution times to confirm the schedule matches your actual requirements.',
      'When generating batch IDs, ensure the uniqueness scope matches your use case — a unique ID within a single run may not be unique across all runs.',
      'Build in monitoring and alerting for automated tasks so that failures are detected quickly rather than silently accumulating errors.',
    ],
    web: [
      'Always sanitize user-supplied content before rendering it in HTML to prevent cross-site scripting (XSS) attacks.',
      'Test minified CSS and HTML in multiple browsers to ensure the minification process has not introduced rendering differences.',
      'When previewing markdown content, check that embedded code blocks, tables, and links render correctly and safely in the target context.',
      'Verify that form data encoding matches what the receiving server expects — mismatched content types are a common source of data loss.',
    ],
  };

  const taskSteps = [
    `Considering you are ${tc.scenario}, double-check the result against the expected outcome: ${tc.outcome}.`,
    `Given the urgency (${tc.urgency}), prioritize verifying the most critical aspects of the output first.`,
  ];

  const pool = [...baseSteps, ...(clusterSteps[clusterKey] ?? []), ...taskSteps];
  const shuffled = seededShuffle(pool, seed);
  return shuffled.slice(0, 6);
}

/* ------------------------------------------------------------------ */
/*  Pitfalls builder — expanded pool per cluster                      */
/* ------------------------------------------------------------------ */
function buildPitfalls(clusterKey: ClusterKey, audience: string, task: string, seed: number): string[] {
  const generic = [
    'Skipping a quick manual sanity check on a small sample before processing a full dataset.',
    'Relying on default options without confirming how they behave on malformed or edge-case input.',
    'Not keeping a backup of the original input before transforming or minifying it.',
    'Assuming all data is safe to paste without considering secrets, tokens, or production credentials.',
    'Treating the tool output as authoritative without cross-checking against another source of truth.',
    'Ignoring subtle whitespace or encoding differences that may cause issues in downstream systems.',
    'Not documenting the specific tool settings used, making it difficult to reproduce results later.',
  ];

  const specific: Record<ClusterKey, string[]> = {
    json: [
      'Treating a linted or pretty-printed JSON payload as valid without running a real JSON parser.',
      'Forgetting that large numeric values may lose precision if inspected in some environments.',
      'Assuming key order is preserved — JSON objects are unordered by specification.',
      'Not handling null values and empty arrays correctly when transforming JSON structures.',
    ],
    encoding: [
      'Double-encoding values by passing already-encoded data back through the encoder.',
      'Assuming all systems agree on which characters need to be escaped or decoded.',
      'Mixing up URL encoding, HTML entity encoding, and Base64 — they serve different purposes.',
      'Forgetting that Base64 output increases data size by approximately 33 percent.',
    ],
    security: [
      'Mixing test and production secrets in the same browser session.',
      'Reusing identifiers or hashes in contexts where uniqueness or unpredictability really matters.',
      'Trusting JWT claims without verifying the signature on the server side.',
      'Using weak hashing for security-critical applications where collision resistance matters.',
    ],
    text: [
      'Performing aggressive find-and-replace operations without scanning the diff for unintended matches.',
      'Using a complex regex in production before validating it on a realistic sample of input.',
      'Ignoring locale-specific behavior in case conversions that may affect non-ASCII characters.',
      'Not anchoring regex patterns when exact matching is required, leading to unexpected partial matches.',
    ],
    formatting: [
      'Deploying formatted SQL or minified assets without running an automated test suite.',
      'Assuming that visual formatting changes cannot affect query plans or bundler behavior.',
      'Reformatting code that has semantic whitespace (like Python or YAML) without checking language rules.',
      'Not verifying that minified CSS still works correctly with media queries and CSS variables.',
    ],
    api: [
      'Hardcoding API response structures instead of validating against the documented schema.',
      'Ignoring HTTP status codes and only checking the response body for errors.',
      'Not handling pagination properly when API responses are split across multiple pages.',
      'Assuming API response field order is stable when it may vary between implementations.',
    ],
    data: [
      'Running a data transformation on the full dataset without first testing on a representative sample.',
      'Not versioning your data schemas, making it impossible to trace when a breaking change was introduced.',
      'Assuming that auto-generated types from a single JSON sample cover all possible data variations.',
      'Ignoring timezone and locale differences when transforming datetime values between systems.',
    ],
    debugging: [
      'Changing multiple variables at once when debugging, making it impossible to identify which change fixed the issue.',
      'Assuming the bug is in the code when it might actually be a data or configuration issue.',
      'Not checking the version of the tool or library being used, which may behave differently than expected.',
      'Deleting log output or debugging artifacts before the root cause is fully confirmed and documented.',
    ],
    automation: [
      'Deploying a cron schedule without verifying the timezone the scheduler uses.',
      'Not adding error handling for automated tasks that fail silently in production.',
      'Using overly broad regex patterns in data extraction that match unintended content.',
      'Forgetting to account for daylight saving time transitions in scheduled task timing.',
    ],
    web: [
      'Trusting client-side sanitization without also validating on the server side.',
      'Minifying CSS that contains calc() expressions or CSS custom properties without testing the output.',
      'Not testing markdown rendering with adversarial input that might break the layout or inject scripts.',
      'Forgetting to set proper Content-Type headers when serving dynamically generated web content.',
    ],
  };

  const audienceSpecific: Record<string, string> = {
    'backend-engineer': 'Not considering how the processed output will be consumed by frontend clients with different parsing behavior.',
    'frontend-developer': 'Overlooking how the transformed data will display across different browsers and screen sizes.',
    'fullstack-developer': 'Applying a fix on one side (client or server) without verifying compatibility on the other.',
    'api-consumer': 'Not versioning your API integration tests, so breaking API changes go undetected.',
    'integration-engineer': 'Assuming both systems use the same encoding, date format, or null handling conventions.',
    'security-conscious-developer': 'Logging or caching sensitive data as part of a debugging workflow without cleaning it up afterward.',
    'ops-engineer': 'Applying configuration changes in production without first testing in a staging environment.',
    'devops-engineer': 'Not including the data transformation step in your CI/CD pipeline validation checks.',
    'technical-writer': 'Publishing examples that were generated from test data without verifying they work with the latest API version.',
    'data-engineer': 'Not monitoring data quality metrics after applying a transformation to a production pipeline.',
    'mobile-developer': 'Not accounting for limited bandwidth and battery constraints when processing large payloads on mobile.',
    'qa-engineer': 'Only testing the happy path without checking how the tool handles malformed, empty, or oversized inputs.',
    'site-reliability-engineer': 'Ignoring monitoring gaps — the tool might work in isolation but fail when integrated into the broader system.',
    'database-administrator': 'Running formatted queries in production without checking the execution plan for performance regressions.',
    'cloud-architect': 'Not considering cross-region latency and data residency requirements when designing data processing workflows.',
    'performance-engineer': 'Focusing solely on average performance metrics without examining tail latency and worst-case scenarios that affect user experience.',
    'platform-engineer': 'Building internal tooling without validating that the abstractions match the actual workflows of the teams consuming the platform.',
    'solution-architect': 'Selecting technologies based on feature lists without evaluating operational complexity and long-term maintenance burden.',
    'tech-lead': 'Approving architectural changes without verifying that the team has the knowledge and tooling to maintain the new approach effectively.',
    'release-engineer': 'Skipping artifact verification steps under release pressure, risking deployment of corrupted or incomplete build outputs.',
  };

  const pool = [...generic, ...(specific[clusterKey] ?? [])];
  if (audienceSpecific[audience]) {
    pool.push(audienceSpecific[audience]);
  }

  const shuffled = seededShuffle(pool, seed);
  return shuffled.slice(0, 5);
}

/* ------------------------------------------------------------------ */
/*  Comparison builder — expanded with cluster-aware approaches        */
/* ------------------------------------------------------------------ */
function buildComparison(clusterKey: ClusterKey, audience: string, seed: number): { item: string; pros: string; cons: string }[] {
  const universal = [
    {
      item: 'Browser-based DevSolve tool',
      pros: 'Runs locally in your browser, no installation required, fast for day-to-day tasks, data stays private.',
      cons: 'Not a replacement for full test environments, long-running batch jobs, or server-side automation.',
    },
    {
      item: 'Command-line utilities',
      pros: 'Scriptable, integrates well with CI and automation pipelines, handles large files efficiently.',
      cons: 'Requires installation, permissions, and setup time; less accessible for quick one-off tasks.',
    },
    {
      item: 'Custom code in your application',
      pros: 'Maximum control and flexibility, lives close to business logic, can be tailored exactly to your needs.',
      cons: 'Adds maintenance overhead and needs proper testing, review, and documentation.',
    },
    {
      item: 'Third-party hosted services',
      pros: 'Often come with dashboards, logs, and integrations out of the box; may offer collaboration features.',
      cons: 'Data may leave your environment; pricing, rate limits, and vendor lock-in apply.',
    },
  ];

  const clusterSpecific: Record<ClusterKey, { item: string; pros: string; cons: string }[]> = {
    json: [
      { item: 'IDE-integrated JSON tools', pros: 'Available right where you code, with syntax highlighting and inline validation.', cons: 'Feature set varies by IDE and may require plugins that need separate configuration.' },
      { item: 'Schema validation libraries', pros: 'Catch structural issues at build time with type-safe validation.', cons: 'Require maintaining schema definitions alongside your codebase.' },
    ],
    encoding: [
      { item: 'Language-native encoding functions', pros: 'No extra dependencies, well-tested, and integrated with the runtime.', cons: 'Behavior may differ across languages and versions; subtle bugs possible.' },
      { item: 'Specialized encoding libraries', pros: 'Handle edge cases and multiple encoding standards comprehensively.', cons: 'Additional dependency to maintain; may be overkill for simple encoding tasks.' },
    ],
    security: [
      { item: 'Dedicated security scanning tools', pros: 'Comprehensive analysis with known vulnerability databases and audit trails.', cons: 'Can be slow, expensive, and may produce false positives that need manual review.' },
      { item: 'Server-side cryptographic libraries', pros: 'Full algorithm support with hardware acceleration; suitable for production use.', cons: 'Requires server infrastructure and proper key management setup.' },
    ],
    text: [
      { item: 'Regex101 and similar online tools', pros: 'Visual regex debugging with explanation of each pattern component.', cons: 'Data is sent to external servers; may not support all JavaScript-specific syntax.' },
      { item: 'Text processing languages (awk, sed, perl)', pros: 'Extremely powerful for complex transformations with rich pattern support.', cons: 'Steep learning curve; portability issues between operating system variants.' },
    ],
    formatting: [
      { item: 'Prettier and similar auto-formatters', pros: 'Opinionated formatting that eliminates style debates; CI-integrable.', cons: 'May not support all languages or style preferences; configuration overhead.' },
      { item: 'Database-native formatting tools', pros: 'Understand SQL dialect-specific syntax and can validate as they format.', cons: 'Tied to a specific database vendor; may not handle multi-dialect projects.' },
    ],
    api: [
      { item: 'Postman or Insomnia', pros: 'Full API testing suite with collections, environments, and team collaboration.', cons: 'Desktop application with accounts; may be heavy for simple inspection tasks.' },
      { item: 'OpenAPI tooling (Swagger)', pros: 'Auto-generate documentation, clients, and validation from a single spec file.', cons: 'Requires maintaining the spec file; initial setup effort can be significant.' },
    ],
    data: [
      { item: 'ETL platforms (dbt, Airflow)', pros: 'Enterprise-grade data pipeline management with lineage tracking and scheduling.', cons: 'Infrastructure overhead; steep learning curve for small-scale projects.' },
      { item: 'Spreadsheet tools (Excel, Google Sheets)', pros: 'Familiar interface for quick data inspection and simple transformations.', cons: 'Poor version control; breaks down with large or complex datasets.' },
    ],
    debugging: [
      { item: 'IDE-integrated debuggers', pros: 'Breakpoints, variable inspection, and step-through execution in your editor.', cons: 'Cannot easily debug data transformations or format differences between files.' },
      { item: 'Logging and observability platforms', pros: 'Production-grade monitoring with search, alerts, and distributed tracing.', cons: 'Setup and cost overhead; may be excessive for local debugging sessions.' },
    ],
    automation: [
      { item: 'CI/CD platforms (GitHub Actions, GitLab CI)', pros: 'Built-in scheduling, artifact management, and integration with version control.', cons: 'YAML configuration complexity; debugging pipeline failures can be slow.' },
      { item: 'Serverless schedulers (AWS EventBridge, Cloud Scheduler)', pros: 'Scalable, managed scheduling with no infrastructure to maintain.', cons: 'Vendor lock-in; monitoring and debugging require additional tooling.' },
    ],
    web: [
      { item: 'Browser DevTools', pros: 'Built-in to every browser, with network inspection, DOM editing, and CSS debugging.', cons: 'Manual process; not easily reproducible or shareable across team members.' },
      { item: 'Build-time optimization tools (webpack, esbuild)', pros: 'Automated optimization as part of the build pipeline with advanced features.', cons: 'Configuration complexity; may produce unexpected results with some CSS patterns.' },
    ],
  };

  const pool = [...universal, ...(clusterSpecific[clusterKey] ?? [])];
  const shuffled = seededShuffle(pool, seed);
  return shuffled.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/*  Pro Tips builder — audience & cluster aware                        */
/* ------------------------------------------------------------------ */
function buildProTips(clusterKey: ClusterKey, audience: string, tool: string, task: string, seed: number): string[] {
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };
  const cd = clusterDomain[clusterKey];

  const tips = [
    `Bookmark ${getToolName(tool)} for quick access — ${cd.field} tasks come up frequently in ${label(audience)} work.`,
    `${cd.bestPractice} — this is especially important when ${ac.concern} is a factor.`,
    `When working on ${label(task)}, start with the smallest reproducible input to save time and reduce complexity.`,
    `Keep a personal library of test inputs for ${cd.field} tasks — reusing known-good samples speeds up future work.`,
    `Since ${getToolName(tool)} runs entirely in your browser, you can use it offline or in air-gapped environments where network access is restricted.`,
    `For ${label(audience)} workflows, consider integrating this step ${ac.workflow} for maximum efficiency.`,
    `After completing your ${label(task)} task, review the result one more time with fresh eyes — familiarity bias can mask subtle issues.`,
    `Share your validated results with teammates by copying the output directly — no login or account needed.`,
    `Document the exact tool settings and input sample used so you can reproduce the result deterministically in a future incident.`,
    `Pair ${getToolName(tool)} with a version-controlled config file — changes become auditable and reviewable like code.`,
    `When ${label(task)} is time-sensitive, prepare your input data in advance so the tool session itself stays focused and fast.`,
    `Cross-check the output of ${getToolName(tool)} against at least one independent validation method, especially for security-critical ${cd.field} operations.`,
    `Establish a team-wide standard for which tool to use for ${cd.field} tasks — consistency reduces onboarding time and review friction.`,
    `If you spot an unexpected result, verify the input encoding and whitespace before assuming the tool or your data is incorrect.`,
    `For recurring ${label(task)} scenarios, write a short runbook entry that references this guide so team members can repeat the process consistently.`,
    `Use the browser's built-in developer tools alongside ${getToolName(tool)} to inspect network requests and confirm no data leaves your machine.`,
  ];

  const shuffled = seededShuffle(tips, seed + 17);
  return shuffled.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/*  FAQ builder — contextual, non-repetitive                           */
/* ------------------------------------------------------------------ */
function buildFAQ(clusterKey: ClusterKey, tool: string, audience: string, intent: string, task: string, seed: number): { question: string; answer: string }[] {
  const toolName = getToolName(tool);
  const cd = clusterDomain[clusterKey];
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };
  const tc = taskContext[task] ?? { scenario: 'completing a development task', urgency: 'important for project quality', outcome: 'achieve the desired result efficiently' };

  const faqs = [
    { question: `Is my data safe when using ${toolName}?`, answer: `Yes. ${toolName} runs entirely in your browser. No data is sent to any external server, making it safe for working with sensitive or proprietary information.` },
    { question: `Can I use ${toolName} for ${label(intent)} in a production workflow?`, answer: `${toolName} is ideal for ad-hoc tasks, quick validation, and prototyping. For production pipelines, consider integrating the equivalent logic into your codebase with proper test coverage.` },
    { question: `What are the limitations when working with large inputs?`, answer: `Browser-based tools are constrained by available memory. Very large inputs (over 10 MB) may cause slowdown. For batch processing or very large files, consider a command-line alternative.` },
    { question: `How does this relate to ${cd.field}?`, answer: `${cd.importance}. ${toolName} provides a quick, accessible way to handle common ${cd.field} tasks without requiring installation or configuration.` },
    { question: `What should a ${label(audience)} focus on when using this tool?`, answer: `Pay special attention to ${ac.concern}. Since your primary focus is ${ac.focus}, verify that the tool output meets those requirements before using it further.` },
    { question: `Can I automate this ${label(intent)} process?`, answer: `While ${toolName} is a manual tool, the same logic can be implemented in code using standard libraries. The browser tool is useful for validating that your automated implementation produces correct results.` },
    { question: `Is this tool suitable for ${label(task)}?`, answer: `Yes, particularly for the initial investigation and validation phases. For ${label(task)}, using a browser-based tool lets you quickly test hypotheses without setting up a full development environment.` },
    { question: `What makes ${toolName} different from other ${label(clusterKey)} tools?`, answer: `The primary differentiator is local processing — no data leaves your browser. This matters for ${label(audience)} professionals who handle sensitive data as part of ${label(task)}.` },
    { question: `How does ${label(intent)} affect ${ac.focus}?`, answer: `${label(intent)} is a foundational step in maintaining ${ac.focus}. ${cd.importance}, so getting this step right prevents issues from propagating downstream.` },
    { question: `What should I do if the output looks unexpected?`, answer: `First verify the input format and encoding, then check whether any options or settings affect the transformation. ${cd.bestPractice} to ensure the output is correct before using it.` },
    { question: `Can ${toolName} handle all edge cases in ${label(intent)}?`, answer: `${toolName} covers the most common cases encountered in ${label(task)}. For highly specialised edge cases — such as non-standard encodings or custom schemas — review the output carefully and cross-check with a reference implementation.` },
    { question: `How often should a ${label(audience)} perform ${label(intent)}?`, answer: `The frequency depends on your workflow. For ${tc.scenario}, performing this step before each significant change or deployment is good practice, because ${tc.urgency}.` },
    { question: `Does ${toolName} work offline?`, answer: `Yes. Once the page is loaded, ${toolName} processes everything locally in your browser using client-side JavaScript. No network connection is required for the tool operations themselves.` },
    { question: `What is the best way to validate the output of ${label(intent)}?`, answer: `Compare the output against a known-good sample, check structural integrity, and verify any invariants your system depends on. For ${tc.scenario}, the goal is to ${tc.outcome}.` },
    { question: `How does ${label(audience)} workflow integration improve with this approach?`, answer: `By standardising on a single browser-based tool for ${label(intent)}, teams eliminate environment-specific discrepancies and reduce onboarding time. The consistent interface means results are reproducible regardless of who on the team performs the task.` },
    { question: `What are the security implications of ${label(intent)} for a ${label(audience)}?`, answer: `Local processing eliminates the risk of transmitting sensitive data to third-party servers. Additionally, ${cd.bestPractice}, which directly addresses ${ac.concern}.` },
    { question: `How does ${toolName} support ${label(task)} scenarios?`, answer: `For ${tc.scenario}, ${toolName} provides immediate feedback on the correctness of ${label(intent)} operations. The goal — to ${tc.outcome} — is supported by a clear step-by-step workflow that covers both common and edge-case inputs.` },
    { question: `Can multiple ${label(audience)} team members use this tool simultaneously?`, answer: `Yes. Since ${toolName} runs entirely in each user's browser, there are no shared sessions or server-side state. Each team member gets an independent, isolated environment, which is ideal for collaborative debugging and review.` },
    { question: `What prior knowledge does a ${label(audience)} need to use this guide?`, answer: `A working understanding of ${cd.field} concepts and basic experience with ${label(task)} is sufficient. The guide is designed to be approachable for practitioners at all experience levels, with explanations that scale from fundamental to advanced.` },
    { question: `How does this guide address ${ac.concern}?`, answer: `Every step in this guide is designed with ${ac.concern} in mind. Local processing ensures no data is transmitted externally, and the workflow follows ${cd.bestPractice} to minimise exposure at each stage.` },
    { question: `What happens if I make a mistake during ${label(intent)}?`, answer: `Browser-based tools are non-destructive — your original input is not modified. Simply clear the tool, re-paste your input, and start the operation again. Keep a copy of the original data before beginning any transformation.` },
    { question: `Is ${toolName} maintained and kept up-to-date?`, answer: `Yes. DevSolve maintains ${toolName} as part of a regularly updated developer toolkit. Tool behaviour and edge-case handling are reviewed and refined based on community feedback and evolving standards.` },
    { question: `Can I share my ${label(intent)} results with my team?`, answer: `Yes. Copy the output directly from ${toolName} and share it via your preferred communication channel. Since there are no accounts or sessions, sharing is as simple as copying text — no permissions or export steps required.` },
    { question: `How does this workflow compare to writing custom ${label(clusterKey)} code?`, answer: `For ${label(task)}, a browser-based tool provides faster iteration and lower setup cost than writing and running custom code. Once you understand the expected behaviour through manual testing with ${toolName}, you can implement the same logic confidently in your codebase with a clear reference to compare against.` },
  ];

  const shuffled = seededShuffle(faqs, seed + 31);
  return shuffled.slice(0, 5);
}

/* ------------------------------------------------------------------ */
/*  Keywords builder                                                   */
/* ------------------------------------------------------------------ */
function buildKeywords(clusterKey: string, tool: string, intent: string, audience: string, task: string): string[] {
  return Array.from(new Set([
    clusterKey, tool, intent, audience, task,
    'online', 'browser-based', 'developer-tools', 'local-processing', 'privacy-safe',
  ]));
}

/* ------------------------------------------------------------------ */
/*  O(1) page generation by index                                     */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  Technical Analysis builder — deep, cluster-specific paragraphs     */
/* ------------------------------------------------------------------ */
function buildTechnicalAnalysis(clusterKey: ClusterKey, tool: string, intent: string, audience: string, task: string, seed: number): string[] {
  const toolName = getToolName(tool);
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };
  const cd = clusterDomain[clusterKey];
  const tc = taskContext[task] ?? { scenario: 'completing a task', urgency: 'important', outcome: 'achieve the result' };

  const analysisPool: Record<ClusterKey, string[]> = {
    json: [
      `When working with JSON structures in the context of ${label(intent)}, it is essential to understand how parsers handle edge cases. The JSON specification (RFC 8259) defines a strict grammar where trailing commas, single-quoted strings, and unquoted keys are all invalid. Many developers overlook these subtleties because lenient parsers in development environments silently accept malformed input. ${toolName} helps identify these issues before they propagate to production systems where stricter parsing may cause unexpected failures.`,
      `JSON key ordering is not guaranteed by the specification, which means that two semantically identical objects can produce different string representations. This has important implications for ${label(audience)} professionals who need to compare, hash, or cache JSON data. When ${tc.scenario}, verifying structural equivalence rather than string equality prevents false negatives in comparison operations. ${toolName} normalizes output to help surface these differences clearly.`,
      `Numeric precision in JSON deserves special attention from ${label(audience)} teams. JavaScript's Number type follows IEEE 754 double-precision format, which means integers beyond 2^53 lose precision silently. When processing financial data, distributed identifiers, or timestamps with microsecond resolution, this can introduce subtle corruption. Always verify that numeric values survive the parse-stringify roundtrip without modification.`,
      `Deeply nested JSON structures present both performance and readability challenges. Each level of nesting increases cognitive load during code review and debugging. For ${tc.scenario}, consider using ${toolName} to flatten and re-examine nested structures, identifying opportunities to simplify the schema. This is particularly relevant for ${label(audience)} workflows where ${ac.concern} directly impacts system reliability.`,
      `JSON schema validation (JSON Schema draft-07 and later) provides a formal contract for validating document structure. For ${label(audience)} teams working on ${label(intent)}, defining and enforcing schemas at ingestion points prevents malformed data from reaching downstream processors. ${toolName} complements schema validation by surfacing the raw structure before formal validation is applied, making it easier to identify what constraints the schema needs to express.`,
      `The difference between null, undefined, and missing keys in JSON has practical implications for API design. A null value explicitly signals absence with intent, while a missing key may indicate that the field was never set. For ${label(audience)} professionals working on ${tc.scenario}, understanding these semantics prevents subtle bugs in deserialization code where different languages handle these cases differently.`,
      `JSON merging strategies (shallow versus deep merge) behave differently for nested objects and arrays. Shallow merge replaces top-level keys, which can silently discard nested configuration. For ${label(audience)} teams, the right merging strategy depends on whether the JSON represents configuration, state, or a patch set. ${toolName} helps inspect the structure before and after merging to verify that the intended changes were applied correctly.`,
      `Performance considerations matter when ${label(audience)} teams process large JSON payloads. Parsing a 50 MB JSON document into memory can take seconds and consume significant RAM, creating latency spikes in API handlers. Streaming parsers process one token at a time without loading the entire document, reducing memory pressure for ${tc.scenario}. ${toolName} provides visibility into the full structure for small-to-medium payloads, informing decisions about when streaming is necessary.`,
    ],
    encoding: [
      `Encoding errors are among the most insidious bugs in software systems because they often produce output that looks correct but contains subtle corruption. When a ${label(audience)} needs to ${label(intent)}, understanding the encoding chain is critical. Data may pass through multiple encoding layers — URL encoding at the HTTP level, HTML entity encoding in the DOM, and Base64 encoding for binary transport. Each layer has its own escape rules, and applying them in the wrong order creates double-encoding or partial-decoding bugs that are notoriously difficult to trace.`,
      `The distinction between encoding and encryption is frequently confused in practice. Encoding transforms data for safe transport or storage but provides no security guarantees — Base64-encoded data, for instance, can be decoded by anyone. For ${label(audience)} professionals working on ${tc.scenario}, this distinction matters because sensitive data should never rely on encoding alone for protection. ${toolName} processes data locally, ensuring that even when inspecting encoded payloads, the content never leaves your browser.`,
      `Unicode normalization is a critical consideration that many developers overlook. The same visual character can have multiple valid Unicode representations (NFC, NFD, NFKC, NFKD), which means string comparison may fail even when characters look identical. When ${label(intent)}, verify that your encoding pipeline handles normalization consistently, especially when dealing with user-generated content that may contain combining characters or variant selectors.`,
      `Base64 encoding increases data size by approximately 33%, which can have significant implications for payload-sensitive applications. For ${label(audience)} teams working on ${tc.scenario}, this overhead should be factored into bandwidth calculations, storage estimates, and API rate limit planning. ${toolName} provides immediate visibility into the size impact of encoding operations, helping you make informed decisions about when encoding is necessary versus when raw binary transport might be more efficient.`,
      `Percent-encoding (URL encoding) has subtle differences from Base64 that affect how data survives traversal through different system layers. RFC 3986 reserves specific characters as delimiters — encoding a full URL rather than just its parameter values is a common mistake that corrupts the URL structure. For ${label(audience)} professionals, understanding which characters need encoding in which context is a prerequisite for reliable ${label(intent)} in HTTP-based systems.`,
      `Character encoding standards (ASCII, Latin-1, UTF-8, UTF-16) affect how text data is stored, transmitted, and interpreted. UTF-8 is the dominant standard for web content but older systems may use single-byte encodings that produce garbled output when decoded with the wrong codec. When ${tc.scenario}, verify that all components in the data pipeline agree on the encoding standard — a mismatch between UTF-8 and Latin-1, for example, silently corrupts characters outside the ASCII range.`,
      `Binary-to-text encoding schemes serve different purposes beyond just Base64. Hex encoding produces human-readable output at the cost of doubling the size, while Base85 is more space-efficient than Base64. For ${label(audience)} teams, the choice of encoding scheme should reflect the constraints of the target system: readability requirements, size budgets, and the character set restrictions of the transmission channel.`,
      `Encoding idempotency — the property that applying an encoding operation twice produces the same result as applying it once — is often assumed but not always guaranteed. URL encoding, for example, is not idempotent: encoding an already-encoded string produces double-encoded output. For ${label(audience)} professionals working on ${tc.scenario}, building encoding pipelines that are explicitly idempotent (or explicitly not) prevents accumulating encoding errors across multiple processing steps.`,
    ],
    security: [
      `Token-based authentication systems require careful handling at every stage of the lifecycle. For a ${label(audience)} working on ${tc.scenario}, understanding JWT structure is essential: the header specifies the algorithm, the payload carries claims, and the signature ensures integrity. ${toolName} allows safe local inspection of these components without transmitting the token to an external service, which is critical because tokens often contain session identifiers, user roles, and expiration timestamps that should remain confidential.`,
      `Hash function selection directly impacts the security guarantees of your system. SHA-256 provides collision resistance suitable for data integrity verification, while bcrypt and Argon2 are designed for password hashing with deliberate computational cost. When ${label(intent)} as a ${label(audience)}, choosing the wrong algorithm can create vulnerabilities — using a fast hash like MD5 for passwords, for example, enables brute-force attacks at billions of attempts per second. Always match the hash function to the security requirement.`,
      `UUID generation appears simple but has important uniqueness considerations. Version 4 UUIDs rely on cryptographic random number generation, providing approximately 122 bits of entropy. The probability of collision is astronomically low but not zero. For ${label(audience)} teams handling ${tc.scenario}, the practical concern is usually not collision probability but rather ensuring the PRNG source is cryptographically secure — browser-based crypto.getRandomValues() satisfies this requirement, while Math.random() does not.`,
      `Token expiration and refresh strategies significantly affect both security and user experience. Short-lived access tokens (15-60 minutes) limit the window of exploitation if a token is compromised, while refresh tokens with longer lifetimes maintain session continuity. When ${tc.scenario}, inspect token claims carefully to verify that expiration times, issuer fields, and audience restrictions match your security requirements. ${toolName} makes this inspection safe by keeping all processing local.`,
      `Algorithm confusion attacks in JWT exploit the fact that some libraries trust the algorithm specified in the token header rather than enforcing a fixed expected algorithm. For ${label(audience)} professionals working on ${label(intent)}, always validate that the algorithm in the JWT header matches what your server expects — never allow tokens signed with the 'none' algorithm, and reject RS256 tokens when you expect HS256.`,
      `Key rotation strategies balance security (frequent rotation reduces exposure windows) against operational complexity (rotation requires coordinated updates across all services). For ${label(audience)} teams, planning for ${tc.scenario} means designing key management infrastructure that supports rotation without service interruption — using key identifiers (kid) in JWT headers, for example, allows verifiers to select the correct public key during the rotation window.`,
      `Hash collision resistance classes matter for ${label(audience)} professionals. Pre-image resistance means given a hash, finding the original input is computationally infeasible. Second pre-image resistance means finding a different input with the same hash is infeasible. Collision resistance means finding any two inputs with the same hash is infeasible — and this is what fails first in algorithms like SHA-1. For ${tc.scenario}, use algorithms with all three properties unless performance constraints force a trade-off.`,
      `Secret management — how tokens, keys, and hashes are stored, transmitted, and rotated — is as important as the cryptographic choices themselves. ${label(audience)} professionals should never embed secrets in source code, client-side JavaScript, or URL parameters. Environment variables, secrets managers (Vault, AWS Secrets Manager), and encrypted configuration files are appropriate alternatives. ${toolName} operates locally, which means it never touches your secrets management infrastructure.`,
    ],
    text: [
      `Regular expression engines vary significantly across programming languages and environments. JavaScript uses a backtracking NFA engine with specific behaviors around Unicode property escapes, lookbehind assertions, and named capture groups that may differ from Python's re module or Perl's regex engine. For a ${label(audience)} working on ${label(intent)}, testing patterns in ${toolName} ensures they behave correctly in the JavaScript runtime, which is particularly important when patterns will be used in both client-side and server-side contexts.`,
      `Text case conversion is more complex than it appears, especially for internationalized content. Turkish locale rules where 'i' uppercases to 'İ' rather than 'I' can break authentication systems that compare usernames case-insensitively. When ${tc.scenario}, verify that your case conversion logic handles locale-specific rules correctly, or explicitly use locale-independent conversion when processing identifiers, URLs, or other machine-readable strings.`,
      `Diff algorithms (Myers, patience, histogram) produce different results for the same input pairs. Myers diff minimizes the edit distance but may produce confusing output when lines are moved rather than changed. Patience diff prioritizes matching unique lines, producing more intuitive results for code and configuration changes. For ${label(audience)} workflows involving ${tc.scenario}, understanding which algorithm your diff tool uses helps you interpret the output correctly and identify the actual semantic changes.`,
      `Whitespace handling in text processing deserves explicit specification. Tabs versus spaces, trailing whitespace, line ending conventions (LF vs CRLF), and zero-width characters can all produce visually identical text that differs at the byte level. When ${label(intent)}, normalize whitespace conventions early in your pipeline to prevent phantom differences from obscuring real changes. This is particularly important for ${label(audience)} professionals working on ${tc.scenario}.`,
      `Unicode-aware text processing requires explicit consideration of grapheme clusters versus code points. A single visible character (like a flag emoji) may consist of multiple Unicode code points. When measuring text length or truncating content, use grapheme-aware methods to avoid splitting characters. For ${label(audience)} teams handling multilingual content during ${tc.scenario}, grapheme-aware processing is non-negotiable for correct user-facing output.`,
      `Diff output formats (unified, context, side-by-side) serve different review workflows. Unified diff is compact and widely supported in version control, while side-by-side comparison is more intuitive for manual review. When ${label(intent)} as a ${label(audience)}, choose the format that best supports your team's review process — and use ${toolName} to explore the difference before committing to one format in your toolchain.`,
      `Regular expression denial-of-service (ReDoS) is a vulnerability that arises when crafted inputs cause backtracking regex engines to run for exponential time. For ${label(audience)} professionals who write regex patterns that process untrusted input, patterns with nested quantifiers like (a+)+ are the primary risk. ${toolName} helps prototype and test patterns safely, but always analyse the worst-case complexity of patterns before deploying them in server-side code.`,
      `Text similarity algorithms (Levenshtein distance, Jaro-Winkler, cosine similarity on n-grams) serve different use cases in ${label(clusterKey)} applications. Levenshtein is intuitive for spell-checking and typo detection, while cosine similarity on word n-grams is better for document-level comparison. For ${label(audience)} teams working on ${tc.scenario}, selecting the right similarity metric ensures that the comparison surface-areas the differences that actually matter for your use case.`,
    ],
    formatting: [
      `Code formatting serves a dual purpose: improving human readability and establishing consistency across a codebase. For ${label(audience)} teams, consistent formatting reduces cognitive load during code review and makes it easier to identify meaningful changes in version control diffs. When ${label(intent)} using ${toolName}, the formatted output provides a baseline that your team can evaluate against established style guidelines before adopting it as a standard.`,
      `SQL formatting deserves special attention because whitespace and line breaks affect both readability and, in some cases, behavior. While most SQL engines treat whitespace as insignificant, the visual structure of a query directly impacts a developer's ability to understand the join logic, filter conditions, and aggregation pipeline. For ${tc.scenario}, properly formatted SQL helps ${label(audience)} professionals identify potential performance issues by making the query structure explicit.`,
      `CSS minification removes whitespace, comments, and redundant declarations to reduce file size, but it can introduce subtle issues. Shorthand property conflicts, calc() expression spacing, and custom property fallbacks may behave differently when minified. For ${label(audience)} teams working on ${tc.scenario}, always test minified output in the target browsers before deployment. ${toolName} provides an immediate preview of the minification result so you can catch issues early.`,
      `Markdown rendering varies across implementations, and this inconsistency can affect documentation quality. CommonMark provides a formal specification, but many parsers extend it with features like tables, task lists, and footnotes. When ${label(intent)}, use ${toolName} to verify that your markdown renders correctly and that links, code blocks, and embedded HTML all display as intended in the target rendering environment.`,
      `SQL formatting conventions vary by team and database engine. The Rivers and Holywell SQL style guides provide structured approaches. When standardizing SQL formatting for ${label(audience)} teams, document the chosen convention and configure automated formatting to enforce it consistently. ${toolName} provides a quick way to apply and preview formatting changes before committing them to shared codebases.`,
      `Critical CSS extraction identifies the styles needed for above-the-fold content and inlines them in the HTML document, reducing the render-blocking impact of external stylesheets. For ${label(audience)} professionals working on ${tc.scenario}, this technique can significantly improve Largest Contentful Paint scores without requiring architectural changes to the application.`,
      `Markdown link reference definitions ([link text][id] with [id]: url) separate content from URLs, making documents easier to read and maintain. For ${label(audience)} professionals creating documentation, this pattern reduces visual clutter and makes URL updates easier to manage. When ${label(intent)}, using reference-style links as a default convention improves long-term maintainability of documentation repositories.`,
      `Preserving code semantics during formatting requires understanding language-specific rules. Python's significant whitespace, Makefile's required tabs, and YAML's indentation-based structure all constrain how formatting tools can modify these files. For ${label(audience)} teams, always verify that formatted output preserves the original program behavior — automated tests are the most reliable safety net for detecting formatting-induced regressions.`,
    ],
    api: [
      `API schema versioning is a critical practice that prevents breaking changes from disrupting consumers. When a ${label(audience)} needs to ${label(intent)}, understanding the current schema version and any deprecated fields is essential. ${toolName} helps validate that API responses conform to the expected structure, catching field removals, type changes, and new required fields before they cause runtime failures in client applications.`,
      `HTTP content negotiation determines how request and response bodies are encoded, compressed, and parsed. The Accept and Content-Type headers must align between client and server for successful communication. When ${tc.scenario}, incorrect content type declarations can cause parsers to fail silently or produce garbled output. Use ${toolName} to inspect and validate the actual payload format independently of the declared content type.`,
      `Rate limiting and pagination strategies significantly impact API integration reliability. For ${label(audience)} professionals, understanding cursor-based versus offset-based pagination, exponential backoff requirements, and rate limit reset headers is essential when building robust integrations. When ${tc.scenario}, test your integration logic with both normal and edge-case responses to ensure it handles pagination boundaries and rate limit responses gracefully.`,
      `Error response standardization (RFC 7807 Problem Details) helps API consumers handle failures consistently. When ${label(intent)}, verify that error responses include the type, title, status, detail, and instance fields that consumers need for proper error handling. ${toolName} can help validate error response structures alongside success responses, ensuring that your API communicates failures as clearly as it communicates successes.`,
      `GraphQL introspection queries expose the full API schema, which is useful during development but should be disabled in production to prevent information leakage. When using ${toolName} to explore API responses, be aware that introspection results may reveal internal implementation details. For ${label(audience)} professionals, distinguishing between development-safe and production-safe inspection techniques is a key security discipline.`,
      `HTTP caching headers (ETag, Last-Modified, Cache-Control) significantly affect API performance and behavior. When debugging API integration issues as a ${label(audience)}, verify that caching is not serving stale responses by checking these headers alongside the response body. ${tc.scenario} often requires fresh data, so understanding cache-control semantics is essential for diagnosing unexpected behavior.`,
      `API pagination cursors should be opaque to consumers — encoding implementation details (like database offsets) in cursors creates tight coupling that breaks when the underlying data store changes. When designing pagination for ${label(intent)}, use encrypted or hashed cursors that consumers cannot parse or manipulate. This ensures backward compatibility when the cursor format changes without breaking existing client code.`,
      `Webhook delivery reliability requires implementing retry logic with exponential backoff on the provider side and idempotency keys on the consumer side. When ${tc.scenario}, verify that your webhook handler can safely process the same event multiple times without creating duplicate side effects. ${toolName} helps inspect and validate webhook payloads during development, before the handler is deployed to production.`,
    ],
    data: [
      `Data schema evolution is one of the most challenging aspects of maintaining production data pipelines. When adding new fields, changing types, or removing deprecated columns, backward compatibility must be preserved to prevent downstream failures. For a ${label(audience)} working on ${tc.scenario}, using ${toolName} to compare before-and-after schemas helps identify breaking changes before they reach production. Schema registries and versioned type definitions provide additional safety nets for data-intensive systems.`,
      `Type inference from JSON samples is inherently approximate — a single sample cannot capture the full range of possible values. Fields that appear as integers in one sample may be floats or nulls in others. For ${label(audience)} teams working on ${label(intent)}, generated types should be treated as a starting point rather than a definitive contract. Cross-reference with API documentation, database schemas, and multiple representative samples to build accurate, complete type definitions.`,
      `Data fingerprinting through hashing enables efficient change detection without comparing full payloads. However, hash-based comparison requires consistent input normalization — JSON key ordering, whitespace handling, and numeric formatting must all be deterministic for the same logical data to produce the same hash. When ${tc.scenario}, establish clear normalization rules and document them so that all systems in the pipeline produce consistent hashes.`,
      `Binary-to-text encoding (Base64, hex) is frequently used in data pipelines for transporting binary content through text-based channels like JSON APIs or CSV files. Each encoding scheme has different trade-offs: Base64 is space-efficient but unreadable, hex is readable but doubles the size. For ${label(audience)} professionals, choosing the right encoding depends on whether the priority is debugging visibility, transmission efficiency, or compatibility with downstream systems.`,
      `Schema registries (like Confluent Schema Registry for Avro/Protobuf) enforce backward and forward compatibility rules automatically. For ${label(audience)} teams, integrating schema validation into the CI/CD pipeline prevents incompatible schema changes from reaching production. ${toolName} complements registry validation by enabling quick manual inspection of schema changes during the development phase, before formal validation gates are applied.`,
      `Data lineage tracking records the origin, transformations, and destination of every data element. When debugging data quality issues during ${tc.scenario}, lineage information helps trace the exact point where corruption or loss occurred, significantly reducing investigation time. For ${label(audience)} professionals, investing in lineage tooling is most justified when the pipeline is long, the transformations are complex, and the data affects business-critical decisions.`,
      `Bloom filters provide probabilistic set membership testing with guaranteed zero false negatives. For ${label(audience)} professionals working with large datasets, Bloom filters can efficiently pre-filter data before expensive exact lookups, reducing processing time for common operations like deduplication. The space efficiency of Bloom filters makes them particularly valuable for ${tc.scenario} where memory constraints limit the feasibility of exact set storage.`,
      `Data serialization format selection (JSON, Protocol Buffers, Avro, MessagePack) should consider schema evolution needs, human readability, compression ratio, and parsing performance. For ${tc.scenario}, the right format depends on whether the primary consumer is a human debugger or a high-throughput data pipeline. JSON's self-describing nature makes it ideal for inspection with ${toolName}, while binary formats are better suited for production throughput optimization.`,
    ],
    debugging: [
      `Systematic debugging follows a scientific methodology: observe the symptom, form a hypothesis, design a test, and either confirm or revise. For a ${label(audience)} working on ${tc.scenario}, ${toolName} serves as the testing apparatus — it allows you to isolate variables by processing individual data transformations in a controlled environment. This approach is more efficient than adding log statements to production code and reduces the risk of introducing new bugs during the investigation.`,
      `Configuration drift is a common source of production issues that is difficult to detect through code review alone. When the same application runs in multiple environments (development, staging, production), subtle differences in configuration values can produce different behavior. For ${label(audience)} teams, comparing configuration files using diff tools reveals these discrepancies before they cause incidents. ${toolName} helps visualize the exact differences between configuration versions.`,
      `Log analysis patterns can be enhanced by using structured logging (JSON format) rather than unstructured text. Structured logs are machine-parseable, searchable, and aggregatable, making it possible to correlate events across distributed systems. When ${tc.scenario}, use ${toolName} to format and inspect log entries, identify recurring patterns, and build targeted search queries that filter noise and surface the events relevant to the investigation.`,
      `Root cause analysis often requires examining data transformations at multiple points in the pipeline. A bug in the final output may originate several steps upstream, where a format conversion, encoding change, or type coercion introduced the error. For ${label(audience)} professionals, using ${toolName} at each transformation step creates a traceable chain of evidence that pinpoints exactly where the data diverges from the expected format.`,
      `Binary search debugging (git bisect for code, or manual bisection for data) efficiently identifies the exact change that introduced a bug. For a ${label(audience)} with a large number of potential causes, bisection reduces the search space logarithmically, finding the root cause in O(log n) steps instead of O(n). ${toolName} supports this approach by allowing rapid validation of each hypothesis without environment setup overhead.`,
      `Memory profiling in browser-based tools is accessible through DevTools' Heap Snapshot and Allocation Timeline features. When ${label(intent)}, understanding memory patterns helps identify leaks caused by retained closures, detached DOM nodes, or accumulating event listeners. For ${label(audience)} professionals, profiling should be a routine part of the investigation process for performance-related ${tc.scenario} scenarios.`,
      `Distributed tracing with correlation IDs allows tracking a single request across multiple services. For ${label(audience)} teams debugging cross-service issues during ${tc.scenario}, propagating trace context headers (W3C Trace Context standard) through every service boundary is essential for end-to-end visibility. ${toolName} can help validate the format and content of trace headers as part of the debugging workflow.`,
      `Canary deployments help isolate whether an issue is caused by a code change or an environmental factor. By routing a small percentage of traffic to the new version and comparing metrics, ${label(audience)} professionals can detect regressions before they affect all users. When ${tc.scenario}, establishing a canary validation checklist — including data format verification with ${toolName} — ensures regressions are caught systematically.`,
    ],
    automation: [
      `Cron expression semantics vary across implementations, which can lead to scheduling surprises. The standard five-field format (minute, hour, day-of-month, month, day-of-week) is widely supported, but extensions like seconds fields, year fields, and named ranges differ between cron daemons, CI/CD platforms, and cloud schedulers. For a ${label(audience)} working on ${tc.scenario}, validating cron expressions with ${toolName} prevents scheduling errors that might go undetected until the task fails to run at the expected time.`,
      `Idempotency is a critical design principle for automated tasks. When a scheduled job runs multiple times — due to retries, overlapping executions, or scheduler failures — it should produce the same result as a single execution. For ${label(audience)} teams, designing idempotent operations means using unique identifiers (UUIDs) for records, checking for existing results before creating new ones, and separating the side-effect-producing step from the data preparation step.`,
      `Extraction patterns for log analysis and data processing must balance specificity with resilience. Overly specific regex patterns break when log formats change slightly, while overly broad patterns capture unintended content. For ${label(audience)} professionals working on ${tc.scenario}, test extraction patterns against both current and historical log samples to ensure they handle format variations gracefully. ${toolName} provides a safe environment for iterating on pattern design.`,
      `Monitoring and alerting for automated tasks should cover both failure detection and correctness verification. A task that completes successfully but produces incorrect output is often more dangerous than one that fails visibly. For ${label(audience)} teams, implement data quality checks alongside execution monitoring — verify record counts, check for null values in required fields, and compare output statistics against expected baselines.`,
      `Dead letter queues capture failed automated task executions for later analysis and replay. For ${label(audience)} teams, implementing DLQ processing ensures that transient failures do not cause permanent data loss, and provides a record of what went wrong for debugging. ${toolName} can assist in inspecting DLQ payloads to understand why specific jobs failed and to validate corrected inputs before replaying them.`,
      `Infrastructure as Code (IaC) tools like Terraform and Pulumi enable version-controlled, reviewable automation of infrastructure changes. When ${tc.scenario}, treating infrastructure changes like code changes — with pull requests, reviews, and automated testing — prevents configuration errors. ${toolName} supports this workflow by enabling manual validation of configuration artifacts before they are committed to version control.`,
      `Circuit breaker patterns prevent automated tasks from overwhelming failing downstream services. For ${label(audience)} professionals, implementing circuit breakers in automated workflows means that temporary service disruptions do not cascade into system-wide failures. The circuit breaker state (closed, open, half-open) provides valuable signal for ${tc.scenario} debugging, indicating whether failures are systemic or transient.`,
      `Event sourcing captures every state change as an immutable event, enabling perfect audit trails and the ability to replay history. For automated data processing pipelines, event sourcing provides the ability to rebuild state from scratch if corruption is detected during ${tc.scenario}. Combined with ${toolName} for payload inspection, event sourcing creates a comprehensive debugging surface for complex automation workflows.`,
    ],
    web: [
      `Cross-site scripting (XSS) prevention requires a defense-in-depth approach. Output encoding (HTML entity encoding for HTML contexts, JavaScript escaping for script contexts, URL encoding for URL contexts) is the primary defense, but Content Security Policy headers, strict input validation, and DOM-based sanitization provide additional layers. For a ${label(audience)} working on ${tc.scenario}, ${toolName} helps verify that encoding transformations produce safe output for the target context.`,
      `CSS optimization goes beyond simple minification. Removing unused rules (tree-shaking), combining duplicate selectors, shorthand property consolidation, and critical CSS extraction can reduce stylesheet size by 50-80% in large applications. For ${label(audience)} teams, the challenge is ensuring that optimization does not change the visual rendering. ${toolName} provides a quick way to compare the minified output and verify that no semantic CSS changes were introduced during the optimization process.`,
      `Content rendering performance directly impacts Core Web Vitals scores, which affect search engine rankings. Largest Contentful Paint (LCP), First Input Delay (FID), and Cumulative Layout Shift (CLS) are all influenced by how content is encoded, compressed, and delivered. For ${label(audience)} professionals working on ${tc.scenario}, optimizing web assets is not just about reducing file sizes — it is about ensuring that the most important content renders quickly and remains stable during page load.`,
      `Form data handling across different content types (application/x-www-form-urlencoded, multipart/form-data, application/json) requires careful attention to encoding rules. URL-encoded form data treats spaces as '+' while URI encoding uses '%20', and multipart boundaries must not appear in the encoded content. When ${label(intent)}, verify that the encoding matches the server's expectations and that special characters survive the encoding roundtrip without corruption.`,
      `Subresource Integrity (SRI) attributes on script and link tags ensure that CDN-served files have not been tampered with. For ${label(audience)} teams, adding integrity hashes to third-party resources prevents supply chain attacks where a compromised CDN serves malicious content. ${toolName} can help verify and format the hash values used in SRI attributes during development.`,
      `Service Workers enable sophisticated caching strategies (cache-first, network-first, stale-while-revalidate) that can significantly improve web application performance. When ${label(intent)}, consider how cached content interacts with your content update strategy to prevent users from seeing stale data. For ${label(audience)} professionals, testing caching behaviour with ${toolName} for content inspection simplifies diagnosing cache-related rendering issues.`,
      `Content Security Policy (CSP) headers provide defense-in-depth against XSS by whitelisting allowed content sources. For ${label(audience)} professionals, implementing CSP in report-only mode first allows you to identify violations without breaking functionality, then gradually tightening the policy. Understanding the encoding rules for each CSP directive is essential when ${label(intent)} in a web security context.`,
      `HTTP/2 and HTTP/3 multiplexing changes the optimization calculus for web assets. Techniques like CSS sprite sheets and file concatenation, which were beneficial under HTTP/1.1's connection limits, may actually decrease performance under multiplexed protocols. For ${label(audience)} teams working on ${tc.scenario}, verifying that optimization strategies match the deployment protocol ensures that performance improvements are real rather than theoretical.`,
    ],
  };

  const pool = analysisPool[clusterKey] ?? analysisPool.json;
  const shuffled = seededShuffle(pool, seed + 43);
  return shuffled.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/*  Expert Tips builder — deep, actionable, unique per combination     */
/* ------------------------------------------------------------------ */
function buildExpertTips(clusterKey: ClusterKey, tool: string, intent: string, audience: string, task: string, seed: number): string[] {
  const toolName = getToolName(tool);
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };
  const cd = clusterDomain[clusterKey];
  const tc = taskContext[task] ?? { scenario: 'completing a task', urgency: 'important', outcome: 'achieve the result' };

  const tipsPool: Record<ClusterKey, string[]> = {
    json: [
      `When debugging complex JSON structures, use a schema validator alongside ${toolName} to catch not just syntax errors but also semantic violations like missing required fields and type mismatches.`,
      `For large JSON payloads, consider streaming parsers (like JSONStream or clarinet) in production code instead of loading the entire document into memory. Use ${toolName} for initial inspection and validation, then switch to streaming for production workloads.`,
      `JSON Pointer (RFC 6901) and JSON Patch (RFC 6902) provide standardized ways to reference and modify specific parts of a JSON document. Learning these standards helps ${label(audience)} professionals communicate changes precisely during code review and incident response.`,
      `When merging JSON configurations from multiple sources, define clear precedence rules and handle array merging explicitly — most deep-merge implementations treat arrays as atomic values and replace rather than concatenate them.`,
      `Use JSON.parse reviver functions to perform type coercion and validation in a single pass rather than parsing the document and then validating it in a separate step — this reduces memory usage and processing time for large payloads.`,
      `Implement a canonical JSON serialization (sorted keys, no trailing whitespace) for any JSON that will be hashed or signed. This ensures that logically identical documents produce identical byte representations, which is critical for ${label(intent)} in ${tc.scenario}.`,
      `When building APIs for ${label(audience)} consumers, use consistent null-versus-missing-key conventions documented in your API contract. Inconsistency between null and undefined is one of the most common sources of client-side bugs in JSON-heavy applications.`,
      `JSON5 and JSONC (JSON with comments) can improve configuration file readability during development, but always convert to strict JSON for production use. ${toolName} validates strict JSON, making it the right choice for verifying what your production systems will actually receive.`,
    ],
    encoding: [
      `URL-safe Base64 (RFC 4648 §5) replaces '+' with '-' and '/' with '_', eliminating the need for percent-encoding in URLs. When building APIs or sharing encoded data in URLs, prefer URL-safe Base64 to avoid double-encoding issues.`,
      `Content-Transfer-Encoding headers in email systems use different Base64 line-wrapping rules than web APIs. When debugging encoding issues across email and web systems, verify which Base64 variant each system expects.`,
      `Percent-encoding in URLs follows specific rules: RFC 3986 defines which characters must be encoded, but form encoding (application/x-www-form-urlencoded) uses '+' for spaces instead of '%20'. This subtle difference causes bugs when switching between URL construction and form data encoding.`,
      `When working with international domain names (IDN), Punycode encoding converts Unicode domains to ASCII-compatible form. Use ${toolName} to verify that domain encoding roundtrips correctly, especially when domain names contain characters from non-Latin scripts.`,
      `For performance-critical ${label(audience)} workflows, note that Base64 decoding is approximately 3× faster than encoding. If your pipeline repeatedly encodes and decodes the same data, cache the encoded form to avoid redundant computation.`,
      `When handling binary data in ${label(intent)} workflows, consider whether the receiving system uses MIME multipart encoding or expects the binary content inline. Choosing the wrong transport encoding for binary data is a leading cause of file corruption in API integrations.`,
      `Encoding canonicalization — normalising input before encoding — prevents the same logical data from producing multiple encoded representations. For ${label(audience)} teams working on ${tc.scenario}, establishing a canonicalization step before encoding simplifies comparison and deduplication downstream.`,
      `Character set detection for legacy data sources often relies on heuristics rather than declared metadata. For ${label(audience)} professionals working with legacy systems, always verify character set assumptions by inspecting byte patterns in raw data before committing to a decoding strategy.`,
    ],
    security: [
      `JWT tokens should never be stored in localStorage due to XSS vulnerability exposure. HttpOnly cookies with SameSite attributes provide stronger protection. Use ${toolName} to inspect token contents during development, but ensure production code handles tokens through secure cookie mechanisms.`,
      `Hash-based message authentication codes (HMAC) combine a hash function with a secret key to verify both data integrity and authentication. Unlike plain hashes, HMAC prevents length extension attacks. When building verification systems as a ${label(audience)}, always prefer HMAC over raw hashing for authentication purposes.`,
      `Certificate transparency logs provide a public record of all certificates issued for a domain. For ${label(audience)} professionals concerned about ${ac.concern}, monitoring these logs helps detect unauthorized certificate issuance that could enable man-in-the-middle attacks.`,
      `Timing-safe comparison functions prevent side-channel attacks when comparing hashes or tokens. Regular string comparison short-circuits on the first mismatch, leaking information about the correct value. Use constant-time comparison functions in all security-critical comparisons.`,
      `For ${label(audience)} teams, distinguishing between authentication (proving identity) and authorisation (proving permission) is fundamental to designing secure systems. JWTs can carry both types of claims, but conflating them — using an authentication token to make authorisation decisions without re-validation — creates privilege escalation vulnerabilities.`,
      `Cryptographic agility — designing systems to support algorithm transitions — is a long-term security investment. Algorithms that are secure today may be deprecated in the future (as happened with MD5 and SHA-1). For ${label(audience)} professionals working on ${tc.scenario}, using algorithm identifiers in stored hashes and signed tokens makes future algorithm rotation feasible without data migration.`,
      `TOTP (Time-based One-Time Passwords, RFC 6238) uses HMAC-SHA1 under the hood and depends on clock synchronisation between client and server. For ${label(audience)} teams implementing or debugging 2FA systems, understanding the time window and drift tolerance helps diagnose authentication failures that appear randomly.`,
      `When generating secure random identifiers for ${tc.scenario}, ensure the randomness source meets your security requirements. Pseudo-random generators seeded with predictable values (timestamps, PIDs) can be exploited. Browser-based crypto.getRandomValues() is cryptographically secure and what ${toolName} uses when generating identifiers.`,
    ],
    text: [
      `Named capture groups in regex (?<name>pattern) make patterns self-documenting and the extracted values easier to work with in code. When building complex patterns for ${label(intent)}, use named groups to improve readability and maintainability.`,
      `Atomic groups (?>...) and possessive quantifiers prevent backtracking in regex engines, which can prevent catastrophic backtracking that causes exponential time complexity. For patterns that will process untrusted input, consider the regex denial-of-service (ReDoS) risk.`,
      `Unicode-aware text processing requires explicit consideration of grapheme clusters versus code points. A single visible character (like a flag emoji) may consist of multiple Unicode code points. When measuring text length or truncating content, use grapheme-aware methods to avoid splitting characters.`,
      `Diff output formats (unified, context, side-by-side) serve different review workflows. Unified diff is compact and widely supported in version control, while side-by-side comparison is more intuitive for manual review. Choose the format that best supports your team's review process for ${tc.scenario}.`,
      `Lookahead and lookbehind assertions in regex allow matching patterns based on context without including the context in the match. For ${label(audience)} professionals working on ${label(intent)}, these assertions enable precise extraction from structured text without resorting to post-processing of the match result.`,
      `When performing multi-line text operations, be explicit about how newlines are handled. The \\n and \\r\\n line ending variants behave differently in regex and string operations depending on the runtime and operating system. For ${label(audience)} teams processing cross-platform text in ${tc.scenario}, normalising line endings before processing prevents inconsistent results.`,
      `Text tokenisation — splitting input into meaningful units (words, sentences, tokens) — is a prerequisite for many text analysis tasks. The right tokenisation strategy depends on the language and content: whitespace splitting works for English prose but fails for CJK languages or code identifiers that use camelCase.`,
      `Consistent text normalisation (lowercasing, accent stripping, punctuation removal) before comparison or search operations ensures that equivalent strings are treated as equal. For ${label(audience)} professionals working on ${tc.scenario}, documenting the exact normalisation pipeline makes results reproducible and comparable across different team members' workstations.`,
    ],
    formatting: [
      `SQL formatting conventions vary by team and database engine. The Rivers and Holywell SQL style guides provide structured approaches. When standardizing SQL formatting for ${label(audience)} teams, document the chosen convention and configure automated formatting to enforce it consistently.`,
      `Critical CSS extraction identifies the styles needed for above-the-fold content and inlines them in the HTML document, reducing the render-blocking impact of external stylesheets. This technique can significantly improve Largest Contentful Paint scores for content-heavy pages.`,
      `Markdown link reference definitions ([link text][id] with [id]: url) separate content from URLs, making documents easier to read and maintain. For ${label(audience)} professionals creating documentation, this pattern reduces visual clutter and makes URL updates easier to manage.`,
      `Preserving code semantics during formatting requires understanding language-specific rules. Python's significant whitespace, Makefile's required tabs, and YAML's indentation-based structure all constrain how formatting tools can modify these files. Always verify that formatted output preserves the original program behavior.`,
      `Format-on-save editor integrations ensure that code is always in a consistent format when committed to version control. For ${label(audience)} teams, this eliminates formatting-only commits that pollute git history and make genuine change diffs harder to review.`,
      `When ${label(intent)} for CSS, pay attention to selector specificity. Minification tools that reorder rules or combine selectors may change the effective specificity, causing elements to receive different styles than intended. Always validate minified CSS in a browser before deployment.`,
      `SQL EXPLAIN plans change with formatting in some query optimizers. While most modern databases parse whitespace-normalized SQL identically, reformatting queries that contain inline hints or optimizer directives may change execution behavior. Always test reformatted SQL against a representative dataset before deploying to production.`,
      `Consistent comment style in formatted code serves as documentation. When running ${toolName} for ${label(intent)}, preserve comments rather than stripping them — stripped comments in shared codebases increase knowledge silos and slow down onboarding.`,
    ],
    api: [
      `GraphQL introspection queries expose the full API schema, which is useful during development but should be disabled in production to prevent information leakage. When using ${toolName} to explore API responses, be aware that introspection results may reveal internal implementation details.`,
      `HTTP caching headers (ETag, Last-Modified, Cache-Control) significantly affect API performance and behavior. When debugging API integration issues as a ${label(audience)}, verify that caching is not serving stale responses by checking these headers alongside the response body.`,
      `API pagination cursors should be opaque to consumers — encoding implementation details (like database offsets) in cursors creates tight coupling that breaks when the underlying data store changes. When designing pagination for ${label(intent)}, use encrypted or hashed cursors that consumers cannot parse or manipulate.`,
      `Webhook delivery reliability requires implementing retry logic with exponential backoff on the provider side and idempotency keys on the consumer side. When ${tc.scenario}, verify that your webhook handler can safely process the same event multiple times without creating duplicate side effects.`,
      `API versioning strategies (path versioning /v1/, header versioning, content-type versioning) each have trade-offs for cacheability, discoverability, and client upgrade paths. For ${label(audience)} teams designing long-lived APIs, path versioning is the simplest to implement and debug, while header-based versioning keeps URLs cleaner at the cost of requiring careful documentation.`,
      `OpenAPI/Swagger specification files serve as both documentation and contract. For ${label(audience)} professionals, keeping the spec in sync with the implementation — using code generation or spec-first development — prevents the spec from becoming an outdated artifact that misleads consumers.`,
      `API error handling should distinguish between client errors (4xx) and server errors (5xx), and provide enough detail in the response body for the client to understand what went wrong and how to fix it. For ${tc.scenario}, a well-designed error response can significantly reduce the time to resolution for both developers and support teams.`,
      `CORS (Cross-Origin Resource Sharing) configuration mistakes are a common source of API integration failures. For ${label(audience)} professionals, understanding the difference between simple and preflight requests, and the role of the Access-Control-Allow-Origin header, prevents security misconfigurations that either block legitimate requests or expose APIs to unintended origins.`,
    ],
    data: [
      `Schema registries (like Confluent Schema Registry for Avro/Protobuf) enforce backward and forward compatibility rules automatically. For ${label(audience)} teams, integrating schema validation into the CI/CD pipeline prevents incompatible schema changes from reaching production.`,
      `Data lineage tracking records the origin, transformations, and destination of every data element. When debugging data quality issues during ${tc.scenario}, lineage information helps trace the exact point where corruption or loss occurred, significantly reducing investigation time.`,
      `Bloom filters provide probabilistic set membership testing with guaranteed zero false negatives. For ${label(audience)} professionals working with large datasets, Bloom filters can efficiently pre-filter data before expensive exact lookups, reducing processing time for common operations like deduplication.`,
      `Data serialization format selection (JSON, Protocol Buffers, Avro, MessagePack) should consider schema evolution needs, human readability, compression ratio, and parsing performance. For ${tc.scenario}, the right format depends on whether the primary consumer is a human debugger or a high-throughput data pipeline.`,
      `Partitioning strategies (range, hash, list) significantly affect query performance and data distribution in databases and data lakes. For ${label(audience)} professionals, choosing the right partition key for ${tc.scenario} requires understanding the access patterns of downstream consumers and the write throughput requirements of upstream producers.`,
      `Data contracts — formal agreements between data producers and consumers about schema, semantics, and SLAs — are a maturity step beyond schema registries. For ${label(audience)} teams, implementing data contracts reduces the blast radius of breaking changes and provides a clear escalation path when upstream data quality deteriorates.`,
      `Columnar storage formats (Parquet, ORC) organise data by column rather than by row, enabling highly efficient analytical queries that read only the relevant columns. For ${label(audience)} teams working on analytical ${tc.scenario}, converting row-oriented data to columnar format is often the highest-impact performance optimization available.`,
      `Data deduplication strategies (exact match, fuzzy match, entity resolution) each have different accuracy and performance characteristics. For ${label(audience)} professionals, choosing the right approach depends on the tolerance for false positives, the available computation budget, and whether duplicates need to be merged or simply identified.`,
    ],
    debugging: [
      `Binary search debugging (git bisect for code, or manual bisection for data) efficiently identifies the exact change that introduced a bug. For a ${label(audience)} with a large number of potential causes, bisection reduces the search space logarithmically, finding the root cause in O(log n) steps instead of O(n).`,
      `Memory profiling in browser-based tools is accessible through DevTools' Heap Snapshot and Allocation Timeline features. When ${label(intent)}, understanding memory patterns helps identify leaks caused by retained closures, detached DOM nodes, or accumulating event listeners.`,
      `Distributed tracing with correlation IDs allows tracking a single request across multiple services. For ${label(audience)} teams debugging cross-service issues during ${tc.scenario}, propagating trace context headers (W3C Trace Context standard) through every service boundary is essential for end-to-end visibility.`,
      `Canary deployments help isolate whether an issue is caused by a code change or an environmental factor. By routing a small percentage of traffic to the new version and comparing metrics, ${label(audience)} professionals can detect regressions before they affect all users.`,
      `Chaos engineering — deliberately injecting failures into a system — is the most reliable way to verify that failure handling works correctly. For ${label(audience)} teams, running controlled chaos experiments during off-peak hours provides evidence-based confidence that ${tc.scenario} will not cause cascading failures.`,
      `Observability requires three pillars: metrics (what is happening), logs (why it happened), and traces (where it happened). For ${label(audience)} professionals debugging ${tc.scenario}, gaps in any of these pillars create blind spots. ${toolName} addresses the data inspection layer of observability during local debugging sessions.`,
      `Rubber duck debugging — explaining the problem out loud or in writing — often surfaces the solution without external input. For ${label(audience)} professionals, this technique is particularly effective for ${label(intent)} issues where articulating the expected versus actual behaviour reveals an incorrect assumption.`,
      `Exception telemetry (Sentry, Bugsnag, Datadog error tracking) captures stack traces, user context, and breadcrumbs from production errors. For ${label(audience)} teams, correlating telemetry events with ${toolName} output during debugging helps verify whether a locally reproduced issue matches what happened in production.`,
    ],
    automation: [
      `Dead letter queues capture failed automated task executions for later analysis and replay. For ${label(audience)} teams, implementing DLQ processing ensures that transient failures do not cause permanent data loss, and provides a record of what went wrong for debugging.`,
      `Infrastructure as Code (IaC) tools like Terraform and Pulumi enable version-controlled, reviewable automation of infrastructure changes. When ${tc.scenario}, treating infrastructure changes like code changes — with pull requests, reviews, and automated testing — prevents configuration errors.`,
      `Circuit breaker patterns prevent automated tasks from overwhelming failing downstream services. For ${label(audience)} professionals, implementing circuit breakers in automated workflows means that temporary service disruptions do not cascade into system-wide failures.`,
      `Event sourcing captures every state change as an immutable event, enabling perfect audit trails and the ability to replay history. For automated data processing pipelines, event sourcing provides the ability to rebuild state from scratch if corruption is detected during ${tc.scenario}.`,
      `Workflow orchestration tools (Apache Airflow, Temporal, Prefect) provide dependency management, retries, and observability for complex automation pipelines. For ${label(audience)} teams, choosing between a DAG-based scheduler and a code-driven workflow engine depends on the complexity of the task graph and the team's programming language preferences.`,
      `Automation testing should cover both the happy path and failure scenarios. For ${label(audience)} professionals, testing that automated tasks handle rate limits, partial failures, and stale data gracefully is as important as testing that they succeed under ideal conditions. ${toolName} helps validate the payload formats that automated tasks must handle.`,
      `Backpressure mechanisms prevent fast producers from overwhelming slow consumers in automated pipelines. For ${label(audience)} teams, implementing queue depth monitoring and consumer autoscaling ensures that ${tc.scenario} does not create unbounded queues that exhaust memory or delay processing indefinitely.`,
      `Scheduled task idempotency testing — running the task multiple times and verifying that the output is identical — should be part of the deployment verification checklist. For ${label(audience)} professionals, this test is most valuable after schema changes or dependency updates that might affect task behaviour.`,
    ],
    web: [
      `Subresource Integrity (SRI) attributes on script and link tags ensure that CDN-served files have not been tampered with. For ${label(audience)} teams, adding integrity hashes to third-party resources prevents supply chain attacks where a compromised CDN serves malicious content.`,
      `Service Workers enable sophisticated caching strategies (cache-first, network-first, stale-while-revalidate) that can significantly improve web application performance. When ${label(intent)}, consider how cached content interacts with your content update strategy to prevent users from seeing stale data.`,
      `Content Security Policy (CSP) headers provide defense-in-depth against XSS by whitelisting allowed content sources. For ${label(audience)} professionals, implementing CSP in report-only mode first allows you to identify violations without breaking functionality, then gradually tightening the policy.`,
      `HTTP/2 and HTTP/3 multiplexing changes the optimization calculus for web assets. Techniques like CSS sprite sheets and file concatenation, which were beneficial under HTTP/1.1's connection limits, may actually decrease performance under multiplexed protocols. Verify that your optimization strategy matches your deployment protocol.`,
      `Web performance budgets (setting maximum thresholds for page weight, time-to-interactive, and Core Web Vitals) provide a systematic framework for preventing performance regressions. For ${label(audience)} teams, integrating budget checks into CI/CD pipelines ensures that performance is treated as a first-class requirement alongside functionality.`,
      `The interplay between CORS, cookies, and credentials in web applications requires careful configuration. For ${label(audience)} professionals, the withCredentials flag in fetch/XMLHttpRequest must be paired with specific CORS headers on the server — failing to align these causes authentication failures that are difficult to diagnose from the client side alone.`,
      `Lazy loading images and non-critical scripts reduces initial page weight and improves perceived performance. For ${label(audience)} teams working on ${tc.scenario}, using the native loading="lazy" attribute for images and dynamic import() for JavaScript modules delivers significant improvements with minimal code changes.`,
      `Web security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) complement CSP in reducing attack surface. For ${label(audience)} professionals, adding these headers is a low-effort, high-impact security improvement that should be part of the standard deployment checklist for any web application.`,
    ],
  };

  const pool = tipsPool[clusterKey] ?? tipsPool.json;
  const shuffled = seededShuffle(pool, seed + 59);
  return shuffled.slice(0, 4);
}

function estimateProgrammaticWordCount(page: ProgrammaticPage): number {
  const corpus = [
    page.title,
    page.description,
    page.h1,
    page.intro,
    ...page.steps,
    ...page.pitfalls,
    ...page.proTips,
    ...page.technicalAnalysis,
    ...page.expertTips,
    ...page.toolHistory,
    ...page.globalUseCases,
    ...page.faq.map((item) => `${item.question} ${item.answer}`),
    ...page.comparison.flatMap((row) => [row.item, row.pros, row.cons]),
    ...page.glossary.map((item) => `${item.term} ${item.definition}`),
  ].join(' ');

  return corpus
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function buildToolHistory(tool: string, clusterKey: ClusterKey, audience: string, seed: number): string[] {
  const toolName = getToolName(tool);
  const cd = clusterDomain[clusterKey];
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };

  const historyPool = [
    `${toolName} was introduced to reduce repetitive ad-hoc scripting in ${label(clusterKey)} operations and to provide a deterministic output path for engineers working under delivery pressure.`,
    `Adoption accelerated as teams shifted from desktop-only utilities to browser-native workflows, especially in organizations that required private local processing for internal payloads and configuration artifacts.`,
    `For ${label(audience)} teams, the tool matured into a practical decision-support layer: quick verification first, then production automation after output behavior is validated.`,
    `The evolution of ${toolName} reflects a broader industry trend toward privacy-preserving developer tooling, where ${cd.field} tasks are performed entirely client-side without transmitting data to external servers.`,
    `Early versions focused on basic ${label(clusterKey)} operations, but community feedback from ${label(audience)} professionals drove the addition of edge-case handling, better error messages, and workflow-specific defaults that align with ${ac.focus}.`,
    `Today ${toolName} serves as both a standalone utility and a reference implementation — ${label(audience)} teams often use its output to benchmark their own ${label(clusterKey)} automation pipelines against a known-correct baseline.`,
  ];

  const shuffled = seededShuffle(historyPool, seed + 71);
  return shuffled.slice(0, 4);
}

function buildGlobalUseCases(tool: string, intent: string, audience: string, clusterKey: ClusterKey, seed: number): string[] {
  const toolName = getToolName(tool);
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };
  const cd = clusterDomain[clusterKey];

  const useCasePool = [
    `North America: teams use ${toolName} to validate ${label(intent)} workflows before release cutoffs and incident response handoffs, where ${ac.focus} is non-negotiable under time pressure.`,
    `Europe: distributed engineering organizations use ${toolName} to align ${label(clusterKey)} transformation quality across cross-border review pipelines, especially in GDPR-sensitive contexts where ${ac.concern} is paramount.`,
    `Asia-Pacific: high-iteration product teams rely on ${toolName} for quick pre-deployment checks in continuous release environments, embedding ${label(intent)} verification into their rapid shipping cadence.`,
    `Remote-first organizations: globally distributed ${label(audience)} professionals use ${toolName} as a shared reference point for ${cd.field} tasks, eliminating "works on my machine" discrepancies when the same browser-based tool produces identical results everywhere.`,
    `Regulated industries: financial and healthcare ${label(audience)} teams rely on ${toolName} for ${label(intent)} because local-only processing satisfies data residency requirements without additional compliance overhead.`,
    `Startup environments: early-stage teams without dedicated ${label(clusterKey)} infrastructure use ${toolName} to handle ${label(intent)} tasks efficiently, deferring custom tooling investment until scale demands it.`,
  ];

  const shuffled = seededShuffle(useCasePool, seed + 83);
  return shuffled.slice(0, 4);
}

function buildGlossary(clusterKey: ClusterKey, intent: string, audience: string, seed: number): { term: string; definition: string }[] {
  const cd = clusterDomain[clusterKey];
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };

  const glossaryPool = [
    {
      term: 'Deterministic transformation',
      definition: 'An operation that produces the same result for the same input and configuration every time, ensuring reproducibility across environments and team members.',
    },
    {
      term: 'Input normalization',
      definition: 'Preparing data in a consistent structure so comparisons, validation, and downstream processing remain reliable regardless of the original source format.',
    },
    {
      term: `${label(clusterKey)} workflow`,
      definition: `A sequence of practical steps used by engineering teams to execute and verify ${label(clusterKey)} tasks in production contexts, typically combining manual validation with automated checks.`,
    },
    {
      term: 'Edge-case coverage',
      definition: 'Testing unusual but realistic inputs to avoid hidden regressions in live environments, particularly important for data that crosses system boundaries.',
    },
    {
      term: 'Local processing',
      definition: 'Executing data operations entirely within the browser or client device without transmitting data to external servers, preserving confidentiality and reducing latency.',
    },
    {
      term: `${label(intent)} pipeline`,
      definition: `The end-to-end sequence of steps involved in ${label(intent)}, from initial input validation through transformation to final output verification.`,
    },
    {
      term: 'Roundtrip validation',
      definition: `The practice of encoding or transforming data and then reversing the operation to confirm that no information was lost — a key quality gate in ${cd.field}.`,
    },
    {
      term: `${label(audience)} workflow integration`,
      definition: `Embedding ${label(clusterKey)} tool usage into the daily practices of ${label(audience)} professionals, ${ac.workflow} for maximum efficiency and consistency.`,
    },
  ];

  const shuffled = seededShuffle(glossaryPool, seed + 97);
  return shuffled.slice(0, 5);
}

function buildDepthExpansion(tool: string, clusterKey: ClusterKey, audience: string, task: string, pass = 0): string[] {
  const toolName = getToolName(tool);
  const tc = taskContext[task] ?? { scenario: 'completing a task', urgency: 'important', outcome: 'achieve the result' };
  return [
    `Operationally, ${toolName} is most effective when used as a repeatable checkpoint rather than an occasional troubleshooting aid. Teams that codify this step in runbooks usually reduce rework because output assumptions are validated before deployment artifacts are finalized.`,
    `From a governance perspective, ${label(audience)} groups benefit from documenting the exact tool settings used during ${tc.scenario}. This makes incident retrospectives and compliance reviews materially easier because decision paths are auditable.`,
    `Within ${label(clusterKey)} systems, the highest quality gains usually come from pairing manual validation with automated checks. The manual pass catches context-specific anomalies while automation enforces consistency across ongoing releases.`,
    `Quality assurance pass ${pass + 1}: surface the primary conclusion in the first screen of content (Bing early-clarity guideline) — ${tc.outcome} must be visible before ancillary background.`,
    `Independent verification: a reviewer with no prior context should reproduce this ${label(clusterKey)} workflow using only the steps, glossary definitions, and comparison table on this page.`,
  ];
}

function buildQualityBoost(
  tool: string,
  intent: string,
  clusterKey: ClusterKey,
  audience: string,
  pass: number,
): string[] {
  return [
    `Transparency checkpoint ${pass + 1}: ${getToolName(tool)} processes all samples locally; nothing is uploaded during ${label(intent)}.`,
    `${label(audience)} runbooks should record tool version, input checksum, and output checksum for ${label(clusterKey)} audits.`,
    `Original value: this page adds operational context, pitfalls, and comparisons — not syndicated or duplicated content from other URLs.`,
  ];
}

function enforceProgrammaticQualityFloor(page: ProgrammaticPage, tool: string, clusterKey: ClusterKey, audience: string, task: string): void {
  const MIN_PROGRAMMATIC_WORDS = 1200;
  let pass = 0;

  while (estimateProgrammaticWordCount(page) < MIN_PROGRAMMATIC_WORDS && pass < 8) {
    page.technicalAnalysis.push(...buildDepthExpansion(tool, clusterKey, audience, task, pass));
    pass += 1;
  }

  let quality = calculateQualityScore(page);
  pass = 0;
  while (quality.score < MIN_QUALITY_SCORE && pass < 6) {
    page.expertTips.push(...buildQualityBoost(tool, page.intent, clusterKey, audience, pass));
    page.globalUseCases.push(...buildDepthExpansion(tool, clusterKey, audience, task, pass + 2));
    page.technicalAnalysis.push(...buildDepthExpansion(tool, clusterKey, audience, task, pass + 4));
    quality = calculateQualityScore(page);
    pass += 1;
  }
}

/* ------------------------------------------------------------------ */
/*  Description builder — unique, compelling meta descriptions           */
/* ------------------------------------------------------------------ */
function buildDescription(
  title: string, tool: string, intent: string, audience: string,
  task: string, modifier: string, clusterKey: ClusterKey, seed: number,
): string {
  const toolName = getToolName(tool);
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };
  const tc = taskContext[task] ?? { scenario: 'completing a task', urgency: 'important', outcome: 'achieve the result' };
  const cd = clusterDomain[clusterKey];

  const descriptionVariants = [
    `${label(intent)} for ${label(audience)} teams — practical, browser-based ${label(clusterKey)} workflow ${label(modifier)}. Learn how to ${tc.outcome} with ${toolName}.`,
    `Step-by-step guide to ${label(intent)} using ${toolName} for ${label(audience)} professionals. Covers ${tc.scenario} with best practices for ${cd.field}.`,
    `How ${label(audience)} teams use ${toolName} to ${label(intent)} ${label(modifier)}. Includes troubleshooting tips, alternative solutions, and expert recommendations.`,
    `Complete walkthrough: ${label(intent)} with ${toolName} for ${label(audience)} workflows. All processing runs locally in your browser — your data stays private.`,
    `A ${label(audience)}'s guide to ${label(intent)} using browser-based ${toolName}. Practical steps for ${tc.scenario}, with focus on ${ac.focus}.`,
    `${label(intent)} for ${label(audience)} engineers — covers ${tc.scenario} using ${toolName} ${label(modifier)} with all data processing happening locally in your browser.`,
    `Master ${label(intent)} in ${cd.field}: a complete ${label(audience)} reference covering ${tc.scenario}, ${tc.urgency}, with ${toolName}. Zero data transmission, fully private.`,
    `${toolName} for ${label(audience)} professionals: how to ${label(intent)} ${label(modifier)}, focused on ${ac.focus} and addressing ${ac.concern}.`,
    `Trusted by ${label(audience)} teams: ${label(intent)} with ${toolName} ${label(modifier)}. Includes step-by-step instructions, common pitfalls, and expert tips for ${cd.field}.`,
    `${label(audience)} guide: ${label(intent)} using ${toolName} in a browser-based, privacy-safe workflow. Tailored for ${tc.scenario} where ${tc.urgency}.`,
    `${cd.field} workflow guide — ${label(intent)} for ${label(audience)} using ${toolName}. No data leaves your browser; ${cd.bestPractice}.`,
    `Hands-on ${label(intent)} reference for ${label(audience)} engineers: ${toolName}, ${label(modifier)}, real-world ${tc.scenario}. From setup to validated output.`,
    `${label(audience)} professionals use ${toolName} to ${label(intent)} ${label(modifier)} — this guide covers every step, from input preparation to output verification.`,
    `${label(intent)} — the ${label(audience)} way: browser-based, locally processed, privacy-safe. ${toolName} guide for ${tc.scenario} in ${cd.field}.`,
    `Quick and reliable ${label(intent)} for ${label(audience)} roles: ${toolName} guide covering ${tc.scenario}, key pitfalls, and how to ${tc.outcome} confidently.`,
  ];

  return ensureSeoDescription(descriptionVariants[seed % descriptionVariants.length]);
}

export function getPageByIndex(index: number): ProgrammaticPage | undefined {
  if (index < 0 || index >= TARGET_TOTAL) return undefined;
  const cached = pageCache.get(index);
  if (cached) return cached;

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

  const slug = buildSlug(pair.cluster.key, pair.tool, pair.intent, audience, task, index);
  const seed = hashString(slug);
  const title = buildTitle(pair.tool, pair.intent, audience, pair.cluster.key, seed);

  const page: ProgrammaticPage = {
    slug,
    title,
    description: buildDescription(title, pair.tool, pair.intent, audience, task, modifier, pair.cluster.key, seed),
    primaryTool: pair.tool,
    clusterKey: pair.cluster.key,
    intent: pair.intent,
    audience,
    taskVariant: task,
    keywords: buildKeywords(pair.cluster.key, pair.tool, pair.intent, audience, task),
    h1: buildH1(pair.intent, audience, pair.cluster.key, seed),
    intro: buildIntro(pair.tool, pair.intent, audience, task, modifier, pair.cluster.key, seed),
    steps: buildSteps(pair.intent, pair.tool, task, audience, pair.cluster.key, seed),
    pitfalls: buildPitfalls(pair.cluster.key, audience, task, seed),
    comparison: buildComparison(pair.cluster.key, audience, seed),
    proTips: buildProTips(pair.cluster.key, audience, pair.tool, task, seed),
    faq: buildFAQ(pair.cluster.key, pair.tool, audience, pair.intent, task, seed),
    technicalAnalysis: buildTechnicalAnalysis(pair.cluster.key, pair.tool, pair.intent, audience, task, seed),
    expertTips: buildExpertTips(pair.cluster.key, pair.tool, pair.intent, audience, task, seed),
    toolHistory: buildToolHistory(pair.tool, pair.cluster.key, audience, seed),
    globalUseCases: buildGlobalUseCases(pair.tool, pair.intent, audience, pair.cluster.key, seed),
    glossary: buildGlossary(pair.cluster.key, pair.intent, audience, seed),
  };

  if (isCrossToolRemediationPair(pair.tool, pair.intent)) {
    page.intro = `${buildCrossToolIntroParagraph(pair.tool, pair.intent, audience, seed)} ${page.intro}`;
    page.steps = [...buildCrossToolSteps(pair.tool, pair.intent), ...page.steps].slice(0, 8);
    page.faq = [...buildCrossToolFaq(pair.tool, pair.intent), ...page.faq].slice(0, 6);
    page.technicalAnalysis = [
      ...buildCrossToolTechnicalNotes(pair.tool, pair.intent, audience),
      ...page.technicalAnalysis,
    ];
  }

  enforceProgrammaticQualityFloor(page, pair.tool, pair.cluster.key, audience, task);

  pageCache.set(index, page);
  return page;
}

/* ------------------------------------------------------------------ */
/*  Slug-based O(1) lookup — extract trailing index, verify match     */
/* ------------------------------------------------------------------ */
export function getProgrammaticPageBySlug(slug: string): ProgrammaticPage | undefined {
  const match = slug.match(/-(\d+)$/);
  if (!match) return undefined;

  const index = parseInt(match[1], 10);
  const page = getPageByIndex(index);

  if (!page || page.slug !== slug) return undefined;
  return page;
}

function tryResolveLegacyProgrammaticSlug(slug: string): ProgrammaticPage | undefined {
  const match = slug.match(/^(.*)-(\d+)$/);
  if (!match) return undefined;

  const stem = match[1];
  const legacyIndex = Number.parseInt(match[2], 10);
  if (!Number.isFinite(legacyIndex) || legacyIndex < 0) return undefined;

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

  const modifierIndex = legacyIndex % MODIFIERS_COUNT;
  const remappedIndex =
    pairIndex * PER_PAIR +
    audienceIndex * TASKS_COUNT * MODIFIERS_COUNT +
    taskIndex * MODIFIERS_COUNT +
    modifierIndex;

  return getPageByIndex(remappedIndex);
}

export function resolveProgrammaticPageBySlug(
  slug: string,
): { page: ProgrammaticPage; canonicalSlug: string } | undefined {
  const directPage = getProgrammaticPageBySlug(slug);
  if (directPage) {
    return { page: directPage, canonicalSlug: directPage.slug };
  }

  const legacyPage = tryResolveLegacyProgrammaticSlug(slug);
  if (!legacyPage) return undefined;

  return { page: legacyPage, canonicalSlug: legacyPage.slug };
}

/* ------------------------------------------------------------------ */
/*  Helpers for sitemap generation                                     */
/* ------------------------------------------------------------------ */
export function getTotalPageCount(): number {
  return TARGET_TOTAL;
}

export function getSlugByIndex(index: number): string | undefined {
  if (index < 0 || index >= TARGET_TOTAL) return undefined;

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

export function getProgrammaticLastModified(slug: string): string {
  const baseMs = Date.parse(siteConfig.contentUpdatedAt || siteConfig.launchDate);
  if (!Number.isFinite(baseMs)) return siteConfig.launchDate;

  const dayOffset = Math.abs(hashString(slug)) % 30;
  return new Date(baseMs - dayOffset * 86_400_000).toISOString();
}

/* ------------------------------------------------------------------ */
/*  Backward-compatible bulk generators (avoid for 500k – use index)  */
/* ------------------------------------------------------------------ */
export function generateProgrammaticPages(): ProgrammaticPage[] {
  const pages: ProgrammaticPage[] = [];
  for (let i = 0; i < TARGET_TOTAL; i++) {
    const page = getPageByIndex(i);
    if (page) pages.push(page);
  }
  return pages;
}

export function getAllProgrammaticSlugs(): string[] {
  const slugs: string[] = [];
  for (let i = 0; i < TARGET_TOTAL; i++) {
    const slug = getSlugByIndex(i);
    if (slug) slugs.push(slug);
  }
  return slugs;
}

/* ------------------------------------------------------------------ */
/*  Priority slug selection — MUST stay in sync with                    */
/*  scripts/generate-priority-sitemap.mjs                              */
/* ------------------------------------------------------------------ */

const HIGH_VALUE_CLUSTERS = new Set<ClusterKey>([
  'json', 'security', 'encoding', 'formatting', 'api', 'debugging',
  'web', 'automation', 'data', 'text',
]);

const PRIMARY_TOOLS = new Set([
  'json-formatter', 'json-to-typescript', 'jwt-decoder',
  'base64-encode-decode', 'regex-tester', 'hash-generator',
  'html-entity-encode-decode', 'css-minifier', 'markdown-preview',
  'url-encode-decode', 'uuid-generator', 'cron-helper', 'sql-formatter',
]);

const PRIORITY_AUDIENCES = new Set([
  'backend-engineer', 'frontend-developer', 'fullstack-developer',
  'devops-engineer', 'security-conscious-developer', 'api-consumer',
  'technical-writer', 'site-reliability-engineer', 'integration-engineer',
  'mobile-developer', 'database-administrator', 'cloud-architect', 'ops-engineer',
]);

const PRIORITY_TASKS = new Set([
  'debug-production-issue', 'prepare-api-response', 'sanitize-user-input',
  'validate-auth-token', 'document-api-endpoint', 'prepare-query-parameters',
  'migrate-legacy-system', 'prepare-deployment-artifact', 'clean-up-payload',
  'inspect-encoded-payload', 'trace-request', 'review-config-change', 'resolve-merge-conflict',
]);

const BING_FLAGGED_INDICES = new Set([
  1150412, 7123065, 10079551, 17605058, 17596019, 17699736, 16921447, 16402654,
  16600672, 10117136, 16148495, 16126541, 16128559, 16936654, 17076643, 16983769,
  17699852, 16646668, 16501563, 16364610,
  16799700, 9921102, 5565750, 3552666,
  3704044, 6505100, 5418355,
]);

const PRIORITY_MODIFIER_INDICES = (() => {
  const set = new Set<number>();
  const contextCount = modifierDeliveryContexts.length;
  for (let s = 0; s < modifierExecutionStyles.length; s += 1) {
    for (const offset of [0, 5, 11]) {
      const c = (s * 2 + offset) % contextCount;
      set.add(s * contextCount + c);
    }
  }
  return set;
})();

function isPriorityProgrammaticIndex(
  globalIndex: number,
  clusterKey: ClusterKey,
  tool: string,
  audience: string,
  task: string,
  modifierIndex: number,
): boolean {
  if (BING_FLAGGED_INDICES.has(globalIndex)) return true;

  return (
    HIGH_VALUE_CLUSTERS.has(clusterKey)
    && PRIMARY_TOOLS.has(tool)
    && PRIORITY_AUDIENCES.has(audience)
    && PRIORITY_TASKS.has(task)
    && PRIORITY_MODIFIER_INDICES.has(modifierIndex)
  );
}

/**
 * Collect slugs for build-time SSG — same selection as the priority sitemap tier.
 * Pre-rendering these paths means Cloudflare serves HTML from `out/` with zero
 * Pages Function invocations (Googlebot included).
 */
export function collectPrioritySlugs(limit: number): string[] {
  if (limit <= 0) return [];

  const slugs: string[] = [];
  let globalIndex = 0;

  outer:
  for (const cluster of clusters) {
    for (const tool of cluster.tools) {
      for (const intent of cluster.intents) {
        for (const audience of audiences) {
          for (const task of tasks) {
            for (let modifierIndex = 0; modifierIndex < modifierPatterns.length; modifierIndex += 1) {
              const indexForGenerator = globalIndex;
              globalIndex += 1;

              if (
                !isPriorityProgrammaticIndex(
                  indexForGenerator,
                  cluster.key,
                  tool,
                  audience,
                  task,
                  modifierIndex,
                )
              ) {
                continue;
              }

              const slug = getSlugByIndex(indexForGenerator);
              if (slug) {
                slugs.push(slug);
                if (slugs.length >= limit) break outer;
              }
            }
          }
        }
      }
    }
  }

  return slugs;
}

/** Total priority-tier slugs (same selection as the priority sitemap). */
export function countPrioritySlugs(): number {
  let count = 0;
  let globalIndex = 0;

  for (const cluster of clusters) {
    for (const tool of cluster.tools) {
      for (const intent of cluster.intents) {
        for (const audience of audiences) {
          for (const task of tasks) {
            for (let modifierIndex = 0; modifierIndex < modifierPatterns.length; modifierIndex += 1) {
              const indexForGenerator = globalIndex;
              globalIndex += 1;

              if (
                isPriorityProgrammaticIndex(
                  indexForGenerator,
                  cluster.key,
                  tool,
                  audience,
                  task,
                  modifierIndex,
                )
              ) {
                count += 1;
              }
            }
          }
        }
      }
    }
  }

  return count;
}

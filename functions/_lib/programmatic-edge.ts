/**
 * Programmatic page generation for Cloudflare Pages Functions (Edge Runtime).
 * Self-contained adaptation of src/data/programmatic.ts — no React or Node.js dependencies.
 */

/* ------------------------------------------------------------------ */
/*  Constants & Data                                                   */
/* ------------------------------------------------------------------ */

const SITE_URL = 'https://devsolvev2.com';
const SITE_NAME = 'DevSolve';
const LAUNCH_DATE = '2026-01-15T00:00:00Z';
const CONTENT_UPDATED_AT = '2026-04-06T00:00:00Z';

interface ToolInfo {
  slug: string;
  name: string;
}

const tools: ToolInfo[] = [
  { slug: 'json-formatter', name: 'JSON Formatter & Validator' },
  { slug: 'jwt-decoder', name: 'JWT Decoder (No Verify)' },
  { slug: 'base64-encode-decode', name: 'Base64 Encode/Decode' },
  { slug: 'url-encode-decode', name: 'URL Encode/Decode' },
  { slug: 'hash-generator', name: 'Hash Generator (MD5/SHA)' },
  { slug: 'uuid-generator', name: 'UUID Generator' },
  { slug: 'regex-tester', name: 'Regex Tester' },
  { slug: 'diff-checker', name: 'Diff Checker' },
  { slug: 'text-case-converter', name: 'Text Case Converter' },
  { slug: 'html-entity-encode-decode', name: 'HTML Entity Encode/Decode' },
  { slug: 'sql-formatter', name: 'SQL Formatter' },
  { slug: 'css-minifier', name: 'CSS Minifier' },
  { slug: 'markdown-preview', name: 'Markdown Preview' },
  { slug: 'json-to-typescript', name: 'JSON to TypeScript' },
  { slug: 'cron-helper', name: 'Cron Expression Helper' },
];

type ClusterKey = 'json' | 'encoding' | 'security' | 'text' | 'formatting' | 'api' | 'data' | 'debugging' | 'automation' | 'web';

interface ClusterDefinition {
  key: ClusterKey;
  tools: string[];
  intents: string[];
}

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
];

const modifierPatterns = modifierExecutionStyles.flatMap((style) =>
  modifierDeliveryContexts.map((context) => `${style}-${context}`),
);

/* ------------------------------------------------------------------ */
/*  Computed constants                                                  */
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

const AUDIENCES_COUNT = audiences.length;
const TASKS_COUNT = tasks.length;
const MODIFIERS_COUNT = modifierPatterns.length;
const PER_PAIR = AUDIENCES_COUNT * TASKS_COUNT * MODIFIERS_COUNT;
const TOTAL_POSSIBLE = toolIntentPairs.length * PER_PAIR;

/**
 * Maximum number of programmatic pages to serve.
 * Matches the app's monetization config rampLevel 5 schedule (14M pages).
 * This limits the addressable index range so invalid indices beyond this
 * threshold return 404 instead of generating content.
 * See: src/config/monetization.ts → opsFlags.programmaticRampLevel
 */
const TARGET_TOTAL = Math.min(TOTAL_POSSIBLE, 14_000_000);

/* ------------------------------------------------------------------ */
/*  Utility functions                                                   */
/* ------------------------------------------------------------------ */

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

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

function label(s: string): string {
  return s.replace(/-/g, ' ');
}

function getToolName(slug: string): string {
  return tools.find((t) => t.slug === slug)?.name ?? slug.replace(/-/g, ' ');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ */
/*  Slug building                                                      */
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
/*  Audience & task context                                            */
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
/*  Title & H1 builders                                                */
/* ------------------------------------------------------------------ */

const titleTemplates: Record<ClusterKey, string[]> = {
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

function buildTitle(tool: string, intent: string, audience: string, clusterKey: ClusterKey, seed: number): string {
  const templates = titleTemplates[clusterKey];
  const template = templates[seed % templates.length];
  return template
    .replace('{intent}', label(intent))
    .replace('{audience}', label(audience))
    .replace('{tool}', getToolName(tool));
}

const h1Templates: Record<ClusterKey, string[]> = {
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

function buildH1(intent: string, audience: string, clusterKey: ClusterKey, seed: number): string {
  const templates = h1Templates[clusterKey];
  const template = templates[seed % templates.length];
  return template.replace('{intent}', label(intent)).replace(/\{audience\}/g, label(audience));
}

/* ------------------------------------------------------------------ */
/*  Content builders (simplified for edge)                             */
/* ------------------------------------------------------------------ */

function buildDescription(tool: string, intent: string, audience: string, task: string, modifier: string, clusterKey: ClusterKey, seed: number): string {
  const toolName = getToolName(tool);
  const tc = taskContext[task] ?? { scenario: 'completing a task', urgency: 'important', outcome: 'achieve the result' };
  const cd = clusterDomain[clusterKey];
  const variants = [
    `Practical, browser-based workflow for real-world ${label(clusterKey)} engineering tasks, ${label(modifier)}. Learn how to ${tc.outcome} with ${toolName}.`,
    `Step-by-step guide to ${label(intent)} using ${toolName} for ${label(audience)} professionals. Covers ${tc.scenario} with best practices for ${cd.field}.`,
    `How ${label(audience)} teams use ${toolName} to ${label(intent)} ${label(modifier)}. Includes troubleshooting tips, alternative solutions, and expert recommendations.`,
    `Complete walkthrough: ${label(intent)} with ${toolName} for ${label(audience)} workflows. All processing runs locally in your browser — your data stays private.`,
    `A ${label(audience)}'s guide to ${label(intent)} using browser-based ${toolName}. Practical steps for ${tc.scenario}, with focus on ${label(audience)} needs.`,
  ];
  return variants[seed % variants.length];
}

function buildIntro(tool: string, intent: string, audience: string, task: string, modifier: string, clusterKey: ClusterKey, seed: number): string {
  const ac = audienceContext[audience] ?? { focus: 'development quality', concern: 'data correctness', workflow: 'within your development process' };
  const cd = clusterDomain[clusterKey];
  const tc = taskContext[task] ?? { scenario: 'completing a development task', urgency: 'important for project quality', outcome: 'achieve the desired result efficiently' };
  const variants = [
    `As a ${label(audience)} focused on ${ac.focus}, you can ${label(intent)} using the browser-based ${getToolName(tool)}. ${cd.importance}, and this guide walks through the process ${label(modifier)}. The scenario here is ${tc.scenario}, which is ${tc.urgency}. By the end, you will ${tc.outcome} — all without sending data to an external server.`,
    `This page explains how a ${label(audience)} can approach ${label(intent)} with ${getToolName(tool)}, ${label(modifier)}. In the context of ${cd.field}, ${cd.importance.toLowerCase()}. The specific focus is on ${tc.scenario}, and the goal is to ${tc.outcome}. Every step runs locally in your browser, so your data stays private — an important consideration given ${ac.concern}.`,
    `When ${tc.scenario}, a ${label(audience)} needs reliable tools for ${label(intent)}. ${getToolName(tool)} handles this ${label(modifier)}, with all processing happening locally in your browser. This is particularly relevant because ${cd.importance.toLowerCase()}. The workflow is designed ${ac.workflow}, with the goal to ${tc.outcome}.`,
  ];
  return variants[seed % variants.length];
}

function buildSteps(intent: string, tool: string, task: string, audience: string, clusterKey: ClusterKey, seed: number): string[] {
  const ac = audienceContext[audience] ?? { focus: 'development quality', concern: 'data correctness', workflow: 'within your development process' };
  const tc = taskContext[task] ?? { scenario: 'completing a task', urgency: 'important', outcome: 'achieve the result' };
  const steps = [
    `Identify the scope of your task: ${tc.scenario}. Start by gathering a representative sample of the data you need to process.`,
    `Open the ${getToolName(tool)} from the DevSolve tools directory. The tool loads entirely in your browser with no server dependency.`,
    `Paste or type your input for the ${label(intent)} operation. If working with sensitive data, verify that your browser environment is secure.`,
    `Configure the tool options to match your requirements. Pay attention to settings that affect ${ac.focus}.`,
    `Execute the operation and carefully review the output. Check for edge cases related to ${ac.concern}.`,
    `Validate the result against your expectations. For ${tc.scenario}, the goal is to ${tc.outcome}.`,
  ];
  return seededShuffle(steps, seed).slice(0, 6);
}

function buildFAQ(clusterKey: ClusterKey, tool: string, audience: string, intent: string, task: string, seed: number): { question: string; answer: string }[] {
  const toolName = getToolName(tool);
  const cd = clusterDomain[clusterKey];
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };
  const faqs = [
    { question: `Is my data safe when using ${toolName}?`, answer: `Yes. ${toolName} runs entirely in your browser. No data is sent to any external server, making it safe for working with sensitive or proprietary information.` },
    { question: `Can I use ${toolName} for ${label(intent)} in a production workflow?`, answer: `${toolName} is ideal for ad-hoc tasks, quick validation, and prototyping. For production pipelines, consider integrating the equivalent logic into your codebase with proper test coverage.` },
    { question: `What are the limitations when working with large inputs?`, answer: `Browser-based tools are constrained by available memory. Very large inputs (over 10 MB) may cause slowdown. For batch processing, consider a command-line alternative.` },
    { question: `How does this relate to ${cd.field}?`, answer: `${cd.importance}. ${toolName} provides a quick, accessible way to handle common ${cd.field} tasks without requiring installation or configuration.` },
    { question: `What should a ${label(audience)} focus on when using this tool?`, answer: `Pay special attention to ${ac.concern}. Since your primary focus is ${ac.focus}, verify that the tool output meets those requirements before using it further.` },
  ];
  return seededShuffle(faqs, seed + 31).slice(0, 4);
}

function buildProTips(clusterKey: ClusterKey, audience: string, tool: string, task: string, seed: number): string[] {
  const ac = audienceContext[audience] ?? { focus: 'quality', concern: 'correctness', workflow: 'your workflow' };
  const cd = clusterDomain[clusterKey];
  const tips = [
    `Bookmark ${getToolName(tool)} for quick access — ${cd.field} tasks come up frequently in ${label(audience)} work.`,
    `${cd.bestPractice} — this is especially important when ${ac.concern} is a factor.`,
    `When working on ${label(task)}, start with the smallest reproducible input to save time and reduce complexity.`,
    `Since ${getToolName(tool)} runs entirely in your browser, you can use it offline or in air-gapped environments where network access is restricted.`,
  ];
  return seededShuffle(tips, seed + 17).slice(0, 3);
}

/* ------------------------------------------------------------------ */
/*  Page resolution                                                    */
/* ------------------------------------------------------------------ */

export interface EdgeProgrammaticPage {
  slug: string;
  canonicalSlug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  steps: string[];
  faq: { question: string; answer: string }[];
  proTips: string[];
  primaryTool: string;
  clusterKey: ClusterKey;
  intent: string;
  audience: string;
  task: string;
  keywords: string[];
}

function getSlugByIndex(index: number): string | undefined {
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

function getPageByIndex(index: number): EdgeProgrammaticPage | undefined {
  if (index < 0 || index >= TARGET_TOTAL) return undefined;

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

  return {
    slug,
    canonicalSlug: slug,
    title,
    description: buildDescription(pair.tool, pair.intent, audience, task, modifier, pair.cluster.key, seed),
    h1: buildH1(pair.intent, audience, pair.cluster.key, seed),
    intro: buildIntro(pair.tool, pair.intent, audience, task, modifier, pair.cluster.key, seed),
    steps: buildSteps(pair.intent, pair.tool, task, audience, pair.cluster.key, seed),
    faq: buildFAQ(pair.cluster.key, pair.tool, audience, pair.intent, task, seed),
    proTips: buildProTips(pair.cluster.key, audience, pair.tool, task, seed),
    primaryTool: pair.tool,
    clusterKey: pair.cluster.key,
    intent: pair.intent,
    audience,
    task,
    keywords: [pair.cluster.key, pair.tool, pair.intent, audience, task, 'online', 'browser-based', 'developer-tools'],
  };
}

function getProgrammaticPageBySlug(slug: string): EdgeProgrammaticPage | undefined {
  const match = slug.match(/-(\d+)$/);
  if (!match) return undefined;
  const index = parseInt(match[1], 10);
  const page = getPageByIndex(index);
  if (!page || page.slug !== slug) return undefined;
  return page;
}

function tryResolveLegacySlug(slug: string): EdgeProgrammaticPage | undefined {
  const match = slug.match(/^(.*)-(\d+)$/);
  if (!match) return undefined;

  const stem = match[1];
  const legacyIndex = parseInt(match[2], 10);
  if (!Number.isFinite(legacyIndex) || legacyIndex < 0) return undefined;

  const cluster = clusters.find((item) => stem.startsWith(`${item.key}-`));
  if (!cluster) return undefined;

  let cursor = stem.slice(cluster.key.length + 1);

  const intents = Array.from(new Set(clusters.flatMap((item) => item.intents))).sort((a, b) => b.length - a.length);
  const audiencesSorted = [...audiences].sort((a, b) => b.length - a.length);
  const tasksSorted = [...tasks].sort((a, b) => b.length - a.length);

  const intent = intents.find((c) => cursor.startsWith(`${c}-`));
  if (!intent) return undefined;
  cursor = cursor.slice(intent.length + 1);

  const audience = audiencesSorted.find((c) => cursor.startsWith(`${c}-`));
  if (!audience) return undefined;
  cursor = cursor.slice(audience.length + 1);

  const task = tasksSorted.find((c) => cursor.startsWith(`${c}-`));
  if (!task) return undefined;
  cursor = cursor.slice(task.length + 1);

  const tool = cluster.tools.find((c) => c === cursor);
  if (!tool) return undefined;

  const pairIdx = toolIntentPairs.findIndex(
    (p) => p.cluster.key === cluster.key && p.intent === intent && p.tool === tool,
  );
  if (pairIdx < 0) return undefined;

  const audienceIdx = audiences.indexOf(audience);
  const taskIdx = tasks.indexOf(task);
  if (audienceIdx < 0 || taskIdx < 0) return undefined;

  const modifierIdx = legacyIndex % MODIFIERS_COUNT;
  const remappedIndex = pairIdx * PER_PAIR + audienceIdx * TASKS_COUNT * MODIFIERS_COUNT + taskIdx * MODIFIERS_COUNT + modifierIdx;

  return getPageByIndex(remappedIndex);
}

export function resolveEdgeProgrammaticPage(slug: string): EdgeProgrammaticPage | undefined {
  const directPage = getProgrammaticPageBySlug(slug);
  if (directPage) return directPage;

  const legacyPage = tryResolveLegacySlug(slug);
  if (!legacyPage) return undefined;

  return { ...legacyPage, canonicalSlug: legacyPage.slug };
}

/* ------------------------------------------------------------------ */
/*  HTML renderer                                                      */
/* ------------------------------------------------------------------ */

export function renderProgrammaticPageHtml(page: EdgeProgrammaticPage): string {
  const canonicalUrl = `${SITE_URL}/k/${page.canonicalSlug}`;
  const toolUrl = `${SITE_URL}/tools/${page.primaryTool}`;
  const toolName = getToolName(page.primaryTool);

  const baseMs = Date.parse(CONTENT_UPDATED_AT || LAUNCH_DATE);
  const dayOffset = hashString(page.canonicalSlug) % 30;
  const dateModified = new Date(baseMs - dayOffset * 86_400_000).toISOString();

  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  });

  const articleJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.h1,
    description: page.description,
    url: canonicalUrl,
    datePublished: LAUNCH_DATE,
    dateModified,
    author: { '@type': 'Organization', name: 'DevSolve Editorial Team', url: `${SITE_URL}/about` },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    inLanguage: 'en',
    isAccessibleForFree: true,
  });

  const breadcrumbJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE_URL}/tools` },
      { '@type': 'ListItem', position: 3, name: page.title, item: canonicalUrl },
    ],
  });

  const stepsHtml = page.steps
    .map((step, i) => `<li><span class="step-num">${i + 1}</span><span>${escapeHtml(step)}</span></li>`)
    .join('\n');

  const faqHtml = page.faq
    .map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`)
    .join('\n');

  const tipsHtml = page.proTips
    .map((tip) => `<li>${escapeHtml(tip)}</li>`)
    .join('\n');

  const keywordsStr = page.keywords.join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(page.title)} — ${SITE_NAME}</title>
<meta name="description" content="${escapeHtml(page.description)}"/>
<meta name="keywords" content="${escapeHtml(keywordsStr)}"/>
<link rel="canonical" href="${canonicalUrl}"/>
<meta property="og:title" content="${escapeHtml(page.title)}"/>
<meta property="og:description" content="${escapeHtml(page.description)}"/>
<meta property="og:url" content="${canonicalUrl}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="${SITE_NAME}"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${escapeHtml(page.title)}"/>
<meta name="twitter:description" content="${escapeHtml(page.description)}"/>
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<script type="application/ld+json">${faqJsonLd}</script>
<script type="application/ld+json">${articleJsonLd}</script>
<script type="application/ld+json">${breadcrumbJsonLd}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1a1a2e;background:#fafbfc;padding:0}
.container{max-width:820px;margin:0 auto;padding:2rem 1.5rem}
nav{background:#fff;border-bottom:1px solid #e5e7eb;padding:.75rem 1.5rem}
nav a{color:#6366f1;text-decoration:none;font-size:.875rem}
nav span{color:#9ca3af;margin:0 .5rem}
h1{font-size:1.875rem;font-weight:700;margin:1.5rem 0 1rem;color:#1a1a2e;line-height:1.3}
h2{font-size:1.25rem;font-weight:600;margin:2rem 0 .75rem;color:#1a1a2e}
p{margin:.75rem 0;color:#374151}
.intro{font-size:1.05rem;color:#4b5563;margin-bottom:1.5rem;line-height:1.8}
.badge{display:inline-flex;align-items:center;gap:.375rem;padding:.25rem .75rem;background:#eef2ff;color:#4338ca;border-radius:9999px;font-size:.75rem;font-weight:500;margin-right:.5rem;margin-bottom:.5rem}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:.75rem;padding:1.5rem;margin:1.5rem 0}
ol{list-style:none;padding:0}
ol li{display:flex;align-items:flex-start;gap:.75rem;margin:.75rem 0;font-size:.925rem;color:#374151}
.step-num{display:flex;align-items:center;justify-content:center;min-width:1.75rem;height:1.75rem;background:#6366f1;color:#fff;border-radius:50%;font-size:.75rem;font-weight:600}
details{border:1px solid #e5e7eb;border-radius:.5rem;padding:1rem;margin:.5rem 0}
summary{cursor:pointer;font-weight:500;color:#1a1a2e}
details p{margin-top:.5rem;color:#4b5563;font-size:.9rem}
ul{padding-left:1.25rem}
ul li{margin:.5rem 0;color:#374151;font-size:.925rem}
.cta{display:inline-flex;align-items:center;gap:.5rem;padding:.75rem 1.5rem;background:#6366f1;color:#fff;border-radius:.5rem;text-decoration:none;font-weight:500;margin:1rem 0}
.cta:hover{background:#4f46e5}
footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid #e5e7eb;text-align:center;font-size:.8rem;color:#9ca3af}
footer a{color:#6366f1;text-decoration:none}
@media(max-width:640px){.container{padding:1rem}h1{font-size:1.5rem}}
</style>
</head>
<body>
<nav>
<a href="/">Home</a><span>/</span><a href="/tools">Tools</a><span>/</span><span>${escapeHtml(page.title)}</span>
</nav>
<div class="container">
<h1>${escapeHtml(page.h1)}</h1>
<div style="margin-bottom:1rem">
<span class="badge">🔒 Runs locally in your browser</span>
<span class="badge">🛠️ ${escapeHtml(toolName)}</span>
<span class="badge">${escapeHtml(page.clusterKey)}</span>
</div>
<p class="intro">${escapeHtml(page.intro)}</p>

<a class="cta" href="${toolUrl}">Open ${escapeHtml(toolName)} →</a>

<div class="card">
<h2>Step-by-Step Guide</h2>
<ol>${stepsHtml}</ol>
</div>

<div class="card">
<h2>Pro Tips</h2>
<ul>${tipsHtml}</ul>
</div>

<div class="card">
<h2>Frequently Asked Questions</h2>
${faqHtml}
</div>

<div class="card">
<h2>Related Resources</h2>
<p><a href="${toolUrl}">${escapeHtml(toolName)} — Free Online Tool</a></p>
<p><a href="/tools">Browse All Developer Tools</a></p>
<p><a href="/guides">Developer Guides & Tutorials</a></p>
</div>

<footer>
<p>© ${new Date().getFullYear()} <a href="/">${SITE_NAME}</a> · Privacy-First Developer Tools</p>
<p style="margin-top:.5rem"><a href="/legal/privacy">Privacy Policy</a> · <a href="/about">About</a> · <a href="/contact">Contact</a></p>
</footer>
</div>
</body>
</html>`;
}

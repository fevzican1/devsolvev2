import { toolRegistry } from '@/tools/registry';
import { hashString } from '@/lib/utils';

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

/* Global audience variants (15) — each represents a genuinely different developer role */
const audiences = [
  'backend-engineer', 'frontend-developer', 'fullstack-developer',
  'api-consumer', 'integration-engineer', 'security-conscious-developer',
  'ops-engineer', 'devops-engineer', 'technical-writer', 'data-engineer',
  'mobile-developer', 'qa-engineer', 'site-reliability-engineer',
  'database-administrator', 'cloud-architect',
];

/* Global task variants (12) — each describes a distinct real-world scenario */
const tasks = [
  'debug-production-issue', 'prepare-api-response', 'clean-up-payload',
  'sanitize-user-input', 'prepare-query-parameters', 'inspect-encoded-payload',
  'trace-request', 'validate-auth-token', 'review-config-change',
  'migrate-legacy-system', 'prepare-deployment-artifact', 'document-api-endpoint',
];

/* Content modifier patterns (64) – derived from execution style x delivery context */
const modifierExecutionStyles = [
  'without-installing-cli-tools',
  'directly-in-your-browser',
  'with-step-by-step-instructions',
  'with-safe-local-processing',
  'while-keeping-data-private',
  'for-quick-prototyping',
  'during-code-review',
  'as-part-of-ci-cd-pipeline',
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

const AUDIENCES_COUNT = audiences.length;        // 15
const TASKS_COUNT = tasks.length;                // 12
const MODIFIERS_COUNT = modifierPatterns.length; // 64
const PER_PAIR = AUDIENCES_COUNT * TASKS_COUNT * MODIFIERS_COUNT; // 11520
const TOTAL_POSSIBLE = toolIntentPairs.length * PER_PAIR;          // 348 × 11520 = 4008960
const TARGET_TOTAL = Math.min(4_000_000, TOTAL_POSSIBLE);

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
};

/* ------------------------------------------------------------------ */
/*  Title & H1 builders — varied by cluster for uniqueness             */
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

  const faqs = [
    { question: `Is my data safe when using ${toolName}?`, answer: `Yes. ${toolName} runs entirely in your browser. No data is sent to any external server, making it safe for working with sensitive or proprietary information.` },
    { question: `Can I use ${toolName} for ${label(intent)} in a production workflow?`, answer: `${toolName} is ideal for ad-hoc tasks, quick validation, and prototyping. For production pipelines, consider integrating the equivalent logic into your codebase with proper test coverage.` },
    { question: `What are the limitations when working with large inputs?`, answer: `Browser-based tools are constrained by available memory. Very large inputs (over 10 MB) may cause slowdown. For batch processing or very large files, consider a command-line alternative.` },
    { question: `How does this relate to ${cd.field}?`, answer: `${cd.importance}. ${toolName} provides a quick, accessible way to handle common ${cd.field} tasks without requiring installation or configuration.` },
    { question: `What should a ${label(audience)} focus on when using this tool?`, answer: `Pay special attention to ${ac.concern}. Since your primary focus is ${ac.focus}, verify that the tool output meets those requirements before using it further.` },
    { question: `Can I automate this ${label(intent)} process?`, answer: `While ${toolName} is a manual tool, the same logic can be implemented in code using standard libraries. The browser tool is useful for validating that your automated implementation produces correct results.` },
    { question: `Is this tool suitable for ${label(task)}?`, answer: `Yes, particularly for the initial investigation and validation phases. For ${label(task)}, using a browser-based tool lets you quickly test hypotheses without setting up a full development environment.` },
  ];

  const shuffled = seededShuffle(faqs, seed + 31);
  return shuffled.slice(0, 4);
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
    ],
    encoding: [
      `Encoding errors are among the most insidious bugs in software systems because they often produce output that looks correct but contains subtle corruption. When a ${label(audience)} needs to ${label(intent)}, understanding the encoding chain is critical. Data may pass through multiple encoding layers — URL encoding at the HTTP level, HTML entity encoding in the DOM, and Base64 encoding for binary transport. Each layer has its own escape rules, and applying them in the wrong order creates double-encoding or partial-decoding bugs that are notoriously difficult to trace.`,
      `The distinction between encoding and encryption is frequently confused in practice. Encoding transforms data for safe transport or storage but provides no security guarantees — Base64-encoded data, for instance, can be decoded by anyone. For ${label(audience)} professionals working on ${tc.scenario}, this distinction matters because sensitive data should never rely on encoding alone for protection. ${toolName} processes data locally, ensuring that even when inspecting encoded payloads, the content never leaves your browser.`,
      `Unicode normalization is a critical consideration that many developers overlook. The same visual character can have multiple valid Unicode representations (NFC, NFD, NFKC, NFKD), which means string comparison may fail even when characters look identical. When ${label(intent)}, verify that your encoding pipeline handles normalization consistently, especially when dealing with user-generated content that may contain combining characters or variant selectors.`,
      `Base64 encoding increases data size by approximately 33%, which can have significant implications for payload-sensitive applications. For ${label(audience)} teams working on ${tc.scenario}, this overhead should be factored into bandwidth calculations, storage estimates, and API rate limit planning. ${toolName} provides immediate visibility into the size impact of encoding operations, helping you make informed decisions about when encoding is necessary versus when raw binary transport might be more efficient.`,
    ],
    security: [
      `Token-based authentication systems require careful handling at every stage of the lifecycle. For a ${label(audience)} working on ${tc.scenario}, understanding JWT structure is essential: the header specifies the algorithm, the payload carries claims, and the signature ensures integrity. ${toolName} allows safe local inspection of these components without transmitting the token to an external service, which is critical because tokens often contain session identifiers, user roles, and expiration timestamps that should remain confidential.`,
      `Hash function selection directly impacts the security guarantees of your system. SHA-256 provides collision resistance suitable for data integrity verification, while bcrypt and Argon2 are designed for password hashing with deliberate computational cost. When ${label(intent)} as a ${label(audience)}, choosing the wrong algorithm can create vulnerabilities — using a fast hash like MD5 for passwords, for example, enables brute-force attacks at billions of attempts per second. Always match the hash function to the security requirement.`,
      `UUID generation appears simple but has important uniqueness considerations. Version 4 UUIDs rely on cryptographic random number generation, providing approximately 122 bits of entropy. The probability of collision is astronomically low but not zero. For ${label(audience)} teams handling ${tc.scenario}, the practical concern is usually not collision probability but rather ensuring the PRNG source is cryptographically secure — browser-based crypto.getRandomValues() satisfies this requirement, while Math.random() does not.`,
      `Token expiration and refresh strategies significantly affect both security and user experience. Short-lived access tokens (15-60 minutes) limit the window of exploitation if a token is compromised, while refresh tokens with longer lifetimes maintain session continuity. When ${tc.scenario}, inspect token claims carefully to verify that expiration times, issuer fields, and audience restrictions match your security requirements. ${toolName} makes this inspection safe by keeping all processing local.`,
    ],
    text: [
      `Regular expression engines vary significantly across programming languages and environments. JavaScript uses a backtracking NFA engine with specific behaviors around Unicode property escapes, lookbehind assertions, and named capture groups that may differ from Python's re module or Perl's regex engine. For a ${label(audience)} working on ${label(intent)}, testing patterns in ${toolName} ensures they behave correctly in the JavaScript runtime, which is particularly important when patterns will be used in both client-side and server-side contexts.`,
      `Text case conversion is more complex than it appears, especially for internationalized content. Turkish locale rules where 'i' uppercases to 'İ' rather than 'I' can break authentication systems that compare usernames case-insensitively. When ${tc.scenario}, verify that your case conversion logic handles locale-specific rules correctly, or explicitly use locale-independent conversion when processing identifiers, URLs, or other machine-readable strings.`,
      `Diff algorithms (Myers, patience, histogram) produce different results for the same input pairs. Myers diff minimizes the edit distance but may produce confusing output when lines are moved rather than changed. Patience diff prioritizes matching unique lines, producing more intuitive results for code and configuration changes. For ${label(audience)} workflows involving ${tc.scenario}, understanding which algorithm your diff tool uses helps you interpret the output correctly and identify the actual semantic changes.`,
      `Whitespace handling in text processing deserves explicit specification. Tabs versus spaces, trailing whitespace, line ending conventions (LF vs CRLF), and zero-width characters can all produce visually identical text that differs at the byte level. When ${label(intent)}, normalize whitespace conventions early in your pipeline to prevent phantom differences from obscuring real changes. This is particularly important for ${label(audience)} professionals working on ${tc.scenario}.`,
    ],
    formatting: [
      `Code formatting serves a dual purpose: improving human readability and establishing consistency across a codebase. For ${label(audience)} teams, consistent formatting reduces cognitive load during code review and makes it easier to identify meaningful changes in version control diffs. When ${label(intent)} using ${toolName}, the formatted output provides a baseline that your team can evaluate against established style guidelines before adopting it as a standard.`,
      `SQL formatting deserves special attention because whitespace and line breaks affect both readability and, in some cases, behavior. While most SQL engines treat whitespace as insignificant, the visual structure of a query directly impacts a developer's ability to understand the join logic, filter conditions, and aggregation pipeline. For ${tc.scenario}, properly formatted SQL helps ${label(audience)} professionals identify potential performance issues by making the query structure explicit.`,
      `CSS minification removes whitespace, comments, and redundant declarations to reduce file size, but it can introduce subtle issues. Shorthand property conflicts, calc() expression spacing, and custom property fallbacks may behave differently when minified. For ${label(audience)} teams working on ${tc.scenario}, always test minified output in the target browsers before deployment. ${toolName} provides an immediate preview of the minification result so you can catch issues early.`,
      `Markdown rendering varies across implementations, and this inconsistency can affect documentation quality. CommonMark provides a formal specification, but many parsers extend it with features like tables, task lists, and footnotes. When ${label(intent)}, use ${toolName} to verify that your markdown renders correctly and that links, code blocks, and embedded HTML all display as intended in the target rendering environment.`,
    ],
    api: [
      `API schema versioning is a critical practice that prevents breaking changes from disrupting consumers. When a ${label(audience)} needs to ${label(intent)}, understanding the current schema version and any deprecated fields is essential. ${toolName} helps validate that API responses conform to the expected structure, catching field removals, type changes, and new required fields before they cause runtime failures in client applications.`,
      `HTTP content negotiation determines how request and response bodies are encoded, compressed, and parsed. The Accept and Content-Type headers must align between client and server for successful communication. When ${tc.scenario}, incorrect content type declarations can cause parsers to fail silently or produce garbled output. Use ${toolName} to inspect and validate the actual payload format independently of the declared content type.`,
      `Rate limiting and pagination strategies significantly impact API integration reliability. For ${label(audience)} professionals, understanding cursor-based versus offset-based pagination, exponential backoff requirements, and rate limit reset headers is essential when building robust integrations. When ${tc.scenario}, test your integration logic with both normal and edge-case responses to ensure it handles pagination boundaries and rate limit responses gracefully.`,
      `Error response standardization (RFC 7807 Problem Details) helps API consumers handle failures consistently. When ${label(intent)}, verify that error responses include the type, title, status, detail, and instance fields that consumers need for proper error handling. ${toolName} can help validate error response structures alongside success responses, ensuring that your API communicates failures as clearly as it communicates successes.`,
    ],
    data: [
      `Data schema evolution is one of the most challenging aspects of maintaining production data pipelines. When adding new fields, changing types, or removing deprecated columns, backward compatibility must be preserved to prevent downstream failures. For a ${label(audience)} working on ${tc.scenario}, using ${toolName} to compare before-and-after schemas helps identify breaking changes before they reach production. Schema registries and versioned type definitions provide additional safety nets for data-intensive systems.`,
      `Type inference from JSON samples is inherently approximate — a single sample cannot capture the full range of possible values. Fields that appear as integers in one sample may be floats or nulls in others. For ${label(audience)} teams working on ${label(intent)}, generated types should be treated as a starting point rather than a definitive contract. Cross-reference with API documentation, database schemas, and multiple representative samples to build accurate, complete type definitions.`,
      `Data fingerprinting through hashing enables efficient change detection without comparing full payloads. However, hash-based comparison requires consistent input normalization — JSON key ordering, whitespace handling, and numeric formatting must all be deterministic for the same logical data to produce the same hash. When ${tc.scenario}, establish clear normalization rules and document them so that all systems in the pipeline produce consistent hashes.`,
      `Binary-to-text encoding (Base64, hex) is frequently used in data pipelines for transporting binary content through text-based channels like JSON APIs or CSV files. Each encoding scheme has different trade-offs: Base64 is space-efficient but unreadable, hex is readable but doubles the size. For ${label(audience)} professionals, choosing the right encoding depends on whether the priority is debugging visibility, transmission efficiency, or compatibility with downstream systems.`,
    ],
    debugging: [
      `Systematic debugging follows a scientific methodology: observe the symptom, form a hypothesis, design a test, and either confirm or revise. For a ${label(audience)} working on ${tc.scenario}, ${toolName} serves as the testing apparatus — it allows you to isolate variables by processing individual data transformations in a controlled environment. This approach is more efficient than adding log statements to production code and reduces the risk of introducing new bugs during the investigation.`,
      `Configuration drift is a common source of production issues that is difficult to detect through code review alone. When the same application runs in multiple environments (development, staging, production), subtle differences in configuration values can produce different behavior. For ${label(audience)} teams, comparing configuration files using diff tools reveals these discrepancies before they cause incidents. ${toolName} helps visualize the exact differences between configuration versions.`,
      `Log analysis patterns can be enhanced by using structured logging (JSON format) rather than unstructured text. Structured logs are machine-parseable, searchable, and aggregatable, making it possible to correlate events across distributed systems. When ${tc.scenario}, use ${toolName} to format and inspect log entries, identify recurring patterns, and build targeted search queries that filter noise and surface the events relevant to the investigation.`,
      `Root cause analysis often requires examining data transformations at multiple points in the pipeline. A bug in the final output may originate several steps upstream, where a format conversion, encoding change, or type coercion introduced the error. For ${label(audience)} professionals, using ${toolName} at each transformation step creates a traceable chain of evidence that pinpoints exactly where the data diverges from the expected format.`,
    ],
    automation: [
      `Cron expression semantics vary across implementations, which can lead to scheduling surprises. The standard five-field format (minute, hour, day-of-month, month, day-of-week) is widely supported, but extensions like seconds fields, year fields, and named ranges differ between cron daemons, CI/CD platforms, and cloud schedulers. For a ${label(audience)} working on ${tc.scenario}, validating cron expressions with ${toolName} prevents scheduling errors that might go undetected until the task fails to run at the expected time.`,
      `Idempotency is a critical design principle for automated tasks. When a scheduled job runs multiple times — due to retries, overlapping executions, or scheduler failures — it should produce the same result as a single execution. For ${label(audience)} teams, designing idempotent operations means using unique identifiers (UUIDs) for records, checking for existing results before creating new ones, and separating the side-effect-producing step from the data preparation step.`,
      `Extraction patterns for log analysis and data processing must balance specificity with resilience. Overly specific regex patterns break when log formats change slightly, while overly broad patterns capture unintended content. For ${label(audience)} professionals working on ${tc.scenario}, test extraction patterns against both current and historical log samples to ensure they handle format variations gracefully. ${toolName} provides a safe environment for iterating on pattern design.`,
      `Monitoring and alerting for automated tasks should cover both failure detection and correctness verification. A task that completes successfully but produces incorrect output is often more dangerous than one that fails visibly. For ${label(audience)} teams, implement data quality checks alongside execution monitoring — verify record counts, check for null values in required fields, and compare output statistics against expected baselines.`,
    ],
    web: [
      `Cross-site scripting (XSS) prevention requires a defense-in-depth approach. Output encoding (HTML entity encoding for HTML contexts, JavaScript escaping for script contexts, URL encoding for URL contexts) is the primary defense, but Content Security Policy headers, strict input validation, and DOM-based sanitization provide additional layers. For a ${label(audience)} working on ${tc.scenario}, ${toolName} helps verify that encoding transformations produce safe output for the target context.`,
      `CSS optimization goes beyond simple minification. Removing unused rules (tree-shaking), combining duplicate selectors, shorthand property consolidation, and critical CSS extraction can reduce stylesheet size by 50-80% in large applications. For ${label(audience)} teams, the challenge is ensuring that optimization does not change the visual rendering. ${toolName} provides a quick way to compare the minified output and verify that no semantic CSS changes were introduced during the optimization process.`,
      `Content rendering performance directly impacts Core Web Vitals scores, which affect search engine rankings. Largest Contentful Paint (LCP), First Input Delay (FID), and Cumulative Layout Shift (CLS) are all influenced by how content is encoded, compressed, and delivered. For ${label(audience)} professionals working on ${tc.scenario}, optimizing web assets is not just about reducing file sizes — it is about ensuring that the most important content renders quickly and remains stable during page load.`,
      `Form data handling across different content types (application/x-www-form-urlencoded, multipart/form-data, application/json) requires careful attention to encoding rules. URL-encoded form data treats spaces as '+' while URI encoding uses '%20', and multipart boundaries must not appear in the encoded content. When ${label(intent)}, verify that the encoding matches the server's expectations and that special characters survive the encoding roundtrip without corruption.`,
    ],
  };

  const pool = analysisPool[clusterKey] ?? analysisPool.json;
  const shuffled = seededShuffle(pool, seed + 43);
  return shuffled.slice(0, 3);
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
    ],
    encoding: [
      `URL-safe Base64 (RFC 4648 §5) replaces '+' with '-' and '/' with '_', eliminating the need for percent-encoding in URLs. When building APIs or sharing encoded data in URLs, prefer URL-safe Base64 to avoid double-encoding issues.`,
      `Content-Transfer-Encoding headers in email systems use different Base64 line-wrapping rules than web APIs. When debugging encoding issues across email and web systems, verify which Base64 variant each system expects.`,
      `Percent-encoding in URLs follows specific rules: RFC 3986 defines which characters must be encoded, but form encoding (application/x-www-form-urlencoded) uses '+' for spaces instead of '%20'. This subtle difference causes bugs when switching between URL construction and form data encoding.`,
      `When working with international domain names (IDN), Punycode encoding converts Unicode domains to ASCII-compatible form. Use ${toolName} to verify that domain encoding roundtrips correctly, especially when domain names contain characters from non-Latin scripts.`,
    ],
    security: [
      `JWT tokens should never be stored in localStorage due to XSS vulnerability exposure. HttpOnly cookies with SameSite attributes provide stronger protection. Use ${toolName} to inspect token contents during development, but ensure production code handles tokens through secure cookie mechanisms.`,
      `Hash-based message authentication codes (HMAC) combine a hash function with a secret key to verify both data integrity and authentication. Unlike plain hashes, HMAC prevents length extension attacks. When building verification systems as a ${label(audience)}, always prefer HMAC over raw hashing for authentication purposes.`,
      `Certificate transparency logs provide a public record of all certificates issued for a domain. For ${label(audience)} professionals concerned about ${ac.concern}, monitoring these logs helps detect unauthorized certificate issuance that could enable man-in-the-middle attacks.`,
      `Timing-safe comparison functions prevent side-channel attacks when comparing hashes or tokens. Regular string comparison short-circuits on the first mismatch, leaking information about the correct value. Use constant-time comparison functions in all security-critical comparisons.`,
    ],
    text: [
      `Named capture groups in regex (?<name>pattern) make patterns self-documenting and the extracted values easier to work with in code. When building complex patterns for ${label(intent)}, use named groups to improve readability and maintainability.`,
      `Atomic groups (?>...) and possessive quantifiers prevent backtracking in regex engines, which can prevent catastrophic backtracking that causes exponential time complexity. For patterns that will process untrusted input, consider the regex denial-of-service (ReDoS) risk.`,
      `Unicode-aware text processing requires explicit consideration of grapheme clusters versus code points. A single visible character (like a flag emoji) may consist of multiple Unicode code points. When measuring text length or truncating content, use grapheme-aware methods to avoid splitting characters.`,
      `Diff output formats (unified, context, side-by-side) serve different review workflows. Unified diff is compact and widely supported in version control, while side-by-side comparison is more intuitive for manual review. Choose the format that best supports your team's review process for ${tc.scenario}.`,
    ],
    formatting: [
      `SQL formatting conventions vary by team and database engine. The Rivers and Holywell SQL style guides provide structured approaches. When standardizing SQL formatting for ${label(audience)} teams, document the chosen convention and configure automated formatting to enforce it consistently.`,
      `Critical CSS extraction identifies the styles needed for above-the-fold content and inlines them in the HTML document, reducing the render-blocking impact of external stylesheets. This technique can significantly improve Largest Contentful Paint scores for content-heavy pages.`,
      `Markdown link reference definitions ([link text][id] with [id]: url) separate content from URLs, making documents easier to read and maintain. For ${label(audience)} professionals creating documentation, this pattern reduces visual clutter and makes URL updates easier to manage.`,
      `Preserving code semantics during formatting requires understanding language-specific rules. Python's significant whitespace, Makefile's required tabs, and YAML's indentation-based structure all constrain how formatting tools can modify these files. Always verify that formatted output preserves the original program behavior.`,
    ],
    api: [
      `GraphQL introspection queries expose the full API schema, which is useful during development but should be disabled in production to prevent information leakage. When using ${toolName} to explore API responses, be aware that introspection results may reveal internal implementation details.`,
      `HTTP caching headers (ETag, Last-Modified, Cache-Control) significantly affect API performance and behavior. When debugging API integration issues as a ${label(audience)}, verify that caching is not serving stale responses by checking these headers alongside the response body.`,
      `API pagination cursors should be opaque to consumers — encoding implementation details (like database offsets) in cursors creates tight coupling that breaks when the underlying data store changes. When designing pagination for ${label(intent)}, use encrypted or hashed cursors that consumers cannot parse or manipulate.`,
      `Webhook delivery reliability requires implementing retry logic with exponential backoff on the provider side and idempotency keys on the consumer side. When ${tc.scenario}, verify that your webhook handler can safely process the same event multiple times without creating duplicate side effects.`,
    ],
    data: [
      `Schema registries (like Confluent Schema Registry for Avro/Protobuf) enforce backward and forward compatibility rules automatically. For ${label(audience)} teams, integrating schema validation into the CI/CD pipeline prevents incompatible schema changes from reaching production.`,
      `Data lineage tracking records the origin, transformations, and destination of every data element. When debugging data quality issues during ${tc.scenario}, lineage information helps trace the exact point where corruption or loss occurred, significantly reducing investigation time.`,
      `Bloom filters provide probabilistic set membership testing with guaranteed zero false negatives. For ${label(audience)} professionals working with large datasets, Bloom filters can efficiently pre-filter data before expensive exact lookups, reducing processing time for common operations like deduplication.`,
      `Data serialization format selection (JSON, Protocol Buffers, Avro, MessagePack) should consider schema evolution needs, human readability, compression ratio, and parsing performance. For ${tc.scenario}, the right format depends on whether the primary consumer is a human debugger or a high-throughput data pipeline.`,
    ],
    debugging: [
      `Binary search debugging (git bisect for code, or manual bisection for data) efficiently identifies the exact change that introduced a bug. For a ${label(audience)} with a large number of potential causes, bisection reduces the search space logarithmically, finding the root cause in O(log n) steps instead of O(n).`,
      `Memory profiling in browser-based tools is accessible through DevTools' Heap Snapshot and Allocation Timeline features. When ${label(intent)}, understanding memory patterns helps identify leaks caused by retained closures, detached DOM nodes, or accumulating event listeners.`,
      `Distributed tracing with correlation IDs allows tracking a single request across multiple services. For ${label(audience)} teams debugging cross-service issues during ${tc.scenario}, propagating trace context headers (W3C Trace Context standard) through every service boundary is essential for end-to-end visibility.`,
      `Canary deployments help isolate whether an issue is caused by a code change or an environmental factor. By routing a small percentage of traffic to the new version and comparing metrics, ${label(audience)} professionals can detect regressions before they affect all users.`,
    ],
    automation: [
      `Dead letter queues capture failed automated task executions for later analysis and replay. For ${label(audience)} teams, implementing DLQ processing ensures that transient failures do not cause permanent data loss, and provides a record of what went wrong for debugging.`,
      `Infrastructure as Code (IaC) tools like Terraform and Pulumi enable version-controlled, reviewable automation of infrastructure changes. When ${tc.scenario}, treating infrastructure changes like code changes — with pull requests, reviews, and automated testing — prevents configuration errors.`,
      `Circuit breaker patterns prevent automated tasks from overwhelming failing downstream services. For ${label(audience)} professionals, implementing circuit breakers in automated workflows means that temporary service disruptions do not cascade into system-wide failures.`,
      `Event sourcing captures every state change as an immutable event, enabling perfect audit trails and the ability to replay history. For automated data processing pipelines, event sourcing provides the ability to rebuild state from scratch if corruption is detected during ${tc.scenario}.`,
    ],
    web: [
      `Subresource Integrity (SRI) attributes on script and link tags ensure that CDN-served files have not been tampered with. For ${label(audience)} teams, adding integrity hashes to third-party resources prevents supply chain attacks where a compromised CDN serves malicious content.`,
      `Service Workers enable sophisticated caching strategies (cache-first, network-first, stale-while-revalidate) that can significantly improve web application performance. When ${label(intent)}, consider how cached content interacts with your content update strategy to prevent users from seeing stale data.`,
      `Content Security Policy (CSP) headers provide defense-in-depth against XSS by whitelisting allowed content sources. For ${label(audience)} professionals, implementing CSP in report-only mode first allows you to identify violations without breaking functionality, then gradually tightening the policy.`,
      `HTTP/2 and HTTP/3 multiplexing changes the optimization calculus for web assets. Techniques like CSS sprite sheets and file concatenation, which were beneficial under HTTP/1.1's connection limits, may actually decrease performance under multiplexed protocols. Verify that your optimization strategy matches your deployment protocol.`,
    ],
  };

  const pool = tipsPool[clusterKey] ?? tipsPool.json;
  const shuffled = seededShuffle(pool, seed + 59);
  return shuffled.slice(0, 3);
}

export function getPageByIndex(index: number): ProgrammaticPage | undefined {
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
    title,
    description: `${title} — practical, browser-based workflow for real-world ${label(pair.cluster.key)} engineering tasks, ${label(modifier)}.`,
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
  };
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

/* ------------------------------------------------------------------ */
/*  Helpers for sitemap generation                                     */
/* ------------------------------------------------------------------ */
export function getTotalPageCount(): number {
  return TARGET_TOTAL;
}

export function getSlugByIndex(index: number): string | undefined {
  return getPageByIndex(index)?.slug;
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

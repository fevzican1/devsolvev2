import { toolRegistry } from '@/tools/registry';
import { hashString } from '@/lib/utils';

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
}

type ClusterKey = 'json' | 'encoding' | 'security' | 'text' | 'formatting';

interface ClusterDefinition {
  key: ClusterKey;
  tools: string[];
  intents: string[];
}

/* ------------------------------------------------------------------ */
/*  Expanded cluster definitions – 8 intents per cluster              */
/* ------------------------------------------------------------------ */
const clusters: ClusterDefinition[] = [
  {
    key: 'json',
    tools: ['json-formatter', 'json-to-typescript'],
    intents: [
      'validate-json', 'format-json', 'inspect-json-structure', 'convert-json-to-types',
      'compare-json-objects', 'transform-json-keys', 'extract-json-values', 'merge-json-data',
    ],
  },
  {
    key: 'encoding',
    tools: ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'],
    intents: [
      'encode-data', 'decode-data', 'fix-encoding-bugs', 'convert-character-sets',
      'handle-unicode-text', 'escape-special-characters', 'troubleshoot-encoding-mismatch', 'batch-encode-values',
    ],
  },
  {
    key: 'security',
    tools: ['hash-generator', 'uuid-generator', 'jwt-decoder'],
    intents: [
      'generate-identifiers', 'verify-tokens', 'inspect-signatures', 'audit-token-expiry',
      'hash-sensitive-data', 'generate-secure-keys', 'validate-jwt-claims', 'compare-security-hashes',
    ],
  },
  {
    key: 'text',
    tools: ['text-case-converter', 'diff-checker', 'regex-tester'],
    intents: [
      'normalize-text', 'compare-versions', 'test-regex', 'find-and-replace-patterns',
      'extract-text-segments', 'convert-text-case', 'analyze-text-differences', 'build-regex-patterns',
    ],
  },
  {
    key: 'formatting',
    tools: ['sql-formatter', 'css-minifier', 'markdown-preview'],
    intents: [
      'format-sql', 'minify-assets', 'preview-markdown', 'indent-nested-code',
      'optimize-css-output', 'validate-markdown-syntax', 'beautify-query-strings', 'restructure-code-blocks',
    ],
  },
];

/* Global audience variants (10) */
const audiences = [
  'backend-engineer', 'frontend-developer', 'fullstack-developer',
  'api-consumer', 'integration-engineer', 'security-conscious-developer',
  'ops-engineer', 'devops-engineer', 'technical-writer', 'data-engineer',
];

/* Global task variants (9) */
const tasks = [
  'debug-production-issue', 'prepare-api-response', 'clean-up-payload',
  'sanitize-user-input', 'prepare-query-parameters', 'inspect-encoded-payload',
  'trace-request', 'validate-auth-token', 'review-config-change',
];

/* Content modifier patterns (5) – add variation to descriptions / intros */
const modifierPatterns = [
  'without-installing-cli-tools',
  'directly-in-your-browser',
  'with-step-by-step-instructions',
  'with-safe-local-processing',
  'while-keeping-data-private',
];

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

const AUDIENCES_COUNT = audiences.length;       // 10
const TASKS_COUNT = tasks.length;               // 9
const MODIFIERS_COUNT = modifierPatterns.length; // 5
const PER_PAIR = AUDIENCES_COUNT * TASKS_COUNT * MODIFIERS_COUNT; // 450
const TOTAL_POSSIBLE = toolIntentPairs.length * PER_PAIR;          // 112 × 450 = 50 400
const TARGET_TOTAL = Math.min(50_000, TOTAL_POSSIBLE);

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
/*  Content generators (same quality as before, deterministic)        */
/* ------------------------------------------------------------------ */
function getToolName(slug: string): string {
  return toolRegistry.find((t) => t.slug === slug)?.name ?? slug.replace(/-/g, ' ');
}

function label(s: string): string {
  return s.replace(/-/g, ' ');
}

function buildTitle(tool: string, intent: string, audience: string): string {
  return `How to ${label(intent)} for a ${label(audience)} using ${getToolName(tool)}`;
}

function buildH1(intent: string, audience: string): string {
  return `Practical guide: ${label(intent)} for a ${label(audience)}`;
}

function buildIntro(tool: string, intent: string, audience: string, task: string, modifier: string): string {
  return [
    `This page walks through how a ${label(audience)} can ${label(intent)} using the browser-based ${getToolName(tool)} tool.`,
    'Everything runs locally in your browser, so the data you paste into the tool is not sent to a server.',
    `The focus is on a concrete task: ${label(task)}, with clear steps, common mistakes, and trade-offs you should keep in mind.`,
    `This workflow is designed for use ${label(modifier)}.`,
  ].join(' ');
}

function buildSteps(intent: string, tool: string, task: string, seed: number): string[] {
  const base = [
    `Clarify the task: ${label(task)}, and identify a small, safe sample of data to work with first.`,
    `Open the ${label(tool)} tool in your browser from the DevSolve tools directory.`,
    `Paste or type the relevant input for your ${label(intent)} task into the input area.`,
    `Adjust any available options so they match your environment and expectations before running the action.`,
    `Run the action and review the output carefully, checking for edge cases, encoding issues, or truncation.`,
    `If the result looks correct on the sample, repeat the same steps on the full dataset, keeping a backup of the original.`,
  ];
  const shuffled = [...base];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 5);
}

function buildPitfalls(clusterKey: ClusterKey, seed: number): string[] {
  const generic = [
    'Skipping a quick manual sanity check on a small sample before processing a full dataset.',
    'Relying on default options without confirming how they behave on malformed or edge-case input.',
    'Not keeping a backup of the original input before transforming or minifying it.',
    'Assuming all data is safe to paste without considering secrets, tokens, or production credentials.',
    'Treating the tool output as authoritative without cross-checking against another source of truth.',
  ];
  const specific: Record<ClusterKey, string[]> = {
    json: [
      'Treating a linted or pretty-printed JSON payload as valid without running a real JSON parser.',
      'Forgetting that large numeric values may lose precision if inspected in some environments.',
    ],
    encoding: [
      'Double-encoding values by passing already-encoded data back through the encoder.',
      'Assuming all systems agree on which characters need to be escaped or decoded.',
    ],
    security: [
      'Mixing test and production secrets in the same browser session.',
      'Reusing identifiers or hashes in contexts where uniqueness or unpredictability really matters.',
    ],
    text: [
      'Performing aggressive find-and-replace operations without scanning the diff for unintended matches.',
      'Using a complex regex in production before validating it on a realistic sample of input.',
    ],
    formatting: [
      'Deploying formatted SQL or minified assets without running an automated test suite.',
      'Assuming that visual formatting changes cannot affect query plans or bundler behavior.',
    ],
  };
  const pool = [...generic, ...(specific[clusterKey] ?? [])];
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 4);
}

function buildComparison(clusterKey: ClusterKey, seed: number): { item: string; pros: string; cons: string }[] {
  const approaches = [
    {
      item: 'Browser-based DevSolve tool',
      pros: 'Runs locally in your browser, no installation, fast for day-to-day tasks.',
      cons: 'Not a replacement for full test environments or long-running batch jobs.',
    },
    {
      item: 'Command-line utilities',
      pros: 'Scriptable, integrates well with CI and automation pipelines.',
      cons: 'Requires installation, permissions, and a bit of setup time.',
    },
    {
      item: 'Custom code in your application',
      pros: 'Maximum control and flexibility, lives close to business logic.',
      cons: 'Adds maintenance overhead and needs proper testing and review.',
    },
    {
      item: 'Third-party hosted services',
      pros: 'Often come with dashboards, logs, and integrations out of the box.',
      cons: 'Data may leave your environment; pricing and rate limits apply.',
    },
  ];
  const note =
    clusterKey === 'security'
      ? 'For security-sensitive workflows, favor approaches that keep secrets within your own infrastructure and rely on audited libraries.'
      : clusterKey === 'encoding'
        ? 'For encoding and decoding, make sure every component in your stack agrees on the expected format and character set.'
        : '';
  const shuffled = [...approaches];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const rows = shuffled.slice(0, 3);
  if (note) {
    rows.push({
      item: 'Implementation note',
      pros: note,
      cons: 'Treat this as a checklist, not a substitute for your own threat modeling or architecture review.',
    });
  }
  return rows;
}

function buildKeywords(clusterKey: string, tool: string, intent: string, audience: string): string[] {
  return Array.from(new Set([clusterKey, tool, intent, audience, 'online', 'browser-based', 'developer-tools']));
}

/* ------------------------------------------------------------------ */
/*  O(1) page generation by index                                     */
/* ------------------------------------------------------------------ */
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
  const title = buildTitle(pair.tool, pair.intent, audience);

  return {
    slug,
    title,
    description: `${title} — practical, browser-based workflow for real-world engineering tasks, ${label(modifier)}.`,
    primaryTool: pair.tool,
    clusterKey: pair.cluster.key,
    intent: pair.intent,
    audience,
    taskVariant: task,
    keywords: buildKeywords(pair.cluster.key, pair.tool, pair.intent, audience),
    h1: buildH1(pair.intent, audience),
    intro: buildIntro(pair.tool, pair.intent, audience, task, modifier),
    steps: buildSteps(pair.intent, pair.tool, task, seed),
    pitfalls: buildPitfalls(pair.cluster.key, seed),
    comparison: buildComparison(pair.cluster.key, seed),
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
/*  Backward-compatible bulk generators (avoid for 50 k – use index)  */
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

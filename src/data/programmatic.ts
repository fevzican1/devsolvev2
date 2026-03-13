import { siteConfig } from '@/config/site';
import { monetizationConfig } from '@/config/monetization';
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
  audienceVariants: string[];
  taskVariants: string[];
}

const clusters = [
  {
    key: 'json',
    tools: ['json-formatter', 'json-to-typescript'],
    intents: ['validate-json', 'format-json', 'inspect-json-structure', 'convert-json-to-types'],
    audienceVariants: ['backend-engineer', 'api-consumer', 'frontend-developer'],
    taskVariants: ['debug-production-issue', 'prepare-api-response', 'clean-up-payload'],
  },
  {
    key: 'encoding',
    tools: ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'],
    intents: ['encode-data', 'decode-data', 'fix-encoding-bugs'],
    audienceVariants: ['frontend-developer', 'integration-engineer'],
    taskVariants: ['sanitize-user-input', 'prepare-query-parameters', 'inspect-encoded-payload'],
  },
  {
    key: 'security',
    tools: ['hash-generator', 'uuid-generator', 'jwt-decoder'],
    intents: ['generate-identifiers', 'verify-tokens', 'inspect-signatures'],
    audienceVariants: ['security-conscious-developer', 'ops-engineer'],
    taskVariants: ['trace-request', 'validate-auth-token', 'compare-hash-values'],
  },
  {
    key: 'text',
    tools: ['text-case-converter', 'diff-checker', 'regex-tester'],
    intents: ['normalize-text', 'compare-versions', 'test-regex'],
    audienceVariants: ['frontend-developer', 'technical-writer'],
    taskVariants: ['prepare-release-notes', 'review-config-change', 'clean-up-log-lines'],
  },
  {
    key: 'formatting',
    tools: ['sql-formatter', 'css-minifier', 'markdown-preview'],
    intents: ['format-sql', 'minify-assets', 'preview-markdown'],
    audienceVariants: ['fullstack-developer', 'data-engineer'],
    taskVariants: ['review-database-query', 'prepare-production-build', 'document-api'],
  },
] as const satisfies ClusterDefinition[];

const modifierPatterns = [
  'without-installing-cli-tools',
  'directly-in-your-browser',
  'with-clear-step-by-step-checklists',
  'with-safe-local-processing',
  'while-keeping-sensitive-data-on-device',
];

function buildDeterministicSlug(cluster: ClusterDefinition, toolSlug: string, intent: string, audience: string, taskVariant: string, index: number): string {
  const base = [
    cluster.key,
    intent,
    audience,
    taskVariant,
    toolSlug,
  ]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${base}-${index}`;
}

function buildTitle(toolSlug: string, intent: string, audience: string): string {
  const toolDef = toolRegistry.find((t) => t.slug === toolSlug);
  const toolName = toolDef?.name ?? toolSlug;
  const intentLabel = intent.replace(/-/g, ' ');
  const audienceLabel = audience.replace(/-/g, ' ');
  return `How to ${intentLabel} for a ${audienceLabel} using ${toolName}`;
}

function buildH1(intent: string, audience: string): string {
  const intentLabel = intent.replace(/-/g, ' ');
  const audienceLabel = audience.replace(/-/g, ' ');
  return `Practical guide: ${intentLabel} for a ${audienceLabel}`;
}

function buildIntro(cluster: ClusterDefinition, toolSlug: string, intent: string, audience: string, taskVariant: string): string {
  const toolDef = toolRegistry.find((t) => t.slug === toolSlug);
  const toolName = toolDef?.name ?? toolSlug;
  const audienceLabel = audience.replace(/-/g, ' ');
  const intentLabel = intent.replace(/-/g, ' ');
  const taskLabel = taskVariant.replace(/-/g, ' ');

  return [
    `This page walks through how a ${audienceLabel} can ${intentLabel} using the browser-based ${toolName} tool.`,
    'Everything runs locally in your browser, so the data you paste into the tool is not sent to a server.',
    `The focus is on a concrete task: ${taskLabel}, with clear steps, common mistakes, and trade-offs you should keep in mind.`,
  ].join(' ');
}

function buildSteps(intent: string, toolSlug: string, taskVariant: string, seed: number): string[] {
  const intentLabel = intent.replace(/-/g, ' ');
  const taskLabel = taskVariant.replace(/-/g, ' ');

  const baseSteps = [
    `Clarify the task: ${taskLabel}, and identify a small, safe sample of data to work with first.`,
    `Open the ${toolSlug.replace(/-/g, ' ')} tool in your browser from the DevSolve tools directory.`,
    `Paste or type the relevant input for your ${intentLabel} task into the input area.`,
    `Adjust any available options so they match your environment and expectations before running the action.`,
    `Run the action and review the output carefully, checking for edge cases, encoding issues, or truncation.`,
    `If the result looks correct on the sample, repeat the same steps on the full dataset, keeping a backup of the original.`,
  ];

  const shuffled = [...baseSteps];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, 5);
}

function buildPitfalls(clusterKey: ClusterKey, intent: string, seed: number): string[] {
  const genericPitfalls = [
    'Skipping a quick manual sanity check on a small sample before processing a full dataset.',
    'Relying on default options without confirming how they behave on malformed or edge-case input.',
    'Not keeping a backup of the original input before transforming or minifying it.',
    'Assuming all data is safe to paste without considering secrets, tokens, or production credentials.',
    'Treating the tool output as authoritative without cross-checking against another source of truth.',
  ];

  const clusterSpecific: Record<ClusterKey, string[]> = {
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

  const pool = [...genericPitfalls, ...(clusterSpecific[clusterKey] ?? [])];
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 4);
}

function buildComparison(clusterKey: ClusterKey, intent: string, seed: number): { item: string; pros: string; cons: string }[] {
  const baseApproaches = [
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

  const clusterNote =
    clusterKey === 'security'
      ? 'For security-sensitive workflows, favor approaches that keep secrets within your own infrastructure and rely on audited libraries.'
      : clusterKey === 'encoding'
        ? 'For encoding and decoding, make sure every component in your stack agrees on the expected format and character set.'
        : '';

  const shuffled = [...baseApproaches];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const rows = shuffled.slice(0, 3);
  if (clusterNote) {
    rows.push({
      item: 'Implementation note',
      pros: clusterNote,
      cons: 'Treat this as a checklist, not a substitute for your own threat modeling or architecture review.',
    });
  }

  return rows;
}

function buildKeywords(cluster: ClusterDefinition, toolSlug: string, intent: string, audience: string): string[] {
  const base = [
    cluster.key,
    toolSlug,
    intent,
    audience,
    'online',
    'browser-based',
    'developer-tools',
  ];
  return Array.from(new Set(base));
}

function getRampTargetTotal(): number {
  const rampLevel = monetizationConfig.opsFlags.programmaticRampLevel ?? 0;
  const schedule = siteConfig.programmatic.rampSchedule;
  if (rampLevel < 0 || rampLevel >= schedule.length) {
    return siteConfig.programmatic.safeDefaultTotal;
  }
  return schedule[rampLevel] ?? siteConfig.programmatic.safeDefaultTotal;
}

export function generateProgrammaticPages(): ProgrammaticPage[] {
  const pages: ProgrammaticPage[] = [];
  const targetCount = getRampTargetTotal();

  let index = 0;

  for (const cluster of clusters) {
    for (const toolSlug of cluster.tools) {
      for (const intent of cluster.intents) {
        for (const audience of cluster.audienceVariants) {
          for (const taskVariant of cluster.taskVariants) {
            if (pages.length >= targetCount) break;

            const slug = buildDeterministicSlug(cluster, toolSlug, intent, audience, taskVariant, index);
            const seed = hashString(slug);
            const modifier = modifierPatterns[seed % modifierPatterns.length];

            const title = buildTitle(toolSlug, intent, audience);
            const description = `${title} — practical, browser-based workflow for real-world engineering tasks, ${modifier.replace(/-/g, ' ')}.`;

            pages.push({
              slug,
              title,
              description,
              primaryTool: toolSlug,
              clusterKey: cluster.key,
              intent,
              audience,
              taskVariant,
              keywords: buildKeywords(cluster, toolSlug, intent, audience),
              h1: buildH1(intent, audience),
              intro: buildIntro(cluster, toolSlug, intent, audience, taskVariant),
              steps: buildSteps(intent, toolSlug, taskVariant, seed),
              pitfalls: buildPitfalls(cluster.key, intent, seed),
              comparison: buildComparison(cluster.key, intent, seed),
            });

            index++;
          }
          if (pages.length >= targetCount) break;
        }
        if (pages.length >= targetCount) break;
      }
      if (pages.length >= targetCount) break;
    }
    if (pages.length >= targetCount) break;
  }

  return pages;
}

export function getProgrammaticPageBySlug(slug: string): ProgrammaticPage | undefined {
  const pages = generateProgrammaticPages();
  return pages.find((p) => p.slug === slug);
}

export function getAllProgrammaticSlugs(): string[] {
  return generateProgrammaticPages().map((p) => p.slug);
}

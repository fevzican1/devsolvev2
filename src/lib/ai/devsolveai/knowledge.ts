import { toolRegistry, type ToolDefinition } from '@/tools/registry';

export const DEVSOLVE_AI_NAME = 'DevSolveAI';
export const DEVSOLVE_AI_TAGLINE = 'Local developer assistant — runs entirely in your browser';

export const QUICK_PROMPTS = [
  'What can you help me with?',
  'Explain this JSON error',
  'Suggest a regex for email',
  'Which tool should I use for JWT?',
  'How does DevSolve keep my data private?',
] as const;

const TOOL_TIPS: Record<string, string[]> = {
  'json-formatter': [
    'Paste minified JSON and click Format to pretty-print with your chosen indent.',
    'Use Minify before sending payloads over the wire to reduce size.',
    'Parse errors show the exact position — ask me to explain any error message.',
  ],
  'jwt-decoder': [
    'Paste a three-part JWT (header.payload.signature) to inspect claims.',
    'This tool does NOT verify signatures — use it for debugging only.',
    'Check exp and iat claims to understand token lifetime.',
  ],
  'regex-tester': [
    'Test patterns with flags like g, i, m before using them in production code.',
    'Ask me to suggest a pattern from plain English (e.g. "match email").',
    'JavaScript regex differs slightly from PCRE or Python — verify in your runtime.',
  ],
  'base64-encode-decode': [
    'UTF-8 text is supported — emoji and non-Latin scripts encode correctly.',
    'Encoded output grows ~33% versus raw bytes.',
    'Pair with JWT Decoder when inspecting Base64URL segments.',
  ],
  'diff-checker': [
    'Compare configs line-by-line — normalize CRLF to LF first for cleaner diffs.',
    'Ask me to summarize differences between your two inputs.',
  ],
  'hash-generator': [
    'SHA-256 is the default choice for integrity checks; SHA-512 for extra margin.',
    'Do not use these hashes for password storage — use bcrypt or Argon2 server-side.',
  ],
};

const KEYWORD_TOOL_MAP: Array<{ keywords: RegExp; slug: string; reason: string }> = [
  { keywords: /\b(json|payload|parse|format json)\b/i, slug: 'json-formatter', reason: 'Format and validate JSON locally' },
  { keywords: /\b(jwt|token|bearer|claims|oauth)\b/i, slug: 'jwt-decoder', reason: 'Inspect JWT header and payload' },
  { keywords: /\b(base64|b64)\b/i, slug: 'base64-encode-decode', reason: 'Encode or decode Base64 with UTF-8' },
  { keywords: /\b(url encode|percent.?encod|query string|uri)\b/i, slug: 'url-encode-decode', reason: 'Percent-encode URL components' },
  { keywords: /\b(regex|regular expression|pattern match)\b/i, slug: 'regex-tester', reason: 'Test regex with live highlighting' },
  { keywords: /\b(hash|sha-?256|sha-?512|checksum|digest)\b/i, slug: 'hash-generator', reason: 'Generate SHA-256/512 hashes' },
  { keywords: /\b(uuid|guid|unique id)\b/i, slug: 'uuid-generator', reason: 'Generate cryptographically random UUID v4' },
  { keywords: /\b(cron|schedule|crontab)\b/i, slug: 'cron-helper', reason: 'Parse cron expressions and preview runs' },
  { keywords: /\b(html entity|xss|escape html)\b/i, slug: 'html-entity-encode-decode', reason: 'Encode/decode HTML entities safely' },
  { keywords: /\b(snake_case|camelCase|kebab|case convert)\b/i, slug: 'text-case-converter', reason: 'Convert naming conventions' },
  { keywords: /\b(diff|compare|difference)\b/i, slug: 'diff-checker', reason: 'Compare two texts side by side' },
  { keywords: /\b(markdown|md preview|readme)\b/i, slug: 'markdown-preview', reason: 'Render Markdown with XSS protection' },
  { keywords: /\b(sql|query format|beautify sql)\b/i, slug: 'sql-formatter', reason: 'Format SQL queries' },
  { keywords: /\b(css minify|compress css)\b/i, slug: 'css-minifier', reason: 'Minify CSS whitespace and comments' },
  { keywords: /\b(typescript|interface|json to type)\b/i, slug: 'json-to-typescript', reason: 'Generate TypeScript interfaces from JSON' },
];

export function getToolTips(slug: string): string[] {
  return TOOL_TIPS[slug] ?? [
    'All DevSolve tools run locally — nothing is uploaded to a server.',
    'Use the related tools section below for common next steps.',
  ];
}

export function recommendTools(query: string, currentSlug?: string): Array<{ slug: string; name: string; reason: string }> {
  const matches: Array<{ slug: string; name: string; reason: string; score: number }> = [];

  for (const entry of KEYWORD_TOOL_MAP) {
    if (entry.keywords.test(query)) {
      const tool = toolRegistry.find((t) => t.slug === entry.slug);
      if (tool && tool.slug !== currentSlug) {
        matches.push({ slug: tool.slug, name: tool.name, reason: entry.reason, score: 2 });
      }
    }
  }

  if (currentSlug) {
    const current = toolRegistry.find((t) => t.slug === currentSlug);
    current?.relatedTools.forEach((relatedSlug) => {
      const tool = toolRegistry.find((t) => t.slug === relatedSlug);
      if (tool) {
        matches.push({ slug: tool.slug, name: tool.name, reason: 'Commonly used together', score: 1 });
      }
    });
  }

  const seen = new Set<string>();
  return matches
    .sort((a, b) => b.score - a.score)
    .filter((m) => {
      if (seen.has(m.slug)) return false;
      seen.add(m.slug);
      return true;
    })
    .slice(0, 3)
    .map(({ slug, name, reason }) => ({ slug, name, reason }));
}

export function getToolKnowledge(tool: ToolDefinition): string {
  const tips = getToolTips(tool.slug);
  return [
    `**${tool.name}** — ${tool.shortDescription}`,
    '',
    tool.description,
    '',
    '**Quick tips:**',
    ...tips.map((t) => `- ${t}`),
    '',
    '**Limitations:**',
    ...tool.limitations.map((l) => `- ${l}`),
  ].join('\n');
}

export function listAllToolsBrief(): string {
  const byCategory = new Map<string, ToolDefinition[]>();
  toolRegistry.forEach((tool) => {
    const list = byCategory.get(tool.category) ?? [];
    list.push(tool);
    byCategory.set(tool.category, list);
  });

  const lines = ['DevSolve offers these browser-local tools:'];
  byCategory.forEach((tools, category) => {
    lines.push('', `**${category.charAt(0).toUpperCase() + category.slice(1)}:**`);
    tools.forEach((t) => lines.push(`- **${t.name}** (\`/tools/${t.slug}\`) — ${t.shortDescription}`));
  });
  return lines.join('\n');
}

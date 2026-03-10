export interface ToolDefinition {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: 'encoding' | 'formatting' | 'security' | 'text' | 'validation' | 'conversion';
  keywords: string[];
  limitations: string[];
  relatedTools: string[];
  relatedGuides: string[];
  isHeavy: boolean;
}

export const toolRegistry: ToolDefinition[] = [
  {
    slug: 'json-formatter',
    name: 'JSON Formatter & Validator',
    shortDescription: 'Format and validate JSON data',
    description: 'Parse, format, and validate JSON data with syntax highlighting and error detection. All processing happens locally in your browser.',
    category: 'formatting',
    keywords: ['json', 'format', 'validate', 'parse', 'pretty print'],
    limitations: [
      'Very large files (>10MB) may cause browser slowdown',
      'Does not validate against JSON Schema',
      'No support for JSON5 or JSONC formats',
    ],
    relatedTools: ['json-to-typescript', 'base64-encode-decode'],
    relatedGuides: ['json-validation-formatting'],
    isHeavy: false,
  },
  {
    slug: 'jwt-decoder',
    name: 'JWT Decoder (No Verify)',
    shortDescription: 'Decode JWT tokens without signature verification',
    description: 'Decode and inspect JWT tokens to view header and payload. Does not verify signatures. All processing happens locally in your browser.',
    category: 'security',
    keywords: ['jwt', 'token', 'decode', 'header', 'payload', 'base64'],
    limitations: [
      'Does not verify token signatures',
      'Cannot validate token expiration against server time',
      'Not suitable for security-critical signature verification',
    ],
    relatedTools: ['base64-encode-decode', 'hash-generator'],
    relatedGuides: ['jwt-decoding-browser'],
    isHeavy: false,
  },
  {
    slug: 'base64-encode-decode',
    name: 'Base64 Encode/Decode',
    shortDescription: 'Encode and decode Base64 strings',
    description: 'Convert text to Base64 and back with UTF-8 support. All processing happens locally in your browser.',
    category: 'encoding',
    keywords: ['base64', 'encode', 'decode', 'utf8', 'binary'],
    limitations: [
      'Binary files must be converted to text first',
      'Very large strings may cause browser slowdown',
      'UTF-8 encoding only',
    ],
    relatedTools: ['url-encode-decode', 'jwt-decoder'],
    relatedGuides: ['base64-usage'],
    isHeavy: false,
  },
  {
    slug: 'url-encode-decode',
    name: 'URL Encode/Decode',
    shortDescription: 'Encode and decode URL components',
    description: 'Safely encode and decode URL components using encodeURIComponent/decodeURIComponent. All processing happens locally in your browser.',
    category: 'encoding',
    keywords: ['url', 'encode', 'decode', 'uri', 'percent encoding'],
    limitations: [
      'Uses encodeURIComponent (not encodeURI)',
      'Does not handle full URL parsing',
      'Special characters are always encoded',
    ],
    relatedTools: ['base64-encode-decode', 'html-entity-encode-decode'],
    relatedGuides: ['url-encoding-pitfalls'],
    isHeavy: false,
  },
  {
    slug: 'hash-generator',
    name: 'Hash Generator',
    shortDescription: 'Generate SHA-256 and SHA-512 hashes',
    description: 'Generate cryptographic hashes using Web Crypto API. Supports SHA-256 and SHA-512. All processing happens locally in your browser.',
    category: 'security',
    keywords: ['hash', 'sha256', 'sha512', 'crypto', 'checksum'],
    limitations: [
      'Uses Web Crypto API (requires HTTPS in production)',
      'Not suitable for password hashing (use bcrypt/argon2 server-side)',
      'Large files may take time to process',
    ],
    relatedTools: ['jwt-decoder', 'uuid-generator'],
    relatedGuides: ['hashing-integrity'],
    isHeavy: false,
  },
  {
    slug: 'uuid-generator',
    name: 'UUID Generator',
    shortDescription: 'Generate random UUIDs (v4)',
    description: 'Generate cryptographically random UUIDs using crypto.getRandomValues. All processing happens locally in your browser.',
    category: 'security',
    keywords: ['uuid', 'guid', 'random', 'v4', 'unique id'],
    limitations: [
      'Only generates UUID v4 (random)',
      'Does not support v1 (timestamp) or v5 (namespace)',
      'Requires crypto.getRandomValues support',
    ],
    relatedTools: ['hash-generator', 'json-formatter'],
    relatedGuides: ['hashing-integrity'],
    isHeavy: false,
  },
  {
    slug: 'regex-tester',
    name: 'Regex Tester',
    shortDescription: 'Test regular expressions with match highlighting',
    description: 'Test regex patterns with flags, view matches, and capture groups. All processing happens locally in your browser.',
    category: 'validation',
    keywords: ['regex', 'regular expression', 'pattern', 'match', 'test'],
    limitations: [
      'Uses JavaScript regex engine (may differ from other languages)',
      'Complex patterns may have performance impact',
      'No support for lookbehind in older browsers',
    ],
    relatedTools: ['text-case-converter', 'diff-checker'],
    relatedGuides: ['regex-testing-debugging'],
    isHeavy: false,
  },
  {
    slug: 'cron-helper',
    name: 'Cron Helper',
    shortDescription: 'Parse cron expressions and view schedules',
    description: 'Parse cron expressions and see the next scheduled run times. All processing happens locally in your browser.',
    category: 'validation',
    keywords: ['cron', 'schedule', 'crontab', 'timer', 'job'],
    limitations: [
      'Uses simplified cron parser',
      'Does not support all cron variants (e.g., Quartz)',
      'Timezone is based on browser local time',
    ],
    relatedTools: ['regex-tester', 'json-formatter'],
    relatedGuides: ['json-validation-formatting'],
    isHeavy: false,
  },
  {
    slug: 'html-entity-encode-decode',
    name: 'HTML Entity Encode/Decode',
    shortDescription: 'Convert HTML entities safely',
    description: 'Encode special characters to HTML entities and decode them back. All processing happens locally in your browser.',
    category: 'encoding',
    keywords: ['html', 'entity', 'encode', 'decode', 'escape'],
    limitations: [
      'Uses DOM-based encoding for safety',
      'Named entities may vary by browser',
      'Does not handle all Unicode entities',
    ],
    relatedTools: ['url-encode-decode', 'markdown-preview'],
    relatedGuides: ['markdown-preview-safety'],
    isHeavy: false,
  },
  {
    slug: 'text-case-converter',
    name: 'Text Case Converter',
    shortDescription: 'Convert text between different cases',
    description: 'Convert text to lowercase, uppercase, title case, snake_case, and kebab-case. All processing happens locally in your browser.',
    category: 'text',
    keywords: ['case', 'lowercase', 'uppercase', 'title', 'snake', 'kebab'],
    limitations: [
      'Title case uses simple word boundary detection',
      'May not handle all locale-specific cases correctly',
      'Does not preserve original formatting for mixed content',
    ],
    relatedTools: ['regex-tester', 'diff-checker'],
    relatedGuides: ['text-transformations'],
    isHeavy: false,
  },
  {
    slug: 'diff-checker',
    name: 'Diff Checker (Text)',
    shortDescription: 'Compare two texts and highlight differences',
    description: 'Compare two text inputs line by line and highlight additions, deletions, and changes. All processing happens locally in your browser.',
    category: 'text',
    keywords: ['diff', 'compare', 'text', 'difference', 'merge'],
    limitations: [
      'Line-based comparison only',
      'Very large files may cause slowdown',
      'No syntax-aware diffing',
    ],
    relatedTools: ['text-case-converter', 'json-formatter'],
    relatedGuides: ['diffing-techniques'],
    isHeavy: false,
  },
  {
    slug: 'markdown-preview',
    name: 'Markdown Preview',
    shortDescription: 'Preview Markdown with safe rendering',
    description: 'Render Markdown to HTML with XSS protection. All processing happens locally in your browser.',
    category: 'formatting',
    keywords: ['markdown', 'preview', 'render', 'html', 'md'],
    limitations: [
      'Some advanced Markdown extensions not supported',
      'Raw HTML is sanitized for security',
      'No support for custom plugins',
    ],
    relatedTools: ['html-entity-encode-decode', 'json-formatter'],
    relatedGuides: ['markdown-preview-safety'],
    isHeavy: false,
  },
  {
    slug: 'sql-formatter',
    name: 'SQL Formatter',
    shortDescription: 'Format SQL queries for readability',
    description: 'Format and beautify SQL queries with consistent indentation. All processing happens locally in your browser.',
    category: 'formatting',
    keywords: ['sql', 'format', 'beautify', 'query', 'database'],
    limitations: [
      'Basic formatting only',
      'May not handle all SQL dialects correctly',
      'Complex queries may have formatting limitations',
    ],
    relatedTools: ['json-formatter', 'css-minifier'],
    relatedGuides: ['sql-formatting'],
    isHeavy: true,
  },
  {
    slug: 'css-minifier',
    name: 'CSS Minifier (Basic)',
    shortDescription: 'Minify CSS by removing whitespace',
    description: 'Basic CSS minification by removing whitespace and comments. All processing happens locally in your browser.',
    category: 'formatting',
    keywords: ['css', 'minify', 'compress', 'optimize', 'whitespace'],
    limitations: [
      'Basic minification only (whitespace/comments)',
      'Does not optimize selectors or properties',
      'May not handle all CSS3 features correctly',
    ],
    relatedTools: ['sql-formatter', 'html-entity-encode-decode'],
    relatedGuides: ['minification-basics'],
    isHeavy: true,
  },
  {
    slug: 'json-to-typescript',
    name: 'JSON to TypeScript (Basic)',
    shortDescription: 'Generate TypeScript interfaces from JSON',
    description: 'Generate TypeScript interface definitions from sample JSON data. All processing happens locally in your browser.',
    category: 'conversion',
    keywords: ['json', 'typescript', 'interface', 'type', 'convert'],
    limitations: [
      'Infers types from sample data only',
      'May not detect optional properties correctly',
      'Complex nested structures may need manual adjustment',
    ],
    relatedTools: ['json-formatter', 'regex-tester'],
    relatedGuides: ['json-to-types'],
    isHeavy: false,
  },
];

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return toolRegistry.find(tool => tool.slug === slug);
}

export function getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
  return toolRegistry.filter(tool => tool.category === category);
}

export function getRelatedTools(slug: string, limit: number = 3): ToolDefinition[] {
  const tool = getToolBySlug(slug);
  if (!tool) return [];

  return tool.relatedTools
    .map(relatedSlug => getToolBySlug(relatedSlug))
    .filter((t): t is ToolDefinition => t !== undefined)
    .slice(0, limit);
}

export function getAllToolSlugs(): string[] {
  return toolRegistry.map(tool => tool.slug);
}

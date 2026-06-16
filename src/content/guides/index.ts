export interface GuideMetadata {
  slug: string;
  title: string;
  primaryToolSlug: string;
  relatedToolSlugs: string[];
  clusterKeys: string[];
  programmaticLinkCountTarget: number;
  description: string;
}

export const guideRegistry: GuideMetadata[] = [
  {
    slug: 'json-validation-formatting',
    title: 'JSON Validation and Formatting Best Practices',
    primaryToolSlug: 'json-formatter',
    relatedToolSlugs: ['json-to-typescript', 'base64-encode-decode', 'diff-checker'],
    clusterKeys: ['json', 'formatting', 'validation', 'data'],
    programmaticLinkCountTarget: 20,
    description: 'Validate, format, and pretty-print JSON with confidence: catch syntax errors early, normalise structure for clean diffs, and keep large payloads readable.',
  },
  {
    slug: 'jwt-decoding-browser',
    title: 'Safely Decoding Tokens in the Browser (No Verification)',
    primaryToolSlug: 'jwt-decoder',
    relatedToolSlugs: ['base64-encode-decode', 'hash-generator', 'json-formatter'],
    clusterKeys: ['jwt', 'security', 'tokens', 'authentication'],
    programmaticLinkCountTarget: 15,
    description: 'Decode and inspect JWT headers, payloads, and claims locally in your browser — no server calls — to debug auth flows and spot expired or malformed tokens.',
  },
  {
    slug: 'hashing-integrity',
    title: 'Practical Hashing for Integrity Checks (Local-only)',
    primaryToolSlug: 'hash-generator',
    relatedToolSlugs: ['uuid-generator', 'jwt-decoder', 'base64-encode-decode'],
    clusterKeys: ['hashing', 'security', 'integrity', 'checksum'],
    programmaticLinkCountTarget: 18,
    description: 'Understand how cryptographic hashing verifies data integrity: when to choose SHA-256 versus SHA-512, how checksums detect tampering, and the real limits of hashing.',
  },
  {
    slug: 'regex-testing-debugging',
    title: 'Regular Expressions: Testing and Debugging Workflow',
    primaryToolSlug: 'regex-tester',
    relatedToolSlugs: ['text-case-converter', 'diff-checker', 'json-formatter'],
    clusterKeys: ['regex', 'patterns', 'text', 'validation'],
    programmaticLinkCountTarget: 22,
    description: 'Test and debug regular expressions step by step: master greedy versus lazy matching, capture groups, and pitfalls, then validate patterns against real sample text.',
  },
  {
    slug: 'url-encoding-pitfalls',
    title: 'URL Encoding Pitfalls and How to Avoid Them',
    primaryToolSlug: 'url-encode-decode',
    relatedToolSlugs: ['base64-encode-decode', 'html-entity-encode-decode', 'json-formatter'],
    clusterKeys: ['url', 'encoding', 'web', 'api'],
    programmaticLinkCountTarget: 16,
    description: 'Avoid common URL-encoding mistakes: percent-encoding reserved characters, double-encoding bugs, and query-string edge cases that quietly break links and APIs in production.',
  },
  {
    slug: 'base64-usage',
    title: 'Base64: When to Use It and Common Mistakes',
    primaryToolSlug: 'base64-encode-decode',
    relatedToolSlugs: ['url-encode-decode', 'jwt-decoder', 'hash-generator'],
    clusterKeys: ['base64', 'encoding', 'binary', 'data'],
    programmaticLinkCountTarget: 14,
    description: 'Learn when Base64 actually helps — data URIs, tokens, binary-safe transport — and the mistakes that bloat payloads or corrupt UTF-8 data, with practical browser examples.',
  },
  {
    slug: 'text-transformations',
    title: 'Text Transformations for Developers (Case, Slug, Normalize)',
    primaryToolSlug: 'text-case-converter',
    relatedToolSlugs: ['regex-tester', 'diff-checker', 'url-encode-decode'],
    clusterKeys: ['text', 'case', 'formatting', 'string'],
    programmaticLinkCountTarget: 18,
    description: 'Transform text between cases, slugs, and normalised forms correctly: handle Unicode, whitespace, and edge characters so identifiers and URLs stay consistent.',
  },
  {
    slug: 'diffing-techniques',
    title: 'Basic Diffing Techniques for Reviews and Debugging',
    primaryToolSlug: 'diff-checker',
    relatedToolSlugs: ['text-case-converter', 'json-formatter', 'regex-tester'],
    clusterKeys: ['diff', 'comparison', 'debugging', 'review'],
    programmaticLinkCountTarget: 15,
    description: 'Compare text effectively for code reviews and debugging: line, word, and character diffs, how to read them fast, and how to spot meaningful changes amid the noise.',
  },
  {
    slug: 'markdown-preview-safety',
    title: 'Markdown Preview: Rendering Safely in Client Apps',
    primaryToolSlug: 'markdown-preview',
    relatedToolSlugs: ['html-entity-encode-decode', 'json-formatter', 'text-case-converter'],
    clusterKeys: ['markdown', 'rendering', 'security', 'html'],
    programmaticLinkCountTarget: 12,
    description: 'Render Markdown safely in client-side apps: sanitise HTML, prevent XSS from untrusted input, and preview content reliably without exposing users to injected scripts.',
  },
  {
    slug: 'sql-formatting',
    title: 'SQL Formatting: Readability Rules and Team Conventions',
    primaryToolSlug: 'sql-formatter',
    relatedToolSlugs: ['json-formatter', 'css-minifier', 'diff-checker'],
    clusterKeys: ['sql', 'formatting', 'database', 'conventions'],
    programmaticLinkCountTarget: 20,
    description: 'Establish consistent, readable SQL formatting: indentation, keyword casing, and clause alignment that make queries easier to review, diff, and maintain across a team.',
  },
  {
    slug: 'minification-basics',
    title: 'Lightweight Minification: What "Basic" Means (And Limits)',
    primaryToolSlug: 'css-minifier',
    relatedToolSlugs: ['sql-formatter', 'json-formatter', 'html-entity-encode-decode'],
    clusterKeys: ['minification', 'css', 'optimization', 'performance'],
    programmaticLinkCountTarget: 14,
    description: 'Understand what basic CSS minification does — stripping whitespace and comments to cut payload size — and the limits where a real build step is needed instead.',
  },
  {
    slug: 'json-to-types',
    title: 'Turning JSON Samples Into Types: A Practical Approach',
    primaryToolSlug: 'json-to-typescript',
    relatedToolSlugs: ['json-formatter', 'regex-tester', 'diff-checker'],
    clusterKeys: ['json', 'typescript', 'types', 'conversion'],
    programmaticLinkCountTarget: 16,
    description: 'Generate TypeScript interfaces from JSON samples and learn where inference falls short: optional fields, unions, and nested shapes you still refine by hand.',
  },
  {
    slug: 'api-contract-validation-deep-dive',
    title: 'API Contract Validation: A Deep Dive for Senior Backend Engineers',
    primaryToolSlug: 'json-formatter',
    relatedToolSlugs: ['jwt-decoder', 'diff-checker', 'json-to-typescript'],
    clusterKeys: ['json', 'api', 'validation', 'contracts'],
    programmaticLinkCountTarget: 24,
    description: 'How senior teams keep documented, runtime, and consumer API contracts aligned — and the validation harness that detects drift before consumers do.',
  },
  {
    slug: 'token-security-deep-dive',
    title: 'Production Token Security: JWT, Hashing, and Identifier Rotation',
    primaryToolSlug: 'jwt-decoder',
    relatedToolSlugs: ['hash-generator', 'uuid-generator', 'base64-encode-decode'],
    clusterKeys: ['security', 'jwt', 'tokens', 'hashing'],
    programmaticLinkCountTarget: 22,
    description: 'A field manual for shipping JWTs, hashes, and machine identifiers safely — including the algorithm-confusion, replay, and timing-attack patterns most teams miss.',
  },
  {
    slug: 'encoding-pitfalls-deep-dive',
    title: 'Encoding Pitfalls: Where Production Data Gets Corrupted',
    primaryToolSlug: 'base64-encode-decode',
    relatedToolSlugs: ['url-encode-decode', 'html-entity-encode-decode', 'json-formatter'],
    clusterKeys: ['encoding', 'utf8', 'base64', 'url'],
    programmaticLinkCountTarget: 22,
    description: 'The eight encoding boundaries in every web stack, the four bugs to recognise on sight, and the roundtrip tests that prevent silent data corruption.',
  },
  {
    slug: 'text-diffing-deep-dive',
    title: 'Diffing Text in Production: Beyond `git diff`',
    primaryToolSlug: 'diff-checker',
    relatedToolSlugs: ['json-formatter', 'text-case-converter', 'regex-tester'],
    clusterKeys: ['text', 'diff', 'review', 'config'],
    programmaticLinkCountTarget: 20,
    description: 'Three classes of diff failure that only appear at scale — and the line, word, and semantic diff modes senior engineers actually use during reviews and incidents.',
  },
];

export function getGuideBySlug(slug: string): GuideMetadata | undefined {
  return guideRegistry.find(guide => guide.slug === slug);
}

export function getGuidesForTool(toolSlug: string): GuideMetadata[] {
  return guideRegistry.filter(
    guide => guide.primaryToolSlug === toolSlug || guide.relatedToolSlugs.includes(toolSlug)
  );
}

export function getAllGuideSlugs(): string[] {
  return guideRegistry.map(guide => guide.slug);
}

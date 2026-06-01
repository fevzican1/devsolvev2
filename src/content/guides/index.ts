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
    description: 'Learn effective techniques for validating and formatting JSON data in development workflows.',
  },
  {
    slug: 'jwt-decoding-browser',
    title: 'Safely Decoding Tokens in the Browser (No Verification)',
    primaryToolSlug: 'jwt-decoder',
    relatedToolSlugs: ['base64-encode-decode', 'hash-generator', 'json-formatter'],
    clusterKeys: ['jwt', 'security', 'tokens', 'authentication'],
    programmaticLinkCountTarget: 15,
    description: 'Understand how to decode and inspect JWT tokens locally without signature verification.',
  },
  {
    slug: 'hashing-integrity',
    title: 'Practical Hashing for Integrity Checks (Local-only)',
    primaryToolSlug: 'hash-generator',
    relatedToolSlugs: ['uuid-generator', 'jwt-decoder', 'base64-encode-decode'],
    clusterKeys: ['hashing', 'security', 'integrity', 'checksum'],
    programmaticLinkCountTarget: 18,
    description: 'Explore how cryptographic hashing works and when to use it for data integrity verification.',
  },
  {
    slug: 'regex-testing-debugging',
    title: 'Regular Expressions: Testing and Debugging Workflow',
    primaryToolSlug: 'regex-tester',
    relatedToolSlugs: ['text-case-converter', 'diff-checker', 'json-formatter'],
    clusterKeys: ['regex', 'patterns', 'text', 'validation'],
    programmaticLinkCountTarget: 22,
    description: 'Master the process of testing and debugging regular expressions effectively.',
  },
  {
    slug: 'url-encoding-pitfalls',
    title: 'URL Encoding Pitfalls and How to Avoid Them',
    primaryToolSlug: 'url-encode-decode',
    relatedToolSlugs: ['base64-encode-decode', 'html-entity-encode-decode', 'json-formatter'],
    clusterKeys: ['url', 'encoding', 'web', 'api'],
    programmaticLinkCountTarget: 16,
    description: 'Common mistakes with URL encoding and practical solutions for web development.',
  },
  {
    slug: 'base64-usage',
    title: 'Base64: When to Use It and Common Mistakes',
    primaryToolSlug: 'base64-encode-decode',
    relatedToolSlugs: ['url-encode-decode', 'jwt-decoder', 'hash-generator'],
    clusterKeys: ['base64', 'encoding', 'binary', 'data'],
    programmaticLinkCountTarget: 14,
    description: 'Learn proper Base64 usage and avoid common encoding pitfalls.',
  },
  {
    slug: 'text-transformations',
    title: 'Text Transformations for Developers (Case, Slug, Normalize)',
    primaryToolSlug: 'text-case-converter',
    relatedToolSlugs: ['regex-tester', 'diff-checker', 'url-encode-decode'],
    clusterKeys: ['text', 'case', 'formatting', 'string'],
    programmaticLinkCountTarget: 18,
    description: 'Techniques for transforming text between different formats and conventions.',
  },
  {
    slug: 'diffing-techniques',
    title: 'Basic Diffing Techniques for Reviews and Debugging',
    primaryToolSlug: 'diff-checker',
    relatedToolSlugs: ['text-case-converter', 'json-formatter', 'regex-tester'],
    clusterKeys: ['diff', 'comparison', 'debugging', 'review'],
    programmaticLinkCountTarget: 15,
    description: 'How to effectively compare text and identify differences in code reviews.',
  },
  {
    slug: 'markdown-preview-safety',
    title: 'Markdown Preview: Rendering Safely in Client Apps',
    primaryToolSlug: 'markdown-preview',
    relatedToolSlugs: ['html-entity-encode-decode', 'json-formatter', 'text-case-converter'],
    clusterKeys: ['markdown', 'rendering', 'security', 'html'],
    programmaticLinkCountTarget: 12,
    description: 'Safely render Markdown content while preventing XSS vulnerabilities.',
  },
  {
    slug: 'sql-formatting',
    title: 'SQL Formatting: Readability Rules and Team Conventions',
    primaryToolSlug: 'sql-formatter',
    relatedToolSlugs: ['json-formatter', 'css-minifier', 'diff-checker'],
    clusterKeys: ['sql', 'formatting', 'database', 'conventions'],
    programmaticLinkCountTarget: 20,
    description: 'Establish consistent SQL formatting standards for better code readability.',
  },
  {
    slug: 'minification-basics',
    title: 'Lightweight Minification: What "Basic" Means (And Limits)',
    primaryToolSlug: 'css-minifier',
    relatedToolSlugs: ['sql-formatter', 'json-formatter', 'html-entity-encode-decode'],
    clusterKeys: ['minification', 'css', 'optimization', 'performance'],
    programmaticLinkCountTarget: 14,
    description: 'Understanding the scope and limitations of basic CSS minification.',
  },
  {
    slug: 'json-to-types',
    title: 'Turning JSON Samples Into Types: A Practical Approach',
    primaryToolSlug: 'json-to-typescript',
    relatedToolSlugs: ['json-formatter', 'regex-tester', 'diff-checker'],
    clusterKeys: ['json', 'typescript', 'types', 'conversion'],
    programmaticLinkCountTarget: 16,
    description: 'Generate TypeScript interfaces from JSON samples and understand the limitations.',
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

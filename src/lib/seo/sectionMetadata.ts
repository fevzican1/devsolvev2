import { guideRegistry } from '../../content/guides';
import { toolRegistry } from '../../tools/registry';

export const TOOLS_SECTION_METADATA = {
  title: 'Free Online Developer Tools — Format, Validate, Encode & Debug',
  description:
    `Browse ${toolRegistry.length}+ free browser-based developer tools for formatting, validating, encoding, decoding, and debugging. No data leaves your browser.`,
  path: '/tools',
  keywords: ['online developer tools', 'free dev tools', 'json formatter', 'regex tester', 'jwt decoder', 'base64 encoder', 'browser tools'],
};

export const GUIDES_SECTION_METADATA = {
  title: 'Developer Guides — Best Practices, Tutorials & Workflows',
  description:
    `In-depth technical guides across ${guideRegistry.length}+ developer workflows — JSON, JWTs, regex, encoding, and hashing — with practical best practices, common pitfalls, and real, copy-ready examples.`,
  path: '/guides',
  keywords: ['developer guides', 'programming tutorials', 'json best practices', 'regex guide', 'jwt tutorial', 'coding workflows'],
};

export const DOCS_SECTION_METADATA = {
  title: 'Docs — Free Public Developer Documentation Hub',
  description:
    'Free public documentation hub for DevSolve tools, data workflows, encoding, tokens, and API payloads. No signup. Browse categories, popular topics, and related guides.',
  path: '/docs',
  keywords: ['developer docs', 'json documentation', 'jwt docs', 'encoding reference', 'free public documentation', 'api payload tools'],
};

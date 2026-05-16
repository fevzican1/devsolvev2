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
    `In-depth technical guides across ${guideRegistry.length}+ developer workflows, with practical best practices and real examples.`,
  path: '/guides',
  keywords: ['developer guides', 'programming tutorials', 'json best practices', 'regex guide', 'jwt tutorial', 'coding workflows'],
};

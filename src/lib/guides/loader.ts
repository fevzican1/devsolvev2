import fs from 'fs';
import path from 'path';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

function readGuideContent(slug: string): { part1: string; part2: string } | null {
  try {
    const guidesDir = path.join(process.cwd(), 'src/content/guides');
    const part1Path = path.join(guidesDir, `${slug}.md`);
    const part2Path = path.join(guidesDir, `${slug}.part-2.md`);

    const part1 = fs.existsSync(part1Path) ? fs.readFileSync(part1Path, 'utf-8') : '';
    const part2 = fs.existsSync(part2Path) ? fs.readFileSync(part2Path, 'utf-8') : '';

    if (!part1) return null;

    return { part1, part2 };
  } catch {
    return null;
  }
}

const loadGuideContentFromCache = unstable_cache(
  async (slug: string) => readGuideContent(slug),
  ['guide-content-v1'],
  { revalidate: 86400 },
);

export const loadGuideContentCached = cache(async (slug: string) => loadGuideContentFromCache(slug));

export function loadGuideContent(slug: string): { part1: string; part2: string } | null {
  return readGuideContent(slug);
}

export function getAllGuideContents(): Record<string, { part1: string; part2: string }> {
  const guides: Record<string, { part1: string; part2: string }> = {};

  const slugs = [
    'json-validation-formatting',
    'jwt-decoding-browser',
    'hashing-integrity',
    'regex-testing-debugging',
    'url-encoding-pitfalls',
    'base64-usage',
    'text-transformations',
    'diffing-techniques',
    'markdown-preview-safety',
    'sql-formatting',
    'minification-basics',
    'json-to-types',
    'api-contract-validation-deep-dive',
    'token-security-deep-dive',
    'encoding-pitfalls-deep-dive',
    'text-diffing-deep-dive',
  ];

  for (const slug of slugs) {
    const content = loadGuideContent(slug);
    if (content) {
      guides[slug] = content;
    }
  }

  return guides;
}

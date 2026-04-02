import { statSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { siteConfig } from '@/config/site';
import { getTotalPageCount } from '@/data/programmatic';

const URLS_PER_SITEMAP = 10000;

/* ISR: regenerate every 12 hours. Cached so Google bot never times out. */
export const revalidate = 43200;

function safeLastModifiedAt(paths: string[], fallback: Date): Date {
  let latest = fallback.getTime();

  for (const path of paths) {
    try {
      const fullPath = join(process.cwd(), path);
      const mtime = statSync(fullPath).mtime.getTime();
      if (mtime > latest) latest = mtime;
    } catch {
      // ignored: missing path keeps fallback timestamp
    }
  }

  return new Date(latest);
}

function formatProgrammaticSitemapName(partIndex: number): string {
  return `sitemap-tools-${String(partIndex).padStart(4, '0')}.xml`;
}

export async function GET() {
  const now = new Date();
  const base = siteConfig.siteUrl;
  const programmaticWindow = Math.min(
    getTotalPageCount(),
    siteConfig.programmaticQuality.maxSitemapUrls,
  );
  const programmaticChunks = Math.ceil(programmaticWindow / URLS_PER_SITEMAP);

  const coreLastmod = safeLastModifiedAt(
    [
      'src/app/page.tsx',
      'src/app/tools/page.tsx',
      'src/app/guides/page.tsx',
      'src/tools/registry.ts',
      'src/content/guides/index.ts',
    ],
    now,
  );

  const programmaticLastmod = safeLastModifiedAt(
    [
      'src/data/programmatic.ts',
      'src/lib/quality/scoring.ts',
      'src/app/k/[slug]/page.tsx',
    ],
    coreLastmod,
  );

  const sitemapEntries = [
    {
      loc: `${base}/sitemaps/sitemap-core.xml`,
      lastmod: coreLastmod,
    },
    ...Array.from({ length: programmaticChunks }, (_, i) => ({
      loc: `${base}/sitemaps/${formatProgrammaticSitemapName(i + 1)}`,
      lastmod: programmaticLastmod,
    })),
  ].sort((a, b) => b.lastmod.getTime() - a.lastmod.getTime());

  const sitemaps = sitemapEntries
    .map(
      (entry) =>
        `  <sitemap>\n    <loc>${entry.loc}</loc>\n    <lastmod>${entry.lastmod.toISOString()}</lastmod>\n  </sitemap>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400',
    },
  });
}

import { NextResponse } from 'next/server';
import { siteConfig } from '@/config/site';
import { toolRegistry } from '@/tools/registry';
import { guideRegistry } from '@/content/guides';
import { getTotalPageCount, getPageByIndex } from '@/data/programmatic';

const URLS_PER_SITEMAP = 5000;

/* ISR: regenerate every 24 hours, but never at build time */
export const revalidate = 86400;

function urlEntry(loc: string, changefreq: string, priority: string): string {
  return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id) || id < 0) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const base = siteConfig.siteUrl;
  const entries: string[] = [];

  if (id === 0) {
    /* Core pages: static + tools + guides */
    entries.push(urlEntry(`${base}/`, 'weekly', '1.0'));
    entries.push(urlEntry(`${base}/about/`, 'monthly', '0.6'));
    entries.push(urlEntry(`${base}/contact/`, 'monthly', '0.7'));
    entries.push(urlEntry(`${base}/tools/`, 'weekly', '0.9'));
    entries.push(urlEntry(`${base}/guides/`, 'weekly', '0.9'));
    entries.push(urlEntry(`${base}/legal/privacy/`, 'monthly', '0.3'));
    entries.push(urlEntry(`${base}/legal/terms/`, 'monthly', '0.3'));
    entries.push(urlEntry(`${base}/legal/cookies/`, 'monthly', '0.3'));

    for (const t of toolRegistry) {
      entries.push(urlEntry(`${base}/tools/${t.slug}/`, 'weekly', '0.8'));
    }
    for (const g of guideRegistry) {
      entries.push(urlEntry(`${base}/guides/${g.slug}/`, 'weekly', '0.8'));
    }
  } else {
    /* Programmatic page chunk */
    const total = getTotalPageCount();
    const start = (id - 1) * URLS_PER_SITEMAP;
    if (start >= total) {
      return new NextResponse('Not Found', { status: 404 });
    }
    const end = Math.min(start + URLS_PER_SITEMAP, total);

    for (let i = start; i < end; i++) {
      const page = getPageByIndex(i);
      if (page) {
        entries.push(urlEntry(`${base}/k/${page.slug}/`, 'weekly', '0.5'));
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
    },
  });
}

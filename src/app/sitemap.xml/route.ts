import { NextResponse } from 'next/server';
import { siteConfig } from '@/config/site';
import { getTotalPageCount } from '@/data/programmatic';

const URLS_PER_SITEMAP = 5000;

/* ISR: regenerate every 12 hours. Cached so Google bot never times out. */
export const revalidate = 43200;

export async function GET() {
  const base = siteConfig.siteUrl;
  const programmaticChunks = Math.ceil(getTotalPageCount() / URLS_PER_SITEMAP);
  const totalChunks = programmaticChunks + 1; // id 0 = core pages

  const sitemaps = Array.from(
    { length: totalChunks },
    (_, i) => `  <sitemap>\n    <loc>${base}/sitemaps/${i}</loc>\n  </sitemap>`,
  ).join('\n');

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

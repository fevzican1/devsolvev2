import { NextResponse } from 'next/server';
import { siteConfig } from '@/config/site';
import { getTotalPageCount } from '@/data/programmatic';

const URLS_PER_SITEMAP = 5000;

/* Always generate on request – this is a tiny index file */
export const dynamic = 'force-dynamic';

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
    headers: { 'Content-Type': 'application/xml' },
  });
}

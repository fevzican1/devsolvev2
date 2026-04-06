import { statSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { toolRegistry } from '@/tools/registry';
import { guideRegistry } from '@/content/guides';
import { getTotalPageCount, getPageByIndex } from '@/data/programmatic';
import { hashString } from '@/lib/utils';
import { absoluteUrl } from '@/lib/seo/url';
import { calculateQualityScore, shouldIncludeInSitemap } from '@/lib/quality/scoring';
import { siteConfig } from '@/config/site';

const URLS_PER_SITEMAP = 10000;

/* ISR: regenerate every 24 hours, but never at build time */
export const revalidate = 86400;

interface UrlCandidate {
  loc: string;
  lastmod: Date;
  changefreq: string;
  priority: string;
  freshness: number;
}

function parseSitemapRequestId(rawId: string): { type: 'core' | 'programmatic'; partIndex?: number } | null {
  if (rawId === 'sitemap-core.xml' || rawId === '0') {
    return { type: 'core' };
  }

  const match = rawId.match(/^sitemap-tools-(\d{4,})\.xml$/i);
  if (match) {
    const partIndex = parseInt(match[1], 10);
    if (Number.isFinite(partIndex) && partIndex > 0) {
      return { type: 'programmatic', partIndex };
    }
  }

  const numeric = parseInt(rawId, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return { type: 'programmatic', partIndex: numeric };
  }

  return null;
}

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

function recencyDaysInverse(lastmod: Date): number {
  const diffDays = Math.max(1, Math.floor((Date.now() - lastmod.getTime()) / 86_400_000));
  return 1 / diffDays;
}

function normalizeUnitScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function estimateOrganicDemandScore(keywordCount: number, slug: string): number {
  const keywordSignal = Math.min(keywordCount / 12, 1);
  const deterministicVariation = (Math.abs(hashString(slug)) % 100) / 100;
  return normalizeUnitScore(keywordSignal * 0.7 + deterministicVariation * 0.3);
}

function estimateInternalLinkPriority(clusterKey: string, primaryTool: string): number {
  const clusterWeight: Record<string, number> = {
    api: 0.95,
    json: 0.92,
    security: 0.9,
    data: 0.88,
    debugging: 0.84,
    formatting: 0.82,
    web: 0.8,
    encoding: 0.78,
    text: 0.76,
    automation: 0.74,
  };

  const relatedToolCount = toolRegistry.find((tool) => tool.slug === primaryTool)?.relatedTools.length ?? 0;
  const clusterScore = clusterWeight[clusterKey] ?? 0.7;
  return normalizeUnitScore(clusterScore * 0.85 + Math.min(relatedToolCount / 6, 1) * 0.15);
}

function estimateConversionSignal(primaryTool: string): number {
  const category = toolRegistry.find((tool) => tool.slug === primaryTool)?.category;
  const categoryWeight: Record<string, number> = {
    validation: 0.86,
    security: 0.84,
    formatting: 0.8,
    conversion: 0.77,
    encoding: 0.75,
    text: 0.72,
  };

  return normalizeUnitScore(categoryWeight[category ?? 'text'] ?? 0.7);
}

function calculateFreshnessScore(options: {
  lastmod: Date;
  keywordCount: number;
  slug: string;
  clusterKey: string;
  primaryTool: string;
}): number {
  const recency = normalizeUnitScore(recencyDaysInverse(options.lastmod));
  const organicDemandScore = estimateOrganicDemandScore(options.keywordCount, options.slug);
  const internalLinkPriority = estimateInternalLinkPriority(options.clusterKey, options.primaryTool);
  const conversionSignal = estimateConversionSignal(options.primaryTool);

  return normalizeUnitScore(
    0.55 * recency
    + 0.2 * organicDemandScore
    + 0.15 * internalLinkPriority
    + 0.1 * conversionSignal,
  );
}

function renderUrlEntry(entry: UrlCandidate): string {
  return [
    '  <url>',
    `    <loc>${entry.loc}</loc>`,
    `    <lastmod>${entry.lastmod.toISOString()}</lastmod>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>',
  ].join('\n');
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const parsed = parseSitemapRequestId(params.id);
  if (!parsed) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const fallbackDate = new Date();
  const coreLastmod = safeLastModifiedAt(
    [
      'src/app/page.tsx',
      'src/app/tools/page.tsx',
      'src/app/guides/page.tsx',
      'src/tools/registry.ts',
      'src/content/guides/index.ts',
    ],
    fallbackDate,
  );
  const programmaticLastmod = safeLastModifiedAt(
    ['src/data/programmatic.ts', 'src/lib/quality/scoring.ts', 'src/app/k/[slug]/page.tsx'],
    coreLastmod,
  );

  const entries: UrlCandidate[] = [];

  if (parsed.type === 'core') {
    entries.push({ loc: absoluteUrl('/'), lastmod: coreLastmod, changefreq: 'daily', priority: '1.0', freshness: 1 });
    entries.push({ loc: absoluteUrl('/about'), lastmod: coreLastmod, changefreq: 'monthly', priority: '0.6', freshness: 0.6 });
    entries.push({ loc: absoluteUrl('/contact'), lastmod: coreLastmod, changefreq: 'monthly', priority: '0.7', freshness: 0.7 });
    entries.push({ loc: absoluteUrl('/tools'), lastmod: coreLastmod, changefreq: 'daily', priority: '0.9', freshness: 0.9 });
    entries.push({ loc: absoluteUrl('/guides'), lastmod: coreLastmod, changefreq: 'daily', priority: '0.9', freshness: 0.9 });
    entries.push({ loc: absoluteUrl('/legal/privacy'), lastmod: coreLastmod, changefreq: 'monthly', priority: '0.3', freshness: 0.3 });
    entries.push({ loc: absoluteUrl('/legal/terms'), lastmod: coreLastmod, changefreq: 'monthly', priority: '0.3', freshness: 0.3 });
    entries.push({ loc: absoluteUrl('/legal/cookies'), lastmod: coreLastmod, changefreq: 'monthly', priority: '0.3', freshness: 0.3 });
    entries.push({ loc: absoluteUrl('/legal/publisher-ethics'), lastmod: coreLastmod, changefreq: 'monthly', priority: '0.4', freshness: 0.4 });

    for (const t of toolRegistry) {
      entries.push({
        loc: absoluteUrl(`/tools/${t.slug}`),
        lastmod: coreLastmod,
        changefreq: 'weekly',
        priority: '0.85',
        freshness: estimateConversionSignal(t.slug),
      });
    }
    for (const g of guideRegistry) {
      entries.push({
        loc: absoluteUrl(`/guides/${g.slug}`),
        lastmod: coreLastmod,
        changefreq: 'weekly',
        priority: '0.85',
        freshness: estimateOrganicDemandScore(g.clusterKeys.length, g.slug),
      });
    }
  } else {
    const partIndex = parsed.partIndex ?? 1;
    const total = getTotalPageCount();
    const start = (partIndex - 1) * URLS_PER_SITEMAP;
    if (start >= total) {
      return new NextResponse('Not Found', { status: 404 });
    }
    const end = Math.min(start + URLS_PER_SITEMAP, total);

    for (let i = start; i < end; i++) {
      const page = getPageByIndex(i);
      if (!page) continue;

      const quality = calculateQualityScore(page);
      const sitemapEligible = shouldIncludeInSitemap(
        quality.score,
        siteConfig.programmaticQuality.minSitemapScore,
        quality.wordCount,
      );
      if (!sitemapEligible) continue;

      const freshness = calculateFreshnessScore({
        lastmod: programmaticLastmod,
        keywordCount: page.keywords.length,
        slug: page.slug,
        clusterKey: page.clusterKey,
        primaryTool: page.primaryTool,
      });

      const priorityValue = Math.max(0.4, Math.min(0.8, 0.4 + freshness * 0.4)).toFixed(1);

      entries.push({
        loc: absoluteUrl(`/k/${page.slug}`),
        lastmod: programmaticLastmod,
        changefreq: 'weekly',
        priority: priorityValue,
        freshness,
      });
    }

    entries.sort((a, b) => b.freshness - a.freshness);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(renderUrlEntry).join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
    },
  });
}

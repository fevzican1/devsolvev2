import { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { toolRegistry } from '@/tools/registry';
import { guideRegistry } from '@/content/guides';
import { getTotalPageCount, getPageByIndex } from '@/data/programmatic';

const URLS_PER_SITEMAP = 5000;

export async function generateSitemaps() {
  const programmaticChunks = Math.ceil(getTotalPageCount() / URLS_PER_SITEMAP);
  /* id 0 = core pages (static + tools + guides)
     id 1..N = programmatic page chunks */
  return Array.from({ length: programmaticChunks + 1 }, (_, i) => ({ id: i }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.siteUrl;

  if (id === 0) {
    const staticPages: MetadataRoute.Sitemap = [
      { url: `${base}/`, changeFrequency: 'weekly', priority: 1.0 },
      { url: `${base}/tools/`, changeFrequency: 'weekly', priority: 0.9 },
      { url: `${base}/guides/`, changeFrequency: 'weekly', priority: 0.9 },
      { url: `${base}/legal/privacy/`, changeFrequency: 'monthly', priority: 0.3 },
      { url: `${base}/legal/terms/`, changeFrequency: 'monthly', priority: 0.3 },
      { url: `${base}/legal/cookies/`, changeFrequency: 'monthly', priority: 0.3 },
    ];
    const toolPages: MetadataRoute.Sitemap = toolRegistry.map((t) => ({
      url: `${base}/tools/${t.slug}/`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    const guidePages: MetadataRoute.Sitemap = guideRegistry.map((g) => ({
      url: `${base}/guides/${g.slug}/`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    return [...staticPages, ...toolPages, ...guidePages];
  }

  /* Programmatic page chunk */
  const start = (id - 1) * URLS_PER_SITEMAP;
  const end = Math.min(start + URLS_PER_SITEMAP, getTotalPageCount());
  const entries: MetadataRoute.Sitemap = [];

  for (let i = start; i < end; i++) {
    const page = getPageByIndex(i);
    if (page) {
      entries.push({
        url: `${base}/k/${page.slug}/`,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }
  }

  return entries;
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { guideRegistry } from '@/content/guides';
import { toolRegistry } from '@/tools/registry';
import { staticProgrammaticSlugs } from '@/lib/programmatic/staticPaths';
import { clusterHubHref, CORPUS_CLUSTER_KEYS } from '@/lib/programmatic/corpusClusters';
import { sortClustersByPriority } from '@/lib/seo/priorityClusters';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/config/site';
import { absoluteUrl } from '@/lib/seo/url';

const PAGE_SIZE = 50;

export const dynamic = 'force-static';

export async function generateStaticParams() {
  const total = Math.ceil(guideRegistry.length / PAGE_SIZE);
  return Array.from({ length: total }, (_, i) => ({ page: String(i + 1) }));
}

export const metadata: Metadata = buildMetadata({
  title: 'Site Arşivi — Tüm Kılavuzlar ve Araçlar',
  description: 'DevSolve tüm kılavuz, araç ve workflow cluster dizini. Kategorilere ayrılmış, sayfalandırılmış HTML sitemap.',
  path: '/guides/page/1',
});

function paginate<T>(items: T[], page: number, size: number): T[] {
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

export default function GuidesSitemapPage({ params }: { params: { page: string } }) {
  const page = Math.max(1, Number.parseInt(params.page, 10) || 1);
  const totalPages = Math.ceil(guideRegistry.length / PAGE_SIZE);

  if (page > totalPages && totalPages > 0) notFound();

  const pagedGuides = paginate(guideRegistry, page, PAGE_SIZE);
  const priorityClusters = sortClustersByPriority([...CORPUS_CLUSTER_KEYS]);

  const programmaticByCluster: Record<string, string[]> = {};
  for (const cluster of priorityClusters) {
    programmaticByCluster[cluster] = staticProgrammaticSlugs
      .filter((slug) => slug.startsWith(`${cluster}-`))
      .slice(0, 8);
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'DevSolve Site Archive',
            url: absoluteUrl(`/guides/page/${page}`),
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
                { '@type': 'ListItem', position: 2, name: 'Guides', item: absoluteUrl('/guides') },
                { '@type': 'ListItem', position: 3, name: `Archive Page ${page}`, item: absoluteUrl(`/guides/page/${page}`) },
              ],
            },
          }),
        }}
      />
      <h1 className="text-3xl font-bold mb-2">Site Arşivi</h1>
      <p className="text-muted-foreground mb-8">
        Tüm kılavuzlar, araçlar ve workflow cluster'ların kategorilere ayrılmış dizini.
        Bu sayfa ana sayfadan doğrudan linklenir; backlink gücü içerideki {'<a>'} bağlantılarıyla
        alt sayfalara ({totalPages} sayfa) yayılır.
      </p>

      <nav className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">Home</Link> ›{' '}
        <Link href="/guides" className="hover:underline">Guides</Link> ›{' '}
        <span className="text-foreground">Archive Page {page} of {totalPages}</span>
      </nav>

      {/* Cluster / programmatic section */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">Workflow Clusterları (Programatik /k/)</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Her cluster, ilgili 20 milyon /k/ sayfasının giriş kapısıdır. Home → /g/[cluster] → /k/[slug]
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {priorityClusters.map((cluster) => (
            <div key={cluster} className="border rounded-lg p-4">
              <h3 className="font-medium mb-3 capitalize">{cluster} workflows</h3>
              <ul className="text-sm space-y-1">
                {programmaticByCluster[cluster]?.map((slug) => (
                  <li key={slug}>
                    <Link
                      href={`/k/${slug}`}
                      className="text-muted-foreground hover:text-primary hover:underline"
                    >
                      {slug.replace(/-/g, ' ')}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                <Link href={clusterHubHref(cluster)} className="text-primary hover:underline">
                  Tüm {cluster} sayfaları →
                </Link>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Guides section */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">Kılavuzlar (Guides)</h2>
        <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedGuides.map((guide) => (
            <li key={guide.slug} className="border rounded-lg p-3">
              <Link
                href={`/guides/${guide.slug}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {guide.title}
              </Link>
              <p className="text-xs text-muted-foreground mt-1">{guide.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Tools section */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">Araçlar (Tools)</h2>
        <ul className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {toolRegistry.map((tool) => (
            <li key={tool.slug} className="border rounded-lg p-3">
              <Link
                href={`/tools/${tool.slug}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {tool.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Pagination */}
      <nav className="mt-12 flex items-center justify-between text-sm">
        {page > 1 && (
          <Link
            href={`/guides/page/${page - 1}`}
            className="text-primary hover:underline font-medium"
          >
            ← Önceki Sayfa
          </Link>
        )}
        <span className="text-muted-foreground">
          Sayfa {page} / {totalPages}
        </span>
        {page < totalPages && (
          <Link
            href={`/guides/page/${page + 1}`}
            className="text-primary hover:underline font-medium"
          >
            Sonraki Sayfa →
          </Link>
        )}
      </nav>
    </div>
  );
}
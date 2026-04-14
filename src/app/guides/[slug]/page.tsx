import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shield, ArrowRight, FileText, Wrench } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { guideRegistry, getGuideBySlug } from '@/content/guides';
import { getToolBySlug } from '@/tools/registry';
import { GuideContent } from '@/components/guides/GuideContent';
import { RecommendedSolutions } from '@/components/monetization/RecommendedSolutions';
import { monetizationConfig } from '@/config/monetization';
import { loadGuideContentCached } from '@/lib/guides/loader';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/url';
import { externalUrls, siteConfig } from '@/config/site';
import {
  CommercialOpportunityLinks,
  EditorialByline,
  EditorialIntro,
  OriginalValueCallouts,
} from '@/components/content/EditorialIdentity';
import { RelatedItemsLinks } from '@/components/seo/RelatedItemsLinks';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return buildMetadata({ title: 'Guide Not Found', noindex: true });

  return buildMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guides/${slug}`,
    keywords: [...guide.clusterKeys, 'developer guide', 'tutorial', 'best practices'],
    articleSection: 'Developer Guides',
  });
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  const guideContent = await loadGuideContentCached(slug);
  const content = guideContent ? `${guideContent.part1}\n\n${guideContent.part2}` : '';

  const primaryTool = getToolBySlug(guide.primaryToolSlug);
  const relatedTools = guide.relatedToolSlugs
    .map(getToolBySlug)
    .filter((t): t is NonNullable<typeof t> => t !== undefined);
  const relatedGuides = guideRegistry
    .filter((candidate) => candidate.slug !== guide.slug)
    .filter((candidate) => candidate.clusterKeys.some((key) => guide.clusterKeys.includes(key)))
    .slice(0, 6);
  const smartRelatedLinks = [
    ...(primaryTool
      ? [{
          href: `/tools/${primaryTool.slug}`,
          label: primaryTool.name,
          description: primaryTool.shortDescription,
        }]
      : []),
    ...relatedTools.map((tool) => ({
      href: `/tools/${tool.slug}`,
      label: tool.name,
      description: tool.shortDescription,
    })),
    ...relatedGuides.map((candidate) => ({
      href: `/guides/${candidate.slug}`,
      label: candidate.title,
      description: candidate.description,
    })),
  ];

  const breadcrumbJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: absoluteUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Guides',
        item: absoluteUrl('/guides'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: guide.title,
        item: absoluteUrl(`/guides/${slug}`),
      },
    ],
  };

  const articleJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'TechArticle',
    headline: guide.title,
    description: guide.description,
    url: absoluteUrl(`/guides/${slug}`),
    datePublished: siteConfig.launchDate,
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: 'DevSolve Editorial Team',
      url: absoluteUrl('/about'),
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: absoluteUrl('/'),
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/favicon.svg'),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(`/guides/${slug}`),
    },
    inLanguage: 'en',
    isAccessibleForFree: true,
    keywords: guide.clusterKeys.join(', '),
    about: {
      '@type': 'Thing',
      name: guide.title,
    },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <article className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/guides" className="hover:text-foreground">
              Guides
            </Link>
            <span>/</span>
            <span className="truncate">{guide.title}</span>
          </div>

          <h1 className="text-3xl font-bold mb-4">{guide.title}</h1>
          <EditorialByline />
          <p className="text-lg text-muted-foreground mb-4">{guide.description}</p>
          <EditorialIntro toolName={primaryTool?.name ?? guide.title} />
          <CommercialOpportunityLinks />

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Runs locally in your browser
            </Badge>
            {primaryTool && (
              <Link href={`/tools/${primaryTool.slug}`}>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  {primaryTool.name}
                </Badge>
              </Link>
            )}
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none mb-8">
          <GuideContent content={content} />
        </div>

        <OriginalValueCallouts toolName={primaryTool?.name ?? guide.title} />

        <div className="p-4 rounded-lg bg-muted/50 border mb-8">
          <p className="text-sm text-muted-foreground">
            {monetizationConfig.disclosure.shortDisclosure}:{' '}
            {monetizationConfig.disclosure.affiliateText}
          </p>
        </div>

        <RecommendedSolutions toolSlug={guide.primaryToolSlug} />

        <Separator className="my-8" />

        <div className="grid md:grid-cols-2 gap-8">
          {primaryTool && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Primary Tool
              </h2>
              <Link href={`/tools/${primaryTool.slug}`}>
                <Card className="hover:shadow-sm transition-shadow">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {primaryTool.name}
                      </CardTitle>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <CardDescription className="text-xs">
                      {primaryTool.shortDescription}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          )}

          {relatedTools.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Related Tools
              </h2>
              <div className="space-y-3">
                {relatedTools.slice(0, 3).map((tool) => (
                  <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                    <Card className="hover:shadow-sm transition-shadow">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {tool.name}
                          </CardTitle>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <CardDescription className="text-xs">
                          {tool.shortDescription}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <RelatedItemsLinks title="Explore Related Pages" items={smartRelatedLinks} />
      </article>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shield, ArrowRight, Wrench, AlertTriangle, CheckCircle, Lightbulb, HelpCircle, BookOpen, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getProgrammaticPageBySlug, getPageByIndex, getTotalPageCount } from '@/data/programmatic';
import { getToolBySlug, toolRegistry } from '@/tools/registry';
import { guideRegistry } from '@/content/guides';
import { siteConfig, externalUrls } from '@/config/site';
import { monetizationConfig } from '@/config/monetization';
import { RecommendedSolutions } from '@/components/monetization/RecommendedSolutions';
import { ComputedExample } from '@/components/programmatic/ComputedExample';
import { buildMetadata } from '@/lib/seo/metadata';
import { linkifyCommercialTerms } from '@/lib/content/commercialLinks';
import { hashString } from '@/lib/utils';
import {
  CommercialOpportunityLinks,
  EditorialByline,
  EditorialIntro,
  OriginalValueCallouts,
  TransparencyBadge,
} from '@/components/content/EditorialIdentity';

/* ISR: revalidate every 24 hours; allow any slug not in generateStaticParams */
export const revalidate = 86400;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getProgrammaticDiscoveryLinks(currentSlug: string, clusterKey: string, count = 12) {
  const total = getTotalPageCount();
  if (total < 2) return [];

  const seed = Math.abs(hashString(currentSlug));
  const links: Array<{ slug: string; title: string }> = [];
  const seen = new Set<string>();
  const step = 7919;
  const preferredClusterFloor = Math.floor(count * 0.7);
  let attempts = 0;

  while (links.length < count && attempts < count * 120) {
    const idx = (seed + attempts * step) % total;
    attempts += 1;

    const candidate = getPageByIndex(idx);
    if (!candidate || candidate.slug === currentSlug || seen.has(candidate.slug)) continue;

    if (links.length < preferredClusterFloor && candidate.clusterKey !== clusterKey) continue;

    seen.add(candidate.slug);
    links.push({ slug: candidate.slug, title: candidate.title });
  }

  return links;
}

export async function generateStaticParams() {
  /* Pre-render a small, evenly distributed sample and render the rest via ISR. */
  const totalPrerender = 500;
  const totalPages = getTotalPageCount();
  if (totalPages < 1) return [];
  const step = Math.max(1, Math.floor(totalPages / totalPrerender));

  const seen = new Set<string>();
  const params: { slug: string }[] = [];
  for (let i = 0; i < totalPrerender; i++) {
    const idx = Math.min(i * step, totalPages - 1);
    const page = getPageByIndex(idx);
    if (page && !seen.has(page.slug)) {
      seen.add(page.slug);
      params.push({ slug: page.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getProgrammaticPageBySlug(slug);
  if (!page) return buildMetadata({ title: 'Not Found', noindex: true });

  return buildMetadata({
    title: page.title,
    description: page.description,
    path: `/k/${slug}`,
    noindex: false,
    keywords: page.keywords,
    datePublished: '2026-01-15T00:00:00Z',
    dateModified: new Date().toISOString(),
    articleSection: page.clusterKey,
  });
}

export default async function ProgrammaticPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getProgrammaticPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const primaryTool = getToolBySlug(page.primaryTool);
  const relatedTools = toolRegistry
    .filter(t => t.slug !== page.primaryTool)
    .slice(0, 3);
  const relatedGuides = guideRegistry
    .filter(g => g.clusterKeys.includes(page.clusterKey))
    .slice(0, 2);
  const semanticProgrammaticLinks = getProgrammaticDiscoveryLinks(page.slug, page.clusterKey, 12);
  const popularTools = toolRegistry.slice(0, 6);
  const categoryExplorationLinks = [
    { href: '/tools', label: 'Developer tools directory' },
    { href: '/guides', label: 'Developer guides hub' },
    { href: '/about', label: 'About editorial standards' },
    { href: '/contact', label: 'Contact the editorial team' },
    { href: '/legal/privacy', label: 'Privacy policy' },
    { href: '/legal/publisher-ethics', label: 'Publisher ethics policy' },
  ];

  const faqJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'FAQPage',
    mainEntity: page.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
  const howToJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'HowTo',
    name: page.h1,
    description: page.description,
    step: page.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: `Step ${index + 1}`,
      text: step,
    })),
  };
  const softwareApplicationJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'SoftwareApplication',
    name: primaryTool?.name ?? 'Developer utility',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  const breadcrumbJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteConfig.siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Tools',
        item: `${siteConfig.siteUrl}/tools`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: page.title,
        item: `${siteConfig.siteUrl}/k/${slug}`,
      },
    ],
  };

  const articleJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'TechArticle',
    headline: page.h1,
    description: page.description,
    url: `${siteConfig.siteUrl}/k/${slug}`,
    datePublished: '2026-01-15T00:00:00Z',
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: 'DevSolve Editorial Team',
      url: `${siteConfig.siteUrl}/about`,
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.siteUrl}/favicon.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteConfig.siteUrl}/k/${slug}`,
    },
    about: {
      '@type': 'Thing',
      name: page.intent.replace(/-/g, ' '),
    },
    proficiencyLevel: 'Beginner',
    dependencies: `Web browser with JavaScript enabled`,
    inLanguage: 'en',
    isAccessibleForFree: true,
    keywords: page.keywords.join(', '),
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/tools" className="hover:text-foreground">
              Tools
            </Link>
            <span>/</span>
            <span className="truncate">{page.title}</span>
          </div>

          <h1 className="text-3xl font-bold mb-4">{page.h1}</h1>
          <div className="flex items-center gap-3 mb-3">
            <TransparencyBadge />
          </div>
          <EditorialByline />
          <p
            className="text-lg text-muted-foreground mb-4"
            dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(page.intro) }}
          />
          <EditorialIntro toolName={primaryTool?.name ?? 'this tool'} />
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

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Step-by-Step Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {page.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(step) }} />
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <ComputedExample toolSlug={page.primaryTool} />

        <Card className="mb-8 border-primary/25 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Why Use This?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              This page explains step by step how to handle the{' '}
              <strong>{page.intent.replace(/-/g, ' ')}</strong> task in real project scenarios
              using <strong>{primaryTool?.name ?? 'the relevant tool'}</strong>.
            </p>
            <p>
              The content combines technical depth, error-point analysis, and alternative solutions,
              making it a definitive landing page where you can make informed decisions — not just a
              redirect page built for traffic.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8 border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Troubleshooting Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {page.pitfalls.map((pitfall, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-warning">-</span>
                  <span dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(pitfall) }} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Alternative Solutions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Approach</th>
                    <th className="text-left py-2 pr-4">Advantages</th>
                    <th className="text-left py-2">Considerations</th>
                  </tr>
                </thead>
                <tbody>
                  {page.comparison.map((row, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td
                        className="py-2 pr-4 font-medium"
                        dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(row.item) }}
                      />
                      <td
                        className="py-2 pr-4 text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(row.pros) }}
                      />
                      <td
                        className="py-2 text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(row.cons) }}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Pro Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {page.proTips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary font-bold">{index + 1}.</span>
                  <span dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(tip) }} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Technical Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {page.technicalAnalysis.map((paragraph, index) => (
                <p
                  key={index}
                  className="text-sm text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(paragraph) }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Tool History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {page.toolHistory.map((paragraph, index) => (
              <p
                key={index}
                className="text-sm text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(paragraph) }}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Real-World Usage Examples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {page.globalUseCases.map((paragraph, index) => (
              <p
                key={index}
                className="text-sm text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(paragraph) }}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Technical Glossary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {page.glossary.map((item) => (
                <div key={item.term}>
                  <dt className="text-sm font-medium">{item.term}</dt>
                  <dd className="text-sm text-muted-foreground">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Community Feedback</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">These are illustrative examples representing common user experiences, not verified reviews.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {page.simulatedReviews.map((review, index) => (
                <div key={`${review.role}-${index}`} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{review.role}</p>
                  <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                  <p className="text-xs text-muted-foreground mt-2">Rating: {review.rating}/5</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Expert Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {page.expertTips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="font-bold">{index + 1}.</span>
                  <span dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(tip) }} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {page.faq.map((item, index) => (
                <div key={index}>
                  <h3
                    className="font-medium text-sm mb-1"
                    dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(item.question) }}
                  />
                  <p
                    className="text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: linkifyCommercialTerms(item.answer) }}
                  />
                  {index < page.faq.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="p-4 rounded-lg bg-muted/50 border mb-8">
          <p className="text-sm text-muted-foreground">
            {monetizationConfig.disclosure.shortDisclosure}:{' '}
            {monetizationConfig.disclosure.affiliateText}
          </p>
        </div>

        <RecommendedSolutions toolSlug={page.primaryTool} />
        <OriginalValueCallouts toolName={primaryTool?.name ?? 'this tool'} />

        <Separator className="my-8" />

        <div className="grid gap-8 md:grid-cols-3 mb-8">
          <div>
            <h2 className="text-lg font-semibold mb-3">Similar Tools</h2>
            <ul className="space-y-2 text-sm">
              {semanticProgrammaticLinks.slice(0, 6).map((item) => (
                <li key={item.slug}>
                  <Link href={`/k/${item.slug}`} className="text-muted-foreground hover:text-foreground">
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3">Most Popular</h2>
            <ul className="space-y-2 text-sm">
              {popularTools.map((tool) => (
                <li key={tool.slug}>
                  <Link href={`/tools/${tool.slug}`} className="text-muted-foreground hover:text-foreground">
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3">Explore by Category</h2>
            <ul className="space-y-2 text-sm">
              {categoryExplorationLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-muted-foreground hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Related Tools
            </h2>
            <div className="space-y-3">
              {relatedTools.map((tool) => (
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

          {relatedGuides.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Related Guides</h2>
              <div className="space-y-3">
                {relatedGuides.map((guide) => (
                  <Link key={guide.slug} href={`/guides/${guide.slug}`}>
                    <Card className="hover:shadow-sm transition-shadow">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {guide.title}
                          </CardTitle>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

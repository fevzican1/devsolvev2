import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Shield, AlertTriangle, ArrowRight, FileText, Wrench, HelpCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toolRegistry, getToolBySlug, getRelatedTools } from '@/tools/registry';
import { getGuidesForTool } from '@/content/guides';
import { ToolRenderer } from '@/components/tools/ToolRenderer';
import { RecommendedSolutions } from '@/components/monetization/RecommendedSolutions';
import { StaticRevenueModules } from '@/components/monetization/StaticRevenue';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  CommercialOpportunityLinks,
  EditorialByline,
  EditorialIntro,
  OriginalValueCallouts,
} from '@/components/content/EditorialIdentity';
import { buildToolPageContent } from '@/lib/seo/toolPageContent';
import ToolsPage from '@/app/tools/page';
import { externalUrls } from '@/config/site';
import { TOOLS_SECTION_METADATA } from '@/lib/seo/sectionMetadata';
import { absoluteUrl } from '@/lib/seo/url';
import { RelatedItemsLinks } from '@/components/seo/RelatedItemsLinks';
import { HubDiscoveryLinks } from '@/components/seo/HubDiscoveryLinks';
import { ToolAiHelper } from '@/components/ai/ToolAiHelper';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-static';

// Pure SSG at build time (`output: 'export'`).

export async function generateStaticParams() {
  return toolRegistry.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return buildMetadata(TOOLS_SECTION_METADATA);

  return buildMetadata({
    title: `${tool.name} — Free Online Tool`,
    description: tool.description,
    path: `/tools/${slug}`,
    keywords: [...tool.keywords, 'online tool', 'free', 'browser-based', 'developer tool'],
  });
}

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return <ToolsPage />;
  }

  const relatedTools = getRelatedTools(slug);
  const relatedGuides = getGuidesForTool(slug);
  const siblingTools = toolRegistry
    .filter((candidate) => candidate.slug !== slug && candidate.category === tool.category)
    .slice(0, 6);
  const smartRelatedLinks = [
    ...relatedTools.map((relatedTool) => ({
      href: `/tools/${relatedTool.slug}`,
      label: relatedTool.name,
      description: relatedTool.shortDescription,
    })),
    ...relatedGuides.map((guide) => ({
      href: `/guides/${guide.slug}`,
      label: guide.title,
      description: guide.description,
    })),
    ...siblingTools.map((sibling) => ({
      href: `/tools/${sibling.slug}`,
      label: sibling.name,
      description: sibling.shortDescription,
    })),
  ];
  const dynamicContent = buildToolPageContent(tool);
  const softwareApplicationJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'SoftwareApplication',
    name: tool.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };
  const howToJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'HowTo',
    name: `How to use ${tool.name}`,
    description: tool.description,
    step: dynamicContent.howTo.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: `Step ${index + 1}`,
      text: step,
    })),
  };

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
        name: 'Tools',
        item: absoluteUrl('/tools'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: tool.name,
        item: absoluteUrl(`/tools/${tool.slug}`),
      },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dynamicContent.faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-5xl mx-auto">
        <article itemScope itemType="https://schema.org/SoftwareApplication">
          <meta itemProp="applicationCategory" content="DeveloperApplication" />
          <meta itemProp="operatingSystem" content="Web Browser" />
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/tools" className="hover:text-foreground">
              Tools
            </Link>
            <span>/</span>
            <span>{tool.name}</span>
          </div>

          <h1 className="text-3xl font-bold mb-4">{tool.name}</h1>
          <EditorialByline />
          <p className="text-lg text-muted-foreground mb-4">{tool.description}</p>
          <EditorialIntro toolName={tool.name} />
          <CommercialOpportunityLinks />

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Runs locally in your browser
            </Badge>
            <Badge variant="outline">{tool.category}</Badge>
          </div>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <ToolRenderer slug={slug} />
            <ToolAiHelper toolSlug={slug} toolName={tool.name} />
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">About This Tool</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dynamicContent.overview.map((paragraph, index) => (
              <p key={index} className="text-sm leading-7 text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Tool History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dynamicContent.history.map((paragraph, index) => (
              <p key={index} className="text-sm leading-7 text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Practical Workflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dynamicContent.globalUseCases.map((paragraph, index) => (
              <p key={index} className="text-sm leading-7 text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Technical Terms Glossary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {dynamicContent.glossary.map((item) => (
                <div key={item.term}>
                  <dt className="text-sm font-medium">{item.term}</dt>
                  <dd className="text-sm text-muted-foreground">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="mb-8 border-primary/25 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              How to Use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {dynamicContent.howTo.map((step, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="mb-8 border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Limitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tool.limitations.map((limitation, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-warning">-</span>
                  {limitation}
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
              {dynamicContent.faq.map((item, index) => (
                <div key={index}>
                  <h3 className="font-medium text-sm mb-1">{item.question}</h3>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                  {index < dynamicContent.faq.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <RecommendedSolutions toolSlug={slug} />
        <StaticRevenueModules toolName={tool.name} seed={slug} />
        <OriginalValueCallouts toolName={tool.name} />

        <Separator className="my-8" />

        <div className="grid md:grid-cols-2 gap-8">
          {relatedTools.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Related Tools
              </h2>
              <div className="space-y-3">
                {relatedTools.map((relatedTool) => (
                  <Link key={relatedTool.slug} href={`/tools/${relatedTool.slug}`}>
                    <Card className="hover:shadow-sm transition-shadow">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {relatedTool.name}
                          </CardTitle>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <CardDescription className="text-xs">
                          {relatedTool.shortDescription}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {relatedGuides.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Related Guides
              </h2>
              <div className="space-y-3">
                {relatedGuides.slice(0, 3).map((guide) => (
                  <Link key={guide.slug} href={`/guides/${guide.slug}`}>
                    <Card className="hover:shadow-sm transition-shadow">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {guide.title}
                          </CardTitle>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <CardDescription className="text-xs">
                          {guide.description}
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
        <Suspense fallback={null}>
          <HubDiscoveryLinks hubPath={`/tools/${slug}`} heading="Guides & Tools" />
        </Suspense>
        </article>
      </div>
    </div>
  );
}

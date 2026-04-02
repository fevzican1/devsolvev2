import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shield, AlertTriangle, ArrowRight, FileText, Wrench, HelpCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toolRegistry, getToolBySlug, getRelatedTools } from '@/tools/registry';
import { getGuidesForTool } from '@/content/guides';
import { ToolRenderer } from '@/components/tools/ToolRenderer';
import { RecommendedSolutions } from '@/components/monetization/RecommendedSolutions';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  CommercialOpportunityLinks,
  EditorialByline,
  EditorialIntro,
  OriginalValueCallouts,
} from '@/components/content/EditorialIdentity';
import { buildToolPageContent } from '@/lib/seo/toolPageContent';
import { externalUrls } from '@/config/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return toolRegistry.map((tool) => ({
    slug: tool.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return buildMetadata({ title: 'Tool Not Found', noindex: true });

  return buildMetadata({
    title: tool.name,
    description: tool.description,
    path: `/tools/${slug}`,
  });
}

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const relatedTools = getRelatedTools(slug);
  const relatedGuides = getGuidesForTool(slug);
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
      <div className="max-w-5xl mx-auto">
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
      </div>
    </div>
  );
}

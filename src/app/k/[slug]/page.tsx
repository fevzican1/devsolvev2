import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shield, ArrowRight, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { generateProgrammaticPages, getProgrammaticPageBySlug } from '@/data/programmatic';
import { getToolBySlug, toolRegistry } from '@/tools/registry';
import { guideRegistry } from '@/content/guides';
import { calculateQualityScore, shouldIndex } from '@/lib/quality/scoring';
import { siteConfig } from '@/config/site';
import { monetizationConfig } from '@/config/monetization';
import { RecommendedSolutions } from '@/components/monetization/RecommendedSolutions';
import { ComputedExample } from '@/components/programmatic/ComputedExample';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const pages = generateProgrammaticPages();
  return pages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getProgrammaticPageBySlug(slug);
  if (!page) return { title: 'Not Found' };

  const score = calculateQualityScore(page);
  const noindex = !shouldIndex(score.score, siteConfig.programmaticQuality.minIndexScore);

  return {
    title: page.title,
    description: page.description,
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
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

  return (
    <div className="container mx-auto px-4 py-12">
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
          <p className="text-lg text-muted-foreground mb-4">{page.intro}</p>

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
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <ComputedExample toolSlug={page.primaryTool} />

        <Card className="mb-8 border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Common Pitfalls to Avoid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {page.pitfalls.map((pitfall, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-warning">-</span>
                  {pitfall}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Comparison of Approaches</CardTitle>
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
                      <td className="py-2 pr-4 font-medium">{row.item}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.pros}</td>
                      <td className="py-2 text-muted-foreground">{row.cons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

        <Separator className="my-8" />

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

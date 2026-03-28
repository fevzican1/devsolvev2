import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FileText, BookOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { guideRegistry } from '@/content/guides';
import { getToolBySlug } from '@/tools/registry';
import { buildMetadata } from '@/lib/seo/metadata';
import { HubDiscoveryLinks } from '@/components/seo/HubDiscoveryLinks';

export const metadata: Metadata = buildMetadata({
  title: 'Developer Guides',
  description:
    'Technical guides for developer workflows, including best practices, pitfalls, and practical examples.',
  path: '/guides',
});

export default function GuidesPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mb-12">
        <h1 className="text-4xl font-bold mb-4">Developer Guides</h1>
        <p className="text-xl text-muted-foreground mb-4">
          Practical guidance for common development workflows. Each guide covers
          best practices, common pitfalls, and how to use our browser-based tools effectively.
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>{guideRegistry.length} guides available</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {guideRegistry.map((guide) => {
          const primaryTool = getToolBySlug(guide.primaryToolSlug);

          return (
            <Link key={guide.slug} href={`/guides/${guide.slug}`}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardHeader>
                  <FileText className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{guide.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {guide.description}
                  </CardDescription>
                  {primaryTool && (
                    <Badge variant="secondary" className="text-xs">
                      Uses: {primaryTool.name}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Suspense fallback={null}>
        <HubDiscoveryLinks hubPath="/guides/" heading="Related Technical Guides" />
      </Suspense>
    </div>
  );
}

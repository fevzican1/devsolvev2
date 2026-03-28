import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Wrench, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toolRegistry, type ToolDefinition } from '@/tools/registry';
import { buildMetadata } from '@/lib/seo/metadata';
import { HubDiscoveryLinks } from '@/components/seo/HubDiscoveryLinks';

export const metadata: Metadata = buildMetadata({
  title: 'Developer Tools',
  description:
    'Browser-based developer tools for formatting, validation, encoding, and debugging workflows.',
  path: '/tools',
});

const categories = [
  { key: 'formatting', label: 'Formatting' },
  { key: 'encoding', label: 'Encoding' },
  { key: 'security', label: 'Security' },
  { key: 'validation', label: 'Validation' },
  { key: 'text', label: 'Text' },
  { key: 'conversion', label: 'Conversion' },
] as const;

function groupToolsByCategory(tools: ToolDefinition[]) {
  const grouped: Record<string, ToolDefinition[]> = {};
  tools.forEach((tool) => {
    if (!grouped[tool.category]) {
      grouped[tool.category] = [];
    }
    grouped[tool.category].push(tool);
  });
  return grouped;
}

export default function ToolsPage() {
  const groupedTools = groupToolsByCategory(toolRegistry);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mb-12">
        <h1 className="text-4xl font-bold mb-4">Developer Tools</h1>
        <p className="text-xl text-muted-foreground mb-4">
          Browser-based utilities for common development tasks. Format, validate,
          encode, and transform your data without sending it to external servers.
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>All tools run locally in your browser</span>
        </div>
      </div>

      {categories.map((category) => {
        const tools = groupedTools[category.key];
        if (!tools || tools.length === 0) return null;

        return (
          <section key={category.key} className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 capitalize">{category.label}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool) => (
                <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <Wrench className="h-8 w-8 text-primary" />
                        {tool.isHeavy && (
                          <Badge variant="outline" className="text-xs">
                            Advanced
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{tool.shortDescription}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <Suspense fallback={null}>
        <HubDiscoveryLinks hubPath="/tools/" heading="İlgili Teknik Rehberler" />
      </Suspense>
    </div>
  );
}

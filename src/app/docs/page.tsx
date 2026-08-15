import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BookOpen, FileText, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toolRegistry, type ToolDefinition } from '@/tools/registry';
import { guideRegistry } from '@/content/guides';
import { buildMetadata } from '@/lib/seo/metadata';
import { DOCS_SECTION_METADATA } from '@/lib/seo/sectionMetadata';
import { HubDiscoveryLinks } from '@/components/seo/HubDiscoveryLinks';
import { REVENUE_HOPS, REVENUE_REL } from '@/config/revenue';
import { externalUrls } from '@/config/site';
import { absoluteUrl } from '@/lib/seo/url';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata(DOCS_SECTION_METADATA);

const CATEGORIES = [
  { key: 'formatting', label: 'Formatting & structure' },
  { key: 'encoding', label: 'Encoding & transport' },
  { key: 'security', label: 'Tokens & integrity' },
  { key: 'validation', label: 'Validation' },
  { key: 'text', label: 'Text, regex & diffs' },
  { key: 'conversion', label: 'Conversion' },
] as const;

const POPULAR_TOPICS = [
  { href: '/tools/json-formatter', title: 'JSON payloads', blurb: 'Format, validate, and inspect API JSON locally.' },
  { href: '/tools/jwt-decoder', title: 'JWT claims', blurb: 'Decode headers and payloads without uploading tokens.' },
  { href: '/tools/base64-encode-decode', title: 'Base64 transport', blurb: 'Encode and decode UTF-8-safe Base64 strings.' },
  { href: '/tools/url-encode-decode', title: 'URL encoding', blurb: 'Percent-encode query values without double-encoding bugs.' },
  { href: '/tools/hash-generator', title: 'Integrity hashes', blurb: 'SHA checksums for local integrity checks.' },
  { href: '/tools/regex-tester', title: 'Regex fixtures', blurb: 'Test capture groups against sample text in the browser.' },
  { href: '/guides/json-validation-formatting', title: 'JSON review workflow', blurb: 'Editorial guide for syntax, diffs, and payload hygiene.' },
  { href: '/guides/jwt-decoding-browser', title: 'Browser JWT inspection', blurb: 'Safe local decoding — no signature verification.' },
  { href: '/k', title: 'Scenario library (/k)', blurb: 'Job × tool walkthroughs for production debugging.' },
] as const;

function groupToolsByCategory(tools: ToolDefinition[]) {
  const grouped: Record<string, ToolDefinition[]> = {};
  for (const tool of tools) {
    (grouped[tool.category] ??= []).push(tool);
  }
  return grouped;
}

export default function DocsPage() {
  const groupedTools = groupToolsByCategory(toolRegistry);

  const collectionPageJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'CollectionPage',
    name: 'DevSolve Docs',
    description: DOCS_SECTION_METADATA.description,
    url: absoluteUrl('/docs'),
    isAccessibleForFree: true,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Docs', item: absoluteUrl('/docs') },
      ],
    },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
      />

      <div className="max-w-3xl mb-10">
        <p
          style={{
            display: 'inline-block',
            background: '#ecfeff',
            color: '#0e7490',
            border: '1px solid #a5f3fc',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.02em',
            padding: '6px 12px',
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          No Signup Required — 100% Free Public Web Access
        </p>
        <h1 className="text-4xl font-bold mb-4">Docs</h1>
        <p className="text-xl text-muted-foreground mb-4">
          Public documentation hub for DevSolve tools, data workflows, and
          copy-ready guides. Everything runs in your browser — no account, no
          upload, no database.
        </p>
        <p className="text-sm text-muted-foreground">
          {toolRegistry.length} tools · {guideRegistry.length} guides · free public access
        </p>
      </div>

      <section className="mb-12" aria-labelledby="popular-topics">
        <h2 id="popular-topics" className="text-2xl font-semibold mb-6">
          Popular data topics
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {POPULAR_TOPICS.map((topic) => (
            <Link key={topic.href} href={topic.href}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardHeader>
                  <FileText className="h-6 w-6 text-primary mb-2" />
                  <CardTitle className="text-lg">{topic.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{topic.blurb}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {CATEGORIES.map((category) => {
        const tools = groupedTools[category.key];
        if (!tools || tools.length === 0) return null;
        return (
          <section key={category.key} className="mb-12" aria-labelledby={`docs-${category.key}`}>
            <h2 id={`docs-${category.key}`} className="text-2xl font-semibold mb-6">
              {category.label}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool) => (
                <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardHeader>
                      <Wrench className="h-6 w-6 text-primary mb-2" />
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-3">{tool.shortDescription}</CardDescription>
                      <Badge variant="secondary" className="text-xs">
                        {category.label}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <section className="mb-12" aria-labelledby="editorial-guides">
        <h2 id="editorial-guides" className="text-2xl font-semibold mb-6">
          Editorial guides
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guideRegistry.map((guide) => (
            <Link key={guide.slug} href={`/guides/${guide.slug}`}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardHeader>
                  <BookOpen className="h-6 w-6 text-primary mb-2" />
                  <CardTitle className="text-lg">{guide.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{guide.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <aside
        className="native-affiliate-box mb-12"
        style={{
          background: '#f8fafc',
          borderLeft: '4px solid #2563eb',
          padding: 16,
        }}
      >
        <strong style={{ color: '#1e293b', fontSize: 14 }}>Sponsored API documentation</strong>
        <p style={{ color: '#475569', fontSize: 13, margin: '8px 0 12px' }}>
          For production scraping and HTTP collection alongside these local tools,
          ScraperAPI publishes public docs and pricing. We may earn a commission
          at no extra cost to you.
        </p>
        <a
          href={REVENUE_HOPS.scraperapiDocs}
          target="_blank"
          rel={REVENUE_REL.sponsored}
          style={{ color: '#2563eb', fontWeight: 700, fontSize: 13, textDecoration: 'underline', marginRight: 16 }}
        >
          ScraperAPI documentation →
        </a>
        <a
          href={REVENUE_HOPS.scraperapiPricing}
          target="_blank"
          rel={REVENUE_REL.sponsored}
          style={{ color: '#2563eb', fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}
        >
          ScraperAPI pricing →
        </a>
      </aside>

      <Suspense fallback={null}>
        <HubDiscoveryLinks hubPath="/docs" heading="More tools, guides & scenarios" />
      </Suspense>
    </div>
  );
}

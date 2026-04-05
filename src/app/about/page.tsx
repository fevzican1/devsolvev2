import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Building2, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildMetadata } from '@/lib/seo/metadata';
import { HubDiscoveryLinks } from '@/components/seo/HubDiscoveryLinks';
import { externalUrls, siteConfig } from '@/config/site';
import { absoluteUrl } from '@/lib/seo/url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'About DevSolve — Privacy-First Browser Developer Tools Platform',
  description:
    'DevSolve is a technical platform providing free, privacy-first, browser-based developer tools and practical implementation guides. All data processing happens locally.',
  path: '/about',
});

export default function AboutPage() {
  const breadcrumbJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'About', item: absoluteUrl('/about') },
    ],
  };

  const aboutPageJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'AboutPage',
    name: 'About DevSolve',
    description: 'DevSolve provides browser-based developer tools and implementation guides built for fast, practical workflows.',
    url: absoluteUrl('/about'),
    mainEntity: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: absoluteUrl('/'),
      description: siteConfig.description,
    },
  };

  return (
    <div className="py-14 md:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl space-y-10">
          <section className="rounded-2xl border bg-gradient-to-b from-background to-muted/30 p-8 md:p-10">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border bg-background px-4 py-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              Technical Platform
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
              About DevSolve
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              DevSolve provides browser-based developer tools and implementation guides built for fast,
              practical workflows. The product is designed to keep data processing local where possible,
              reduce friction in daily engineering tasks, and publish clear, actionable documentation.
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-2xl">Privacy-First by Default</CardTitle>
              </CardHeader>
              <CardContent className="text-base leading-7 text-muted-foreground">
                Core tools are built to process user input directly in the browser. This minimizes
                unnecessary data transfer and supports safer workflows when working with sensitive payloads.
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-2xl">Quality and Clarity</CardTitle>
              </CardHeader>
              <CardContent className="text-base leading-7 text-muted-foreground">
                Every guide and utility is structured to prioritize accuracy, transparent trade-offs,
                and real implementation constraints rather than generic marketing claims.
              </CardContent>
            </Card>
          </section>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <span className="rounded-lg bg-primary/10 p-2">
                <Target className="h-5 w-5 text-primary" />
              </span>
              <CardTitle className="text-xl md:text-2xl">Mission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-7 text-muted-foreground">
                DevSolve helps engineering teams move from issue to resolution faster with reliable tools,
                trustworthy documentation, and strict editorial transparency.
              </p>
            </CardContent>
          </Card>

          <Suspense fallback={null}>
            <HubDiscoveryLinks hubPath="/about" heading="Related Technical Guides" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

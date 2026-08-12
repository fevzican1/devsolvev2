import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Building2, Target, Shield, FileCheck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildMetadata } from '@/lib/seo/metadata';
import { HubDiscoveryLinks } from '@/components/seo/HubDiscoveryLinks';
import { TrustSignals } from '@/components/layout/TrustSignals';
import { externalUrls, siteConfig } from '@/config/site';
import { absoluteUrl } from '@/lib/seo/url';
import { monetizationConfig } from '@/config/monetization';
import { BRAND_SAME_AS, getBrandProfileLinks, PUBLISHER_IDENTITY } from '@/lib/seo/organization';
import { FeaturedBadges } from '@/components/layout/FeaturedBadges';


export const metadata: Metadata = buildMetadata({
  title: 'About DevSolve — Privacy-First Browser Developer Tools Platform',
  description:
    'DevSolve is a privacy-first browser tools platform with 19 free utilities and technical guides, operated by Fevzican Aytekin with transparent publisher policies.',
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
      sameAs: [...BRAND_SAME_AS],
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
              practical workflows. The product keeps data processing local where possible,
              reduces friction in daily engineering tasks, and publishes clear documentation with
              transparent editorial and monetization policies.
            </p>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Publisher &amp; Operator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-base leading-7 text-muted-foreground">
              <p>
                <strong className="text-foreground">Operator:</strong> {PUBLISHER_IDENTITY.operatorName}
              </p>
              <p>
                <strong className="text-foreground">Product:</strong> {siteConfig.name} — free browser-based developer utilities and technical guides at{' '}
                <Link href="/" className="text-primary hover:underline">{siteConfig.siteUrl.replace('https://', '')}</Link>
              </p>
              <p>
                <strong className="text-foreground">Contact:</strong>{' '}
                <a href={`mailto:${PUBLISHER_IDENTITY.contactEmail}`} className="text-primary hover:underline">
                  {PUBLISHER_IDENTITY.contactEmail}
                </a>
                {' · '}
                <Link href="/contact" className="text-primary hover:underline">Contact form</Link>
              </p>
              <p>
                <strong className="text-foreground">Profiles:</strong>{' '}
                {getBrandProfileLinks()
                  .filter((link) =>
                    ['LinkedIn', 'GitHub Profile', 'X (Twitter)', 'Hashnode', 'dev.to', 'Indie Hackers'].includes(
                      link.label,
                    ),
                  )
                  .map((link, index) => (
                    <span key={link.href}>
                      {index > 0 ? ' · ' : null}
                      <a
                        href={link.href}
                        target="_blank"
                        rel="me noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {link.label === 'GitHub Profile' ? 'GitHub' : link.label === 'X (Twitter)' ? 'X' : link.label}
                      </a>
                    </span>
                  ))}
              </p>
              <p>
                Third-party advertising and affiliate scripts remain <strong className="text-foreground">disabled</strong> until
                each publisher network (Sovrn Journey, CJ Affiliate, Infolinks, Skimlinks) approves the site.
                Our <Link href="/ads.txt" className="text-primary hover:underline">ads.txt</Link> lists authorized sellers once active.
              </p>
            </CardContent>
          </Card>

          <section className="grid gap-6 md:grid-cols-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-primary" />
                  Privacy-First by Default
                </CardTitle>
              </CardHeader>
              <CardContent className="text-base leading-7 text-muted-foreground">
                Core tools process user input directly in the browser. This minimizes unnecessary data
                transfer and supports safer workflows when working with sensitive payloads such as JWTs,
                API keys, or production configuration samples.
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Quality and Clarity
                </CardTitle>
              </CardHeader>
              <CardContent className="text-base leading-7 text-muted-foreground">
                Every guide and utility prioritizes accuracy, transparent trade-offs, and real implementation
                constraints. Tool pages explain limitations openly; guides include worked examples engineers can verify locally.
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Publisher Standards
                </CardTitle>
              </CardHeader>
              <CardContent className="text-base leading-7 text-muted-foreground">
                DevSolve follows a written{' '}
                <Link href="/legal/publisher-ethics" className="text-primary hover:underline">
                  Publisher Ethics Policy
                </Link>{' '}
                covering affiliate transparency, traffic quality, and content integrity — aligned with
                major commerce-network requirements.
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
                trustworthy documentation, and strict editorial transparency. For business, partnership, or
                affiliate inquiries, visit our{' '}
                <Link href="/contact" className="text-primary hover:underline">contact page</Link>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Official Profiles &amp; Listings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-base leading-7 text-muted-foreground">
              <p>
                DevSolve maintains verified profiles on the platforms below. Each profile links back to{' '}
                <Link href="/" className="text-primary hover:underline">{siteConfig.siteUrl.replace('https://', '')}</Link>{' '}
                so search engines can confirm brand ownership (entity consolidation).
              </p>
              <ul className="space-y-2">
                {getBrandProfileLinks().map(({ label, href }) => (
                  <li key={href}>
                    <a
                      href={href}
                      target="_blank"
                      rel="me noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
              <FeaturedBadges className="mt-6 flex flex-wrap items-center gap-4" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Affiliate &amp; Monetization Disclosure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-base leading-7 text-muted-foreground">
              <p>{monetizationConfig.disclosure.affiliateText}</p>
              <p>
                Full policy details:{' '}
                <Link href="/legal/publisher-ethics" className="text-primary hover:underline">Publisher Ethics</Link>
                {' · '}
                <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                {' · '}
                <Link href="/legal/cookies" className="text-primary hover:underline">Cookie Policy</Link>.
              </p>
            </CardContent>
          </Card>

          <TrustSignals compact />

          <Suspense fallback={null}>
            <HubDiscoveryLinks hubPath="/about" heading="Guides & Tools" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

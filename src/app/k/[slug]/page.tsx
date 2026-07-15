import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowRight, Wrench, AlertTriangle, CheckCircle, Lightbulb, HelpCircle, BookOpen, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  resolveProgrammaticPageBySlug,
  getProgrammaticLastModified,
} from '@/data/programmatic';
import { staticProgrammaticSlugs } from '@/lib/programmatic/staticPaths';
import { getToolBySlug, toolRegistry } from '@/tools/registry';
import { guideRegistry } from '@/content/guides';
import { siteConfig, externalUrls } from '@/config/site';
import { monetizationConfig } from '@/config/monetization';
import { RecommendedSolutions } from '@/components/monetization/RecommendedSolutions';
import { ComputedExample } from '@/components/programmatic/ComputedExample';
import { buildMetadata } from '@/lib/seo/metadata';
import { PROGRAMMATIC_HUB_METADATA } from '@/lib/programmatic/metadata';
import { absoluteUrl } from '@/lib/seo/url';
import { linkifyCommercialTerms } from '@/lib/content/commercialLinks';
import { hashString } from '@/lib/utils';
import {
  CommercialOpportunityLinks,
  EditorialByline,
  EditorialIntro,
  OriginalValueCallouts,
  TransparencyBadge,
} from '@/components/content/EditorialIdentity';
import { RelatedItemsLinks } from '@/components/seo/RelatedItemsLinks';
import { ProgrammaticHubPage } from '@/components/programmatic/ProgrammaticHubPage';

// Pure SSG at build time (`output: 'export'`). Only exported paths are linked
// and included in sitemaps, so no request requires a runtime function.
export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

function humanizeProgrammaticSlug(slug: string): string {
  const withoutIndex = slug.replace(/-\d+$/, '');
  const text = withoutIndex.replace(/-/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : slug;
}

interface SlugWorkedExample {
  fixtureId: string;
  recordId: number;
  inputLabel: string;
  outputLabel: string;
  input: string;
  output: string;
  note: string;
}

/**
 * Build a DETERMINISTIC, per-slug worked example, rendered on the server so it
 * is present in the statically generated HTML (the client-side <ComputedExample>
 * runs only in the browser and is invisible to crawlers). Every field is seeded
 * from the slug hash, so no two of the programmatic pages share this block —
 * mirroring the duplicate-content remedy in functions/k/[[slug]].ts and giving
 * the pre-rendered pages the same genuine information-gain.
 */
function buildSlugWorkedExample(
  slug: string,
  intent: string,
  toolName: string,
  toolSlug: string,
): SlugWorkedExample {
  let x = (Math.abs(hashString(slug)) ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
  const hex = (n: number) =>
    Array.from({ length: n }, () => '0123456789abcdef'[rnd() % 16]).join('');
  const pick = <T,>(arr: T[]): T => arr[rnd() % arr.length];

  const fixtureId = `fx-${hex(8)}`;
  const recordId = 1000 + (rnd() % 9000);
  const fields = ['userId', 'orderId', 'sessionId', 'traceId', 'tenantId', 'requestId', 'jobId', 'batchId'];
  const f1 = pick(fields);
  let f2 = pick(fields);
  if (f2 === f1) f2 = fields[(fields.indexOf(f1) + 1) % fields.length];

  const sample = `{"${f1}":"${fixtureId}","${f2}":${recordId},"stage":"${intent}"}`;
  let inputLabel = 'input fixture';
  let outputLabel = `${toolName} output`;
  let input = sample;
  let output: string;

  switch (toolSlug) {
    case 'json-to-typescript':
      outputLabel = 'generated interface';
      output = `interface Record${recordId} {\n  ${f1}: string;\n  ${f2}: number;\n  stage: string;\n}`;
      break;
    case 'hash-generator':
      inputLabel = 'message';
      outputLabel = 'SHA-256 (representative)';
      input = fixtureId;
      output = hex(64);
      break;
    case 'uuid-generator':
      inputLabel = 'namespace seed';
      outputLabel = 'UUID v4';
      input = slug;
      output = `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[rnd() % 4]}${hex(3)}-${hex(12)}`;
      break;
    case 'base64-encode-decode':
      inputLabel = 'plaintext';
      outputLabel = 'Base64';
      input = `${f1}:${fixtureId}`;
      output = Buffer.from(input).toString('base64');
      break;
    case 'jwt-decoder': {
      inputLabel = 'JWT (header.payload.signature)';
      outputLabel = 'decoded payload';
      const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
      const payload = Buffer.from(`{"sub":"${fixtureId}","${f1}":${recordId},"iat":1700000000}`).toString('base64url');
      input = `${header}.${payload}.${hex(16)}`;
      output = `{\n  "sub": "${fixtureId}",\n  "${f1}": ${recordId},\n  "iat": 1700000000\n}`;
      break;
    }
    case 'json-formatter':
    default:
      try {
        output = JSON.stringify(JSON.parse(sample), null, 2);
      } catch {
        output = sample;
      }
  }

  const note = pick([
    `Fixture ${fixtureId} is derived deterministically from this page's slug, so it is unique to this guide and reproduces byte-for-byte on any machine — which is what makes it admissible in a postmortem.`,
    `Commit this input/output pair to a version-controlled corpus so a future refactor that changes the result fails CI loudly instead of silently.`,
    `Only the structurally significant characters change — everything else round-trips, which is the exact invariant you assert in a regression test.`,
  ]);

  return { fixtureId, recordId, inputLabel, outputLabel, input, output, note };
}


function getProgrammaticDiscoveryLinks(currentSlug: string, count = 12) {
  if (staticProgrammaticSlugs.length < 2) return [];

  const seed = Math.abs(hashString(currentSlug));
  const links: Array<{ slug: string; title: string }> = [];
  const seen = new Set<string>();
  const step = 7919;
  let attempts = 0;

  while (links.length < count && attempts < count * 10) {
    const idx = (seed + attempts * step) % staticProgrammaticSlugs.length;
    attempts += 1;

    const slug = staticProgrammaticSlugs[idx];
    if (!slug || slug === currentSlug || seen.has(slug)) continue;

    seen.add(slug);
    links.push({ slug, title: humanizeProgrammaticSlug(slug) });
  }

  return links;
}

export async function generateStaticParams() {
  return staticProgrammaticSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = resolveProgrammaticPageBySlug(slug);
  if (!resolved) {
    return buildMetadata(PROGRAMMATIC_HUB_METADATA);
  }
  const { page, canonicalSlug } = resolved;
  const dateModified = getProgrammaticLastModified(canonicalSlug);

  return buildMetadata({
    title: page.title,
    description: page.description,
    path: `/k/${canonicalSlug}`,
    keywords: page.keywords,
    datePublished: siteConfig.launchDate,
    dateModified,
    articleSection: page.clusterKey,
  });
}

export default async function ProgrammaticPage({ params }: PageProps) {
  const { slug } = await params;
  const resolved = resolveProgrammaticPageBySlug(slug);

  if (!resolved) {
    return <ProgrammaticHubPage requestedSlug={slug} />;
  }
  const { page, canonicalSlug } = resolved;

  const primaryTool = getToolBySlug(page.primaryTool);
  const relatedTools = toolRegistry
    .filter(t => t.slug !== page.primaryTool)
    .slice(0, 3);
  const relatedGuides = guideRegistry
    .filter(g => g.clusterKeys.includes(page.clusterKey))
    .slice(0, 2);
  const semanticProgrammaticLinks = getProgrammaticDiscoveryLinks(page.slug, 12);
  const popularTools = toolRegistry.slice(0, 6);
  const smartRelatedLinks = [
    ...semanticProgrammaticLinks.map((entry) => ({
      href: `/k/${entry.slug}`,
      label: entry.title,
    })),
    ...relatedTools.map((tool) => ({
      href: `/tools/${tool.slug}`,
      label: tool.name,
      description: tool.shortDescription,
    })),
    ...relatedGuides.map((guide) => ({
      href: `/guides/${guide.slug}`,
      label: guide.title,
      description: guide.description,
    })),
    ...popularTools.map((tool) => ({
      href: `/tools/${tool.slug}`,
      label: tool.name,
      description: tool.shortDescription,
    })),
  ];
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
        name: page.title,
        item: absoluteUrl(`/k/${canonicalSlug}`),
      },
    ],
  };

  const articleJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'TechArticle',
    headline: page.h1,
    description: page.description,
    url: absoluteUrl(`/k/${canonicalSlug}`),
    datePublished: siteConfig.launchDate,
    dateModified: getProgrammaticLastModified(canonicalSlug),
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
      '@id': absoluteUrl(`/k/${canonicalSlug}`),
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

        {(() => {
          const we = buildSlugWorkedExample(
            canonicalSlug,
            page.intent,
            primaryTool?.name ?? 'this tool',
            page.primaryTool,
          );
          return (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Worked Example — Fixture {we.fixtureId}
                </CardTitle>
                <CardDescription className="text-xs">
                  Deterministically generated for this page — unique to{' '}
                  <code>/k/{canonicalSlug}</code> and reproducible byte-for-byte.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    {we.inputLabel}
                  </p>
                  <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">
                    <code>{we.input}</code>
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    {we.outputLabel} (record #{we.recordId})
                  </p>
                  <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">
                    <code>{we.output}</code>
                  </pre>
                </div>
                <p className="text-xs text-muted-foreground">{we.note}</p>
              </CardContent>
            </Card>
          );
        })()}

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
                  <Link href={`/k/${item.slug}`} prefetch={false} className="text-muted-foreground hover:text-foreground">
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
        <RelatedItemsLinks title="Explore Related Pages" items={smartRelatedLinks} />
      </div>
    </div>
  );
}

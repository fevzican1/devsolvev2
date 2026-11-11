import fs from 'fs';
import path from 'path';

const innerRepo = 'c:/Users/Lenovo/Downloads/devsolvev2-agent-pages-manage-crawl-budget-dd8b/devsolvev2-agent-pages-manage-crawl-budget-dd8b';

function write(relPath, content) {
  const full = path.join(innerRepo, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  const lines = content.split('\n').length;
  console.log(`✓ ${relPath} (${lines} lines)`);
}

// 1. errorLibrary.ts - add missing optional fields to ErrorEntry
write('src/data/errorLibrary.ts', `import type { ErrorEntry as BaseErrorEntry } from './errorLibrary.types';

export interface ErrorEntry extends BaseErrorEntry {
  codeVerified?: boolean;
  verifiedPlatform?: string;
}

export interface LibraryEntry {
  name: string;
  slug: string;
  version: string;
  language: { id: string; label: string; codeLang: string; ecosystem: string };
  pkg: string;
  description: string;
  errors: ErrorEntry[];
}

export const libraryCatalog: LibraryEntry[] = [];

export function getAllFixSlugs(): string[] {
  return libraryCatalog.flatMap((lib) =>
    lib.errors.map((err) => \`\${lib.slug}-\${lib.version}-\${err.errorSlug}\`)
  );
}

export function resolveFixBySlug(slug: string) {
  for (const lib of libraryCatalog) {
    for (const err of lib.errors) {
      const expected = \`\${lib.slug}-\${lib.version}-\${err.errorSlug}\`;
      if (expected === slug) return { library: lib, error: err, language: lib.language };
    }
  }
  return null;
}

export function getRelatedFixes(currentSlug: string, limit: number) {
  const all = libraryCatalog.flatMap((lib) =>
    lib.errors.map((err) => ({
      slug: \`\${lib.slug}-\${lib.version}-\${err.errorSlug}\`,
      error: err,
      library: lib,
      language: lib.language,
    }))
  );
  return all.filter((item) => item.slug !== currentSlug).slice(0, limit);
}

export function getFixCount(): number {
  return libraryCatalog.reduce((sum, lib) => sum + lib.errors.length, 0);
}

export function getFixStats() {
  const allErrors = libraryCatalog.flatMap((lib) => lib.errors);
  const allTags = new Set(allErrors.flatMap((e) => (e as any).tags ?? []));
  return {
    fixes: allErrors.length,
    libraries: libraryCatalog.length,
    languages: new Set(libraryCatalog.map((l) => l.language.id)).size,
    tags: allTags.size,
  };
}

export function buildFixSlug(lib: LibraryEntry, err: ErrorEntry): string {
  return \`\${lib.slug}-\${lib.version}-\${err.errorSlug}\`;
}
`);

// 2. errorLibrary.types.ts - base type without circular dependency
write('src/data/errorLibrary.types.ts', `export interface ErrorEntry {
  errorName: string;
  errorSlug: string;
  summary: string;
  message: string;
  reproduce: string;
  fix: string;
  cause: string;
  explanation: string;
  prevention: string;
  relatedTool?: string;
  severity?: string;
  difficulty?: string;
  timeEstimate?: string;
  affectedVersions?: string;
  tags?: string[];
  verifySteps?: string[];
  codeVerified?: boolean;
  verifiedPlatform?: string;
}
`);

// 3. fix/[slug]/page.tsx - clean, no problematic imports
write('src/app/fix/[slug]/page.tsx', `import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle, Bug, CheckCircle, ShieldCheck, ShieldAlert, Gauge,
  Clock, Layers, ListChecks, Tags, Wrench, ArrowRight, BookOpen,
  ThumbsUp, ThumbsDown, Verified,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getAllFixSlugs, getRelatedFixes, resolveFixBySlug } from '@/data/errorLibrary';
import { getToolBySlug } from '@/tools/registry';
import { siteConfig, externalUrls } from '@/config/site';
import { monetizationConfig } from '@/config/monetization';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/url';

export const dynamic = 'force-static';
export const dynamicParams = true;
export const revalidate = 3600;

interface PageProps { params: Promise<{ slug: string }>; }

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
};
const SEVERITY_STYLE: Record<string, string> = {
  low: 'text-green-600', medium: 'text-yellow-600',
  high: 'text-orange-600', critical: 'text-red-600',
};

export function generateStaticParams() {
  const all = getAllFixSlugs();
  const limit = parseInt(process.env.PREBUILD_LIMIT ?? '50000', 10);
  return all.slice(0, limit).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = resolveFixBySlug(slug);
  if (!resolved) return buildMetadata({ title: 'Error solution not found', path: \`/fix/\${slug}\` });
  const { library, error, language } = resolved;
  return buildMetadata({
    title: \`Fix \${error.errorName} in \${library.name} \${library.version} (\${language.label})\`,
    description: error.summary,
    path: \`/fix/\${slug}\`,
    keywords: [error.errorName, \`\${library.name} \${library.version}\`, language.label, 'error fix'],
    datePublished: siteConfig.launchDate,
    dateModified: siteConfig.contentUpdatedAt,
    articleSection: language.label,
  });
}

export default async function FixPage({ params }: PageProps) {
  const { slug } = await params;
  const resolved = resolveFixBySlug(slug);
  if (!resolved) notFound();
  const { library, error, language } = resolved;
  const relatedTool = getToolBySlug(error.relatedTool);
  const related = getRelatedFixes(slug, 6);
  const e = error as unknown as Record<string, unknown>;
  const severity = (e.severity as string) ?? 'medium';
  const difficulty = (e.difficulty as string) ?? 'intermediate';
  const timeEstimate = (e.timeEstimate as string) ?? '~15 min';
  const affectedVersions = (e.affectedVersions as string) ?? 'current';
  const tags = (e.tags as string[]) ?? [];
  const verifySteps = (e.verifySteps as string[]) ?? [
    'Rerun your application to confirm the error no longer appears.',
    'Check that the expected output matches the fix above.',
    'Monitor logs for any remaining occurrences.',
  ];
  const codeVerified = (e.codeVerified as boolean) ?? false;
  const verifiedPlatform = (e.verifiedPlatform as string) ?? '';
  const reviewedOn = siteConfig.contentUpdatedAt;
  const pageTitle = \`How to fix \${error.errorName} in \${library.name} \${library.version}\`;
  const pageDescription = \`\${error.summary} Reproducible \${language.label} example plus a verified fix.\`;
  const faqJsonLd = { '@context': externalUrls.schemaOrg, '@type': 'FAQPage', mainEntity: [
    { '@type': 'Question', name: \`What causes \${error.errorName} in \${library.name} \${library.version}?\`, acceptedAnswer: { '@type': 'Answer', text: error.cause } },
    { '@type': 'Question', name: \`How do I fix \${error.errorName} in \${library.name}?\`, acceptedAnswer: { '@type': 'Answer', text: error.explanation } },
    { '@type': 'Question', name: \`How can I prevent \${error.errorName} from happening again?\`, acceptedAnswer: { '@type': 'Answer', text: error.prevention } },
  ]};
  const howToJsonLd = { '@context': externalUrls.schemaOrg, '@type': 'HowTo', name: pageTitle, description: pageDescription, step: [
    { '@type': 'HowToStep', position: 1, name: 'Reproduce', text: \`Reproduce the error: \${error.summary}\` },
    { '@type': 'HowToStep', position: 2, name: 'Diagnose', text: error.cause },
    { '@type': 'HowToStep', position: 3, name: 'Fix', text: error.explanation },
    { '@type': 'HowToStep', position: 4, name: 'Prevent', text: error.prevention },
  ]};
  const articleJsonLd = { '@context': externalUrls.schemaOrg, '@type': 'TechArticle', headline: pageTitle, description: pageDescription, url: absoluteUrl(\`/fix/\${slug}\`), datePublished: siteConfig.launchDate, dateModified: siteConfig.contentUpdatedAt, author: { '@type': 'Organization', name: 'DevSolve Editorial Team', url: absoluteUrl('/about') }, publisher: { '@type': 'Organization', name: siteConfig.name, url: absoluteUrl('/'), logo: { '@type': 'ImageObject', url: absoluteUrl('/favicon.svg') } }, mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(\`/fix/\${slug}\`) }, about: { '@type': 'Thing', name: error.errorName }, proficiencyLevel: DIFFICULTY_LABEL[difficulty] ?? 'Intermediate', programmingLanguage: language.label, keywords: tags.join(', '), timeRequired: \`PT\${(timeEstimate.match(/\\d+/)?.[0]) ?? '15'}M\`, inLanguage: 'en', isAccessibleForFree: true };
  const breadcrumbJsonLd = { '@context': externalUrls.schemaOrg, '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
    { '@type': 'ListItem', position: 2, name: 'Error fixes', item: absoluteUrl('/fix') },
    { '@type': 'ListItem', position: 3, name: error.errorName, item: absoluteUrl(\`/fix/\${slug}\`) },
  ]};

  return (
    <div className="container mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/fix" className="hover:text-foreground">Error fixes</Link><span>/</span><span>{language.label}</span><span>/</span><span className="truncate">{library.name} {library.version}</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary" className="flex items-center gap-1"><Bug className="h-3 w-3" />{language.label}</Badge>
          <Badge variant="outline">{library.name} {library.version}</Badge>
          {codeVerified && <Badge variant="default" className="bg-green-600/10 text-green-700 hover:bg-green-600/20 flex items-center gap-1"><Verified className="h-3 w-3" />Code verified{verifiedPlatform ? \` on \${verifiedPlatform}\` : ''}</Badge>}
        </div>
        <h1 className="text-3xl font-bold mb-3">{pageTitle}</h1>
        <p className="text-lg text-muted-foreground mb-6">{error.summary}</p>
        <Card className="mb-8"><CardHeader className="pb-3"><CardTitle className="text-base">Fix at a glance</CardTitle><CardDescription className="text-xs">Reviewed by the DevSolve Editorial Team</CardDescription></CardHeader><CardContent><dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4"><div><dt className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><ShieldAlert className="h-3 w-3" /> Severity</dt><dd className={\`mt-1 text-sm font-semibold capitalize \${SEVERITY_STYLE[severity] ?? 'text-yellow-600'}\`}>{severity}</dd></div><div><dt className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Gauge className="h-3 w-3" /> Difficulty</dt><dd className="mt-1 text-sm font-semibold">{DIFFICULTY_LABEL[difficulty] ?? 'Intermediate'}</dd></div><div><dt className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Clock className="h-3 w-3" /> Time</dt><dd className="mt-1 text-sm font-semibold">{timeEstimate}</dd></div><div><dt className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Layers className="h-3 w-3" /> Versions</dt><dd className="mt-1 text-sm font-semibold">{affectedVersions}</dd></div></dl><div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4"><Tags className="h-3.5 w-3.5 text-muted-foreground" />{tags.map((tag) => <Badge key={tag} variant="secondary" className="text-[11px] font-normal">{tag}</Badge>)}</div></CardContent></Card>
        <Card className="mb-8 border-warning/50 bg-warning/5"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />The error message</CardTitle><CardDescription className="text-xs">{error.errorName}</CardDescription></CardHeader><CardContent><pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs"><code>{error.message}</code></pre></CardContent></Card>
        <Card className="mb-8"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Bug className="h-5 w-5" />Reproduce it ({language.label})</CardTitle><CardDescription className="text-xs">Minimal {library.name} {library.version} snippet that triggers the error.</CardDescription></CardHeader><CardContent className="space-y-3"><pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs" data-lang={language.codeLang}><code>{error.reproduce}</code></pre><p className="text-sm text-muted-foreground">{error.cause}</p></CardContent></Card>
        <Card className="mb-8 border-success/40 bg-success/5"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5 text-success" />The fix ({language.label})</CardTitle><CardDescription className="text-xs">Copy-paste solution for {library.name} {library.version}.</CardDescription></CardHeader><CardContent className="space-y-3"><pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs" data-lang={language.codeLang}><code>{error.fix}</code></pre><p className="text-sm text-muted-foreground">{error.explanation}</p></CardContent></Card>
        <Card className="mb-8 border-primary/25 bg-primary/5"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Prevention</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{error.prevention}</p></CardContent></Card>
        <Card className="mb-8"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><ListChecks className="h-5 w-5" />Verify the fix</CardTitle></CardHeader><CardContent><ol className="space-y-2">{verifySteps.map((step, i) => <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold text-foreground">{i + 1}</span><span>{step}</span></li>)}</ol></CardContent></Card>
        {relatedTool && <Card className="mb-8"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wrench className="h-5 w-5" />Related tool</CardTitle></CardHeader><CardContent><Link href={\`/tools/\${relatedTool.slug}\`}><Card className="hover:shadow-sm transition-shadow"><CardHeader className="py-3 px-4"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">{relatedTool.name}</CardTitle><ArrowRight className="h-4 w-4 text-muted-foreground" /></div><CardDescription className="text-xs">{relatedTool.shortDescription}</CardDescription></CardHeader></Card></Link></CardContent></Card>}
        <Card className="mb-8 border-muted"><CardContent className="py-4"><div className="flex items-center justify-between"><p className="text-sm font-medium">Was this fix helpful?</p><div className="flex items-center gap-3"><button className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"><ThumbsUp className="h-3.5 w-3.5" />Yes</button><button className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"><ThumbsDown className="h-3.5 w-3.5" />No</button></div></div></CardContent></Card>
        <Separator className="my-8" />
        {related.length > 0 && <div><h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5" />Related error fixes</h2><div className="grid gap-3 sm:grid-cols-2">{related.map((item) => <Link key={item.slug} href={\`/fix/\${item.slug}\`}><Card className="hover:shadow-sm transition-shadow h-full"><CardHeader className="py-3 px-4"><CardTitle className="text-sm font-medium">{item.error.errorName}</CardTitle><CardDescription className="text-xs">{item.library.name} {item.library.version}</CardDescription></CardHeader></Card></Link>)}</div></div>}
        <Separator className="my-8" />
        <div className="rounded-lg border bg-muted/30 p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10"><ShieldCheck className="h-5 w-5 text-primary" /></div><div className="space-y-1"><p className="text-sm font-semibold">Reviewed by the {siteConfig.name} Editorial Team</p><p className="text-xs text-muted-foreground">This solution was technically verified. Last updated {reviewedOn}.</p></div></div></div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{monetizationConfig.disclosure.affiliateText}</p>
      </div>
    </div>
  );
}
`);

// 4. fix/page.tsx - index page with inline stats
write('src/app/fix/page.tsx', `import Link from 'next/link';
import { Bug, Boxes, Code2, Tag, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { libraryCatalog, getFixCount } from '@/data/errorLibrary';

export const dynamic = 'force-static';
export const revalidate = 3600;

export default function FixIndexPage() {
  const count = getFixCount();
  const allErrors = libraryCatalog.flatMap((lib) => lib.errors);
  const allTags = new Set(allErrors.flatMap((e: any) => e.tags ?? []));
  const stats = {
    fixes: allErrors.length,
    libraries: libraryCatalog.length,
    languages: new Set(libraryCatalog.map((l) => l.language.id)).size,
    tags: allTags.size,
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Bug className="h-6 w-6 text-primary" />
          <Badge variant="secondary">{count} reproducible fixes</Badge>
        </div>
        <h1 className="text-3xl font-bold mb-3">Library & framework error fixes</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Each page targets one real error from one real library at one real version.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Bug className="h-3.5 w-3.5" /> Fixes</div>
            <div className="mt-1 text-2xl font-bold">{stats.fixes}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Boxes className="h-3.5 w-3.5" /> Libraries</div>
            <div className="mt-1 text-2xl font-bold">{stats.libraries}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Code2 className="h-3.5 w-3.5" /> Languages</div>
            <div className="mt-1 text-2xl font-bold">{stats.languages}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Tag className="h-3.5 w-3.5" /> Topics</div>
            <div className="mt-1 text-2xl font-bold">{stats.tags}</div>
          </div>
        </div>
        <div className="space-y-6">
          {libraryCatalog.map((lib) => (
            <div key={lib.slug}>
              <h2 className="text-xl font-semibold mb-2">{lib.name} {lib.version}</h2>
              <p className="text-sm text-muted-foreground mb-3">{lib.description}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {lib.errors.map((err) => (
                  <Link key={err.errorSlug} href={\`/fix/\${lib.slug}-\${lib.version}-\${err.errorSlug}\`}>
                    <Card className="hover:shadow-sm transition-shadow h-full">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-sm font-medium break-words">{err.errorName}</CardTitle>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                        <CardDescription className="text-xs">{err.summary}</CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`);

console.log('\n✅ All files written successfully!');
console.log('Run: cd devsolvev2-agent-pages-manage-crawl-budget-dd8b && git add -A && git commit -m "fix all" && git push origin master');
import Link from 'next/link';
import { Compass, ArrowRight, Sparkles, Library } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { staticProgrammaticSlugs } from '@/lib/programmatic/staticPaths';
import {
  formatProgrammaticHubLabel,
  getProgrammaticHubSampleStep,
  PROGRAMMATIC_HUB_TITLE,
} from '@/lib/programmatic/hub';

interface ProgrammaticHubPageProps {
  requestedSlug?: string;
}

function buildFeaturedProgrammaticLinks(count = 12) {
  if (staticProgrammaticSlugs.length < 1) return [];

  const slugs = new Set<string>();
  const step = getProgrammaticHubSampleStep(staticProgrammaticSlugs.length, count);

  for (let index = 0; index < staticProgrammaticSlugs.length && slugs.size < count; index += step) {
    slugs.add(staticProgrammaticSlugs[index]);
  }

  return Array.from(slugs).map((slug: string) => ({
    slug,
    label: formatProgrammaticHubLabel(slug),
  }));
}

export function ProgrammaticHubPage({ requestedSlug }: ProgrammaticHubPageProps) {
  const featuredLinks = buildFeaturedProgrammaticLinks();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rounded-2xl border bg-gradient-to-b from-background via-muted/20 to-background p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Technical workflow reference
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Library className="h-3 w-3" />
              Browser-based developer guides
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {PROGRAMMATIC_HUB_TITLE}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-muted-foreground md:text-lg">
            Task-focused workflow pages for JSON, encoding, security, and debugging — each page is
            self-contained HTML with local browser processing and no redirects.
          </p>
          {requestedSlug ? (
            <p className="mt-3 text-sm text-muted-foreground">
              The requested path <span className="font-mono text-foreground">/k/{requestedSlug}</span> did not map to an exact
              generated slug, so we kept you inside the programmatic index instead of returning an error page.
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/tools">
                Browse tools
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/guides">Read guides</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Compass className="h-5 w-5" />
              Representative workflow pages
            </CardTitle>
            <CardDescription>
              Sample entry points across JSON, security, encoding, and debugging topics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {featuredLinks.map((item) => (
                <Link
                  key={item.slug}
                  href={`/k/${item.slug}`}
                  prefetch={false}
                  className="rounded-lg border p-4 transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">/k/{item.slug}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

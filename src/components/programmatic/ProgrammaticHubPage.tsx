import Link from 'next/link';
import { Compass, ArrowRight, Sparkles, Library } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSlugByIndex, getTotalPageCount } from '@/data/programmatic';
import { formatProgrammaticHubLabel } from '@/lib/programmatic/hub';

interface ProgrammaticHubPageProps {
  requestedSlug?: string;
}

function buildFeaturedProgrammaticLinks(count = 12) {
  const total = getTotalPageCount();
  if (total < 1) return [];

  const slugs = new Set<string>();
  const normalizedCount = count > 0 ? count : 1;
  const step = Math.max(1, Math.floor(total / normalizedCount));

  for (let index = 0; index < total && slugs.size < count; index += step) {
    const slug = getSlugByIndex(index);
    if (slug) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs).map((slug: string) => ({
    slug,
    label: formatProgrammaticHubLabel(slug),
  }));
}

export function ProgrammaticHubPage({ requestedSlug }: ProgrammaticHubPageProps) {
  const total = getTotalPageCount();
  const featuredLinks = buildFeaturedProgrammaticLinks();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rounded-2xl border bg-gradient-to-b from-background via-muted/20 to-background p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Static programmatic SEO library
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Library className="h-3 w-3" />
              {total.toLocaleString('en-US')} published /k pages
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Explore DevSolve&apos;s programmatic developer pages
          </h1>
          <p className="mt-4 max-w-3xl text-base text-muted-foreground md:text-lg">
            Every programmatic URL in the /k library is intended to resolve as a crawlable HTML page without redirects.
            Use this hub to continue browsing the indexed page set.
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
              Representative /k entry points
            </CardTitle>
            <CardDescription>
              Deterministic samples from across the full programmatic inventory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {featuredLinks.map((item) => (
                <Link
                  key={item.slug}
                  href={`/k/${item.slug}`}
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

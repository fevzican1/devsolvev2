import type { Metadata } from 'next';
import Link from 'next/link';
import { Bug, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { libraryCatalog, languages, buildFixSlug, getFixCount } from '@/data/errorLibrary';
import { externalUrls } from '@/config/site';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/url';

export const dynamic = 'force-static';
export const revalidate = false;

export function generateMetadata(): Metadata {
  const count = getFixCount();
  return buildMetadata({
    title: `Library error fixes — ${count} reproducible solutions for real packages`,
    description:
      'A growing hub of reproducible, language-specific fixes for real library errors: Python, JavaScript, Java, Go, PHP and Ruby. Each page shows the exact error, a minimal reproduction, and a copy-paste fix.',
    path: '/fix',
    keywords: ['library errors', 'error fix', 'how to fix', 'python', 'javascript', 'java', 'go', 'php', 'ruby'],
  });
}

export default function FixHubPage() {
  const count = getFixCount();

  // Group libraries by language for a clean, crawlable index.
  const byLanguage = Object.values(languages).map((lang) => ({
    lang,
    libraries: libraryCatalog.filter((lib) => lib.language === lang.id),
  })).filter((group) => group.libraries.length > 0);

  const itemListJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'ItemList',
    name: 'Library error fixes',
    numberOfItems: count,
    itemListElement: libraryCatalog.flatMap((lib) =>
      lib.errors.map((err) => ({
        '@type': 'ListItem',
        url: absoluteUrl(`/fix/${buildFixSlug(lib, err)}`),
        name: `${err.errorName} in ${lib.name} ${lib.version}`,
      })),
    ),
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Bug className="h-6 w-6 text-primary" />
          <Badge variant="secondary">{count} reproducible fixes</Badge>
        </div>
        <h1 className="text-3xl font-bold mb-3">Library &amp; framework error fixes</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Each page targets one real error from one real library at one real version. You get the exact
          message, a minimal reproduction in the library&apos;s native language, the root cause, and a
          copy-paste fix — never an empty tool box.
        </p>

        <div className="space-y-10">
          {byLanguage.map(({ lang, libraries }) => (
            <section key={lang.id}>
              <h2 className="text-xl font-semibold mb-1">{lang.label}</h2>
              <p className="text-sm text-muted-foreground mb-4">{lang.ecosystem}</p>
              <div className="space-y-6">
                {libraries.map((lib) => (
                  <div key={lib.pkg}>
                    <h3 className="text-sm font-medium mb-2">
                      {lib.name} <span className="text-muted-foreground">{lib.version}</span> — {lib.description}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {lib.errors.map((err) => (
                        <Link key={err.errorSlug} href={`/fix/${buildFixSlug(lib, err)}`}>
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
            </section>
          ))}
        </div>

        <Card className="mt-12 border-primary/25 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Looking for a browser tool instead of an error fix? Explore the{' '}
              <Link href="/tools" className="underline">developer tools directory</Link> or the{' '}
              <Link href="/guides" className="underline">guides hub</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

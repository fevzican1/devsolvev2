import type { Metadata } from 'next';
import Link from 'next/link';
import { FileQuestion, Home, Wrench, FileText, Compass, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Page Not Found — DevSolve Developer Tools',
  description: 'The page you are looking for could not be found. Browse our free browser-based developer tools and technical guides.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: undefined,
  },
};

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-2xl border bg-gradient-to-b from-background via-muted/20 to-background p-8 text-center">
          <FileQuestion className="mx-auto mb-5 h-14 w-14 text-muted-foreground" />
          <p className="mb-3 inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            Error 404
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            This page could not be found
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
            The address may be outdated or typed incorrectly. Use the shortcuts below to continue browsing.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Back to Homepage
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tools">
                <Wrench className="mr-2 h-4 w-4" />
                Developer Tools
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/guides">
                <FileText className="mr-2 h-4 w-4" />
                Technical Guides
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <Compass className="mt-1 h-4 w-4 text-primary" />
              <div>
                <h2 className="mb-1 text-sm font-semibold">Popular destinations</h2>
                <p className="text-sm text-muted-foreground">
                  Start from <Link href="/tools" className="text-primary hover:underline">Tools</Link> or
                  <Link href="/guides" className="text-primary hover:underline"> Guides</Link> to find active pages quickly.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <ShieldCheck className="mt-1 h-4 w-4 text-primary" />
              <div>
                <h2 className="mb-1 text-sm font-semibold">Need help?</h2>
                <p className="text-sm text-muted-foreground">
                  Report broken links via <Link href="/contact" className="text-primary hover:underline">Contact Us</Link>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

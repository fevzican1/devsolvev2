import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArrowRight, Shield, Zap, Globe, Code2, FileText, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toolRegistry } from '@/tools/registry';
import { guideRegistry } from '@/content/guides';
import { buildMetadata } from '@/lib/seo/metadata';
import { HubDiscoveryLinks } from '@/components/seo/HubDiscoveryLinks';
import { platformExternalUrls } from '@/config/monetization';

export const metadata: Metadata = buildMetadata({
  description:
    'Free browser-based developer tools for JSON formatting, JWT decoding, regex testing, Base64 encoding, and more. All processing happens locally — your data never leaves your browser.',
  path: '/',
  keywords: ['developer tools', 'json formatter', 'jwt decoder', 'regex tester', 'base64', 'online tools', 'privacy-first', 'free tools'],
});

const features = [
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'All processing happens locally in your browser. Your data never leaves your machine.',
  },
  {
    icon: Zap,
    title: 'Instant Results',
    description: 'No server round-trips. Get immediate feedback as you work with your data.',
  },
  {
    icon: Globe,
    title: 'Works Offline',
    description: 'Once loaded, tools work without an internet connection. Process data anywhere.',
  },
];

const featuredTools = toolRegistry.slice(0, 6);
const featuredGuides = guideRegistry.slice(0, 3);

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">
              Browser-based developer tools
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Free Developer Tools That{' '}
              <span className="text-primary">Respect Your Privacy</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Format JSON, decode JWTs, test regex patterns, encode Base64, generate hashes — all without
              sending data to external servers. 15+ tools that run entirely in your browser.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/tools">
                  Explore Tools
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/guides">
                  Read Guides
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-background">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Popular Developer Tools</h2>
              <p className="text-muted-foreground">
                Free browser-based utilities for JSON, encoding, hashing, and more
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/tools">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredTools.map((tool) => (
              <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Wrench className="h-8 w-8 text-primary" />
                      <Badge variant="outline" className="text-xs">
                        {tool.category}
                      </Badge>
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
        </div>
      </section>

      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Technical Guides & Tutorials</h2>
              <p className="text-muted-foreground">
                In-depth guides with best practices and real-world examples
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/guides">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {featuredGuides.map((guide) => (
              <Link key={guide.slug} href={`/guides/${guide.slug}`}>
                <Card className="h-full hover:shadow-md transition-shadow bg-background">
                  <CardHeader>
                    <FileText className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-lg">{guide.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{guide.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12">
              <div className="max-w-2xl mx-auto text-center">
                <Code2 className="h-12 w-12 mx-auto mb-4" />
                <h2 className="text-3xl font-bold mb-4">
                  100% Local Processing — Zero Data Collection
                </h2>
                <p className="text-lg opacity-90 mb-6">
                  Your data stays on your machine. No server processing, no data collection,
                  no tracking. Free, open developer tools that simply work.
                </p>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/tools">
                    Start Using Tools
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-6 border-t">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Sponsored link disclosure</p>
          <a
            href={platformExternalUrls.sponsoredOffer}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Visit partner offer (sponsored)
          </a>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-14">
        <Suspense fallback={null}>
          <HubDiscoveryLinks hubPath="/" heading="Explore More" />
        </Suspense>
      </div>
    </div>
  );
}

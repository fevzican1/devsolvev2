import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Mail, ShieldCheck, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildMetadata } from '@/lib/seo/metadata';
import { ContactForm } from '@/components/contact/ContactForm';
import { HubDiscoveryLinks } from '@/components/seo/HubDiscoveryLinks';
import { externalUrls, siteConfig } from '@/config/site';
import { absoluteUrl } from '@/lib/seo/url';

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  title: 'Contact DevSolve — Support, Partnerships & Inquiries',
  description:
    'Get in touch with DevSolve for product support, partnership inquiries, policy questions, or business communication. Typical response within 2 business days.',
  path: '/contact',
});

export default function ContactPage() {
  const breadcrumbJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Contact', item: absoluteUrl('/contact') },
    ],
  };

  const contactPageJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'ContactPage',
    name: 'Contact DevSolve',
    description: 'Contact DevSolve for product support, partnership inquiries, or business communication.',
    url: absoluteUrl('/contact'),
    mainEntity: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: absoluteUrl('/'),
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        url: absoluteUrl('/contact'),
      },
    },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageJsonLd) }}
      />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Contact Us</h1>
          <p className="text-lg text-muted-foreground">
            Use this channel for product support, legal requests, affiliate inquiries, or business communications.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Response Window
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Requests are typically answered within 2 business days.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Privacy Handling
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Contact submissions are processed solely for support and compliance communication.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Policy References
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              {' · '}
              <Link href="/legal/terms" className="text-primary hover:underline">Terms of Service</Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send a message</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>

        <Suspense fallback={null}>
          <HubDiscoveryLinks hubPath="/contact" heading="Keep Exploring" />
        </Suspense>
      </div>
    </div>
  );
}

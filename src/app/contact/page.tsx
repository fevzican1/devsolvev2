import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Mail, ShieldCheck, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildMetadata } from '@/lib/seo/metadata';
import { ContactForm } from '@/components/contact/ContactForm';
import { HubDiscoveryLinks } from '@/components/seo/HubDiscoveryLinks';

export const metadata: Metadata = buildMetadata({
  title: 'Contact Us',
  description:
    'Contact DevSolve for support, policy questions, partnership inquiries, or legal communication.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12">
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
          <HubDiscoveryLinks hubPath="/contact/" heading="Keep Exploring" />
        </Suspense>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Shield, FileCheck, Handshake, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { monetizationConfig } from '@/config/monetization';

const signals = [
  {
    icon: Shield,
    title: 'Privacy-First Processing',
    description:
      'Core developer tools run entirely in your browser. Sensitive payloads are not sent to our servers for formatting, decoding, or validation.',
  },
  {
    icon: FileCheck,
    title: 'Editorial Standards',
    description:
      'Guides and tool documentation are written for working engineers, with clear limitations and no pay-to-play editorial influence.',
    href: '/legal/publisher-ethics',
  },
  {
    icon: Eye,
    title: 'Honest Product Scope',
    description:
      'DevSolve is a free browser-based utility suite plus technical guides. We publish workflow reference pages only where they add distinct, verifiable value.',
  },
  {
    icon: Handshake,
    title: 'Affiliate Transparency',
    description:
      'Sponsored links and ad partners are disclosed before they go live. Third-party monetization stays disabled until publisher-network approval.',
    href: '/legal/publisher-ethics',
  },
] as const;

interface TrustSignalsProps {
  compact?: boolean;
}

export function TrustSignals({ compact = false }: TrustSignalsProps) {
  return (
    <section aria-label="Trust and editorial standards" className={compact ? 'py-8' : 'py-16'}>
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Built for Trust, Transparency &amp; Quality
          </h2>
          <p className="mt-3 text-muted-foreground text-base leading-7">
            DevSolve is operated by a named publisher with verifiable profiles, written policies,
            and privacy-respecting tools — the baseline commerce and directory reviewers expect.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {signals.map((signal) => {
            const Icon = signal.icon;
            const body = (
              <Card className="h-full border-muted/60">
                <CardContent className="pt-6">
                  <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-foreground">{signal.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.description}</p>
                  {'href' in signal && signal.href ? (
                    <Link
                      href={signal.href}
                      className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      Read our policy →
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            );

            return <div key={signal.title}>{body}</div>;
          })}
        </div>

        <p className="mt-8 text-center text-xs leading-6 text-muted-foreground max-w-2xl mx-auto">
          {monetizationConfig.disclosure.shortDisclosure}: {monetizationConfig.disclosure.affiliateText}{' '}
          See also our{' '}
          <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          {' · '}
          <Link href="/legal/terms" className="text-primary hover:underline">Terms of Service</Link>
          {' · '}
          <Link href="/contact" className="text-primary hover:underline">Contact</Link>.
        </p>
      </div>
    </section>
  );
}

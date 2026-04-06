import type { Metadata } from 'next';
import { siteConfig, externalUrls } from '@/config/site';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/url';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of Service — DevSolve Usage Guidelines',
  description:
    'Terms governing access to and use of DevSolve developer tools, technical guides, and website content. Browser-based, privacy-first tools.',
  path: '/legal/terms',
});

export const revalidate = 86400;

export default function TermsPage() {
  const breadcrumbJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Legal', item: absoluteUrl('/legal/terms') },
      { '@type': 'ListItem', position: 3, name: 'Terms of Service', item: absoluteUrl('/legal/terms') },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: March 17, 2026</p>

        <h2>1. Agreement to Terms</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern use of {siteConfig.name}. By accessing or using
          the Service, users agree to be bound by these Terms. If a user does not agree, the Service
          must not be used.
        </p>

        <h2>2. Service Description</h2>
        <p>
          The Service provides browser-based developer tools, technical guides, and related educational
          resources. Features may be modified, suspended, or discontinued at any time.
        </p>

        <h2>3. Acceptable Use</h2>
        <p>Users agree not to:</p>
        <ul>
          <li>Use the Service for unlawful, deceptive, or abusive activity</li>
          <li>Attempt unauthorized access to systems, data, or infrastructure</li>
          <li>Interfere with service availability, integrity, or security</li>
          <li>Upload or distribute malicious code or harmful content</li>
        </ul>

        <h2>4. Intellectual Property</h2>
        <p>
          Except where otherwise stated, the Service, including branding, design, code, and original
          content, is owned by or licensed to {siteConfig.name} and protected by applicable intellectual
          property laws.
        </p>

        <h2>5. Third-Party and Affiliate Links</h2>
        <p>
          The Service may contain links to third-party sites and affiliate offers. {siteConfig.name} is
          not responsible for third-party content, policies, or transactions.
        </p>
        <p>
          Promotional links are required to be clearly labeled where monetization applies. The Service
          prohibits deceptive destination masking, forced click behavior, and misleading commercial claims.
        </p>

        <h2>6. Traffic Quality and Publisher Compliance</h2>
        <p>Use of the Service for monetization must comply with publisher network requirements, including:</p>
        <ul>
          <li>No automated clicks, fake transactions, click stuffing, or hidden redirect mechanisms</li>
          <li>No unauthorized trademark bidding, impersonation, or merchant brand misuse</li>
          <li>No referrer cloaking or other methods that obscure true traffic origin</li>
          <li>No distribution of malware, unwanted software, or deceptive promotional software</li>
        </ul>
        <p>
          Compliance expectations are further described in the{' '}
          <a href="/legal/publisher-ethics">Publisher Ethics Policy</a>.
        </p>

        <h2>7. Disclaimers</h2>
        <p>
          The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any
          kind, express or implied, including merchantability, fitness for a particular purpose, and
          non-infringement.
        </p>

        <h2>8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, {siteConfig.name} and its affiliates will not be
          liable for indirect, incidental, special, consequential, or punitive damages, or any loss of
          data, profits, or goodwill arising from use of the Service.
        </p>

        <h2>9. Indemnification</h2>
        <p>
          Users agree to defend, indemnify, and hold harmless {siteConfig.name} from claims, damages,
          liabilities, and expenses resulting from violations of these Terms or misuse of the Service.
        </p>

        <h2>10. Termination</h2>
        <p>
          Access to the Service may be suspended or terminated at any time, with or without notice, if
          there is a reasonable belief of Terms violations or security risk.
        </p>

        <h2>11. Changes to Terms</h2>
        <p>
          These Terms may be updated periodically. Continued use after updates become effective
          constitutes acceptance of the revised Terms.
        </p>

        <h2>12. Governing Law</h2>
        <p>
          These Terms are governed by applicable laws and dispute resolution requirements in the relevant
          jurisdiction, without regard to conflict-of-law principles.
        </p>

        <h2>13. Contact</h2>
        <p>
          Legal inquiries can be submitted at <a href="/contact">Contact Us</a>.
        </p>
      </div>
    </div>
  );
}

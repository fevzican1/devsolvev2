import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig, externalUrls } from '@/config/site';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/url';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy Policy — How DevSolve Protects Your Data',
  description:
    'Learn how DevSolve handles browser-side processing, limited analytics, and user privacy rights. All tool processing happens locally in your browser.',
  path: '/legal/privacy',
});

export default function PrivacyPage() {
  const breadcrumbJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Legal', item: absoluteUrl('/legal/privacy') },
      { '@type': 'ListItem', position: 3, name: 'Privacy Policy', item: absoluteUrl('/legal/privacy') },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: March 17, 2026</p>

        <h2>1. Scope</h2>
        <p>
          This Privacy Policy explains how {siteConfig.name} collects, uses, discloses, and protects
          information in connection with the website located at {siteConfig.siteUrl} and related
          services (collectively, the &quot;Service&quot;).
        </p>

        <h2>2. Browser-Side Processing</h2>
        <p>
          Core tool functionality is designed to run in the user&apos;s browser. In most use cases,
          content entered into tools is processed locally and is not transmitted to Service servers.
          Users remain responsible for the data they choose to process.
        </p>

        <h2>3. Information Collected</h2>
        <p>The Service may process the following categories of information:</p>
        <ul>
          <li>Technical log data, such as IP address, user agent, and request metadata</li>
          <li>Usage data, such as visited pages, timestamps, and referral sources</li>
          <li>Contact form submissions voluntarily provided by users</li>
          <li>Cookie or local storage preferences, including theme and consent settings</li>
        </ul>

        <h2>4. Legal Bases and Purposes</h2>
        <p>
          Information is used to operate and secure the Service, respond to support requests, improve
          performance, prevent abuse, and comply with applicable legal obligations.
        </p>

        <h2>5. Cookies and Similar Technologies</h2>
        <p>
          The Service uses essential technologies required for functionality and may use limited
          analytics and affiliate attribution. Users can manage these settings through browser controls.
        </p>
        <p>
          The Service does not permit hidden cookie stuffing, forced affiliate tagging, or automatic
          monetization events that are not initiated by explicit user action.
        </p>

        <h2>6. Third-Party Services and Links</h2>
        <p>
          The Service may include third-party content, affiliate links, or external destinations.
          Third-party websites and services operate under their own terms and privacy notices.
        </p>
        <p>
          Where monetized links are presented, the promotional nature is disclosed to users through
          visible labels and policy notices.
        </p>

        <h2>7. Data Retention</h2>
        <p>
          Information is retained only as long as reasonably necessary for the purposes outlined in this
          Policy, including legal, accounting, and security obligations.
        </p>

        <h2>8. International Processing</h2>
        <p>
          Data may be processed in jurisdictions outside a user&apos;s country of residence, subject to
          applicable safeguards required by law.
        </p>

        <h2>9. Security</h2>
        <p>
          Reasonable administrative, technical, and organizational safeguards are applied to protect
          information. No internet transmission or storage system can be guaranteed to be fully secure.
        </p>

        <h2>10. User Rights</h2>
        <p>
          Subject to applicable law, users may request access, correction, deletion, or restriction of
          processing for personal information. Requests may be submitted through the Contact page.
        </p>

        <h2>11. Children&apos;s Privacy</h2>
        <p>
          The Service is not directed to children under the age required by local law. If unauthorized
          child data is identified, commercially reasonable efforts will be made to remove it.
        </p>

        <h2>12. Policy Changes</h2>
        <p>
          This Policy may be updated periodically. Material changes will be reflected by revising the
          &quot;Last updated&quot; date and, where required, by additional notice.
        </p>

        <h2>13. Contact</h2>
        <p>
          Privacy-related inquiries can be submitted at <a href="/contact">Contact Us</a>.
        </p>
      </div>
    </div>
  );
}

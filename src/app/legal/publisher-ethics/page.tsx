import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { externalUrls } from '@/config/site';
import { absoluteUrl } from '@/lib/seo/url';

export const metadata: Metadata = buildMetadata({
  title: 'Publisher Ethics Policy — DevSolve Content Integrity Standards',
  description:
    'Traffic quality, affiliate transparency, and content integrity standards for DevSolve. Aligned with commerce network requirements and publisher best practices.',
  path: '/legal/publisher-ethics',
});


export default function PublisherEthicsPage() {
  const breadcrumbJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Legal', item: absoluteUrl('/legal/publisher-ethics') },
      { '@type': 'ListItem', position: 3, name: 'Publisher Ethics', item: absoluteUrl('/legal/publisher-ethics') },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
        <h1>Publisher Ethics Policy</h1>
        <p className="text-muted-foreground">Last updated: March 26, 2026</p>

        <p>
          This policy defines the traffic quality and promotional standards applied across this site for
          affiliate and commerce activity. These controls were adopted to align with publisher network
          requirements, including the Sovrn Publisher Code of Conduct (updated November 30, 2023).
        </p>

        <h2>1. Trademark and Brand Use</h2>
        <ul>
          <li>No unauthorized use of merchant trademarks, service marks, or brand terms.</li>
          <li>No domain, social profile, or software naming that imitates merchant brands.</li>
          <li>No use of merchant marks in paid search ads unless written authorization exists.</li>
        </ul>

        <h2>2. Real User Clicks Only</h2>
        <ul>
          <li>No click stuffing, hidden frames, forced redirects, or auto-triggered affiliate events.</li>
          <li>No bots, scripts, fabricated pixels, or synthetic interactions to generate commissions.</li>
          <li>Affiliate credit is valid only for explicit user-initiated actions.</li>
        </ul>

        <h2>3. Clear Labeling and Reader Transparency</h2>
        <ul>
          <li>Sponsored or affiliate links must be clearly labeled.</li>
          <li>Promotional content must not mislead users about destination or intent.</li>
          <li>No deceptive placement, cloaking, or traffic source obfuscation.</li>
        </ul>

        <h2>4. Content Integrity Standards</h2>
        <ul>
          <li>No illegal, defamatory, hateful, explicit, or dangerous content.</li>
          <li>No medical misinformation, deceptive claims, or manipulated editorial content.</li>
          <li>No copyright infringement, piracy, or unauthorized content reuse.</li>
          <li>Content is not targeted primarily to users under 16.</li>
        </ul>

        <h2>5. Software, Cookies, and Tracking Controls</h2>
        <ul>
          <li>No downloadable software-based promotion is run without explicit contractual approval.</li>
          <li>No affiliate tracking deployment from hidden or non-user-initiated execution paths.</li>
          <li>Tracking behavior must remain consistent with disclosed privacy and cookie policies.</li>
        </ul>

        <h2>6. Messaging and Consent</h2>
        <ul>
          <li>No unsolicited spam via email, SMS, or messaging apps.</li>
          <li>Promotional messaging requires prior consent and a valid unsubscribe mechanism.</li>
          <li>Sender identity must be accurate and must not impersonate merchants or networks.</li>
        </ul>

        <h2>7. Enforcement</h2>
        <p>
          Suspected policy violations can result in immediate removal of promotional placements, account
          restrictions, commission reversals, and merchant-level access suspension.
        </p>

        <h2>8. Reporting</h2>
        <p>
          Compliance concerns can be reported via <a href="/contact">Contact Us</a>. Verified issues are
          investigated and remediated as a priority.
        </p>
      </div>
    </div>
  );
}

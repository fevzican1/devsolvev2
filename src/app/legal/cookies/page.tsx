import type { Metadata } from 'next';
import { siteConfig, externalUrls } from '@/config/site';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/url';

export const metadata: Metadata = buildMetadata({
  title: 'Cookie Policy — DevSolve Cookie & Local Storage Practices',
  description: 'DevSolve cookie and local storage policy. Minimal cookies for essential functionality, transparent analytics, and full browser control.',
  path: '/legal/cookies',
});


export default function CookiesPage() {
  const breadcrumbJsonLd = {
    '@context': externalUrls.schemaOrg,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Legal', item: absoluteUrl('/legal/cookies') },
      { '@type': 'ListItem', position: 3, name: 'Cookie Policy', item: absoluteUrl('/legal/cookies') },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
        <h1>Cookie Policy</h1>
        <p className="text-muted-foreground">Last updated: March 17, 2026</p>

        <h2>What Are Cookies</h2>
        <p>
          Cookies are small text files stored on your device when you visit websites.
          They help websites remember your preferences and improve your experience.
        </p>

        <h2>How We Use Cookies</h2>
        <p>
          {siteConfig.name} uses minimal cookies for essential functionality:
        </p>

        <h3>Essential Cookies</h3>
        <ul>
          <li>
            <strong>Theme preference:</strong> Remembers your light/dark mode choice
          </li>
        </ul>

        <h3>Analytics Cookies (Optional)</h3>
        <p>
          If enabled, we may use basic analytics to understand how our tools are used.
          These do not track personal information.
        </p>

        <h2>Local Storage</h2>
        <p>
          We also use browser local storage for:
        </p>
        <ul>
          <li>User preferences (theme settings)</li>
          <li>Optional local analytics data</li>
        </ul>
        <p>
          Local storage data stays on your device and is not transmitted to our servers.
        </p>

        <h2>Third-Party Cookies</h2>
        <p>
          When you click links to external services, those sites may set their own cookies.
          We do not control third-party cookies.
        </p>

        <h2>Managing Cookies</h2>
        <p>
          You can control cookies through your browser settings:
        </p>
        <ul>
          <li>Block all cookies</li>
          <li>Delete existing cookies</li>
          <li>Allow cookies from specific sites only</li>
        </ul>
        <p>
          Our tools will continue to function if you disable cookies, though your
          preferences may not be saved between visits.
        </p>

        <h2>Clearing Local Storage</h2>
        <p>
          To clear local storage data:
        </p>
        <ol>
          <li>Open your browser&apos;s developer tools (F12)</li>
          <li>Go to the Application or Storage tab</li>
          <li>Find Local Storage and clear the data for this site</li>
        </ol>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this cookie policy as needed. Check this page for the latest
          information.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about our cookie practices, please contact us through our website.
        </p>
      </div>
    </div>
  );
}

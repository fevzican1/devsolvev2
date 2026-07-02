import type { Metadata } from 'next';
import { siteConfig, externalUrls } from '@/config/site';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/url';

export const metadata: Metadata = buildMetadata({
  title: 'Cookie Policy — DevSolve Cookie & Local Storage Practices',
  description: 'DevSolve cookie and local storage policy. Essential cookies for theme preferences, optional partners disclosed by name, and full browser control.',
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
        <p className="text-muted-foreground">Last updated: July 2, 2026</p>

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
          <li>
            <strong>Cookie consent:</strong> Stores whether you accepted optional cookies
          </li>
        </ul>

        <h3>Advertising &amp; Affiliate Partners (Optional — disabled until approved)</h3>
        <p>
          DevSolve may load third-party advertising or affiliate scripts only after a publisher
          network approves our application. When enabled, partners may set their own cookies:
        </p>
        <ul>
          <li>
            <strong>Infolinks</strong> — contextual advertising (Publisher ID 3444436). Disabled until Infolinks publisher approval.
          </li>
          <li>
            <strong>Sovrn / VigLink (Journey)</strong> — affiliate link monetization. Disabled until Sovrn Journey approval.
          </li>
          <li>
            <strong>CJ Affiliate</strong> — affiliate tracking when applicable. Disabled until CJ publisher approval.
          </li>
          <li>
            <strong>Skimlinks</strong> — merchant link routing when applicable. Disabled until Skimlinks approval.
          </li>
        </ul>
        <p>
          Authorized ad sellers are listed in our{' '}
          <a href="/ads.txt">ads.txt</a> file once each partnership is active.
        </p>

        <h3>Analytics Cookies (Optional)</h3>
        <p>
          If enabled in the future, we may use privacy-respecting analytics to understand how
          tools are used. These would not track personal information and would be disclosed here
          before activation.
        </p>

        <h2>Local Storage</h2>
        <p>
          We also use browser local storage for:
        </p>
        <ul>
          <li>User preferences (theme settings)</li>
          <li>Cookie consent choice</li>
        </ul>
        <p>
          Local storage data stays on your device and is not transmitted to our servers.
        </p>

        <h2>Third-Party Cookies</h2>
        <p>
          When you click links to external services, those sites may set their own cookies.
          Sponsored or affiliate links are labeled with <code>rel=&quot;sponsored&quot;</code> where applicable.
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

        <h2>Contact</h2>
        <p>
          Questions about cookies:{' '}
          <a href="mailto:contact@devsolvev2.com">contact@devsolvev2.com</a>
          {' · '}
          <a href="/contact">Contact form</a>
        </p>
      </div>
    </div>
  );
}

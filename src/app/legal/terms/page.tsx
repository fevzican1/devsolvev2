import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for DevSolve - browser-based developer tools.',
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: February 2026</p>

        <h2>Acceptance of Terms</h2>
        <p>
          By accessing and using {siteConfig.name}, you accept and agree to be bound by these
          Terms of Service. If you do not agree to these terms, please do not use our services.
        </p>

        <h2>Description of Service</h2>
        <p>
          {siteConfig.name} provides browser-based developer tools for formatting, encoding,
          validation, and other data processing tasks. All processing occurs locally in your
          browser.
        </p>

        <h2>Use of Tools</h2>
        <p>
          Our tools are provided for legitimate development and personal use. You agree to:
        </p>
        <ul>
          <li>Use the tools for lawful purposes only</li>
          <li>Not attempt to exploit or abuse the service</li>
          <li>Not use the tools to process illegal content</li>
        </ul>

        <h2>No Warranty</h2>
        <p>
          Our tools are provided &quot;as is&quot; without warranty of any kind. While we strive
          for accuracy and reliability:
        </p>
        <ul>
          <li>We do not guarantee error-free operation</li>
          <li>Tools may have limitations as documented</li>
          <li>Results should be verified for critical applications</li>
        </ul>

        <h2>Limitation of Liability</h2>
        <p>
          {siteConfig.name} shall not be liable for any damages arising from the use of our
          tools, including but not limited to:
        </p>
        <ul>
          <li>Data loss or corruption</li>
          <li>Errors in processing results</li>
          <li>Service interruptions</li>
        </ul>

        <h2>Intellectual Property</h2>
        <p>
          The {siteConfig.name} website, design, and original content are protected by
          intellectual property laws. You may not reproduce or redistribute our content
          without permission.
        </p>

        <h2>Third-Party Links</h2>
        <p>
          Our site contains links to third-party websites and services. We are not responsible
          for the content or practices of these external sites.
        </p>

        <h2>Affiliate Disclosure</h2>
        <p>
          Some links on this site are affiliate links. We may earn commissions from purchases
          made through these links, at no additional cost to you. This helps support the
          free tools we provide.
        </p>

        <h2>Modifications</h2>
        <p>
          We reserve the right to modify these terms at any time. Continued use of the service
          after changes constitutes acceptance of the new terms.
        </p>

        <h2>Governing Law</h2>
        <p>
          These terms are governed by applicable laws. Any disputes shall be resolved through
          appropriate legal channels.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about these terms, please contact us through our website.
        </p>
      </div>
    </div>
  );
}

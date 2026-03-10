import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for DevSolve - browser-based developer tools.',
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: February 2026</p>

        <h2>Overview</h2>
        <p>
          {siteConfig.name} is committed to protecting your privacy. This policy explains
          how we handle information when you use our browser-based developer tools.
        </p>

        <h2>Data Processing</h2>
        <p>
          <strong>All tool processing happens locally in your browser.</strong> When you use
          our tools (JSON formatter, hash generator, etc.), your data is processed entirely
          on your device. We do not transmit your input data to any servers.
        </p>

        <h2>Information We Collect</h2>
        <h3>Automatically Collected Information</h3>
        <p>
          Like most websites, our servers may automatically log standard technical information:
        </p>
        <ul>
          <li>IP address (may be anonymized)</li>
          <li>Browser type and version</li>
          <li>Pages visited and time spent</li>
          <li>Referring website</li>
        </ul>

        <h3>Information We Do Not Collect</h3>
        <p>
          We do not collect, store, or transmit:
        </p>
        <ul>
          <li>Data you input into our tools</li>
          <li>Personal identification information</li>
          <li>Account credentials or passwords</li>
        </ul>

        <h2>Cookies and Local Storage</h2>
        <p>
          We use minimal cookies and local storage for:
        </p>
        <ul>
          <li>Remembering your theme preference (light/dark mode)</li>
          <li>Basic analytics (if enabled)</li>
        </ul>
        <p>
          You can disable cookies in your browser settings without affecting tool functionality.
        </p>

        <h2>Third-Party Services</h2>
        <p>
          Our site may include links to third-party services. When you click affiliate links,
          you will be directed to external websites with their own privacy policies. We encourage
          you to review those policies.
        </p>

        <h2>Data Security</h2>
        <p>
          Since tool processing happens locally, your sensitive data never leaves your browser.
          This local-only approach provides inherent security for your data.
        </p>

        <h2>Your Rights</h2>
        <p>
          You have the right to:
        </p>
        <ul>
          <li>Use our tools without creating an account</li>
          <li>Clear local storage data at any time</li>
          <li>Disable cookies in your browser</li>
        </ul>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this policy periodically. Significant changes will be noted on this page.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about this privacy policy, please contact us through our website.
        </p>
      </div>
    </div>
  );
}

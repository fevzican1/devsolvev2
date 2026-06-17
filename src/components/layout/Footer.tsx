import Link from 'next/link';
import { Code2, Github, Linkedin, Twitter } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { monetizationConfig } from '@/config/monetization';
import { BRAND_SAME_AS } from '@/lib/seo/organization';

// Visible, verifiable links to the brand's owned profiles. rel="me" declares
// an identity relationship (reinforces the JSON-LD sameAs for crawlers), and
// the reciprocal link (profile → devsolvev2.com → profile) confirms ownership.
const socialLinks = [
  { label: 'GitHub', Icon: Github, href: BRAND_SAME_AS.find((u) => u.includes('github.com')) ?? '#' },
  { label: 'LinkedIn', Icon: Linkedin, href: BRAND_SAME_AS.find((u) => u.includes('linkedin.com')) ?? '#' },
  { label: 'X (Twitter)', Icon: Twitter, href: BRAND_SAME_AS.find((u) => u.includes('x.com')) ?? '#' },
];

const footerLinks = {
  tools: [
    { href: '/tools/json-formatter', label: 'JSON Formatter' },
    { href: '/tools/jwt-decoder', label: 'JWT Decoder' },
    { href: '/tools/hash-generator', label: 'Hash Generator' },
    { href: '/tools/regex-tester', label: 'Regex Tester' },
    { href: '/tools/base64-encode-decode', label: 'Base64 Encoder' },
    { href: '/tools/url-encode-decode', label: 'URL Encoder' },
    { href: '/tools/uuid-generator', label: 'UUID Generator' },
    { href: '/tools/diff-checker', label: 'Diff Checker' },
  ],
  guides: [
    { href: '/guides/json-validation-formatting', label: 'JSON Best Practices' },
    { href: '/guides/regex-testing-debugging', label: 'Regex Workflow' },
    { href: '/guides/hashing-integrity', label: 'Hashing Guide' },
    { href: '/guides/jwt-decoding-browser', label: 'JWT Decoding Guide' },
    { href: '/guides/url-encoding-pitfalls', label: 'URL Encoding Pitfalls' },
    { href: '/guides/base64-usage', label: 'Base64 Usage Guide' },
  ],
  legal: [
    { href: '/about', label: 'About DevSolve' },
    { href: '/k', label: 'Technical Library (/k)' },
    { href: '/contact', label: 'Contact Us' },
    { href: '/legal/publisher-ethics', label: 'Publisher Ethics Policy' },
    { href: '/legal/privacy', label: 'Privacy Policy' },
    { href: '/legal/terms', label: 'Terms of Service' },
    { href: '/legal/cookies', label: 'Cookie Policy' },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Code2 className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">{siteConfig.name}</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              {siteConfig.description}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              All tools run locally in your browser.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map(({ label, Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={`DevSolve on ${label}`}
                  title={`DevSolve on ${label}`}
                  target="_blank"
                  rel="me noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Tools</h3>
            <ul className="space-y-2">
              {footerLinks.tools.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/tools"
                  className="text-sm text-primary hover:underline"
                >
                  View all tools
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Guides</h3>
            <ul className="space-y-2">
              {footerLinks.guides.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/guides"
                  className="text-sm text-primary hover:underline"
                >
                  View all guides
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t">
          <p className="text-xs text-muted-foreground text-center">
            {monetizationConfig.disclosure.shortDisclosure}:{' '}
            {monetizationConfig.disclosure.affiliateText}
          </p>
          <p className="text-xs text-muted-foreground text-center mt-3">
            © {currentYear} DevSolve - All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
}

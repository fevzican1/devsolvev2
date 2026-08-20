import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AdFooterSlot, AdHeaderSlot } from '@/components/monetization/StaticRevenue';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { siteConfig, externalUrls } from '@/config/site';
import { platformExternalUrls, isInfolinksEnabled } from '@/config/monetization';
import { toolRegistry } from '@/tools/registry';
import { CodeBlocksEnhancer } from '@/components/content/CodeBlocksEnhancer';
import { CookieConsent } from '@/components/layout/CookieConsent';
import { CONTENT_SIGNAL_VALUE } from '@/lib/seo/contentSignal';
import {
  BRAND_SAME_AS,
  buildOrganizationNode,
  buildWebSiteNode,
} from '@/lib/seo/organization';
import { buildPageTitle, ensureSeoDescription, ROBOTS_INDEX_FOLLOW } from '@/lib/seo/seoText';

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const defaultPageTitle = buildPageTitle('Free Privacy-First Developer Tools & Guides');
const defaultDescription = ensureSeoDescription(siteConfig.description);

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: defaultPageTitle,
    template: `%s | ${siteConfig.name}`,
  },
  description: defaultDescription,
  applicationName: siteConfig.name,
  keywords: [
    'developer tools',
    'online developer tools',
    'json formatter online',
    'jwt decoder',
    'regex tester online',
    'base64 encode decode',
    'url encoder',
    'hash generator',
    'uuid generator',
    'browser-based tools',
    'privacy-first tools',
    'free developer tools',
    'code formatter',
    'sql formatter',
    'css minifier',
    'diff checker',
    'text case converter',
  ],
  category: 'technology',
  creator: 'DevSolve Editorial Team',
  publisher: 'DevSolve',
  alternates: {
    canonical: '/',
    languages: {
      'en': '/',
      'x-default': '/',
    },
    types: {
      'application/rss+xml': `${siteConfig.siteUrl}/feed.xml`,
    },
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    url: siteConfig.siteUrl,
    title: defaultPageTitle,
    description: defaultDescription,
    siteName: siteConfig.name,
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: `${siteConfig.name} — Free browser-based developer tools`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultPageTitle,
    description: defaultDescription,
    images: ['/opengraph-image.png'],
  },
  other: {
    'content-signal': CONTENT_SIGNAL_VALUE,
    'saashub-verification': '7scl5mzbiksx',
    bingbot: ROBOTS_INDEX_FOLLOW,
    msnbot: ROBOTS_INDEX_FOLLOW,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: googleSiteVerification
    ? {
        google: googleSiteVerification,
      }
    : undefined,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

const brandGraphJsonLd = {
  '@context': externalUrls.schemaOrg,
  '@graph': [
    buildOrganizationNode({ siteUrl: siteConfig.siteUrl }),
    buildWebSiteNode({ siteUrl: siteConfig.siteUrl }),
  ],
};

const itemListJsonLd = {
  '@context': externalUrls.schemaOrg,
  '@type': 'ItemList',
  name: 'Developer Tools',
  description: ensureSeoDescription(
    'Free browser-based developer tools for formatting, validation, encoding, and debugging workflows.',
  ),
  numberOfItems: toolRegistry.length,
  itemListElement: toolRegistry.map((tool, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: tool.name,
    url: `${siteConfig.siteUrl}/tools/${tool.slug}`,
  })),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {BRAND_SAME_AS.map((href) => (
          <link key={href} rel="me" href={href} />
        ))}
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <CodeBlocksEnhancer />
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:top-0 focus:left-0">
            Skip to main content
          </a>
          <div className="relative flex min-h-screen flex-col pb-14">
            <Header />
            <AdHeaderSlot />
            <main id="main-content" className="flex-1">{children}</main>
            <Footer />
          </div>
          <AdFooterSlot />
        </ThemeProvider>
        <CookieConsent />
        <Script id="ld-brand-graph" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(brandGraphJsonLd)}
        </Script>
        <Script id="ld-itemlist" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(itemListJsonLd)}
        </Script>
        {isInfolinksEnabled() ? (
          <>
            <Script id="infolinks-config" strategy="afterInteractive">
              {`var infolinks_pid = 3444436; var infolinks_wsid = 0;`}
            </Script>
            <Script
              src={platformExternalUrls.infolinksScript}
              strategy="afterInteractive"
            />
          </>
        ) : null}
      </body>
    </html>
  );
}

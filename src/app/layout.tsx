import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { siteConfig, externalUrls } from '@/config/site';
import { platformExternalUrls } from '@/config/monetization';
import { toolRegistry } from '@/tools/registry';
import { CodeBlocksEnhancer } from '@/components/content/CodeBlocksEnhancer';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: `${siteConfig.name} — Free Privacy-First Developer Tools & Guides`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
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
    title: `${siteConfig.name} — Free Privacy-First Developer Tools`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — Free browser-based developer tools`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — Free Developer Tools`,
    description: siteConfig.description,
    images: ['/twitter-image'],
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

const websiteJsonLd = {
  '@context': externalUrls.schemaOrg,
  '@type': 'WebSite',
  name: siteConfig.name,
  alternateName: 'DevSolve Developer Tools',
  url: siteConfig.siteUrl,
  description: siteConfig.description,
  inLanguage: 'en',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteConfig.siteUrl}/tools?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

const organizationJsonLd = {
  '@context': externalUrls.schemaOrg,
  '@type': 'Organization',
  name: siteConfig.name,
  url: siteConfig.siteUrl,
  logo: {
    '@type': 'ImageObject',
    url: `${siteConfig.siteUrl}/favicon.svg`,
  },
  description: siteConfig.description,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: `${siteConfig.siteUrl}/contact`,
  },
  sameAs: [
    platformExternalUrls.netlify,
  ],
};

const itemListJsonLd = {
  '@context': externalUrls.schemaOrg,
  '@type': 'ItemList',
  name: 'Developer Tools',
  description: 'Free browser-based developer tools for formatting, validation, encoding, and debugging',
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
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <CodeBlocksEnhancer />
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:top-0 focus:left-0">
            Skip to main content
          </a>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main id="main-content" className="flex-1">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
        <Script id="ld-website" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(websiteJsonLd)}
        </Script>
        <Script id="ld-organization" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(organizationJsonLd)}
        </Script>
        <Script id="ld-itemlist" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(itemListJsonLd)}
        </Script>
        <Script id="infolinks-config" strategy="afterInteractive">
          {`var infolinks_pid = 3444436; var infolinks_wsid = 0;`}
        </Script>
        <Script
          src={platformExternalUrls.infolinksScript}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

export const siteConfig = {
  name: 'DevSolve',
  tagline: 'Privacy-First Developer Tools & Guides',
  description: 'Free browser-based developer tools for JSON formatting, JWT decoding, regex testing, Base64 encoding and more. All processing happens locally — your data never leaves your machine.',
  siteUrl: 'https://devsolvev2.com',

  programmatic: {
    targetTotal: 20_000_000,
    safeDefaultTotal: 1000,
    rampSchedule: [500000, 2000000, 5000000, 9000000, 14000000, 20000000] as const,
    rampMode: 'manual' as const,
    /** Fallback advertised ramp level. Live value is `.ramp-level` +
     *  `EMBEDDED_RAMP_LEVEL` (must stay in lockstep). Level 1 = 2M URLs.
     *  All 20M pages remain 200 + indexable; only sitemap advertisement is gated. */
    defaultRampLevel: 1,
  },

  programmaticQuality: {
    /** Unified Bing + Google quality threshold — pages below 90 are noindex */
    minIndexScore: 90,
    minSitemapScore: 90,
    minMetaDescriptionLength: 150,
    minWordCount: 1200,
    targetEligiblePages: 20_000_000,
    maxSitemapUrls: 20_000_000,
  },

  toolPackaging: {
    mode: 'core+extended' as const,
  },

  launchDate: '2026-01-15T00:00:00Z',
  contentUpdatedAt: '2026-08-12T00:00:00Z',

  features: {
    darkMode: true,
    cookieConsent: true,
    devSolveAi: true,
  },
} as const;

export const externalUrls = {
  schemaOrg: 'https://schema.org',
} as const;

export type SiteConfig = typeof siteConfig;

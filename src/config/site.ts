export const siteConfig = {
  name: 'DevSolve',
  tagline: 'Privacy-First Developer Tools & Guides',
  description: 'Free browser-based developer tools for JSON formatting, JWT decoding, regex testing, Base64 encoding and more. All processing happens locally — your data never leaves your machine.',
  siteUrl: 'https://devsolvev2.com',

  programmatic: {
    targetTotal: 18040320,
    safeDefaultTotal: 1000,
    rampSchedule: [500000, 2000000, 5000000, 9000000, 14000000, 18040320] as const,
    rampMode: 'manual' as const,
    /** Active ramp level — controlled by PROGRAMMATIC_RAMP_LEVEL env var.
     *  See src/config/rampController.ts for gate metrics and level definitions.
     *  Default: 0 (500K sitemap, Faz 0 — prove quality before expanding). */
    defaultRampLevel: 0,
  },

  programmaticQuality: {
    minIndexScore: 82,
    minSitemapScore: 90,
    minMetaDescriptionLength: 140,
    minWordCount: 1200,
    targetEligiblePages: 15_814_080,
    maxSitemapUrls: 18040320,
  },

  toolPackaging: {
    mode: 'core+extended' as const,
  },

  launchDate: '2026-01-15T00:00:00Z',
  contentUpdatedAt: '2026-06-22T00:00:00Z',

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

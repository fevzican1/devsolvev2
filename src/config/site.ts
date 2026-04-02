export const siteConfig = {
  name: 'DevSolve',
  description: 'Browser-based developer tools and guides. All processing happens locally in your browser.',
  siteUrl: 'https://devsolvev2.com',

  programmatic: {
    targetTotal: 120000,
    safeDefaultTotal: 120000,
    rampSchedule: [5000, 15000, 30000, 60000, 90000, 120000] as const,
    rampMode: 'manual' as const,
  },

  programmaticQuality: {
    minIndexScore: 82,
    minSitemapScore: 90,
    maxSitemapUrls: 50000,
  },

  toolPackaging: {
    mode: 'core+extended' as const,
  },

  features: {
    darkMode: true,
    cookieConsent: true,
  },
} as const;

export const externalUrls = {
  schemaOrg: 'https://schema.org',
} as const;

export type SiteConfig = typeof siteConfig;

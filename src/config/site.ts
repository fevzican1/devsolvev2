export const siteConfig = {
  name: 'DevSolve',
  description: 'Browser-based developer tools and guides. All processing happens locally in your browser.',
  siteUrl: 'https://devsolvev2.com',

  programmatic: {
    targetTotal: 500000,
    safeDefaultTotal: 500000,
    rampSchedule: [800, 2500, 10000, 50000, 150000, 300000, 500000] as const,
    rampMode: 'manual' as const,
  },

  programmaticQuality: {
    minIndexScore: 78,
    minSitemapScore: 85,
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

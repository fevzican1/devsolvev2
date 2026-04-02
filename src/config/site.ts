export const siteConfig = {
  name: 'DevSolve',
  description: 'Browser-based developer tools and guides. All processing happens locally in your browser.',
  siteUrl: 'https://devsolvev2.com',

  programmatic: {
    targetTotal: 4008960,
    safeDefaultTotal: 4008960,
    rampSchedule: [250000, 800000, 1600000, 2400000, 3200000, 4008960] as const,
    rampMode: 'manual' as const,
  },

  programmaticQuality: {
    minIndexScore: 82,
    minSitemapScore: 90,
    maxSitemapUrls: 4008960,
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

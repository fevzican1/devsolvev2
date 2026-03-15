export const siteConfig = {
  name: 'DevSolve',
  description: 'Browser-based developer tools and guides. All processing happens locally in your browser.',
  siteUrl: 'https://devsolvev2.com',

  programmatic: {
    targetTotal: 50000,
    safeDefaultTotal: 50000,
    rampSchedule: [800, 1500, 2500, 5000, 10000, 50000] as const,
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

export type SiteConfig = typeof siteConfig;

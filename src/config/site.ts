export const siteConfig = {
  name: 'DevSolve',
  description: 'Browser-based developer tools and guides. All processing happens locally in your browser.',
  siteUrl: 'https://devsolvev2.com',

  programmatic: {
    targetTotal: 10000,
    safeDefaultTotal: 800,
    rampSchedule: [800, 1500, 2500, 4000, 6500, 10000] as const,
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

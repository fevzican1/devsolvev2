/**
 * ============================================================================
 * DEVSOLVE MONETIZATION CONFIGURATION
 * ============================================================================
 *
 * CEO: AFFILIATE ID / TRACKING URL TEMPLATES GO HERE
 *
 * This is the ONLY file you need to edit to configure monetization.
 * All affiliate links, tracking IDs, and payout preferences are managed here.
 *
 * Instructions:
 * 1. Sign up for affiliate programs (e.g., Impact, PartnerStack, etc.)
 * 2. Get your tracking URL templates from each program
 * 3. Replace the placeholder values below with your actual IDs
 * 4. Payouts will be handled by affiliate networks (Payoneer compatible)
 *
 * ============================================================================
 */

export interface AffiliateProgram {
  id: string;
  name: string;
  enabled: boolean;
  trackingUrlTemplate: string;
  homepageUrl: string;
  category: 'hosting' | 'security' | 'devtools' | 'marketing' | 'infrastructure';
  description: string;
  features: string[];
  limitations: string[];
}

export interface OfferCatalogItem {
  id: string;
  programId: string;
  title: string;
  shortDescription: string;
  relevantTools: string[];
  relevantClusters: string[];
  priority: number;
}

export interface PlacementRule {
  location: 'tool-sidebar' | 'guide-footer' | 'programmatic-sidebar';
  maxOffers: number;
  requiresMatch: boolean;
}

export interface AdSlotConfig {
  id: string;
  location: string;
  enabled: boolean;
  placeholder: string;
}

export interface DisclosureConfig {
  affiliateText: string;
  adText: string;
  shortDisclosure: string;
  skimlinksNote: string;
}

export interface OpsFlags {
  /**
   * Ramp level for programmatic pages.
   * 0 = safeDefaultTotal only, 5 = full targetTotal
   */
  programmaticRampLevel?: 0 | 1 | 2 | 3 | 4 | 5;
}

/**
 * Flip each flag to `true` ONLY after the corresponding network approves the
 * publisher application. Until then, third-party ad/affiliate scripts and
 * sponsored CTAs stay off-site (reviewers see disclosure policy text only).
 */
export interface PublisherNetworkApproval {
  sovrnJourney: boolean;
  cjAffiliate: boolean;
  infolinks: boolean;
  skimlinks: boolean;
}

/** Infolinks publisher ID — also listed in public/ads.txt after approval. */
export const INFOLINKS_PUBLISHER_ID = '3444436';

export interface MonetizationConfig {
  payoutPreference: 'Payoneer';
  payoneerNote: string;
  affiliateDefaults: {
    utmSource: string;
    utmMedium: string;
    subIdTemplate: string;
  };
  affiliatePrograms: AffiliateProgram[];
  offerCatalog: OfferCatalogItem[];
  placementRules: PlacementRule[];
  adSlots: AdSlotConfig[];
  disclosure: DisclosureConfig;
  opsFlags: OpsFlags;
}

export interface NamedExternalLink {
  name: string;
  href: string;
}

export interface CommercialTermLink {
  term: string;
  href: string;
}

/**
 * ============================================================================
 * CEO: EDIT THE VALUES BELOW
 * ============================================================================
 */
export const monetizationConfig: MonetizationConfig = {
  payoutPreference: 'Payoneer',
  payoneerNote: 'Payout is handled by affiliate networks; no on-site payment processing.',

  affiliateDefaults: {
    utmSource: 'devsolve',
    utmMedium: 'affiliate',
    subIdTemplate: '{toolSlug}_{timestamp}',
  },

  /**
   * CEO: ADD YOUR AFFILIATE PROGRAMS HERE
   *
   * Example entry:
   * {
   *   id: 'vercel',
   *   name: 'Vercel',
   *   enabled: true,
   *   trackingUrlTemplate: 'https://vercel.com/?ref=YOUR_AFFILIATE_ID&utm_source={utmSource}',
   *   homepageUrl: 'https://vercel.com',
   *   category: 'hosting',
   *   description: 'Deploy and scale web applications',
   *   features: ['Automatic deployments', 'Edge network', 'Analytics'],
   *   limitations: ['Usage-based pricing', 'Vendor lock-in considerations'],
   * }
   */
  affiliatePrograms: [
    // ADD YOUR AFFILIATE PROGRAMS HERE
    // When empty, recommended-solution UI is hidden entirely (no placeholder cards).
  ],

  /**
   * CEO: ADD YOUR OFFER CATALOG HERE
   *
   * Map offers to specific tools and content clusters
   */
  offerCatalog: [
    // ADD YOUR OFFERS HERE
  ],

  placementRules: [
    { location: 'tool-sidebar', maxOffers: 2, requiresMatch: true },
    { location: 'guide-footer', maxOffers: 3, requiresMatch: true },
    { location: 'programmatic-sidebar', maxOffers: 2, requiresMatch: false },
  ],

  adSlots: [
    { id: 'tool-sidebar', location: 'tool-sidebar', enabled: false, placeholder: 'Ad space available' },
    { id: 'guide-banner', location: 'guide-banner', enabled: false, placeholder: 'Ad space available' },
  ],

  disclosure: {
    affiliateText:
      'Some links on this page may be monetized through affiliate partnerships. If you choose to purchase after clicking one of these links, we may receive a commission at no additional cost to you. The primary goal of each page is to provide useful, practical information; recommendations are added only where they are technically relevant.',
    adText: 'This page may contain sponsored or monetized placements where clearly labeled.',
    shortDisclosure: 'Monetization & affiliate disclosure',
    skimlinksNote:
      'Links may be routed through a monetization partner such as Skimlinks. Destination merchants and offers should always be relevant to the technical topic of the page.',
  },

  opsFlags: {
    programmaticRampLevel: 0,
  },
};

/**
 * Network approval gates — all false until Sovrn Journey / CJ / Infolinks / Skimlinks
 * explicitly approve the publisher account.
 */
export const publisherNetworkApproval: PublisherNetworkApproval = {
  sovrnJourney: false,
  cjAffiliate: false,
  infolinks: false,
  skimlinks: false,
};

export function isMonetizationConfigured(): boolean {
  return monetizationConfig.affiliatePrograms.some(p => p.enabled);
}

export function isInfolinksEnabled(): boolean {
  return publisherNetworkApproval.infolinks;
}

export function isSovrnJourneyEnabled(): boolean {
  return publisherNetworkApproval.sovrnJourney;
}

export function isSkimlinksEnabled(): boolean {
  return publisherNetworkApproval.skimlinks;
}

export function isCjAffiliateEnabled(): boolean {
  return publisherNetworkApproval.cjAffiliate;
}

/** Any third-party monetization script or sponsored CTA may render. */
export function isThirdPartyMonetizationLive(): boolean {
  return (
    isInfolinksEnabled()
    || isSovrnJourneyEnabled()
    || isSkimlinksEnabled()
    || isCjAffiliateEnabled()
    || isMonetizationConfigured()
  );
}

export function getEnabledPrograms(): AffiliateProgram[] {
  return monetizationConfig.affiliatePrograms.filter(p => p.enabled);
}

export function getProgramById(id: string): AffiliateProgram | undefined {
  return monetizationConfig.affiliatePrograms.find(p => p.id === id);
}

export function getOffersForTool(toolSlug: string): OfferCatalogItem[] {
  return monetizationConfig.offerCatalog.filter(
    offer => offer.relevantTools.includes(toolSlug)
  );
}

export function getOffersForCluster(clusterKey: string): OfferCatalogItem[] {
  return monetizationConfig.offerCatalog.filter(
    offer => offer.relevantClusters.includes(clusterKey)
  );
}

export const platformExternalUrls = {
  netlify: 'https://www.netlify.com/',
  infolinksScript: 'https://resources.infolinks.com/js/infolinks_main.js',
  sponsoredOffer: 'https://sovrn.co/wvnas9j',
} as const;

export const commercialPlatforms: NamedExternalLink[] = [
  { name: 'Cloudflare', href: 'https://www.cloudflare.com/' },
  { name: 'AWS', href: 'https://aws.amazon.com/' },
  { name: 'DigitalOcean', href: 'https://www.digitalocean.com/' },
  { name: 'MongoDB', href: 'https://www.mongodb.com/' },
  { name: 'GitHub', href: 'https://github.com/' },
];

export const commercialTermLinks: CommercialTermLink[] = [
  { term: 'AWS EventBridge', href: 'https://aws.amazon.com/eventbridge/' },
  { term: 'Amazon Web Services', href: 'https://aws.amazon.com/' },
  { term: 'GitHub Actions', href: 'https://github.com/features/actions' },
  { term: 'GitLab CI', href: 'https://about.gitlab.com/stages-devops-lifecycle/continuous-integration/' },
  { term: 'Cloud Scheduler', href: 'https://cloud.google.com/scheduler' },
  { term: 'DigitalOcean', href: 'https://www.digitalocean.com/' },
  { term: 'Cloudflare', href: 'https://www.cloudflare.com/' },
  { term: 'MongoDB', href: 'https://www.mongodb.com/' },
  { term: 'Postman', href: 'https://www.postman.com/' },
  { term: 'Insomnia', href: 'https://insomnia.rest/' },
  { term: 'GitHub', href: 'https://github.com/' },
  { term: 'Vercel', href: 'https://vercel.com/' },
  { term: 'Netlify', href: 'https://www.netlify.com/' },
  { term: 'AWS', href: 'https://aws.amazon.com/' },
];

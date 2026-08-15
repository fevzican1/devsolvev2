/**
 * Static, zero-JS revenue hops.
 *
 * Pages never embed Payoneer or vendor referral URLs. They link to internal
 * paths below; Cloudflare Pages `_redirects` issues a 302. Changing a payout
 * destination does not require regenerating 20M corpus pages.
 *
 * Destinations live only in public/_redirects.
 */
export const REVENUE_HOPS = {
  buyDataset: '/buy-dataset',
  vultr: '/go/vultr',
  digitalocean: '/go/digitalocean',
  scraperapi: '/go/scraperapi',
  scraperapiDocs: '/go/scraperapi-docs',
  scraperapiPricing: '/go/scraperapi-pricing',
} as const;

export const REVENUE_REL = {
  ownProduct: 'nofollow',
  sponsored: 'nofollow sponsored',
} as const;

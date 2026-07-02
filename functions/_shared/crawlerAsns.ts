/**
 * ASN allow-lists for search crawlers — shared by botGuard and WAF deploy script.
 * Google operates multiple ASNs (PeeringDB + Google Search docs); blocking only
 * 15169/396982 caused real Googlebot 403s → GSC discovered 0.
 */

/** Google LLC ASNs used by Googlebot / Search crawlers (PeeringDB 2026). */
export const GOOGLE_CRAWLER_ASNS: readonly number[] = [
  15169, 396982, 36040, 43515, 36561, 19527, 139070,
];

/** Microsoft ASNs used by Bingbot / MSN crawlers. */
export const BING_CRAWLER_ASNS: readonly number[] = [
  8075, 3598, 8068, 8069, 6182, 23274, 11271,
];

export const GOOGLE_CRAWLER_ASN_SET: ReadonlySet<number> = new Set(GOOGLE_CRAWLER_ASNS);
export const BING_CRAWLER_ASN_SET: ReadonlySet<number> = new Set(BING_CRAWLER_ASNS);

/** Cloudflare WAF expression fragment: `{15169 396982 ...}` */
export function wafAsnSet(asns: readonly number[]): string {
  return `{${asns.join(' ')}}`;
}

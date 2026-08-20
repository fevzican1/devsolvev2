/**
 * Published Google/Bing crawl networks. Kept as reference for hosting-ASN
 * overlap (WAF3 challenges Chrome-from-VPS, not crawler UAs). Custom WAF
 * rules must not 403 on Googlebot/Bingbot User-Agent + ASN; access is granted
 * only by `cf.client.bot`.
 */

/**
 * Networks Googlebot actually crawls from. 15169 is the classic 66.249.64.0/19
 * range; 396982 covers the 34.x/35.x Google Cloud addresses that appear in
 * Google's published googlebot.json for user-triggered and special-case
 * crawlers.
 */
export const GOOGLE_CRAWLER_ASNS = [
  15169, 396982, 36040, 43515, 36561, 19527, 139070, 139190,
];

/** Microsoft/Bing crawl networks (bingbot, adidxbot, msnbot, BingPreview). */
export const BING_CRAWLER_ASNS = [
  8075, 8068, 8069, 8070, 8071, 8072, 3598, 6182, 23274, 11271, 12076,
];

export function wafAsnSet(asns) {
  return `{${[...new Set(asns)].sort((a, b) => a - b).join(' ')}}`;
}

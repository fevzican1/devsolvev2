/**
 * Published Google/Bing crawl networks.
 *
 * These ASNs must NEVER appear as a positive match on a challenge or block
 * rule. Google's renderer fetches CSS/JS with a Chrome User-Agent from
 * 15169/396982/…; BingPreview does the same from 8075/8068/…. Challenging
 * "Chrome from hosting ASNs" that include those numbers is how a real crawl
 * gets 403ed even when the HTML request itself skipped on a googlebot UA.
 *
 * The WAF uses this list only as an exclusion on the fake-Chrome block.
 * Search crawlers skip on User-Agent (WAF1), not on `cf.client.bot` — a lag
 * in Cloudflare's verified-bot signal is the other way a real crawl 403s.
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

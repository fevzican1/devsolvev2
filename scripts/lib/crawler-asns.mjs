/**
 * Published search-crawler networks — reference only.
 *
 * Custom WAF rules WAF2–WAF5 must never mention these ASNs or the words
 * Google / Bing. Search crawlers skip on User-Agent in WAF1. Putting 15169
 * or 8075 on a challenge list is how a renderer fetching CSS/JS with a
 * Chrome User-Agent gets 403ed after the HTML request already skipped.
 */

export const GOOGLE_CRAWLER_ASNS = [
  15169, 396982, 36040, 43515, 36561, 19527, 139070, 139190,
];

export const BING_CRAWLER_ASNS = [
  8075, 8068, 8069, 8070, 8071, 8072, 3598, 6182, 23274, 11271, 12076,
];

export function wafAsnSet(asns) {
  return `{${[...new Set(asns)].sort((a, b) => a - b).join(' ')}}`;
}

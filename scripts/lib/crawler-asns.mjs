/**
 * Published search-crawler networks.
 *
 * WAF1 may skip Chrome renderers from these ASNs. Google and Bing often
 * fetch /k/ and assets with a plain Chrome User-Agent (no "google"/"bing"
 * token). Those requests used to fall through to WAF3.
 *
 * WAF2–WAF5 must never mention these ASNs or the words Google / Bing.
 * Putting 15169 or 8075 on a challenge list is how a renderer gets 403ed.
 */

export const GOOGLE_CRAWLER_ASNS = [
  15169, 396982, 36040, 43515, 36561, 19527, 139070, 139190,
];

/** Google crawler/renderer nets only. 396982 is Google Cloud customer VMs — farms rent those. */
export const GOOGLE_WAF1_ASNS = GOOGLE_CRAWLER_ASNS.filter((asn) => asn !== 396982);

export const BING_CRAWLER_ASNS = [
  8075, 8068, 8069, 8070, 8071, 8072, 3598, 6182, 23274, 11271, 12076,
];

export function wafAsnSet(asns) {
  return `{${[...new Set(asns)].sort((a, b) => a - b).join(' ')}}`;
}

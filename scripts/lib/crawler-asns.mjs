/** Keep in sync with functions/_shared/crawlerAsns.ts */

export const GOOGLE_CRAWLER_ASNS = [15169, 396982, 36040, 43515, 36561, 19527, 139070];

export const BING_CRAWLER_ASNS = [8075, 3598, 8068, 8069, 6182, 23274, 11271];

export function wafAsnSet(asns) {
  return `{${asns.join(' ')}}`;
}

/**
 * Cloudflare custom WAF rules for devsolvev2.com — Free plan, 5 rules.
 *
 * Keep these expressions short and obvious. The live dashboard should match
 * this file. First match wins.
 *
 * WAF1 is the only rule that names search or social crawlers. Real Google
 * and Bing skip only when a crawler User-Agent token AND a crawler ASN both
 * match. Do not skip on the bare substrings "google" / "bing" / "msn" — that
 * is the spoof leak. Do not add `cf.client.bot` here: Cloudflare often
 * verifies Google and lags on Bing, and that lag is what 403s a real Bing
 * crawl. Do not try to catch fake Googlebot/Bingbot in later rules. Applebot
 * is intentionally NOT skipped here — WAF5 already blocks it.
 *
 * WAF2 and WAF3 expressions are frozen. Do not edit them. Operator rules
 * (sasd, AI Crawl Control) stay in slots 4 and 5.
 */

import { BING_CRAWLER_ASNS, GOOGLE_WAF1_ASNS, wafAsnSet } from './crawler-asns.mjs';

export const MAX_EXPRESSION_LENGTH = 4096;

/** Social unfurls. Not Google/Bing — those require crawler ASN. */
export const WAF1_SOCIAL_UA_SKIP_TOKENS = [
  'twitter', 'facebook', 'facebot', 'linkedin', 'slack',
  'discord', 'whatsapp', 'telegram', 'reddit', 'pinterest',
];

/** Real Google crawlers. Not the substring "google". */
export const WAF1_GOOGLE_UA_TOKENS = [
  'googlebot',
  'google-inspectiontool',
  'adsbot-google',
  'apis-google',
  'mediapartners-google',
  'storebot-google',
  'googleproducer',
  'google-read-aloud',
  'feedfetcher-google',
  'googleother',
  'google-site-verification',
  'duplexweb-google',
];

/** Real Bing crawlers. Not the substring "bing" / "msn". */
export const WAF1_BING_UA_TOKENS = [
  'bingbot',
  'msnbot',
  'adidxbot',
  'bingpreview',
  'microsoftpreview',
];

export const WAF1_PUBLIC_PATHS = [
  '/robots.txt',
  '/sitemap.xml',
  '/feed.xml',
  '/opengraph-image.png',
  '/ee5098cac2284d92b6ee1c9fca52a120.txt',
  '/ads.txt',
  '/sellers.json',
];

export function collapse(expr) {
  return expr.replace(/\s+/g, ' ').trim();
}

/** Public files any client must be able to fetch (IndexNow, ads, social cards). */
export const PUBLIC_ENDPOINTS = `(http.request.uri.path in {${WAF1_PUBLIC_PATHS.map((p) => `"${p}"`).join(' ')}})`;

const EXTENSION_DENY = collapse(`
  not lower(http.user_agent) contains "chrome-extension"
  and not lower(http.user_agent) contains "moz-extension"
  and not http.request.headers["origin"][0] contains "chrome-extension"
  and not http.request.headers["referer"][0] contains "chrome-extension"
  and not http.request.headers["origin"][0] contains "moz-extension"
  and not http.request.headers["referer"][0] contains "moz-extension"
`);

const FARM_STAMP_DENY = collapse(`
  not lower(http.user_agent) contains ".0.0.0"
  and not lower(http.user_agent) contains "chrome/100.0.4896"
  and not (lower(http.user_agent) contains "mac os x 10_15_7" and lower(http.user_agent) contains "chrome/")
`);

function uaContainsAny(tokens) {
  return tokens.map((token) => `lower(http.user_agent) contains "${token}"`).join(' or ');
}

const GOOGLE_UA_ANY = `(${uaContainsAny(WAF1_GOOGLE_UA_TOKENS)})`;
const BING_UA_ANY = `(${uaContainsAny(WAF1_BING_UA_TOKENS)})`;
const SEARCH_UA_DENY = `not (${uaContainsAny([...WAF1_GOOGLE_UA_TOKENS, ...WAF1_BING_UA_TOKENS])})`;

/**
 * Named Google/Bing crawlers skip only from their own crawler ASNs.
 * GCP 396982 is not a Google crawler ASN. Chrome-extension never skips.
 * Bing also drops farm-stamped Chrome even when the UA says bingbot.
 */
export const WAF1_SEARCH_CRAWLER_ASN = collapse(`(
  ${EXTENSION_DENY}
  and (
    (${GOOGLE_UA_ANY} and ip.src.asnum in ${wafAsnSet(GOOGLE_WAF1_ASNS)})
    or (
      ${BING_UA_ANY}
      and ip.src.asnum in ${wafAsnSet(BING_CRAWLER_ASNS)}
      and ${FARM_STAMP_DENY}
    )
  )
)`);

/**
 * Plain Chrome renderers from Google/Bing ASNs (PageSpeed, headless fetch).
 * Search-crawler User-Agents are excluded so a spoofed Googlebot+Chrome
 * string on Azure 8075 cannot ride the Bing renderer skip.
 *
 * - Google crawler ASNs (not GCP 396982): skip Chrome, including PageSpeed's
 *   Chrome/123.0.0.0. Farms do not sit on 15169.
 * - Bing/Microsoft ASNs (includes Azure 8075): skip only unstamped Chrome, so
 *   Chrome/145.0.0.0 on Azure still falls through to WAF2.
 * - chrome-extension / moz-extension never skip here. That is the farm.
 */
export const WAF1_SEARCH_RENDERER_ASN = collapse(`(
  lower(http.user_agent) contains "chrome/"
  and ${EXTENSION_DENY}
  and ${SEARCH_UA_DENY}
  and (
    ip.src.asnum in ${wafAsnSet(GOOGLE_WAF1_ASNS)}
    or (
      ip.src.asnum in ${wafAsnSet(BING_CRAWLER_ASNS)}
      and ${FARM_STAMP_DENY}
    )
  )
)`);

/**
 * WAF1 — SKIP. Real Google/Bing crawlers (token + ASN), social unfurls,
 * Google/Bing Chrome renderers, and the public files above. No verified-bot
 * flag. No Applebot. No lighthouse / pagespeed tokens. No bare "google" /
 * "bing" substring skip.
 */
export const WAF1_SKIP = collapse(`(
  ${WAF1_SOCIAL_UA_SKIP_TOKENS.map((token) => `lower(http.user_agent) contains "${token}"`).join('\n  or ')}
  or ${WAF1_SEARCH_CRAWLER_ASN}
  or ${WAF1_SEARCH_RENDERER_ASN}
  or ${PUBLIC_ENDPOINTS}
)`);

export function isFarmStampUa(ua) {
  const lower = String(ua || '').toLowerCase();
  return lower.includes('.0.0.0')
    || lower.includes('chrome/100.0.4896')
    || (lower.includes('mac os x 10_15_7') && lower.includes('chrome/'));
}

export function isExtensionRequest({ ua = '', origin = '', referer = '' } = {}) {
  const blob = `${ua}\n${origin}\n${referer}`.toLowerCase();
  return blob.includes('chrome-extension') || blob.includes('moz-extension');
}

function uaHasToken(lower, tokens) {
  return tokens.some((token) => lower.includes(token));
}

/**
 * Offline model of WAF1. Real Google/Bing skip; spoofed crawler UAs do not.
 */
export function matchesWaf1Skip({
  ua = '',
  path = '/k/x',
  asnum = 0,
  origin = '',
  referer = '',
} = {}) {
  const lower = String(ua || '').toLowerCase();
  if (WAF1_PUBLIC_PATHS.includes(path)) {
    return { skip: true, via: 'public-path' };
  }
  if (uaHasToken(lower, WAF1_SOCIAL_UA_SKIP_TOKENS)) {
    return { skip: true, via: 'social-ua' };
  }

  const hasGoogleToken = uaHasToken(lower, WAF1_GOOGLE_UA_TOKENS);
  const hasBingToken = uaHasToken(lower, WAF1_BING_UA_TOKENS);
  const extension = isExtensionRequest({ ua, origin, referer });

  if (!extension && hasGoogleToken && GOOGLE_WAF1_ASNS.includes(asnum)) {
    return { skip: true, via: 'google-crawler' };
  }
  if (!extension && hasBingToken && BING_CRAWLER_ASNS.includes(asnum) && !isFarmStampUa(ua)) {
    return { skip: true, via: 'bing-crawler' };
  }
  if (hasGoogleToken || hasBingToken) {
    return { skip: false, via: null };
  }
  if (!lower.includes('chrome/')) {
    return { skip: false, via: null };
  }
  if (extension) {
    return { skip: false, via: null };
  }
  if (GOOGLE_WAF1_ASNS.includes(asnum)) {
    return { skip: true, via: 'google-asn' };
  }
  if (BING_CRAWLER_ASNS.includes(asnum) && !isFarmStampUa(ua)) {
    return { skip: true, via: 'bing-asn' };
  }
  return { skip: false, via: null };
}

/**
 * WAF2 — expression frozen. Named scrapers, the Chrome-extension leak, and
 * the farm's stamped User-Agent. Live action is managed_challenge (operator
 * choice). Do not edit this expression. Real Chrome is `Chrome/144.0.7559.109`.
 * The farm sends `Chrome/144.0.0.0` / `Edg/144.0.0.0` and Catalina `10_15_7`
 * with Chrome. Search crawlers never reach this rule (WAF1 skipped them).
 */
export const WAF2_BLOCK = collapse(`(
  lower(http.user_agent) contains "gpt"
  or lower(http.user_agent) contains "oai-"
  or lower(http.user_agent) contains "claude"
  or lower(http.user_agent) contains "anthropic"
  or lower(http.user_agent) contains "perplexity"
  or lower(http.user_agent) contains "bytespider"
  or lower(http.user_agent) contains "ccbot"
  or lower(http.user_agent) contains "ahrefs"
  or lower(http.user_agent) contains "semrush"
  or lower(http.user_agent) contains "dataforseo"
  or lower(http.user_agent) contains "headless"
  or lower(http.user_agent) contains "puppeteer"
  or lower(http.user_agent) contains "selenium"
  or lower(http.user_agent) contains "curl"
  or lower(http.user_agent) contains "wget"
  or lower(http.user_agent) contains "python"
  or lower(http.user_agent) contains "scrapy"
  or lower(http.user_agent) contains "chrome-extension"
  or lower(http.user_agent) contains "moz-extension"
  or http.request.headers["origin"][0] contains "chrome-extension"
  or http.request.headers["referer"][0] contains "chrome-extension"
  or http.request.headers["origin"][0] contains "moz-extension"
  or http.request.headers["referer"][0] contains "moz-extension"
  or lower(http.user_agent) contains ".0.0.0"
  or lower(http.user_agent) contains "chrome/100.0.4896"
  or (lower(http.user_agent) contains "mac os x 10_15_7" and lower(http.user_agent) contains "chrome/")
  or (len(http.user_agent) lt 12 and not cf.client.bot)
)`);

/**
 * WAF3 — expression frozen. Chrome-looking clients hitting /k/ that are not
 * a real page open. Live action is managed_challenge (operator choice). Do
 * not edit this expression. A person sends sec-fetch-mode: navigate and
 * sec-fetch-dest: document. Search crawlers never reach this rule (WAF1
 * already skipped them, including Google/Bing Chrome renderers by ASN).
 */
export const WAF3_CHALLENGE = collapse(`(
  starts_with(http.request.uri.path, "/k/")
  and lower(http.user_agent) contains "chrome/"
  and not (
    http.request.headers["sec-fetch-mode"][0] eq "navigate"
    and http.request.headers["sec-fetch-dest"][0] eq "document"
  )
)`);

/** WAF4 — operator rule `sasd` (wp-admin / .env). Preserved, not rewritten. */
export const WAF4_PRESERVED_DESCRIPTION = 'sasd';

/** WAF5 — operator rule AI Crawl Control. Preserved, not rewritten. */
export const WAF5_PRESERVED_DESCRIPTION = 'AI Crawl Control - Block AI bots by User Agent';

export const SKIP_PRODUCTS = ['zoneLockdown', 'uaBlock', 'bic', 'hot', 'securityLevel', 'rateLimit', 'waf'];

export const RULE_SPEC = [
  {
    slot: 'WAF1',
    description: '[DevSolve] WAF1 SKIP Google Bing + verified social unfurls and public endpoints',
    expression: WAF1_SKIP,
    action: 'skip',
    action_parameters: { ruleset: 'current', products: SKIP_PRODUCTS },
    logging: { enabled: true },
  },
  {
    slot: 'WAF2',
    description: '[DevSolve] WAF2 BLOCK scrapers, AI crawlers, fake Chrome and short User-Agents',
    expression: WAF2_BLOCK,
    action: 'managed_challenge',
  },
  {
    slot: 'WAF3',
    description: '[DevSolve] WAF3 BLOCK fake Chrome on /k/',
    expression: WAF3_CHALLENGE,
    action: 'managed_challenge',
  },
];

/**
 * Rate limit (separate phase, does not count as a custom-rule slot).
 * WAF1 skip already lists rateLimit, so search/social User-Agents never hit it.
 */
export const RATE_LIMIT_RULE = {
  description: '[DevSolve] corpus rate limit — 30 req/10s per IP, verified bots exempt',
  expression: collapse(`(
    (starts_with(http.request.uri.path, "/k/") or starts_with(http.request.uri.path, "/sitemap"))
    and not cf.client.bot
  )`),
  action: 'managed_challenge',
  ratelimit: {
    characteristics: ['ip.src', 'cf.colo.id'],
    period: 10,
    requests_per_period: 30,
    mitigation_timeout: 10,
  },
};

export const LEGACY_DESCRIPTIONS = new Set([
  '[DevSolve] WAF1 SKIP Google Bing + verified social unfurls and public endpoints',
  '[DevSolve] WAF1 SKIP verified search + social preview crawlers and public endpoints',
  '[DevSolve] SKIP crawlers + real browsers (never challenge)',
  '[DevSolve] WAF1 SKIP verified Googlebot + Bingbot and public endpoints',
  '[DevSolve] WAF1 SKIP verified Googlebot + Bingbot (first, never challenged)',
  '[DevSolve] SKIP verified Google/Bing only (never challenge)',
  '[DevSolve] SKIP verified Google/Bing crawlers (never challenge/block)',
  '[DevSolve] WAF1 block scrapers — keep Google Bing GSC + humans',
  '[DevSolve] WAF2 BLOCK scrapers, AI crawlers, fake Chrome and short User-Agents',
  '[DevSolve] WAF2 BLOCK scrapers, AI crawlers and short User-Agents',
  '[DevSolve] WAF2 BLOCK scrapers, AI crawlers and spoofed Googlebot',
  '[DevSolve] WAF2 corpus allowlist — Google Bing GSC + real browsers',
  '[DevSolve] WAF3 BLOCK fake Chrome on /k/',
  '[DevSolve] WAF3 CHALLENGE browser-extension scrapers',
  '[DevSolve] WAF3 CHALLENGE fake browsers and datacenter traffic',
  '[DevSolve] single block — fake Chrome + scrapers; Google Bing humans allowed',
  '[DevSolve] sitewide block AI indexers + extension scrapers',
  '[DevSolve] sitewide block Meta AI indexer',
  '[DevSolve] sitewide block AI indexers (Claude-SearchBot, Meta)',
  '[DevSolve] sitewide block fake desktop Chrome without Client Hints',
  '[DevSolve] corpus+sitemaps block fake Googlebot/Bingbot (wrong ASN)',
  '[DevSolve] corpus+sitemaps allowlist — Google Bing GSC inspection + real browsers',
  '[DevSolve] /k/* block fake Bingbot',
  '[DevSolve] /k/* allowlist — Google Bing DuckDuckGo + real browsers',
  '[DevSolve] /k/* block known scraper UAs',
  '[DevSolve] /k/* block fake desktop Chrome without Client Hints',
  '[DevSolve] /k/* block fake Googlebot/Bingbot (wrong ASN)',
  '[DevSolve] /k/* allowlist — Google Bing GSC inspection + real browsers',
  '[DevSolve] /k/*  Googlebot/Bingbot (wrong ASN)',
  '[DevSolve] corpus+sitemaps block known scraper UAs',
  '[DevSolve] corpus+sitemaps block fake desktop Chrome without Client Hints',
]);

export function assertExpressionLengths(rules = [...RULE_SPEC, RATE_LIMIT_RULE]) {
  for (const rule of rules) {
    const expression = collapse(rule.expression);
    if (expression.length > MAX_EXPRESSION_LENGTH) {
      throw new Error(
        `${rule.description} expression is ${expression.length} chars (max ${MAX_EXPRESSION_LENGTH})`,
      );
    }
  }
}

/** Later custom rules must never name search crawlers. */
export function laterRulesNameSearchCrawlers() {
  const named = [];
  for (const rule of [ { name: 'WAF2', expression: WAF2_BLOCK }, { name: 'WAF3', expression: WAF3_CHALLENGE }, { name: 'rateLimit', expression: RATE_LIMIT_RULE.expression } ]) {
    if (/\bgoogle|\bbing/i.test(rule.expression)) named.push(rule.name);
  }
  return named;
}

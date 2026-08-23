/**
 * Cloudflare custom WAF rules for devsolvev2.com — Free plan, 5 rules.
 *
 * Keep these expressions short and obvious. The live dashboard should match
 * this file. First match wins.
 *
 * WAF1 is the only rule that names search or social crawlers. It SKIPS them
 * on User-Agent (and Google/Bing renderer ASNs). Do not add `cf.client.bot`
 * here: Cloudflare often verifies Google and lags on Bing, and that lag is
 * what 403s a real Bing crawl. Do not try to catch fake Googlebot/Bingbot
 * in later rules. Applebot is intentionally NOT skipped here — WAF5 already
 * blocks it.
 *
 * WAF2 and WAF3 expressions are frozen. Do not edit them. Operator rules
 * (sasd, AI Crawl Control) stay in slots 4 and 5.
 */

import { BING_CRAWLER_ASNS, GOOGLE_CRAWLER_ASNS, wafAsnSet } from './crawler-asns.mjs';

export const MAX_EXPRESSION_LENGTH = 4096;

export const SEARCH_CRAWLER_ASNS = [...GOOGLE_CRAWLER_ASNS, ...BING_CRAWLER_ASNS];

export function collapse(expr) {
  return expr.replace(/\s+/g, ' ').trim();
}

/** Public files any client must be able to fetch (IndexNow, ads, social cards). */
export const PUBLIC_ENDPOINTS = `(http.request.uri.path in {"/robots.txt" "/sitemap.xml" "/feed.xml" "/opengraph-image.png" "/ee5098cac2284d92b6ee1c9fca52a120.txt" "/ads.txt" "/sellers.json"})`;

/**
 * Chrome renderers from Google/Bing ASNs. Those fetches often have no
 * "google"/"bing" in the User-Agent, so they used to hit WAF3. Farm stamps
 * stay out of this skip so WAF2 still sees Chrome/144.0.0.0 on Azure/GCP.
 */
export const WAF1_SEARCH_RENDERER_ASN = collapse(`(
  ip.src.asnum in ${wafAsnSet(SEARCH_CRAWLER_ASNS)}
  and lower(http.user_agent) contains "chrome/"
  and not lower(http.user_agent) contains ".0.0.0"
  and not lower(http.user_agent) contains "chrome/100.0.4896"
  and not (lower(http.user_agent) contains "mac os x 10_15_7" and lower(http.user_agent) contains "chrome/")
)`);

/**
 * WAF1 — SKIP. Search + social User-Agents, Google/Bing renderer ASNs, and
 * the public files above. No verified-bot flag. No Applebot — that skip is
 * what let Applebot through. A spoofed crawler UA is cheaper than a 403 on Bing.
 */
export const WAF1_SKIP = collapse(`(
  lower(http.user_agent) contains "google"
  or lower(http.user_agent) contains "bing"
  or lower(http.user_agent) contains "msn"
  or lower(http.user_agent) contains "adidx"
  or lower(http.user_agent) contains "microsoftpreview"
  or lower(http.user_agent) contains "lighthouse"
  or lower(http.user_agent) contains "pagespeed"
  or lower(http.user_agent) contains "twitter"
  or lower(http.user_agent) contains "facebook"
  or lower(http.user_agent) contains "facebot"
  or lower(http.user_agent) contains "linkedin"
  or lower(http.user_agent) contains "slack"
  or lower(http.user_agent) contains "discord"
  or lower(http.user_agent) contains "whatsapp"
  or lower(http.user_agent) contains "telegram"
  or lower(http.user_agent) contains "reddit"
  or lower(http.user_agent) contains "pinterest"
  or ${WAF1_SEARCH_RENDERER_ASN}
  or ${PUBLIC_ENDPOINTS}
)`);

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

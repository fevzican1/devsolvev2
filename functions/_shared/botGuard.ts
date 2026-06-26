/**
 * Strict allowlist for /k/* — ONLY:
 *   • Google search crawlers
 *   • Bing search crawlers
 *   • DuckDuckGo crawlers
 *   • Verified real human browsers (header-checked Chromium, Firefox, Safari)
 *
 * Everything else is blocked: AI scrapers, social unfurlers, Apple/Meta/Baidu
 * bots, fake Chrome UAs, headless clients, curl/python/etc.
 *
 * Pages Function code still counts as 1 invocation per /k/* request that
 * reaches it. To block attackers with ZERO Function invocations, deploy the
 * matching WAF rule: `node scripts/deploy-waf-bot-block.mjs`
 */

export interface CfRequestProperties {
  asn?: number;
  asOrganization?: string;
  verifiedBotCategory?: string;
  botManagement?: { verifiedBot?: boolean; score?: number };
}

export interface GuardHeaders {
  secChUa: string | null;
  secChUaMobile: string | null;
}

export type AccessDecision = 'allow' | 'block';

const GOOGLE_UA_MARKERS: readonly string[] = [
  'googlebot', 'adsbot-google', 'mediapartners-google', 'storebot-google',
  'google-inspectiontool', 'google-site-verification', 'feedfetcher-google',
  'apis-google', 'duplexweb-google', 'googleother',
];

const BING_UA_MARKERS: readonly string[] = [
  'bingbot', 'bingpreview', 'adidxbot', 'msnbot',
];

const DUCKDUCK_UA_MARKERS: readonly string[] = [
  'duckduckbot', 'duckduckgo-favicons-bot',
];

/** Always block — includes the attack sources called out by site owner. */
const HARD_BLOCK_PATTERNS: readonly string[] = [
  // Meta crawlers (NOT the unfurl/preview bot — that is in SOCIAL_PREVIEW_MARKERS)
  'meta-webindexer', 'meta-externalagent', 'meta-externalfetcher',
  'facebookcatalog', 'facebookbot',
  // Apple / Baidu / Yandex
  'applebot', 'applebot-extended', 'apple-pubsub',
  'baidu', 'baiduspider', 'yandexbot', 'yandex.com/bots', 'sogou', 'sogou web spider',
  // AI / LLM crawlers
  'chatgpt-user', 'oai-searchbot', 'openai', 'anthropic-ai', 'claude-web', 'claudebot',
  'claude-searchbot', 'searchbot', 'gptbot', 'google-extended',
  'perplexitybot', 'perplexity-user', 'youbot', 'cohere-ai', 'cohere-training-data-crawler',
  'bytespider', 'amazonbot', 'diffbot', 'omgilibot', 'omgili', 'ccbot',
  'common crawl', 'commoncrawl',
  // SEO / scraper bots
  'ahrefsbot', 'ahrefssiteaudit', 'semrushbot', 'mj12bot', 'dotbot', 'blexbot', 'petalbot',
  'dataforseobot', 'seznambot', 'aspiegelbot', 'exabot', 'megaindex', 'serpstatbot',
  'barkrowler', 'zoominfobot', 'seekport', 'linkdexbot', 'rogerbot', 'sistrix',
  'embedly', 'iframely',
  // Fake browser / automation
  'chrome-extension', 'headlesschrome', 'headless', 'phantomjs', 'puppeteer', 'playwright',
  'selenium', 'electron/', 'scrapy', 'httrack', 'wget', 'curl/', 'libwww-perl',
  'python-requests', 'python-urllib', 'go-http-client', 'java/', 'okhttp', 'node-fetch',
  'axios/', 'masscan', 'nikto', 'nmap', 'sqlmap', 'fuzz', 'zgrab', 'censys', 'shodan',
  'pingdom', 'screaming frog', 'netcraftsurveyagent', 'gigabot', 'leikibot', 'wpscan',
  'binlar', 'spbot', 'mauibot', 'researchscan', 'palo alto',
];

/**
 * Social / link-preview (unfurl) crawlers — allowed to fetch pages so they can
 * render rich Open Graph cards when a user shares a link on these platforms.
 * These are NOT search-index or AI-training crawlers. They only ever fetch the
 * cheap, edge-cached page (zero extra Cloudflare cost). Kept in sync with
 * robots.txt which explicitly `Allow: /` for each of these user-agents.
 */
const SOCIAL_PREVIEW_MARKERS: readonly string[] = [
  'twitterbot', 'facebookexternalhit',
  'linkedinbot', 'slackbot', 'slack-imgproxy',
  'discordbot', 'telegrambot', 'redditbot',
  'pinterest', 'pinterestbot', 'mastodon',
  'whatsapp',
];

const GOOGLE_ASNS: ReadonlySet<number> = new Set([15169, 396982]);

function lowerIncludesAny(lower: string, markers: readonly string[]): boolean {
  return markers.some((m) => lower.includes(m));
}

function matchesHardBlock(lower: string): boolean {
  return HARD_BLOCK_PATTERNS.some((p) => lower.includes(p));
}

function uaClaimsGoogle(lower: string): boolean {
  return lowerIncludesAny(lower, GOOGLE_UA_MARKERS);
}

function uaClaimsBing(lower: string): boolean {
  return lowerIncludesAny(lower, BING_UA_MARKERS);
}

function uaClaimsDuckDuckGo(lower: string): boolean {
  return lowerIncludesAny(lower, DUCKDUCK_UA_MARKERS);
}

function isSocialPreviewBot(lower: string): boolean {
  return lowerIncludesAny(lower, SOCIAL_PREVIEW_MARKERS);
}

function isNetworkVerifiedGoogle(cf?: CfRequestProperties): boolean | null {
  if (!cf) return null;
  if (cf.verifiedBotCategory && /search/i.test(cf.verifiedBotCategory)) return true;
  if (cf.botManagement?.verifiedBot === true) return true;
  if (typeof cf.asn === 'number' && GOOGLE_ASNS.has(cf.asn)) return true;
  if (cf.asOrganization && /google/i.test(cf.asOrganization)) return true;
  return null;
}

/**
 * Real human browser — rejects Chrome UA strings without sec-ch-ua (typical
 * of scrapers pretending to be desktop Chrome / extension abuse).
 */
function looksLikeRealHumanBrowser(ua: string, headers: GuardHeaders): boolean {
  const lower = ua.toLowerCase();
  if (!lower.includes('mozilla/')) return false;

  if (matchesHardBlock(lower)) return false;

  // iOS in-app browsers (Instagram, Facebook, TikTok link taps) — real users,
  // not crawlers. Typical pattern: iPhone/iPad + AppleWebKit + Mobile.
  if (/(?:iphone|ipad|ipod)/.test(lower) && lower.includes('applewebkit/') && lower.includes('mobile/')) {
    if (/(?:bot|crawler|spider|facebookexternalhit|meta-webindexer|applebot|baiduspider)/.test(lower)) {
      return false;
    }
    return true;
  }

  // Android WebView / in-app browsers (Chrome WebView token " wv" or Mobile Safari-like)
  if (lower.includes('android') && lower.includes('applewebkit/') && lower.includes('mobile')) {
    if (/(?:bot|crawler|spider|baiduspider|semrushbot|ahrefsbot)/.test(lower)) return false;
    return true;
  }

  // Firefox / Firefox iOS
  if (lower.includes('firefox/') || lower.includes('fxios/')) {
    return lower.includes('gecko/');
  }

  // Safari (not Chromium pretending to be Safari)
  if (lower.includes('safari/') && !/(?:chrome\/|chromium\/|crios\/|edg\/|opr\/)/.test(lower)) {
    return lower.includes('applewebkit/') && lower.includes('version/');
  }

  // iOS Chrome
  if (lower.includes('crios/')) return true;

  // Chromium family — require Client Hints on desktop; allow Android Chrome / Samsung
  if (/(?:chrome\/|edg\/|edga\/|edgios\/|opr\/|samsungbrowser\/)/.test(lower)) {
    const secChUa = headers.secChUa?.trim() ?? '';
    if (secChUa.length > 2) return true;
    if (lower.includes('android')) return true;
    return false;
  }

  return false;
}

export function decideAccess(
  ua: string,
  cf?: CfRequestProperties,
  headers: GuardHeaders = { secChUa: null, secChUaMobile: null },
): AccessDecision {
  if (!ua) return 'block';

  const lower = ua.toLowerCase();
  if (matchesHardBlock(lower)) return 'block';

  if (uaClaimsGoogle(lower)) {
    const verified = isNetworkVerifiedGoogle(cf);
    return verified === false ? 'block' : 'allow';
  }

  if (uaClaimsBing(lower)) return 'allow';
  if (uaClaimsDuckDuckGo(lower)) return 'allow';

  // Social / link-preview bots — allow rich card unfurling (matches robots.txt)
  if (isSocialPreviewBot(lower)) return 'allow';

  if (looksLikeRealHumanBrowser(ua, headers)) return 'allow';

  return 'block';
}

export const ACCESS_DENIED_HEADERS: Record<string, string> = {
  'Content-Type': 'text/plain;charset=UTF-8',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

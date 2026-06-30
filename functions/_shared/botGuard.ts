/**
 * Strict allowlist for /k/* — ONLY:
 *   • Google search crawlers
 *   • Bing search crawlers
 *   • DuckDuckGo crawlers
 *   • Social preview / unfurl bots (for link equity & referral traffic)
 *   • Verified real human browsers (header-checked Chromium, Firefox, Safari)
 *
 * Everything else is blocked: AI scrapers, SEO audit bots, fake Chrome UAs,
 * headless clients, curl/python/etc.
 *
 * Social preview bots (Twitter, LinkedIn, Slack, Discord, etc.) are NOW ALLOWED
 * because they drive shares, referral clicks, and organic inbound links — the
 * only code-controllable backlink channel. They only fetch the cheap,
 * edge-cached page at zero Cloudflare cost. Blocking them previously caused
 * broken link previews which reduced shareability and inbound link acquisition.
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

/**
 * Social preview / unfurl bot markers — these bots fetch a URL when a human
 * shares it (Twitter, LinkedIn, Slack, Discord, Telegram, WhatsApp, Facebook,
 * Reddit, Pinterest, Mastodon). They render Open Graph cards that drive shares
 * and organic inbound links. Allowed because:
 *   1. Zero cost (edge-cached response)
 *   2. Drive referral traffic + backlinks
 *   3. Only fire on human-shared URLs (not automated crawls)
 */
const SOCIAL_PREVIEW_MARKERS: readonly string[] = [
  'twitterbot', 'facebookexternalhit', 'facebookcatalog',
  'linkedinbot', 'slackbot', 'slack-imgproxy',
  'discordbot', 'telegrambot', 'whatsapp',
  'redditbot', 'pinterest', 'pinterestbot',
  'embedly', 'iframely', 'mastodon',
];

/** Always block — includes the attack sources called out by site owner. */
const HARD_BLOCK_PATTERNS: readonly string[] = [
  // Meta / Apple / Baidu / Claude / AI
  'meta-webindexer', 'meta-externalagent', 'meta-externalfetcher',
  'applebot', 'applebot-extended', 'apple-pubsub',
  'baidu', 'baiduspider', 'yandexbot', 'yandex.com/bots', 'sogou', 'sogou web spider',
  'chatgpt-user', 'oai-searchbot', 'openai', 'anthropic-ai', 'claude-web', 'claudebot',
  'claude-searchbot', 'searchbot', 'gptbot', 'google-extended',
  'perplexitybot', 'perplexity-user', 'youbot', 'cohere-ai', 'cohere-training-data-crawler',
  'bytespider', 'amazonbot', 'diffbot', 'omgilibot', 'omgili', 'ccbot',
  'common crawl', 'commoncrawl',
  // SEO / scraper (NOT social unfurlers)
  'ahrefsbot', 'ahrefssiteaudit', 'semrushbot', 'mj12bot', 'dotbot', 'blexbot', 'petalbot',
  'dataforseobot', 'seznambot', 'aspiegelbot', 'exabot', 'megaindex', 'serpstatbot',
  'barkrowler', 'zoominfobot', 'seekport', 'linkdexbot', 'rogerbot', 'sistrix',
  // Fake browser / automation
  'chrome-extension', 'headlesschrome', 'headless', 'phantomjs', 'puppeteer', 'playwright',
  'selenium', 'electron/', 'scrapy', 'httrack', 'wget', 'curl/', 'libwww-perl',
  'python-requests', 'python-urllib', 'go-http-client', 'java/', 'okhttp', 'node-fetch',
  'axios/', 'masscan', 'nikto', 'nmap', 'sqlmap', 'fuzz', 'zgrab', 'censys', 'shodan',
  'pingdom', 'screaming frog', 'netcraftsurveyagent', 'gigabot', 'leikibot', 'wpscan',
  'binlar', 'spbot', 'mauibot', 'researchscan', 'palo alto',
];

const GOOGLE_ASNS: ReadonlySet<number> = new Set([15169, 396982]);

/** Microsoft ASNs used by Bingbot / MSN crawlers. */
const BING_ASNS: ReadonlySet<number> = new Set([8075, 3598, 8068, 8069, 6182]);

/** Desktop Chrome below this major version is always a scraper fingerprint (2026). */
const MIN_DESKTOP_CHROME_MAJOR = 90;

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
  return false;
}

function isNetworkVerifiedBing(cf?: CfRequestProperties): boolean | null {
  if (!cf) return null;
  if (cf.verifiedBotCategory && /search/i.test(cf.verifiedBotCategory)) return true;
  if (cf.botManagement?.verifiedBot === true) return true;
  if (typeof cf.asn === 'number' && BING_ASNS.has(cf.asn)) return true;
  if (cf.asOrganization && /microsoft|bing/i.test(cf.asOrganization)) return true;
  return false;
}

/** Scraper UAs often copy ancient desktop Chrome strings without Client Hints. */
function isAbsurdlyStaleDesktopChrome(lower: string): boolean {
  if (/(?:iphone|ipad|ipod|android|mobile)/.test(lower)) return false;
  const match = lower.match(/chrome\/(\d+)/);
  if (!match) return false;
  return Number.parseInt(match[1], 10) < MIN_DESKTOP_CHROME_MAJOR;
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

  if (isAbsurdlyStaleDesktopChrome(lower)) return false;

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

  if (uaClaimsBing(lower)) {
    const verified = isNetworkVerifiedBing(cf);
    return verified === false ? 'block' : 'allow';
  }
  if (uaClaimsDuckDuckGo(lower)) return 'allow';

  // Social preview bots — allowed for link equity and referral traffic.
  // They only fire on human-shared URLs (not automated crawls) and fetch
  // the cheap, edge-cached response at zero extra Cloudflare cost.
  if (isSocialPreviewBot(lower)) return 'allow';

  if (looksLikeRealHumanBrowser(ua, headers)) return 'allow';

  return 'block';
}

export const ACCESS_DENIED_HEADERS: Record<string, string> = {
  'Content-Type': 'text/plain;charset=UTF-8',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

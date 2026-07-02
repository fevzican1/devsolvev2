/**
 * Strict allowlist for /k/* — ONLY:
 *   • Google search crawlers (ASN-verified or Cloudflare verified)
 *   • Bing search crawlers (ASN-verified or Cloudflare verified)
 *   • Google Search Console URL Inspection (google-inspectiontool UA)
 *   • Verified real human browsers (header-checked Chromium, Firefox, Safari)
 *
 * Blocked at WAF before Pages Function (zero invocations):
 *   AI scrapers, SEO bots, fake Google/Bing UA, social unfurl bots, DuckDuckGo,
 *   fake Chrome, curl/python, etc.
 *
 * IMPORTANT — Cloudflare Pages Function invocation accounting:
 *   • WAF `block` → 0 invocations (traffic never reaches this handler)
 *   • Allowed traffic that reaches this handler → 1 invocation per request,
 *     including cache hits and 403 responses decided here
 *   • Real Googlebot/Bingbot crawling /k/* WILL invoke the function on cache miss
 *     (required for indexing). Spam must be stopped at WAF, not here.
 *
 * Deploy matching WAF: `node scripts/deploy-waf-bot-block.mjs`
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

import { BING_CRAWLER_ASN_SET, GOOGLE_CRAWLER_ASN_SET } from './crawlerAsns';

export type AccessDecision = 'allow' | 'block';

const GOOGLE_UA_MARKERS: readonly string[] = [
  'googlebot', 'adsbot-google', 'mediapartners-google', 'storebot-google',
  'feedfetcher-google', 'apis-google', 'duplexweb-google', 'googleother',
];

/** GSC Live Test / site verification — runs from Google infra AND user-triggered inspection IPs. */
const GOOGLE_INSPECTION_UA_MARKERS: readonly string[] = [
  'google-inspectiontool', 'google-site-verification',
];

const BING_UA_MARKERS: readonly string[] = [
  'bingbot', 'bingpreview', 'adidxbot', 'msnbot',
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
  // DuckDuckGo — not a primary index target; blocks function invocations at scale
  'duckduckbot', 'duckduckgo-favicons-bot',
  // Social unfurl bots — drive function invocations on every /k/* share; not needed for GSC/Bing
  'twitterbot', 'facebookexternalhit', 'facebookcatalog', 'facebookbot',
  'linkedinbot', 'slackbot', 'slack-imgproxy', 'discordbot', 'telegrambot', 'whatsapp',
  'redditbot', 'pinterest', 'pinterestbot', 'embedly', 'iframely', 'mastodon',
  // SEO / scraper
  'ahrefsbot', 'ahrefssiteaudit', 'semrushbot', 'mj12bot', 'dotbot', 'blexbot', 'petalbot',
  'dataforseobot', 'seznambot', 'aspiegelbot', 'exabot', 'megaindex', 'serpstatbot',
  'barkrowler', 'zoominfobot', 'seekport', 'linkdexbot', 'rogerbot', 'sistrix',
  // Fake browser / automation
  'chrome-extension', 'moz-extension', 'safari-web-extension',
  'headlesschrome', 'headless', 'phantomjs', 'puppeteer', 'playwright',
  'selenium', 'electron/', 'scrapy', 'httrack', 'wget', 'curl/', 'libwww-perl',
  'python-requests', 'python-urllib', 'go-http-client', 'java/', 'okhttp', 'node-fetch',
  'axios/', 'masscan', 'nikto', 'nmap', 'sqlmap', 'fuzz', 'zgrab', 'censys', 'shodan',
  'pingdom', 'screaming frog', 'netcraftsurveyagent', 'gigabot', 'leikibot', 'wpscan',
  'binlar', 'spbot', 'mauibot', 'researchscan', 'palo alto',
];

const GOOGLE_ASNS = GOOGLE_CRAWLER_ASN_SET;
const BING_ASNS = BING_CRAWLER_ASN_SET;

const MIN_DESKTOP_CHROME_MAJOR = 90;

function lowerIncludesAny(lower: string, markers: readonly string[]): boolean {
  return markers.some((m) => lower.includes(m));
}

function matchesHardBlock(lower: string): boolean {
  return HARD_BLOCK_PATTERNS.some((p) => lower.includes(p));
}

function uaClaimsGoogleInspection(lower: string): boolean {
  return lowerIncludesAny(lower, GOOGLE_INSPECTION_UA_MARKERS);
}

function uaClaimsGoogle(lower: string): boolean {
  return lowerIncludesAny(lower, GOOGLE_UA_MARKERS);
}

function uaClaimsBing(lower: string): boolean {
  return lowerIncludesAny(lower, BING_UA_MARKERS);
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

function isAbsurdlyStaleDesktopChrome(lower: string): boolean {
  if (/(?:iphone|ipad|ipod|android|mobile)/.test(lower)) return false;
  const match = lower.match(/chrome\/(\d+)/);
  if (!match) return false;
  return Number.parseInt(match[1], 10) < MIN_DESKTOP_CHROME_MAJOR;
}

function looksLikeRealHumanBrowser(ua: string, headers: GuardHeaders): boolean {
  const lower = ua.toLowerCase();
  if (!lower.includes('mozilla/')) return false;

  if (matchesHardBlock(lower)) return false;

  if (/(?:iphone|ipad|ipod)/.test(lower) && lower.includes('applewebkit/') && lower.includes('mobile/')) {
    if (/(?:bot|crawler|spider|facebookexternalhit|meta-webindexer|applebot|baiduspider)/.test(lower)) {
      return false;
    }
    return true;
  }

  if (lower.includes('android') && lower.includes('applewebkit/') && lower.includes('mobile')) {
    if (/(?:bot|crawler|spider|baiduspider|semrushbot|ahrefsbot)/.test(lower)) return false;
    return true;
  }

  if (lower.includes('firefox/') || lower.includes('fxios/')) {
    return lower.includes('gecko/');
  }

  if (lower.includes('safari/') && !/(?:chrome\/|chromium\/|crios\/|edg\/|opr\/)/.test(lower)) {
    return lower.includes('applewebkit/') && lower.includes('version/');
  }

  if (lower.includes('crios/')) return true;

  if (isAbsurdlyStaleDesktopChrome(lower)) return false;

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

  if (uaClaimsGoogleInspection(lower)) return 'allow';

  if (uaClaimsGoogle(lower)) {
    const verified = isNetworkVerifiedGoogle(cf);
    return verified === false ? 'block' : 'allow';
  }

  if (uaClaimsBing(lower)) {
    const verified = isNetworkVerifiedBing(cf);
    return verified === false ? 'block' : 'allow';
  }

  if (looksLikeRealHumanBrowser(ua, headers)) return 'allow';

  return 'block';
}

export const ACCESS_DENIED_HEADERS: Record<string, string> = {
  'Content-Type': 'text/plain;charset=UTF-8',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

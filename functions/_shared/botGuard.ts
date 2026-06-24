/**
 * Edge bot guard — runs in `functions/_middleware.ts` BEFORE any Pages Function
 * handler so blocked clients never invoke the heavy /k/* HTML generator.
 *
 * Policy (site owner requirement):
 *   • ALLOW — Google search crawlers (fail-open when cf ASN cannot be verified)
 *   • ALLOW — Bing search crawlers (bingbot / bingpreview / adidxbot / msnbot)
 *   • ALLOW — mainstream human browsers (Chrome, Firefox, Safari, Edge, …)
 *   • BLOCK — every other bot, scraper, headless client, social unfurler, AI crawler
 */

export interface CfRequestProperties {
  asn?: number;
  asOrganization?: string;
  verifiedBotCategory?: string;
  botManagement?: { verifiedBot?: boolean; score?: number };
}

export type AccessDecision = 'allow' | 'block';

const BLOCKED_BOT_PATTERNS: readonly string[] = [
  'gptbot', 'ahrefsbot', 'ahrefssiteaudit', 'semrushbot', 'yandexbot', 'yandex.com/bots',
  'meta-webindexer', 'meta-externalagent', 'meta-externalfetcher',
  'facebookexternalhit', 'facebookcatalog', 'twitterbot', 'linkedinbot',
  'slackbot', 'slack-imgproxy', 'discordbot', 'telegrambot', 'whatsapp', 'redditbot',
  'pinterest', 'pinterestbot', 'embedly', 'iframely', 'skypeuripreview',
  'mastodon', 'pleroma', 'akkoma', 'misskey', 'flipboard', 'nuzzel', 'tumblr', 'vkshare',
  'bitlybot', 'snapchat', 'line-podcast', 'kakaotalk-scrap', 'google-amphtml',
  'chatgpt-user', 'oai-searchbot', 'openai', 'anthropic-ai', 'claude-web', 'claudebot',
  'perplexitybot', 'perplexity-user', 'youbot', 'cohere-ai', 'cohere-training-data-crawler',
  'google-extended',
  'bytespider', 'amazonbot', 'applebot', 'applebot-extended', 'diffbot', 'omgilibot', 'omgili',
  'ccbot', 'common crawl', 'commoncrawl', 'duckduckbot', 'duckduckgo-favicons-bot',
  'mj12bot', 'dotbot', 'blexbot', 'petalbot', 'dataforseobot', 'seznambot', 'aspiegelbot',
  'sogou', 'exabot', 'megaindex', 'serpstatbot', 'barkrowler', 'zoominfobot',
  'seekport', 'linkdexbot', 'rogerbot', 'sistrix', 'pingdom', 'screaming frog',
  'netcraftsurveyagent', 'gigabot', 'leikibot', 'palo alto', 'wpscan',
  'scrapy', 'httrack', 'wget', 'curl/', 'libwww-perl', 'python-requests', 'python-urllib',
  'go-http-client', 'java/', 'okhttp', 'node-fetch', 'axios/', 'phantomjs', 'headlesschrome',
  'puppeteer', 'playwright', 'selenium', 'masscan', 'nikto', 'nmap', 'sqlmap', 'fuzz', 'zgrab',
  'censys', 'shodan', 'binlar', 'spbot', 'mauibot', 'researchscan',
];

const BING_UA_MARKERS: readonly string[] = [
  'bingbot', 'bingpreview', 'adidxbot', 'msnbot',
];

const GOOGLE_UA_MARKERS: readonly string[] = [
  'googlebot', 'adsbot-google', 'mediapartners-google', 'storebot-google',
  'google-inspectiontool', 'google-site-verification', 'feedfetcher-google',
  'apis-google', 'duplexweb-google', 'googleother',
];

const GOOGLE_ASNS: ReadonlySet<number> = new Set([15169, 396982]);

function uaClaimsGoogle(lowerUa: string): boolean {
  return GOOGLE_UA_MARKERS.some((m) => lowerUa.includes(m));
}

function uaClaimsBing(lowerUa: string): boolean {
  return BING_UA_MARKERS.some((m) => lowerUa.includes(m));
}

function isBlockedUserAgent(ua: string): boolean {
  if (!ua) return true;
  const lower = ua.toLowerCase();

  if (uaClaimsGoogle(lower) || uaClaimsBing(lower)) return false;

  for (const pattern of BLOCKED_BOT_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }
  return false;
}

function isNetworkVerifiedGoogle(cf?: CfRequestProperties): boolean | null {
  if (!cf) return null;
  if (cf.verifiedBotCategory && /search/i.test(cf.verifiedBotCategory)) return true;
  if (cf.botManagement?.verifiedBot === true) return true;
  if (typeof cf.asn === 'number' && GOOGLE_ASNS.has(cf.asn)) return true;
  if (cf.asOrganization && /google/i.test(cf.asOrganization)) return true;
  // Fail-open: a false block deindexes the site; a spoofed Googlebot only gets
  // cheap edge-cached HTML, not an attack surface.
  return null;
}

function looksLikeRealBrowser(lowerUa: string): boolean {
  if (!lowerUa.includes('mozilla/')) return false;
  return (
    lowerUa.includes('chrome/') || lowerUa.includes('crios/') ||
    lowerUa.includes('firefox/') || lowerUa.includes('fxios/') ||
    lowerUa.includes('safari/') || lowerUa.includes('edg/') ||
    lowerUa.includes('edga/') || lowerUa.includes('edgios/') ||
    lowerUa.includes('opr/') || lowerUa.includes('opera') ||
    lowerUa.includes('samsungbrowser/')
  );
}

export function decideAccess(ua: string, cf?: CfRequestProperties): AccessDecision {
  if (!ua) return 'block';

  const lower = ua.toLowerCase();

  if (uaClaimsGoogle(lower)) {
    const verified = isNetworkVerifiedGoogle(cf);
    return verified === false ? 'block' : 'allow';
  }

  if (uaClaimsBing(lower)) return 'allow';

  if (isBlockedUserAgent(ua)) return 'block';

  if (looksLikeRealBrowser(lower)) return 'allow';

  if (isNetworkVerifiedGoogle(cf) === true) return 'allow';

  return 'block';
}

export const ACCESS_DENIED_HEADERS: Record<string, string> = {
  'Content-Type': 'text/plain;charset=UTF-8',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

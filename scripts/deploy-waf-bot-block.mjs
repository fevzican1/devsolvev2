#!/usr/bin/env node
/**
 * Deploy Cloudflare WAF rules for /k/* + sitemap bot protection at the EDGE
 * (zero Pages Function invocation for blocked traffic).
 *
 * Rule order (first match wins):
 *   0. SKIP — verified Google/Bing crawlers (right ASN or Cloudflare-verified)
 *      bypass Under-Attack challenges, managed rules, rate limits and the
 *      block rules below. This guarantees crawls NEVER see 403/challenge/5xx
 *      no matter how aggressive the anti-attack posture gets.
 *   1. Site-wide — block AI indexers + browser-extension scraper UAs
 *   2. /k/* + sitemaps — block known scraper / AI / SEO UAs
 *   3. /k/* + sitemaps — block desktop Chrome/Edge without sec-ch-ua Client Hints
 *   4. /k/* + sitemaps — block fake Googlebot/Bingbot (wrong ASN; GSC inspection exempt)
 *   5. /k/* + sitemaps — allowlist catch-all (real Google/Bing + real browsers ONLY)
 *
 * Pages Function invocations: ONLY traffic passing rule 0 or 5 reaches the
 * Function paths, and only on a CDN cache MISS (see scripts/deploy-cache-rules.mjs).
 * Blocked at rules 1–4 = zero invocations.
 *
 * Requires: CLOUDFLARE_API_TOKEN
 * Usage: node scripts/deploy-waf-bot-block.mjs
 */

import { BING_CRAWLER_ASNS, GOOGLE_CRAWLER_ASNS, wafAsnSet } from './lib/crawler-asns.mjs';

const BING_ASNS = wafAsnSet(BING_CRAWLER_ASNS);
const GOOGLE_ASNS = wafAsnSet(GOOGLE_CRAWLER_ASNS);

const GOOGLE_UA_MARKERS = [
  'googlebot',
  'googlebot-image',
  'googlebot-news',
  'googlebot-video',
  'adsbot-google',
  'adsbot-google-mobile',
  'mediapartners-google',
  'storebot-google',
  'feedfetcher-google',
  'apis-google',
  'duplexweb-google',
  'googleother',
  'google-read-aloud',
  'google-safety',
  'google-site-verification',
  'google-inspectiontool',
];

const BING_UA_MARKERS = [
  'bingbot',
  'bingpreview',
  'adidxbot',
  'msnbot',
  'msnbot-media',
  'bingbot-mobile',
];

/** Cloudflare-verified search crawler — never block. */
const VERIFIED_SEARCH_CRAWLER = 'cf.verified_bot_category eq "Search Engine Crawler"';

/** Free-plan WAF: use contains/lower(), not regex matches (Business+ only). */
function uaContainsAny(markers) {
  return markers.map((m) => `(lower(http.user_agent) contains "${m}")`).join(' or ');
}

/**
 * Every path that can invoke the Pages Function (per public/_routes.json)
 * plus static sitemap files: /k/*, /sitemap.xml, /sitemaps/*, /sitemap-*.
 * Bot floods on sitemap endpoints burn Function invocations exactly like
 * /k/* floods, so both prefixes get the same edge protection.
 */
const GUARDED_PATHS = '(starts_with(http.request.uri.path, "/k/") or starts_with(http.request.uri.path, "/sitemap"))';

function kPath(expr) {
  return `${GUARDED_PATHS} and (${expr})`;
}

/**
 * Rule 0 — impolite AI indexers + browser-extension scrapers (sitewide).
 */
const WAF_SITEWIDE_BAD_BOT_BLOCK = `(
  ${uaContainsAny([
    'meta-webindexer',
    'meta-externalagent',
    'meta-externalfetcher',
    'claude-searchbot',
    'anthropic.com',
    'chrome-extension',
    'moz-extension',
    'safari-web-extension',
  ])}
  or (
    lower(http.user_agent) contains "searchbot"
    and not lower(http.user_agent) contains "googlebot"
    and not lower(http.user_agent) contains "bingbot"
    and not lower(http.user_agent) contains "duckduckbot"
  )
)`;

/** Rule 1 — explicit deny list for /k/* (no Function cost). */
const WAF_KNOWN_BAD_EXPRESSION = kPath(`(
  ${uaContainsAny([
    'meta-webindexer',
    'meta-externalagent',
    'meta-externalfetcher',
    'facebookcatalog',
    'facebookbot',
    'applebot',
    'applebot-extended',
    'apple-pubsub',
    'baiduspider',
    'baidu',
    'yandexbot',
    'sogou',
    'claudebot',
    'claude-searchbot',
    'claude-web',
    'anthropic-ai',
    'gptbot',
    'oai-searchbot',
    'chatgpt-user',
    'openai',
    'perplexitybot',
    'bytespider',
    'amazonbot',
    'google-extended',
    'cohere-ai',
    'diffbot',
    'ccbot',
    'ahrefsbot',
    'semrushbot',
    'mj12bot',
    'dotbot',
    'blexbot',
    'petalbot',
    'serpstatbot',
    'headlesschrome',
    'headless',
    'puppeteer',
    'playwright',
    'selenium',
    'phantomjs',
    'python-requests',
    'python-urllib',
    'curl/',
    'wget',
    'scrapy',
    'go-http-client',
    'java/',
    'okhttp',
    'node-fetch',
    'axios/',
    'chrome-extension',
    'moz-extension',
    'safari-web-extension',
    'duckduckbot',
    'duckduckgo-favicons-bot',
    'twitterbot',
    'facebookexternalhit',
    'linkedinbot',
    'slackbot',
    'discordbot',
    'telegrambot',
    'whatsapp',
    'redditbot',
    'embedly',
    'iframely',
  ])}
  or (
    lower(http.user_agent) contains "searchbot"
    and not lower(http.user_agent) contains "googlebot"
    and not lower(http.user_agent) contains "bingbot"
    and not lower(http.user_agent) contains "duckduckbot"
  )
)`);

/**
 * Rule 2 — desktop Chrome/Edge scrapers without Client Hints on /k/*.
 */
const WAF_FAKE_CHROME_EXPRESSION = kPath(`(
  (
    (lower(http.user_agent) contains "chrome/" and lower(http.user_agent) contains "safari/")
    or lower(http.user_agent) contains "edg/"
  )
  and not lower(http.user_agent) contains "android"
  and not lower(http.user_agent) contains "iphone"
  and not lower(http.user_agent) contains "ipad"
  and not lower(http.user_agent) contains "mobile"
  and not lower(http.user_agent) contains "crios"
  and len(http.request.headers["sec-ch-ua"][0]) <= 2
)`);

const GOOGLE_INSPECTION_UA = ['google-inspectiontool', 'google-site-verification'];

/**
 * Rule 0 — SKIP for verified search crawlers (sitewide, evaluated first).
 * Real Googlebot/Bingbot (Cloudflare-verified OR right UA + right ASN) and
 * the GSC URL Inspection tool bypass: Security Level (I'm Under Attack
 * challenges), Browser Integrity Check, Hotlink Protection, UA rules, Zone
 * Lockdown, rate limiting, managed WAF rules, Super Bot Fight Mode and the
 * remaining custom rules. Search crawlers must NEVER receive a challenge or
 * 403 — that is what caused the "server error (5xx)" wave in GSC.
 */
const WAF_VERIFIED_CRAWLER_SKIP = `(
  ${VERIFIED_SEARCH_CRAWLER}
  or (
    (${uaContainsAny(GOOGLE_UA_MARKERS)})
    and ip.src.asnum in ${GOOGLE_ASNS}
  )
  or (
    (${uaContainsAny(BING_UA_MARKERS)})
    and ip.src.asnum in ${BING_ASNS}
  )
  or ${uaContainsAny(GOOGLE_INSPECTION_UA)}
)`;

/**
 * Widest skip first; the API rejects parameters unavailable on the current
 * plan (e.g. Super Bot Fight Mode phase on Free), so the deploy retries with
 * progressively narrower skip parameters until one is accepted.
 */
const SKIP_PARAMETER_VARIANTS = [
  {
    ruleset: 'current',
    phases: ['http_ratelimit', 'http_request_firewall_managed', 'http_request_sbfm'],
    products: ['zoneLockdown', 'uaBlock', 'bic', 'hot', 'securityLevel', 'rateLimit', 'waf'],
  },
  {
    ruleset: 'current',
    phases: ['http_ratelimit', 'http_request_firewall_managed'],
    products: ['zoneLockdown', 'uaBlock', 'bic', 'hot', 'securityLevel', 'rateLimit', 'waf'],
  },
  {
    ruleset: 'current',
    products: ['zoneLockdown', 'uaBlock', 'bic', 'hot', 'securityLevel', 'rateLimit', 'waf'],
  },
  {
    ruleset: 'current',
    products: ['zoneLockdown', 'uaBlock', 'bic', 'hot', 'securityLevel'],
  },
  { ruleset: 'current' },
];

/**
 * Rule 3 — fake Googlebot/Bingbot on /k/* (wrong ASN → zero Function invocations).
 * GSC URL Inspection UA exempt — runs from non-Google IPs during Live Test.
 */
const WAF_FAKE_SEARCH_BOT_EXPRESSION = kPath(`(
  (
    ${uaContainsAny(GOOGLE_UA_MARKERS)}
    and not ${uaContainsAny(GOOGLE_INSPECTION_UA)}
    and not ip.src.asnum in ${GOOGLE_ASNS}
    and not ${VERIFIED_SEARCH_CRAWLER}
  )
  or (
    ${uaContainsAny(BING_UA_MARKERS)}
    and not ip.src.asnum in ${BING_ASNS}
    and not ${VERIFIED_SEARCH_CRAWLER}
  )
)`);

/**
 * Rule 4 — allowlist catch-all for /k/*.
 * ONLY: verified Google/Bing, GSC inspection UA, real browsers.
 * NO social unfurl bots, NO DuckDuckGo (they caused function invocation floods).
 */
const WAF_ALLOWLIST_EXPRESSION = kPath(`not (
  (
    cf.client.bot
    and ${VERIFIED_SEARCH_CRAWLER}
  )
  or ${uaContainsAny(GOOGLE_INSPECTION_UA)}
  or ${uaContainsAny(GOOGLE_UA_MARKERS)}
  or ${uaContainsAny(BING_UA_MARKERS)}
  or (lower(http.user_agent) contains "firefox/" and lower(http.user_agent) contains "gecko/")
  or (
    lower(http.user_agent) contains "safari/"
    and not lower(http.user_agent) contains "chrome/"
    and not lower(http.user_agent) contains "chromium/"
    and not lower(http.user_agent) contains "crios/"
    and not lower(http.user_agent) contains "edg/"
    and not lower(http.user_agent) contains "opr/"
    and lower(http.user_agent) contains "version/"
  )
  or lower(http.user_agent) contains "crios/"
  or (
    lower(http.user_agent) contains "chrome/"
    and len(http.request.headers["sec-ch-ua"][0]) > 2
  )
  or (
    lower(http.user_agent) contains "edg/"
    and len(http.request.headers["sec-ch-ua"][0]) > 2
  )
  or (lower(http.user_agent) contains "android" and lower(http.user_agent) contains "chrome/")
  or lower(http.user_agent) contains "samsungbrowser/"
  or (
    (lower(http.user_agent) contains "iphone" or lower(http.user_agent) contains "ipad" or lower(http.user_agent) contains "ipod")
    and lower(http.user_agent) contains "applewebkit/"
    and lower(http.user_agent) contains "mobile/"
    and not lower(http.user_agent) contains "bot"
    and not lower(http.user_agent) contains "crawler"
    and not lower(http.user_agent) contains "spider"
    and not lower(http.user_agent) contains "facebookexternalhit"
    and not lower(http.user_agent) contains "meta-webindexer"
    and not lower(http.user_agent) contains "applebot"
    and not lower(http.user_agent) contains "baiduspider"
  )
  or (
    lower(http.user_agent) contains "android"
    and lower(http.user_agent) contains "applewebkit/"
    and lower(http.user_agent) contains "mobile"
    and not lower(http.user_agent) contains "bot"
    and not lower(http.user_agent) contains "crawler"
    and not lower(http.user_agent) contains "spider"
    and not lower(http.user_agent) contains "baiduspider"
    and not lower(http.user_agent) contains "semrushbot"
    and not lower(http.user_agent) contains "ahrefsbot"
  )
)`);

const RULES = [
  {
    description: '[DevSolve] SKIP verified Google/Bing crawlers (never challenge/block)',
    expression: WAF_VERIFIED_CRAWLER_SKIP,
    action: 'skip',
  },
  {
    description: '[DevSolve] sitewide block AI indexers + extension scrapers',
    expression: WAF_SITEWIDE_BAD_BOT_BLOCK,
    action: 'block',
  },
  {
    description: '[DevSolve] corpus+sitemaps block known scraper UAs',
    expression: WAF_KNOWN_BAD_EXPRESSION,
    action: 'block',
  },
  {
    description: '[DevSolve] corpus+sitemaps block fake desktop Chrome without Client Hints',
    expression: WAF_FAKE_CHROME_EXPRESSION,
    action: 'block',
  },
  {
    description: '[DevSolve] corpus+sitemaps block fake Googlebot/Bingbot (wrong ASN)',
    expression: WAF_FAKE_SEARCH_BOT_EXPRESSION,
    action: 'block',
  },
  {
    description: '[DevSolve] corpus+sitemaps allowlist — Google Bing GSC inspection + real browsers',
    expression: WAF_ALLOWLIST_EXPRESSION,
    action: 'block',
  },
];

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneName = (process.env.CLOUDFLARE_ZONE_NAME || process.env.SITE_URL || 'https://devsolvev2.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '');

if (!token) {
  console.error('Set CLOUDFLARE_API_TOKEN (Zone ID is resolved automatically from zone name).');
  console.error(`Optional: CLOUDFLARE_ZONE_NAME=${zoneName} (default)`);
  process.exit(1);
}

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!body.success) {
    throw new Error(JSON.stringify(body.errors ?? body, null, 2));
  }
  return body;
}

async function resolveZoneId() {
  if (process.env.CLOUDFLARE_ZONE_ID) {
    return process.env.CLOUDFLARE_ZONE_ID;
  }
  const { result } = await cf(`/zones?name=${encodeURIComponent(zoneName)}`);
  const zone = result?.[0];
  if (!zone?.id) {
    throw new Error(
      `Zone not found for "${zoneName}". Set CLOUDFLARE_ZONE_ID manually or grant Zone:Read on this token.`,
    );
  }
  console.log(`Resolved zone "${zone.name}" → ${zone.id}`);
  return zone.id;
}

async function disableLegacyBotdRuleset(zoneId) {
  const { result: rulesets } = await cf(
    `/zones/${zoneId}/rulesets?phase=http_request_firewall_custom`,
  );
  for (const rs of rulesets.filter((r) => r.kind === 'zone')) {
    let full;
    try {
      ({ result: full } = await cf(`/zones/${zoneId}/rulesets/${rs.id}`));
    } catch {
      continue;
    }
    if (!full.rules?.some((r) => r.description === 'botd' && r.enabled)) continue;
    console.warn(
      'DISABLING legacy botd rule — it blocks ALL /k/* when cf.bot_management.verified_bot',
      'is false (standard Cloudflare plans never set this for real Googlebot).',
    );
    const rules = full.rules.map((r) =>
      r.description === 'botd' ? { ...r, enabled: false } : r,
    );
    await cf(`/zones/${zoneId}/rulesets/${rs.id}`, {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    });
    console.log('Legacy botd rule disabled in ruleset', rs.id);
  }
}

async function main() {
  const zoneId = await resolveZoneId();
  await disableLegacyBotdRuleset(zoneId);
  const { result: rulesets } = await cf(
    `/zones/${zoneId}/rulesets?phase=http_request_firewall_custom`,
  );

  const ruleset = rulesets.find((r) => r.kind === 'zone' && r.phase === 'http_request_firewall_custom');

  const managedDescriptions = new Set(RULES.map((r) => r.description));
  /** Retired rules — removed on deploy to avoid duplicate / stale blocks. */
  const legacyDescriptions = new Set([
    '[DevSolve] sitewide block Meta AI indexer',
    '[DevSolve] sitewide block AI indexers (Claude-SearchBot, Meta)',
    '[DevSolve] /k/* block fake Bingbot',
    '[DevSolve] sitewide block fake desktop Chrome without Client Hints',
    '[DevSolve] /k/* allowlist — Google Bing DuckDuckGo + real browsers',
    '[DevSolve] /k/* block known scraper UAs',
    '[DevSolve] /k/* block fake desktop Chrome without Client Hints',
    '[DevSolve] /k/* block fake Googlebot/Bingbot (wrong ASN)',
    '[DevSolve] /k/* allowlist — Google Bing GSC inspection + real browsers',
  ]);
  const preserved = (ruleset?.rules ?? []).filter(
    (r) => !managedDescriptions.has(r.description) && !legacyDescriptions.has(r.description),
  );

  function buildRules(skipParameters) {
    return [
      ...RULES.map((spec) => {
        const existing = ruleset?.rules?.find((r) => r.description === spec.description);
        return {
          id: existing?.id,
          action: spec.action,
          ...(spec.action === 'skip'
            ? { action_parameters: skipParameters, logging: { enabled: true } }
            : {}),
          expression: spec.expression,
          description: spec.description,
          enabled: true,
        };
      }),
      ...preserved,
    ];
  }

  async function deployWithSkipFallback(deploy) {
    let lastError;
    for (const skipParameters of SKIP_PARAMETER_VARIANTS) {
      try {
        return await deploy(buildRules(skipParameters));
      } catch (error) {
        lastError = error;
        console.warn('Skip-rule parameters rejected, retrying with a narrower variant...');
      }
    }
    throw lastError;
  }

  if (!ruleset) {
    const created = await deployWithSkipFallback((rules) =>
      cf(`/zones/${zoneId}/rulesets`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'devsolve-k-bot-block',
          kind: 'zone',
          phase: 'http_request_firewall_custom',
          rules,
        }),
      }),
    );
    console.log('Created WAF ruleset:', created.result.id);
    console.log(`Deployed ${RULES.length} rules. Verified Google/Bing skip everything (Rule 0).`);
    return;
  }

  const updated = await deployWithSkipFallback((rules) =>
    cf(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    }),
  );
  console.log('Updated WAF ruleset:', updated.result.id);
  console.log(`Deployed ${RULES.length} rules. Verified Google/Bing skip everything (Rule 0).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

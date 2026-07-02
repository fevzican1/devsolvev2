#!/usr/bin/env node
/**
 * Deploy Cloudflare WAF rules for /k/* bot protection at the EDGE
 * (zero Pages Function invocation for blocked traffic).
 *
 * Rule order (first match wins):
 *   0. Site-wide — block AI indexers + browser-extension scraper UAs
 *   1. /k/* — block known scraper / AI / SEO UAs
 *   2. /k/* — block desktop Chrome/Edge without sec-ch-ua Client Hints
 *   3. /k/* — block fake Googlebot/Bingbot (wrong ASN; GSC inspection exempt)
 *   4. /k/* — allowlist catch-all (real Google/Bing + real browsers ONLY)
 *
 * Pages Function invocations: ONLY traffic passing rule 4 reaches /k/* function.
 * Blocked at rules 0–3 = zero invocations. Google/Bing on cache miss = expected.
 *
 * Requires: CLOUDFLARE_API_TOKEN
 * Usage: node scripts/deploy-waf-bot-block.mjs
 *
 * Keep expressions aligned with functions/_shared/botGuard.ts
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

function kPath(expr) {
  return `starts_with(http.request.uri.path, "/k/") and (${expr})`;
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
    description: '[DevSolve] sitewide block AI indexers + extension scrapers',
    expression: WAF_SITEWIDE_BAD_BOT_BLOCK,
  },
  {
    description: '[DevSolve] /k/* block known scraper UAs',
    expression: WAF_KNOWN_BAD_EXPRESSION,
  },
  {
    description: '[DevSolve] /k/* block fake desktop Chrome without Client Hints',
    expression: WAF_FAKE_CHROME_EXPRESSION,
  },
  {
    description: '[DevSolve] /k/* block fake Googlebot/Bingbot (wrong ASN)',
    expression: WAF_FAKE_SEARCH_BOT_EXPRESSION,
  },
  {
    description: '[DevSolve] /k/* allowlist — Google Bing GSC inspection + real browsers',
    expression: WAF_ALLOWLIST_EXPRESSION,
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
  ]);
  const preserved = (ruleset?.rules ?? []).filter(
    (r) => !managedDescriptions.has(r.description) && !legacyDescriptions.has(r.description),
  );

  const newRules = RULES.map((spec) => {
    const existing = ruleset?.rules?.find((r) => r.description === spec.description);
    return {
      id: existing?.id,
      action: 'block',
      expression: spec.expression,
      description: spec.description,
      enabled: true,
    };
  });

  const rules = [...newRules, ...preserved];

  if (!ruleset) {
    const created = await cf(`/zones/${zoneId}/rulesets`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'devsolve-k-bot-block',
        kind: 'zone',
        phase: 'http_request_firewall_custom',
        rules,
      }),
    });
    console.log('Created WAF ruleset:', created.result.id);
    console.log(`Deployed ${RULES.length} rules. Real Googlebot/Bingbot must pass Rule 4.`);
    return;
  }

  const updated = await cf(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
    method: 'PUT',
    body: JSON.stringify({ rules }),
  });
  console.log('Updated WAF ruleset:', updated.result.id);
  console.log(`Deployed ${RULES.length} rules. Real Googlebot/Bingbot must pass Rule 4.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

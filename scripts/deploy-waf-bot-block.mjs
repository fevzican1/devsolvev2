#!/usr/bin/env node
/**
 * Deploy Cloudflare WAF rules for /k/* bot protection at the EDGE
 * (zero Pages Function invocation for blocked traffic).
 *
 * Rule order (first match wins):
 *   0. Site-wide — block impolite AI indexers (Claude-SearchBot, Meta webindexer)
 *   1. /k/* — block known scraper / AI / SEO UAs
 *   2. /k/* — block fake Bingbot (UA claims bingbot but not verified)
 *   3. /k/* — block desktop Chrome/Edge without sec-ch-ua Client Hints
 *   4. /k/* — allowlist catch-all (Google, Bing, DuckDuckGo, real browsers)
 *
 * Cloudflare analytics (2026-07): Claude-SearchBot 84.5k, meta-webindexer 34.3k,
 * bingbot 12.7k (allowed). Rule 0 must sitewide-block AI crawlers that hammer
 * sitemaps and static assets — not only /k/*.
 *
 * Requires: CLOUDFLARE_API_TOKEN
 * Optional: CLOUDFLARE_ZONE_ID (auto-resolved from devsolvev2.com if omitted)
 * Usage: node scripts/deploy-waf-bot-block.mjs
 *
 * Keep expressions aligned with functions/_shared/botGuard.ts
 */

const BING_ASNS = '{8075 3598 8068 8069 6182}';
const GOOGLE_ASNS = '{15169 396982}';

/** Free-plan WAF: use contains/lower(), not regex matches (Business+ only). */
function uaContainsAny(markers) {
  return markers.map((m) => `(lower(http.user_agent) contains "${m}")`).join(' or ');
}

function kPath(expr) {
  return `starts_with(http.request.uri.path, "/k/") and (${expr})`;
}

/**
 * Rule 0 — impolite AI indexers hit sitemaps and static assets sitewide
 * (84.5k Claude-SearchBot, 34.3k meta-webindexer in Jul 2026 analytics).
 * Stale desktop Chrome (< v90) is blocked on /k/* via botGuard.ts + WAF rules 1/3.
 */
const WAF_SITEWIDE_BAD_BOT_BLOCK = `(
  ${uaContainsAny([
    'meta-webindexer',
    'meta-externalagent',
    'meta-externalfetcher',
    'claude-searchbot',
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
  ])}
  or (
    lower(http.user_agent) contains "searchbot"
    and not lower(http.user_agent) contains "googlebot"
    and not lower(http.user_agent) contains "bingbot"
    and not lower(http.user_agent) contains "duckduckbot"
  )
)`);

/** Rule 2 — fake Bingbot: UA string only, not Cloudflare-verified or Microsoft ASN. */
const WAF_FAKE_BING_EXPRESSION = kPath(`(
  lower(http.user_agent) contains "bingbot"
  and not cf.client.bot
  and not ip.src.asnum in ${BING_ASNS}
)`);

/** Rule 3 — desktop Chrome/Edge scrapers without Client Hints (all versions). */
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

/** Rule 4 — allowlist-only catch-all for anything else on /k/*. */
const WAF_ALLOWLIST_EXPRESSION = kPath(`not (
  (
    cf.client.bot
    and cf.verified_bot_category eq "Search Engine Crawler"
  )
  or (
    (${uaContainsAny([
      'googlebot',
      'adsbot-google',
      'mediapartners-google',
      'storebot-google',
      'google-inspectiontool',
      'feedfetcher-google',
      'apis-google',
      'duplexweb-google',
      'googleother',
    ])})
    and (cf.client.bot or ip.src.asnum in ${GOOGLE_ASNS})
  )
  or (
    (${uaContainsAny(['bingbot', 'bingpreview', 'adidxbot', 'msnbot'])})
    and (cf.client.bot or ip.src.asnum in ${BING_ASNS})
  )
  or ${uaContainsAny(['duckduckbot', 'duckduckgo-favicons-bot'])}
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
  or ${uaContainsAny([
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
)`);

const RULES = [
  {
    description: '[DevSolve] sitewide block AI indexers (Claude-SearchBot, Meta)',
    expression: WAF_SITEWIDE_BAD_BOT_BLOCK,
  },
  {
    description: '[DevSolve] /k/* block known scraper UAs',
    expression: WAF_KNOWN_BAD_EXPRESSION,
  },
  {
    description: '[DevSolve] /k/* block fake Bingbot',
    expression: WAF_FAKE_BING_EXPRESSION,
  },
  {
    description: '[DevSolve] /k/* block fake desktop Chrome without Client Hints',
    expression: WAF_FAKE_CHROME_EXPRESSION,
  },
  {
    description: '[DevSolve] /k/* allowlist — Google Bing DuckDuckGo + real browsers',
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

async function main() {
  const zoneId = await resolveZoneId();
  const { result: rulesets } = await cf(
    `/zones/${zoneId}/rulesets?phase=http_request_firewall_custom`,
  );

  const ruleset = rulesets.find((r) => r.kind === 'zone' && r.phase === 'http_request_firewall_custom');

  const managedDescriptions = new Set(RULES.map((r) => r.description));
  /** Retired rule descriptions — removed on deploy to avoid duplicate blocks. */
  const legacyDescriptions = new Set([
    '[DevSolve] sitewide block Meta AI indexer',
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
    console.log(`Deployed ${RULES.length} rules. Blocked /k/* bots will NOT invoke Pages Functions.`);
    return;
  }

  const updated = await cf(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
    method: 'PUT',
    body: JSON.stringify({ rules }),
  });
  console.log('Updated WAF ruleset:', updated.result.id);
  console.log(`Deployed ${RULES.length} rules. Blocked /k/* bots will NOT invoke Pages Functions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

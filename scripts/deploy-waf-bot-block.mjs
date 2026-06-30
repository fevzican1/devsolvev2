#!/usr/bin/env node
/**
 * Deploy Cloudflare WAF rules for /k/* bot protection at the EDGE
 * (zero Pages Function invocation for blocked traffic).
 *
 * Rule order (first match wins):
 *   0. Site-wide — block Meta AI indexer on every path (biggest attack source)
 *   1. /k/* — block known scraper / AI / SEO UAs
 *   2. /k/* — block fake Bingbot (UA claims bingbot but not verified)
 *   3. /k/* — block desktop Chrome/Edge without sec-ch-ua Client Hints
 *   4. /k/* — allowlist catch-all (Google, Bing, DuckDuckGo, real browsers)
 *
 * Requires: CLOUDFLARE_API_TOKEN
 * Optional: CLOUDFLARE_ZONE_ID (auto-resolved from devsolvev2.com if omitted)
 * Usage: node scripts/deploy-waf-bot-block.mjs
 *
 * Keep expressions aligned with functions/_shared/botGuard.ts
 */

const BING_ASNS = '{8075 3598 8068 8069 6182}';
const GOOGLE_ASNS = '{15169 396982}';

/** Rule 0 — Meta webindexer hammers static + /k/*; block before origin entirely. */
const WAF_SITEWIDE_META_BLOCK = `http.user_agent matches ".*(?i)(meta-webindexer|meta-externalagent|meta-externalfetcher).*"`;

/** Rule 1 — explicit deny list for /k/* (no Function cost). */
const WAF_KNOWN_BAD_EXPRESSION = `(http.request.uri.path starts_with "/k/")
and (
  http.user_agent matches ".*(?i)(meta-webindexer|meta-externalagent|meta-externalfetcher|facebookcatalog|facebookbot).*"
  or http.user_agent matches ".*(?i)(applebot|applebot-extended|apple-pubsub).*"
  or http.user_agent matches ".*(?i)(baiduspider|baidu.*spider|yandexbot|sogou).*"
  or http.user_agent matches ".*(?i)(claudebot|claude-searchbot|claude-web|anthropic-ai|gptbot|oai-searchbot|chatgpt-user|openai).*"
  or http.user_agent matches ".*(?i)(perplexitybot|bytespider|amazonbot|google-extended|cohere-ai|diffbot|ccbot).*"
  or http.user_agent matches ".*(?i)(ahrefsbot|semrushbot|mj12bot|dotbot|blexbot|petalbot|serpstatbot).*"
  or http.user_agent matches ".*(?i)(headlesschrome|headless|puppeteer|playwright|selenium|phantomjs).*"
  or http.user_agent matches ".*(?i)(python-requests|python-urllib|curl/|wget|scrapy|go-http-client|java/|okhttp|node-fetch|axios/).*"
  or http.user_agent matches ".*(?i)chrome-extension.*"
  or (
    http.user_agent matches ".*(?i)(searchbot).*"
    and not http.user_agent matches ".*(?i)(googlebot|bingbot|duckduckbot).*"
  )
)`;

/** Rule 2 — fake Bingbot: UA string only, not Cloudflare-verified or Microsoft ASN. */
const WAF_FAKE_BING_EXPRESSION = `(http.request.uri.path starts_with "/k/")
and http.user_agent matches ".*(?i)bingbot.*"
and not cf.client.bot
and not ip.src.asnum in ${BING_ASNS}`;

/** Rule 3 — desktop Chrome/Edge scrapers without Client Hints (all versions). */
const WAF_FAKE_CHROME_EXPRESSION = `(http.request.uri.path starts_with "/k/")
and (
  http.user_agent matches ".*(?i)Chrome/.*Safari/.*"
  or http.user_agent matches ".*(?i)Edg/.*"
)
and not http.user_agent matches ".*(?i)(Android|iPhone|iPad|Mobile|CriOS).*"
and len(http.request.headers["sec-ch-ua"][0]) <= 2`;

/** Rule 4 — allowlist-only catch-all for anything else on /k/*. */
const WAF_ALLOWLIST_EXPRESSION = `(http.request.uri.path starts_with "/k/")
and not (
  (
    cf.client.bot
    and cf.verified_bot_category eq "Search Engine Crawler"
  )
  or (
    http.user_agent matches ".*(?i)(googlebot|adsbot-google|mediapartners-google|storebot-google|google-inspectiontool|feedfetcher-google|apis-google|duplexweb-google|googleother).*"
    and (
      cf.client.bot
      or ip.src.asnum in ${GOOGLE_ASNS}
    )
  )
  or (
    http.user_agent matches ".*(?i)(bingbot|bingpreview|adidxbot|msnbot).*"
    and (
      cf.client.bot
      or ip.src.asnum in ${BING_ASNS}
    )
  )
  or http.user_agent matches ".*(?i)(duckduckbot|duckduckgo-favicons-bot).*"
  or http.user_agent matches ".*(?i)Firefox/.*Gecko/.*"
  or (
    http.user_agent matches ".*Safari/.*"
    and not http.user_agent matches ".*(?i)Chrome/.*"
    and not http.user_agent matches ".*(?i)Chromium/.*"
    and not http.user_agent matches ".*(?i)CriOS/.*"
    and not http.user_agent matches ".*(?i)Edg/.*"
    and not http.user_agent matches ".*(?i)OPR/.*"
    and http.user_agent matches ".*Version/.*"
  )
  or http.user_agent matches ".*(?i)CriOS/.*"
  or (
    http.user_agent matches ".*(?i)Chrome/.*"
    and len(http.request.headers["sec-ch-ua"][0]) > 2
  )
  or (
    http.user_agent matches ".*(?i)Edg/.*"
    and len(http.request.headers["sec-ch-ua"][0]) > 2
  )
  or http.user_agent matches ".*(?i)Android.*Chrome/.*"
  or http.user_agent matches ".*(?i)SamsungBrowser/.*"
  or (
    http.user_agent matches ".*(?i)(iPhone|iPad|iPod).*AppleWebKit/.*Mobile/.*"
    and not http.user_agent matches ".*(?i)(bot|crawler|spider|facebookexternalhit|meta-webindexer|applebot|baiduspider).*"
  )
  or (
    http.user_agent matches ".*(?i)Android.*AppleWebKit/.*Mobile.*"
    and not http.user_agent matches ".*(?i)(bot|crawler|spider|baiduspider|semrushbot|ahrefsbot).*"
  )
  or http.user_agent matches ".*(?i)(twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|redditbot|embedly|iframely).*"
)`;

const RULES = [
  {
    description: '[DevSolve] sitewide block Meta AI indexer',
    expression: WAF_SITEWIDE_META_BLOCK,
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
  const preserved = (ruleset?.rules ?? []).filter(
    (r) => !managedDescriptions.has(r.description),
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

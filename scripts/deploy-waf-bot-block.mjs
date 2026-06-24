#!/usr/bin/env node
/**
 * Deploy Cloudflare WAF rules for /k/* bot protection at the EDGE
 * (zero Pages Function invocation for blocked traffic).
 *
 * Two rules (order matters):
 *   1. Block known attack/scraper UAs explicitly
 *   2. Allowlist-only — Google, Bing, DuckDuckGo, verified real browsers
 *
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID
 * Usage: node scripts/deploy-waf-bot-block.mjs
 */

/** Rule 1 — explicit deny list for the heaviest attackers (no Function cost). */
const WAF_KNOWN_BAD_EXPRESSION = `(http.request.uri.path starts_with "/k/")
and (
  http.user_agent matches ".*(?i)(meta-webindexer|meta-externalagent|meta-externalfetcher|facebookexternalhit|facebookcatalog|facebookbot).*"
  or http.user_agent matches ".*(?i)(applebot|applebot-extended|apple-pubsub).*"
  or http.user_agent matches ".*(?i)(baiduspider|baidu.*spider|yandexbot|sogou).*"
  or http.user_agent matches ".*(?i)(claudebot|claude-searchbot|claude-web|anthropic-ai|gptbot|oai-searchbot|chatgpt-user|openai).*"
  or http.user_agent matches ".*(?i)(perplexitybot|bytespider|amazonbot|google-extended|cohere-ai|diffbot|ccbot).*"
  or http.user_agent matches ".*(?i)(ahrefsbot|semrushbot|mj12bot|dotbot|blexbot|petalbot|serpstatbot).*"
  or http.user_agent matches ".*(?i)(headlesschrome|headless|puppeteer|playwright|selenium|phantomjs).*"
  or http.user_agent matches ".*(?i)(python-requests|python-urllib|curl/|wget|scrapy|go-http-client|java/|okhttp|node-fetch|axios/).*"
  or (
    http.user_agent matches ".*(?i)(searchbot).*"
    and not http.user_agent matches ".*(?i)(googlebot|bingbot|duckduckbot).*"
  )
)`;

/** Rule 2 — allowlist-only catch-all for anything else on /k/*. */
const WAF_ALLOWLIST_EXPRESSION = `(http.request.uri.path starts_with "/k/")
and not (
  cf.client.bot
  or http.user_agent matches ".*(?i)(googlebot|adsbot-google|mediapartners-google|storebot-google|google-inspectiontool|feedfetcher-google|apis-google|duplexweb-google|googleother).*"
  or http.user_agent matches ".*(?i)(bingbot|bingpreview|adidxbot|msnbot).*"
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
  or (
    http.user_agent matches ".*(?i)Android.*Chrome/.*"
  )
  or (
    http.user_agent matches ".*(?i)SamsungBrowser/.*"
  )
  or (
    http.user_agent matches ".*(?i)(iPhone|iPad|iPod).*AppleWebKit/.*Mobile/.*"
    and not http.user_agent matches ".*(?i)(bot|crawler|spider|facebookexternalhit|meta-webindexer|applebot|baiduspider).*"
  )
  or (
    http.user_agent matches ".*(?i)Android.*AppleWebKit/.*Mobile.*"
    and not http.user_agent matches ".*(?i)(bot|crawler|spider|baiduspider|semrushbot|ahrefsbot).*"
  )
)`;

const RULES = [
  {
    description: '[DevSolve] /k/* block known scraper UAs',
    expression: WAF_KNOWN_BAD_EXPRESSION,
  },
  {
    description: '[DevSolve] /k/* allowlist — Google Bing DuckDuckGo + real browsers',
    expression: WAF_ALLOWLIST_EXPRESSION,
  },
];

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;

if (!token || !zoneId) {
  console.error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID');
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

async function main() {
  const { result: rulesets } = await cf(
    `/zones/${zoneId}/rulesets?phase=http_request_firewall_custom`,
  );

  const ruleset = rulesets.find((r) => r.kind === 'zone' && r.phase === 'http_request_firewall_custom');

  const managedDescriptions = new Set(RULES.map((r) => r.description));
  const preserved = (ruleset?.rules ?? []).filter(
    (r) => !managedDescriptions.has(r.description),
  );

  const newRules = RULES.map((spec, index) => {
    const existing = ruleset?.rules?.find((r) => r.description === spec.description);
    return {
      id: existing?.id,
      action: 'block',
      expression: spec.expression,
      description: spec.description,
      enabled: true,
      ...(index === 0 ? {} : {}),
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

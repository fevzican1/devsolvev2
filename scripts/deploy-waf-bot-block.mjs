#!/usr/bin/env node
/**
 * Deploy Cloudflare WAF rules for bot/scraper protection at the EDGE
 * (zero Pages Function invocation for blocked traffic).
 *
 * No skip rule. Googlebot, Bingbot and GSC inspection are allow-listed by
 * User-Agent only (no ASN). Cloudflare handles spoofed crawler UAs. Scrapers
 * that spoof Chrome/Edge are blocked by fingerprint.
 *
 * Rule order (first match wins). Free plan: 5 custom rules; user-managed
 * rules (e.g. wp-admin) are preserved.
 *
 *   WAF1 (sitewide block) — malicious scrapers and fake browsers:
 *     - Never matches Google/Bing/GSC User-Agents. Do not ASN-check them;
 *       a stale ASN list 403s real crawls. Spoofed Googlebot/Bingbot is
 *       Cloudflare's job, not this ruleset.
 *     - Blocks AI indexers, headless/automation, HTTP libraries, extension
 *       scrapers, the Wikipedia Chrome/42+Edge/12.246 UA.
 *     - Blocks Chrome/Edge UAs that are missing a real navigation fingerprint
 *       (Client Hints Chromium brand, Fetch Metadata, Accept-Language, and
 *       for navigate: dest=document/iframe + Accept: text/html).
 *
 *   WAF2 (/k/* + sitemaps allowlist) — everything that looks like a browser
 *     still has to be a real client: HTTP/2 or HTTP/3, and not a cloud/hosting
 *     ASN. This is what stops the Chrome/99–136 farm that sends Client Hints.
 *     Google/Bing/GSC UAs still pass (same allow as WAF1, no ASN).
 *
 * Requires: CLOUDFLARE_API_TOKEN
 * Usage: node scripts/deploy-waf-bot-block.mjs [--dry-run]
 */

import { wafAsnSet } from './lib/crawler-asns.mjs';

const MAX_EXPRESSION_LENGTH = 4096;

/** Cloud/hosting ASNs used by scraper farms. Not mobile/residential ISPs.
 * Google Cloud / Azure are here only for Chrome UA spoofs from VPS.
 * Googlebot/Bingbot UAs are never ASN-checked (see ALLOWED_SEARCH_CRAWLER).
 */
const HOSTING_ASNS = wafAsnSet([
  16509, 14618, // Amazon
  396982, 15169, 19527, 36040, // Google Cloud / Google (browser spoof)
  8075, 8068, 8069, // Azure / Microsoft (browser spoof)
  14061, // DigitalOcean
  24940, 213230, // Hetzner
  16276, // OVH
  63949, // Linode
  20473, // Vultr
  51167, // Contabo
  31898, // Oracle
  45102, // Alibaba
  12876, // Scaleway
  9009, // M247
  212238, 60068, // Datacamp / CDN77
  40676, // Psychz
  8560, // IONOS
  132203, // Tencent
]);

/** Free-plan WAF: contains/lower(), not regex (Business+). Parenthesize OR-groups. */
function uaContainsAny(markers) {
  return `(${markers.map((m) => `lower(http.user_agent) contains "${m}"`).join(' or ')})`;
}

function headerIn(name, values) {
  return `http.request.headers["${name}"][0] in {${values.map((v) => `"${v}"`).join(' ')}}`;
}

function collapse(expr) {
  return expr.replace(/\s+/g, ' ').trim();
}

const GOOGLE_INSPECTION_UA = ['google-inspectiontool', 'google-site-verification'];
const GOOGLE_UA_MARKERS = [
  'googlebot',
  'adsbot-google',
  'mediapartners-google',
  'storebot-google',
  'googleother',
  'google-read-aloud',
  'google-safety',
];
const BING_UA_MARKERS = ['bingbot', 'bingpreview', 'adidxbot', 'msnbot'];

/**
 * Google/Bing/GSC User-Agents — never block, no ASN, no verified-bot check.
 * Wrong-ASN spoof detection belongs to Cloudflare, not this ruleset.
 */
const ALLOWED_SEARCH_CRAWLER = `(
  ${uaContainsAny(GOOGLE_INSPECTION_UA)}
  or ${uaContainsAny(GOOGLE_UA_MARKERS)}
  or ${uaContainsAny(BING_UA_MARKERS)}
)`;

/**
 * Real Chromium navigation/fetch fingerprint. Lazy scrapers send Chrome/N
 * (and sometimes a dummy sec-ch-ua) without Fetch Metadata or Accept-Language.
 * curl-impersonate still dies on WAF2 (HTTP/1.1 or hosting ASN).
 */
const REAL_CHROMIUM_FINGERPRINT = `(
  ${headerIn('sec-fetch-mode', ['navigate', 'cors', 'no-cors', 'same-origin'])}
  and len(http.request.headers["sec-ch-ua"][0]) > 20
  and lower(http.request.headers["sec-ch-ua"][0]) contains "chromium"
  and ${headerIn('sec-fetch-site', ['none', 'same-origin', 'same-site', 'cross-site'])}
  and len(http.request.headers["accept-language"][0]) > 1
  and (
    not http.request.headers["sec-fetch-mode"][0] eq "navigate"
    or (
      ${headerIn('sec-fetch-dest', ['document', 'iframe'])}
      and lower(http.request.headers["accept"][0]) contains "text/html"
    )
  )
)`;

const KNOWN_SCRAPER_UA = `(
  ${uaContainsAny([
    'meta-webindexer',
    'meta-externalagent',
    'meta-externalfetcher',
    'claude-searchbot',
    'anthropic.com',
    'chrome-extension',
    'moz-extension',
    'safari-web-extension',
    'edge/12.246',
    'chrome/42.0.2311.135',
    'headless',
    'puppeteer',
    'playwright',
    'selenium',
    'phantomjs',
    'gptbot',
    'claudebot',
    'bytespider',
    'ahrefsbot',
    'semrushbot',
    'ccbot',
    'petalbot',
    'amazonbot',
    'curl/',
    'wget',
    'python-',
    'scrapy',
    'go-http-client',
  ])}
  or (
    lower(http.user_agent) contains "searchbot"
    and not lower(http.user_agent) contains "googlebot"
    and not lower(http.user_agent) contains "bingbot"
    and not lower(http.user_agent) contains "duckduckbot"
  )
)`;

/**
 * WAF1 — sitewide scraper detector. First match; skip rule is gone.
 */
const WAF1_SCRAPER_BLOCK = `(
  not ${ALLOWED_SEARCH_CRAWLER}
  and (
    len(http.user_agent) lt 12
    or ${KNOWN_SCRAPER_UA}
    or (
      lower(http.user_agent) contains "chrome/"
      and not lower(http.user_agent) contains "googlebot"
      and not lower(http.user_agent) contains "bingbot"
      and not ${REAL_CHROMIUM_FINGERPRINT}
    )
  )
)`;

const GUARDED_PATHS = '(starts_with(http.request.uri.path, "/k/") or starts_with(http.request.uri.path, "/sitemap"))';
const HTTP2_OR_3 = '(http.request.version eq "HTTP/2" or http.request.version eq "HTTP/3")';
const NOT_HOSTING = `not ip.src.asnum in ${HOSTING_ASNS}`;

const REAL_SAFARI = `(
  lower(http.user_agent) contains "safari/"
  and not lower(http.user_agent) contains "chrome/"
  and not lower(http.user_agent) contains "chromium/"
  and not lower(http.user_agent) contains "crios/"
  and not lower(http.user_agent) contains "edg/"
  and not lower(http.user_agent) contains "opr/"
  and lower(http.user_agent) contains "version/"
)`;

const REAL_IOS = `(
  (lower(http.user_agent) contains "iphone" or lower(http.user_agent) contains "ipad")
  and lower(http.user_agent) contains "applewebkit/"
  and lower(http.user_agent) contains "mobile/"
  and not lower(http.user_agent) contains "bot"
)`;

/**
 * WAF2 — /k/* + sitemaps catch-all. Chrome that already passed WAF1 (has a
 * real fingerprint) still needs HTTP/2|3 and a non-hosting ASN. That is the
 * farm: rotating Chrome/99–136 UAs from cloud VPS with Client Hints.
 */
function waf2Allowlist({ requireHttp2, blockHosting }) {
  const chromeOk = [
    'lower(http.user_agent) contains "chrome/"',
    requireHttp2 ? HTTP2_OR_3 : null,
    blockHosting ? NOT_HOSTING : null,
  ]
    .filter(Boolean)
    .join(' and ');

  return `(
    ${GUARDED_PATHS}
    and not ${ALLOWED_SEARCH_CRAWLER}
    and not (
      not ${uaContainsAny(['bot', 'crawler', 'spider'])}
      and (
        (lower(http.user_agent) contains "firefox/" and lower(http.user_agent) contains "gecko/")
        or ${REAL_SAFARI}
        or lower(http.user_agent) contains "crios/"
        or (${chromeOk})
        or lower(http.user_agent) contains "samsungbrowser/"
        or ${REAL_IOS}
      )
    )
  )`;
}

const WAF2_VARIANTS = [
  { requireHttp2: true, blockHosting: true, label: 'HTTP/2+3 and hosting ASN' },
  { requireHttp2: false, blockHosting: true, label: 'hosting ASN only' },
  { requireHttp2: true, blockHosting: false, label: 'HTTP/2+3 only' },
  { requireHttp2: false, blockHosting: false, label: 'browser UA only (last resort)' },
];

function rulesForVariant(variant) {
  return [
    {
      description: '[DevSolve] WAF1 block scrapers — keep Google Bing GSC + humans',
      expression: WAF1_SCRAPER_BLOCK,
      action: 'block',
    },
    {
      description: '[DevSolve] WAF2 corpus allowlist — Google Bing GSC + real browsers',
      expression: waf2Allowlist(variant),
      action: 'block',
    },
  ];
}

function assertExpressionLengths(rules) {
  for (const rule of rules) {
    const expression = collapse(rule.expression);
    if (expression.length > MAX_EXPRESSION_LENGTH) {
      throw new Error(
        `${rule.description} expression is ${expression.length} chars (max ${MAX_EXPRESSION_LENGTH})`,
      );
    }
  }
}

function printDryRun(variant) {
  const rules = rulesForVariant(variant);
  console.log(`WAF2 variant: ${variant.label}`);
  for (const rule of rules) {
    const expression = collapse(rule.expression);
    console.log(`\n${rule.action.toUpperCase()} ${rule.description}`);
    console.log(`length ${expression.length}/${MAX_EXPRESSION_LENGTH}`);
    console.log(expression);
  }
}

const LEGACY_DESCRIPTIONS = new Set([
  '[DevSolve] SKIP crawlers + real browsers (never challenge)',
  '[DevSolve] SKIP verified Google/Bing only (never challenge)',
  '[DevSolve] SKIP verified Google/Bing crawlers (never challenge/block)',
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

const dryRun = process.argv.includes('--dry-run');
if (dryRun) {
  for (const variant of WAF2_VARIANTS) {
    assertExpressionLengths(rulesForVariant(variant));
    printDryRun(variant);
    console.log('\n----\n');
  }
  console.log('Dry-run OK — all variants fit the 4096-char cap. Skip rule is not deployed.');
  process.exit(0);
}

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

async function fetchCustomRuleset(zoneId) {
  const { result: rulesets } = await cf(
    `/zones/${zoneId}/rulesets?phase=http_request_firewall_custom`,
  );
  const stub = rulesets.find((r) => r.kind === 'zone' && r.phase === 'http_request_firewall_custom');
  if (!stub) return null;
  try {
    const { result } = await cf(`/zones/${zoneId}/rulesets/${stub.id}`);
    return result;
  } catch {
    const { result } = await cf(
      `/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`,
    );
    return result;
  }
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

function assembleRules(ruleset, spec) {
  const managedDescriptions = new Set(spec.map((r) => r.description));
  const preserved = (ruleset?.rules ?? []).filter(
    (r) => !managedDescriptions.has(r.description) && !LEGACY_DESCRIPTIONS.has(r.description),
  );
  return [
    ...spec.map((rule) => {
      const existing = ruleset?.rules?.find((r) => r.description === rule.description);
      return {
        id: existing?.id,
        action: rule.action,
        expression: collapse(rule.expression),
        description: rule.description,
        enabled: true,
      };
    }),
    ...preserved,
  ];
}

async function main() {
  const zoneId = await resolveZoneId();
  await disableLegacyBotdRuleset(zoneId);
  const ruleset = await fetchCustomRuleset(zoneId);

  let lastError;
  for (const variant of WAF2_VARIANTS) {
    const spec = rulesForVariant(variant);
    assertExpressionLengths(spec);
    const rules = assembleRules(ruleset, spec);
    try {
      let result;
      if (!ruleset) {
        ({ result } = await cf(`/zones/${zoneId}/rulesets`, {
          method: 'POST',
          body: JSON.stringify({
            name: 'devsolve-k-bot-block',
            kind: 'zone',
            phase: 'http_request_firewall_custom',
            rules,
          }),
        }));
        console.log('Created WAF ruleset:', result.id);
      } else {
        ({ result } = await cf(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
          method: 'PUT',
          body: JSON.stringify({ rules }),
        }));
        console.log('Updated WAF ruleset:', result.id);
      }
      console.log(`Deployed ${spec.length} DevSolve rules (WAF2: ${variant.label}).`);
      console.log('Skip rule removed. Turn Bot Fight Mode OFF so Google/Bing/humans are not challenged.');
      for (const rule of spec) {
        console.log(`  ${collapse(rule.expression).length} chars — ${rule.description}`);
      }
      return;
    } catch (error) {
      lastError = error;
      console.warn(`WAF2 variant "${variant.label}" rejected, retrying a narrower one...`);
      console.warn(String(error));
    }
  }
  throw lastError;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

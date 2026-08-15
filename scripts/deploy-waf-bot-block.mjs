#!/usr/bin/env node
/**
 * Deploy Cloudflare WAF rules for /k/* + sitemap bot protection at the EDGE
 * (zero Pages Function invocation for blocked traffic).
 *
 * Rule order (first match wins) — kept to 3 managed rules because the Free
 * plan allows at most 5 custom WAF rules per zone (user-managed rules, e.g.
 * the wp-admin block, are preserved):
 *   1. SKIP — ONLY verified Google/Bing (right ASN or Cloudflare-verified
 *      search crawler with a Google/Bing UA) plus GSC inspection. They bypass
 *      Under-Attack / Bot Fight / BIC so real crawls never see 403/challenge.
 *      Real browsers are NOT in this skip: spoofed Chrome + Client Hints was
 *      skipping Bot Fight and draining /k/* Function/cache. Bot Fight Mode
 *      still evaluates humans; it does not challenge ordinary browsers.
 *   2. Site-wide — block AI indexers + Wikipedia-example Chrome/42+Edge/12.246
 *      + browser-extension scraper UAs.
 *   3. /k/* + sitemaps — allowlist catch-all (real Google/Bing with ASN or
 *      verified bot, GSC inspection, real browsers). Fake Googlebot UA without
 *      Google ASN is NOT allowed here — Bot Fight Mode handles spoofed
 *      crawlers; a dedicated ASN-block rule is not used because a stale ASN
 *      list can 403 real Google/Bing.
 *
 * Pages Function invocations: ONLY traffic that is skipped (Google/Bing) or
 * that passes the allowlist reaches Function paths, and only on a CDN cache
 * MISS. Everything else is zero invocations.
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

/** Free-plan WAF: use contains/lower(), not regex matches (Business+ only).
 * Always parenthesize the OR-group so `not uaContainsAny(...)` is safe.
 */
function uaContainsAny(markers) {
  return `(${markers.map((m) => `lower(http.user_agent) contains "${m}"`).join(' or ')})`;
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
    'edge/12.246',
    'chrome/42.0.2311.135',
  ])}
  or (
    lower(http.user_agent) contains "searchbot"
    and not lower(http.user_agent) contains "googlebot"
    and not lower(http.user_agent) contains "bingbot"
    and not lower(http.user_agent) contains "duckduckbot"
  )
)`;

// NOTE: dedicated "known scraper UA", "fake desktop Chrome without Client
// Hints", and "fake Googlebot wrong ASN" block rules were folded into the
// allowlist catch-all: any UA that matches no allow pattern — including
// curl/wget/scrapy/headless browsers, Chrome without sec-ch-ua, and spoofed
// Googlebot from the wrong ASN — is blocked there. The Free plan allows only
// 5 custom WAF rules per zone, so every rule slot counts.

const GOOGLE_INSPECTION_UA = ['google-inspectiontool', 'google-site-verification'];

// Deduplicated marker lists for the allowlist expression — "googlebot" already
// matches googlebot-image/news/video, "msnbot" matches msnbot-media, etc.
// Custom WAF expressions are capped at 4096 characters, so every clause counts.
const GOOGLE_UA_MARKERS_COMPACT = [
  'googlebot',
  'adsbot-google',
  'mediapartners-google',
  'storebot-google',
  'feedfetcher-google',
  'apis-google',
  'duplexweb-google',
  'googleother',
  'google-read-aloud',
  'google-safety',
];
const BING_UA_MARKERS_COMPACT = ['bingbot', 'bingpreview', 'adidxbot', 'msnbot'];

/**
 * Rule 1 — SKIP Security Level / Bot Fight / integrity checks for verified
 * Google and Bing only (sitewide).
 *
 * Do NOT skip for "real browsers" (Chrome + sec-ch-ua, Firefox, Safari, …).
 * Scrapers spoof those headers cheaply; skipping Bot Fight for them is how
 * Chrome/120–143 farms burned Function invocations without paying for ads.
 *
 * Do NOT skip remaining custom WAF (`ruleset: current` / product `waf`).
 *
 * GSC URL Inspection runs from non-Google IPs during Live Test — keep it here
 * so Search Console is never challenged.
 */
const WAF_VERIFIED_CRAWLER_SKIP = `(
  (
    ${VERIFIED_SEARCH_CRAWLER}
    and (${uaContainsAny([...GOOGLE_UA_MARKERS_COMPACT, ...BING_UA_MARKERS_COMPACT, ...GOOGLE_INSPECTION_UA])})
  )
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
    phases: ['http_ratelimit', 'http_request_firewall_managed', 'http_request_sbfm'],
    products: ['zoneLockdown', 'uaBlock', 'bic', 'hot', 'securityLevel'],
  },
  {
    products: ['zoneLockdown', 'uaBlock', 'bic', 'hot', 'securityLevel'],
  },
  {
    products: ['securityLevel', 'bic', 'hot'],
  },
];

/**
 * /k/* + sitemaps allowlist catch-all (block unless allowed).
 * ONLY: verified Google/Bing (UA + ASN or Cloudflare-verified), GSC inspection,
 * real browsers. Fake Googlebot/Bingbot UA from the wrong ASN is blocked here
 * (Bot Fight Mode also scores them — they no longer skip it).
 * NO social unfurl bots, NO DuckDuckGo (Function invocation floods).
 */
const WAF_ALLOWLIST_EXPRESSION = kPath(`(
  (
    ${uaContainsAny([
    'bot',
    'crawler',
    'spider',
    'headless',
    'puppeteer',
    'playwright',
    'selenium',
    'phantomjs',
    'electron',
    'chrome-extension',
    'moz-extension',
    'safari-web-extension',
    'curl/',
    'wget',
    'python-',
    'scrapy',
    'go-http-client',
    'java/',
    'okhttp',
    'node-fetch',
    'axios/',
    'facebookexternalhit',
    'whatsapp',
  ])}
    and not ${uaContainsAny(['googlebot', 'bingbot', 'adsbot-google', 'google-inspectiontool', 'msnbot'])}
  )
  or not (
    ${uaContainsAny(GOOGLE_INSPECTION_UA)}
    or (
      ${uaContainsAny(GOOGLE_UA_MARKERS_COMPACT)}
      and (${VERIFIED_SEARCH_CRAWLER} or ip.src.asnum in ${GOOGLE_ASNS})
    )
    or (
      ${uaContainsAny(BING_UA_MARKERS_COMPACT)}
      and (${VERIFIED_SEARCH_CRAWLER} or ip.src.asnum in ${BING_ASNS})
    )
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
      and len(http.request.headers["sec-fetch-mode"][0]) > 1
    )
    or (
      lower(http.user_agent) contains "edg/"
      and len(http.request.headers["sec-ch-ua"][0]) > 2
    )
    or lower(http.user_agent) contains "samsungbrowser/"
    or (
      (lower(http.user_agent) contains "iphone" or lower(http.user_agent) contains "ipad")
      and lower(http.user_agent) contains "applewebkit/"
      and lower(http.user_agent) contains "mobile/"
      and not lower(http.user_agent) contains "bot"
    )
  )
)`);

const RULES = [
  {
    description: '[DevSolve] SKIP verified Google/Bing only (never challenge)',
    expression: WAF_VERIFIED_CRAWLER_SKIP,
    action: 'skip',
  },
  {
    description: '[DevSolve] sitewide block AI indexers + extension scrapers',
    expression: WAF_SITEWIDE_BAD_BOT_BLOCK,
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

  const rulesetStub = rulesets.find((r) => r.kind === 'zone' && r.phase === 'http_request_firewall_custom');
  // The list endpoint omits each ruleset's rules — fetch the full ruleset so
  // user-managed rules are preserved (not silently dropped) by the PUT below.
  let ruleset;
  if (rulesetStub) {
    ({ result: ruleset } = await cf(`/zones/${zoneId}/rulesets/${rulesetStub.id}`));
  }

  const managedDescriptions = new Set(RULES.map((r) => r.description));
  /** Retired rules — removed on deploy to avoid duplicate / stale blocks. */
  const legacyDescriptions = new Set([
    '[DevSolve] SKIP crawlers + real browsers (never challenge)',
    '[DevSolve] corpus+sitemaps block fake Googlebot/Bingbot (wrong ASN)',
    '[DevSolve] SKIP verified Google/Bing crawlers (never challenge/block)',
    '[DevSolve] sitewide block Meta AI indexer',
    '[DevSolve] sitewide block AI indexers (Claude-SearchBot, Meta)',
    '[DevSolve] /k/* block fake Bingbot',
    '[DevSolve] sitewide block fake desktop Chrome without Client Hints',
    '[DevSolve] /k/* allowlist — Google Bing DuckDuckGo + real browsers',
    '[DevSolve] /k/* block known scraper UAs',
    '[DevSolve] /k/* block fake desktop Chrome without Client Hints',
    '[DevSolve] /k/* block fake Googlebot/Bingbot (wrong ASN)',
    '[DevSolve] /k/* allowlist — Google Bing GSC inspection + real browsers',
    // Manually-created skip rule (note the double space) — superseded by Rule 0.
    '[DevSolve] /k/*  Googlebot/Bingbot (wrong ASN)',
    // Interim consolidated rules — folded into the allowlist catch-all.
    '[DevSolve] corpus+sitemaps block known scraper UAs',
    '[DevSolve] corpus+sitemaps block fake desktop Chrome without Client Hints',
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
          // Collapse formatting whitespace — expressions are capped at 4096 chars.
          expression: spec.expression.replace(/\s+/g, ' ').trim(),
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
    console.log(`Deployed ${RULES.length} rules. Skip is Google/Bing only — Bot Fight still scores browsers.`);
    return;
  }

  const updated = await deployWithSkipFallback((rules) =>
    cf(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    }),
  );
  console.log('Updated WAF ruleset:', updated.result.id);
  console.log(`Deployed ${RULES.length} rules. Skip is Google/Bing only — Bot Fight still scores browsers.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

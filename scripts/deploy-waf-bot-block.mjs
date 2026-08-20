#!/usr/bin/env node
import { BING_CRAWLER_ASNS, GOOGLE_CRAWLER_ASNS, wafAsnSet } from './lib/crawler-asns.mjs';

/**
 * Deploy the Cloudflare edge protection for devsolvev2.com.
 *
 * Everything runs in the WAF (Ruleset Engine) so blocked traffic costs zero
 * Pages Function invocations, and so every decision is auditable and skippable
 * for search crawlers.
 *
 * WHY NOT BOT FIGHT MODE
 * ----------------------
 * Bot Fight Mode (Free) does NOT run on the Ruleset Engine. Cloudflare
 * documents that it "cannot be bypassed with custom rule Skip actions" and that
 * it may challenge legitimate crawlers — so a skip rule for Googlebot/Bingbot
 * cannot protect them from it, on any plan below Super Bot Fight Mode.
 * https://developers.cloudflare.com/bots/get-started/bot-fight-mode/
 * These rules therefore reproduce what Bot Fight Mode is for (kill automated
 * traffic) using signals we control and can exempt crawlers from. Keep Bot
 * Fight Mode OFF; leaving it on is the single most likely way to deindex the
 * corpus, and no code in this repository can undo it.
 *
 * RULE ORDER (first match wins; Free plan allows 5 custom rules, and rules the
 * operator created by hand are preserved after ours)
 *
 *   1. SKIP  — Googlebot/Bingbot family User-Agents, verified social unfurl
 *      crawlers, and public ownership endpoints. Search crawlers are skipped
 *      on User-Agent alone (not `cf.client.bot`): a lag in Cloudflare's
 *      verified-bot signal is how a real Google/Bing crawl gets 403ed, and
 *      Google's renderer also fetches subresources with a Chrome UA from
 *      Google ASNs. Those ASNs are therefore NOT in the hosting block list.
 *      Social preview bots still require `cf.client.bot` so a spoofed
 *      "Twitterbot" from a VPS does not inherit the skip.
 *
 *   2. BLOCK — everything that is not a human browser or a skipped crawler:
 *      named AI/SEO/scraper agents and HTTP libraries (even when Cloudflare
 *      lists them as verified — that matches public/robots.txt), empty or
 *      tiny User-Agents, and "Chrome" User-Agents that do not send Client
 *      Hints + Fetch Metadata + HTTP/2|3 (the farm signature).
 *
 *   3. MANAGED CHALLENGE — browser-extension scrapers (`chrome-extension://`,
 *      `moz-extension://`, `safari-web-extension`). A person who leaked that
 *      token from an installed extension can still pass; a farm of extension
 *      scrapers cannot do that at volume.
 *
 *   4. RATE LIMIT (separate phase, own quota) — /k/* and sitemaps, per IP,
 *      excluding verified bots. This is the only defence against a farm that
 *      rotates residential proxies AND sends a perfect header set: no human
 *      reads 30 corpus pages in 10 seconds.
 *
 * Requires: CLOUDFLARE_API_TOKEN (Zone:Read + Zone WAF:Edit)
 * Usage: node scripts/deploy-waf-bot-block.mjs [--dry-run]
 */

const MAX_EXPRESSION_LENGTH = 4096;

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

/** Every Google and Bing agent that must reach the corpus. */
const SEARCH_CRAWLER_UA = uaContainsAny([
  'googlebot',
  'adsbot-google',
  'mediapartners-google',
  'storebot-google',
  'googleother',
  'google-inspectiontool',
  'google-site-verification',
  'google-read-aloud',
  'google-safety',
  'feedfetcher-google',
  'apis-google',
  'google-extended',
  'googleproducer',
  'google-favicon',
  'chrome-lighthouse',
  'bingbot',
  'bingpreview',
  'adidxbot',
  'msnbot',
  'microsoftpreview',
]);

/** Link-preview crawlers. Skip only when Cloudflare has verified the client. */
const SOCIAL_CRAWLER_UA = uaContainsAny([
  'twitterbot',
  'linkedinbot',
  'facebookexternalhit',
  'facebot',
  'slackbot',
  'discordbot',
  'whatsapp',
  'telegrambot',
]);

/** Cloudflare's verified-bot signal — available on every plan, unspoofable. */
const VERIFIED = 'cf.client.bot';

/**
 * Endpoints that must answer any client, because the machines that read them
 * are not verified bots and are not going to solve a challenge:
 *   - the IndexNow key file, fetched by api.indexnow.org to prove ownership
 *     (a challenge here silently invalidates every URL submission);
 *   - robots.txt, which must never be gated for anyone;
 *   - the sitemap index (400 lines, cached) — the per-chunk sitemaps under
 *     /sitemaps/ stay protected;
 *   - feed.xml, whose readers (Feedly, Inoreader, NetNewsWire relays) fetch
 *     from AWS/GCP and are a real referral channel.
 */
const PUBLIC_ENDPOINTS = `(http.request.uri.path in {
  "/robots.txt"
  "/sitemap.xml"
  "/feed.xml"
  "/opengraph-image.png"
  "/ee5098cac2284d92b6ee1c9fca52a120.txt"
  "/ads.txt"
  "/sellers.json"
})`;

/**
 * WAF1 — the skip. Google/Bing family User-Agents (no verified-bot
 * requirement — verification lag is how a real crawl gets 403ed), verified
 * social unfurl crawlers, and public ownership/feed endpoints bypass every
 * later custom rule plus Security Level, Browser Integrity Check, UA
 * blocking, rate limiting and Managed Rules.
 */
const WAF1_CRAWLER_SKIP = `(
  ${SEARCH_CRAWLER_UA}
  or (${VERIFIED} and ${SOCIAL_CRAWLER_UA})
  or ${PUBLIC_ENDPOINTS}
)`;

/**
 * Named agents that are blocked whatever Cloudflare thinks of them: AI training
 * and answer crawlers, SEO backlink crawlers, headless automation, HTTP
 * libraries, and browser-extension scrapers. Mirrors public/robots.txt, which
 * asks the polite ones not to come.
 */
const KNOWN_SCRAPER_UA = uaContainsAny([
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'claudebot',
  'claude-searchbot',
  'claude-web',
  'anthropic-ai',
  'anthropic.com',
  'perplexitybot',
  'perplexity-user',
  'meta-webindexer',
  'meta-externalagent',
  'meta-externalfetcher',
  'bytespider',
  'ccbot',
  'diffbot',
  'omgilibot',
  'cohere-ai',
  'mistralai-user',
  'ahrefsbot',
  'semrushbot',
  'dataforseobot',
  'mj12bot',
  'blexbot',
  'dotbot',
  'petalbot',
  'amazonbot',
  'barkrowler',
  'serpstatbot',
  'zoominfobot',
  'screaming frog',
  'edge/12.246',
  'chrome/42.0.2311.135',
  'headless',
  'puppeteer',
  'playwright',
  'selenium',
  'phantomjs',
  'curl/',
  'wget',
  'python-',
  'python/',
  'aiohttp',
  'httpx',
  'okhttp',
  'java/',
  'scrapy',
  'go-http-client',
  'node-fetch',
  'axios/',
  'libwww-perl',
  'zgrab',
  'masscan',
]);

const HTTP2_OR_3 = '(http.request.version eq "HTTP/2" or http.request.version eq "HTTP/3")';

/**
 * Real Chromium fingerprint. Farms that stamp a current Chrome User-Agent
 * typically omit Client Hints or send a dummy sec-ch-ua without "chromium".
 * Nested fetch-dest checks were dropped so this expression stays under the
 * 4096-char cap when combined with the scraper list.
 */
const REAL_CHROMIUM_FINGERPRINT = `(
  len(http.request.headers["sec-ch-ua"][0]) > 20
  and lower(http.request.headers["sec-ch-ua"][0]) contains "chromium"
  and ${headerIn('sec-fetch-mode', ['navigate', 'cors', 'no-cors', 'same-origin'])}
  and len(http.request.headers["accept-language"][0]) > 1
)`;

const EXTENSION_SCRAPER_UA = uaContainsAny([
  'chrome-extension',
  'moz-extension',
  'safari-web-extension',
]);

/**
 * Google/Bing crawl ASNs. Used only as an EXCLUSION on the fake-Chrome block:
 * Google's renderer fetches CSS/JS with a Chrome User-Agent from these
 * networks, and putting 15169/8075 on a challenge/block list is how a real
 * crawl gets 403ed. Do not invert this into "challenge these ASNs".
 */
const SEARCH_CRAWLER_ASNS = `ip.src.asnum in ${wafAsnSet([...GOOGLE_CRAWLER_ASNS, ...BING_CRAWLER_ASNS])}`;

/**
 * WAF2 — hard block. Named scrapers/AI agents/HTTP libraries, empty/tiny
 * User-Agents, and Chrome User-Agents that do not send a real Chromium
 * fingerprint. Search crawlers never reach this rule (WAF1 skipped them).
 * Extension scrapers are excluded so they fall through to WAF3's challenge.
 * Google/Bing ASNs are excluded so the renderer is not 403ed on subresources.
 */
const WAF2_HARD_BLOCK = `(
  ${KNOWN_SCRAPER_UA}
  or (len(http.user_agent) lt 12 and not ${VERIFIED})
  or (
    lower(http.user_agent) contains "chrome/"
    and not ${EXTENSION_SCRAPER_UA}
    and not ${SEARCH_CRAWLER_ASNS}
    and not (${REAL_CHROMIUM_FINGERPRINT} and ${HTTP2_OR_3})
  )
)`;

/**
 * WAF3 — managed challenge for browser-extension scrapers only. A human who
 * leaked an extension token in the User-Agent can still pass; a farm cannot.
 */
const WAF3_EXTENSION_CHALLENGE = `(
  ${EXTENSION_SCRAPER_UA}
  and not ${SEARCH_CRAWLER_UA}
  and not ${PUBLIC_ENDPOINTS}
)`;

const SKIP_PRODUCTS = ['zoneLockdown', 'uaBlock', 'bic', 'hot', 'securityLevel', 'rateLimit', 'waf'];

const RULE_SPEC = [
  {
    description: '[DevSolve] WAF1 SKIP Google Bing + verified social unfurls and public endpoints',
    expression: WAF1_CRAWLER_SKIP,
    action: 'skip',
    action_parameters: { ruleset: 'current', products: SKIP_PRODUCTS },
    logging: { enabled: true },
  },
  {
    description: '[DevSolve] WAF2 BLOCK scrapers, AI crawlers, fake Chrome and short User-Agents',
    expression: WAF2_HARD_BLOCK,
    action: 'block',
  },
  {
    description: '[DevSolve] WAF3 CHALLENGE browser-extension scrapers',
    expression: WAF3_EXTENSION_CHALLENGE,
    action: 'managed_challenge',
  },
];

/**
 * Rate limiting rule (phase http_ratelimit, separate quota from custom rules).
 * Free plan: 1 rule, IP characteristic, 10s window, 10s mitigation, and the
 * expression may only reference the path and the verified-bot flag.
 *
 * Real Googlebot/Bingbot cannot hit this rule:
 *   1. the expression requires `not cf.client.bot` — verified crawlers never match;
 *   2. WAF1 skip lists `rateLimit` in `products`, so even the phase is skipped
 *      for verified Google/Bing User-Agents.
 * A spoofed crawler UA from a VPS has cf.client.bot=false and can be limited;
 * that is the farm this rule exists for.
 */
const RATE_LIMIT_RULE = {
  description: '[DevSolve] corpus rate limit — 30 req/10s per IP, verified bots exempt',
  expression: collapse(`(
    (starts_with(http.request.uri.path, "/k/") or starts_with(http.request.uri.path, "/sitemap"))
    and not ${VERIFIED}
  )`),
  action: 'managed_challenge',
  ratelimit: {
    characteristics: ['ip.src', 'cf.colo.id'],
    period: 10,
    requests_per_period: 30,
    mitigation_timeout: 10,
  },
};

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

function printDryRun() {
  for (const rule of [...RULE_SPEC, RATE_LIMIT_RULE]) {
    const expression = collapse(rule.expression);
    console.log(`\n${rule.action.toUpperCase()} — ${rule.description}`);
    console.log(`length ${expression.length}/${MAX_EXPRESSION_LENGTH}`);
    console.log(expression);
  }
}

/** Descriptions this script has used before; replaced rather than preserved. */
const LEGACY_DESCRIPTIONS = new Set([
  '[DevSolve] WAF1 SKIP Google Bing + verified social unfurls and public endpoints',
  '[DevSolve] WAF1 SKIP verified search + social preview crawlers and public endpoints',
  '[DevSolve] SKIP crawlers + real browsers (never challenge)',
  '[DevSolve] WAF1 SKIP verified Googlebot + Bingbot and public endpoints',
  '[DevSolve] WAF1 SKIP verified Googlebot + Bingbot (first, never challenged)',
  '[DevSolve] SKIP verified Google/Bing only (never challenge)',
  '[DevSolve] SKIP verified Google/Bing crawlers (never challenge/block)',
  '[DevSolve] WAF1 block scrapers — keep Google Bing GSC + humans',
  '[DevSolve] WAF2 BLOCK scrapers, AI crawlers, fake Chrome and short User-Agents',
  '[DevSolve] WAF2 BLOCK scrapers, AI crawlers and short User-Agents',
  '[DevSolve] WAF2 BLOCK scrapers, AI crawlers and spoofed Googlebot',
  '[DevSolve] WAF2 corpus allowlist — Google Bing GSC + real browsers',
  '[DevSolve] WAF3 CHALLENGE browser-extension scrapers',
  '[DevSolve] WAF3 CHALLENGE fake browsers and datacenter traffic',
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
  assertExpressionLengths([...RULE_SPEC, RATE_LIMIT_RULE]);
  printDryRun();
  console.log('\nDry-run OK — every expression fits the 4096-char cap.');
  console.log('Reminder: Bot Fight Mode must stay OFF. It ignores skip rules and can challenge Googlebot.');
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

/**
 * The list endpoint ignores ?phase= for zone-level rulesets, so every zone
 * ruleset is fetched and filtered on the phase reported by the detail call.
 */
async function zoneRulesets(zoneId, phase) {
  const { result: stubs } = await cf(`/zones/${zoneId}/rulesets`);
  const found = [];
  for (const stub of stubs.filter((r) => r.kind === 'zone')) {
    if (stub.phase && stub.phase !== phase) continue;
    try {
      const { result } = await cf(`/zones/${zoneId}/rulesets/${stub.id}`);
      if (result.phase === phase) found.push(result);
    } catch {
      // A ruleset we cannot read cannot be managed; skip it.
    }
  }
  return found;
}

/**
 * The zone can hold several custom-rule rulesets (the dashboard creates one,
 * older API runs created others). The entrypoint is the one Cloudflare actually
 * evaluates, so that is the one this script writes.
 */
async function customRulesEntrypoint(zoneId) {
  try {
    const { result } = await cf(
      `/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`,
    );
    return result;
  } catch {
    const [first] = await zoneRulesets(zoneId, 'http_request_firewall_custom');
    return first ?? null;
  }
}

async function disableOrphanedRulesets(zoneId, keepId) {
  for (const ruleset of await zoneRulesets(zoneId, 'http_request_firewall_custom')) {
    if (ruleset.id === keepId) continue;
    const stale = (ruleset.rules ?? []).filter((r) => r.enabled);
    if (!stale.length) continue;
    console.warn(
      `Disabling ${stale.length} enabled rule(s) in non-entrypoint ruleset ${ruleset.id}:`,
      stale.map((r) => r.description).join(', '),
    );
    await cf(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
      method: 'PUT',
      body: JSON.stringify({ rules: (ruleset.rules ?? []).map((r) => ({ ...r, enabled: false })) }),
    });
  }
}

function assembleRules(ruleset, spec) {
  const managed = new Set(spec.map((r) => r.description));
  const preserved = (ruleset?.rules ?? []).filter(
    (r) => !managed.has(r.description) && !LEGACY_DESCRIPTIONS.has(r.description),
  );
  return [
    ...spec.map((rule) => {
      const existing = ruleset?.rules?.find((r) => r.description === rule.description);
      return {
        ...(existing?.id ? { id: existing.id } : {}),
        action: rule.action,
        ...(rule.action_parameters ? { action_parameters: rule.action_parameters } : {}),
        ...(rule.logging ? { logging: rule.logging } : {}),
        expression: collapse(rule.expression),
        description: rule.description,
        enabled: true,
      };
    }),
    ...preserved.map((rule) => ({
      id: rule.id,
      action: rule.action,
      ...(rule.action_parameters ? { action_parameters: rule.action_parameters } : {}),
      expression: rule.expression,
      description: rule.description,
      enabled: rule.enabled,
    })),
  ];
}

/**
 * Skip-action shapes, most capable first. `products` is what actually protects
 * Googlebot from Security Level, Browser Integrity Check and rate limiting; if
 * the zone rejects the field we still want the ruleset skip to land.
 */
const SKIP_VARIANTS = [
  { ruleset: 'current', products: SKIP_PRODUCTS },
  { ruleset: 'current' },
];

async function putCustomRules(zoneId, ruleset) {
  let lastError;
  for (const skip of SKIP_VARIANTS) {
    const spec = RULE_SPEC.map((rule) =>
      rule.action === 'skip' ? { ...rule, action_parameters: skip } : rule,
    );
    const rules = assembleRules(ruleset, spec);
    try {
      const { result } = await cf(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
        method: 'PUT',
        body: JSON.stringify({ rules }),
      });
      console.log(`Updated custom ruleset ${result.id} with ${rules.length} rule(s):`);
      for (const rule of result.rules ?? []) {
        console.log(`  ${rule.enabled ? 'ON ' : 'off'} ${rule.action.padEnd(18)} ${rule.description}`);
      }
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Skip variant ${JSON.stringify(skip)} rejected, retrying with a simpler one...`);
      console.warn(String(error));
    }
  }
  throw lastError;
}

/** Rate limiting actions, most human-friendly first. */
const RATE_LIMIT_ACTIONS = ['managed_challenge', 'block'];
const RATE_LIMIT_CHARACTERISTICS = [
  ['ip.src', 'cf.colo.id'],
  ['ip.src'],
];

async function putRateLimit(zoneId) {
  let entry;
  try {
    ({ result: entry } = await cf(`/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`));
  } catch {
    entry = null;
  }

  const preserved = (entry?.rules ?? []).filter((r) => r.description !== RATE_LIMIT_RULE.description);
  let lastError;
  for (const action of RATE_LIMIT_ACTIONS) {
    for (const characteristics of RATE_LIMIT_CHARACTERISTICS) {
      const rule = {
        action,
        expression: RATE_LIMIT_RULE.expression,
        description: RATE_LIMIT_RULE.description,
        enabled: true,
        ratelimit: { ...RATE_LIMIT_RULE.ratelimit, characteristics },
      };
      const body = JSON.stringify({ rules: [rule, ...preserved] });
      try {
        if (entry) {
          await cf(`/zones/${zoneId}/rulesets/${entry.id}`, { method: 'PUT', body });
        } else {
          await cf(`/zones/${zoneId}/rulesets`, {
            method: 'POST',
            body: JSON.stringify({
              name: 'devsolve-corpus-rate-limit',
              kind: 'zone',
              phase: 'http_ratelimit',
              rules: [rule],
            }),
          });
        }
        console.log(
          `Rate limit deployed: ${action} at ${RATE_LIMIT_RULE.ratelimit.requests_per_period} req/`
          + `${RATE_LIMIT_RULE.ratelimit.period}s per ${characteristics.join('+')} (verified bots exempt).`,
        );
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Rate limit ${action} / ${characteristics.join('+')} rejected, trying the next shape...`);
      }
    }
  }
  console.warn('Rate limiting rule could not be deployed (plan limit or permissions):');
  console.warn(String(lastError));
}

async function main() {
  assertExpressionLengths([...RULE_SPEC, RATE_LIMIT_RULE]);
  const zoneId = await resolveZoneId();

  const entry = await customRulesEntrypoint(zoneId);
  if (!entry) {
    const { result } = await cf(`/zones/${zoneId}/rulesets`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'devsolve-edge-protection',
        kind: 'zone',
        phase: 'http_request_firewall_custom',
        rules: assembleRules(null, RULE_SPEC),
      }),
    });
    console.log('Created custom ruleset:', result.id);
  } else {
    await putCustomRules(zoneId, entry);
    await disableOrphanedRulesets(zoneId, entry.id);
  }

  await putRateLimit(zoneId);

  console.log('\nNext: keep Bot Fight Mode OFF (Security → Bots). It cannot be skipped by these rules');
  console.log('and Cloudflare documents that it may challenge legitimate crawlers, including Googlebot.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

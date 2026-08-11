#!/usr/bin/env node
/**
 * Deploy Cloudflare zone Cache Rules so the programmatic corpus is served
 * "as if static" — repeat requests are answered by the Cloudflare CDN cache
 * and NEVER invoke the Pages Function.
 *
 * Why this is required: Cloudflare only edge-caches responses whose file
 * extension is on its default list (css/js/images/...). HTML (/k/*) and XML
 * (/sitemap.xml, /sitemaps/*) are classified as "Dynamic" and their
 * Cache-Control / CDN-Cache-Control headers are IGNORED at the zone edge
 * until an explicit Cache Rule marks them "Eligible for cache". Without this
 * rule every single crawler/bot request is a cache MISS that invokes the
 * Pages Function (CPU cost + invocation quota + crash risk under attack).
 *
 * With the rule deployed:
 *   request → WAF (spam blocked) → CDN cache HIT → response  (no Function)
 *   request → WAF → CDN cache MISS → Function (deterministic, ~1ms) → cached
 *
 * The rule respects the origin Cache-Control headers already emitted by
 * functions/[[path]].ts (s-maxage=2592000 for /k/*, s-maxage=604800 for
 * sitemaps) and by public/_headers for static sitemap files. Those TTLs are
 * deliberately months rather than a year: a cached page must pick up a content
 * fix without waiting for a manual purge.
 *
 * Also enables Tiered Cache (free on all plans) so a cache miss in one
 * Cloudflare colo is filled from an upper-tier colo instead of invoking the
 * Function again — massively fewer invocations for globally-crawled sites.
 *
 * Requires: CLOUDFLARE_API_TOKEN (Zone: Cache Rules Edit + Zone Settings Edit)
 * Usage: node scripts/deploy-cache-rules.mjs
 */

const PHASE = 'http_request_cache_settings';

/**
 * Everything the Pages Function serves + every static sitemap file.
 * `respect_origin` means: follow the Cache-Control header on the response,
 * bypass nothing our headers do not explicitly allow.
 */
const CACHE_EXPRESSION = [
  'starts_with(http.request.uri.path, "/k/")',
  '(http.request.uri.path eq "/sitemap.xml")',
  'starts_with(http.request.uri.path, "/sitemaps/")',
  'starts_with(http.request.uri.path, "/sitemap-")',
  '(http.request.uri.path eq "/feed.xml")',
].join(' or ');

const CACHE_RULE = {
  description: '[DevSolve] edge-cache programmatic corpus + sitemaps (zero Function invocations on hit)',
  expression: CACHE_EXPRESSION,
  action: 'set_cache_settings',
  action_parameters: {
    cache: true,
    edge_ttl: { mode: 'respect_origin' },
    browser_ttl: { mode: 'respect_origin' },
    serve_stale: { disable_stale_while_updating: false },
  },
};

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
    const detail = JSON.stringify(body.errors ?? body, null, 2);
    if (detail.includes('not authorized') || detail.includes('Unauthorized')) {
      console.error('\nToken lacks Cache Rules permission. Create this rule manually in Cloudflare dashboard:');
      console.error('  Zone → Caching → Cache Rules → Create rule');
      console.error('  Name: [DevSolve] edge-cache programmatic corpus + sitemaps');
      console.error(`  When: Custom filter expression → ${CACHE_EXPRESSION}`);
      console.error('  Then: Eligible for cache → Edge TTL: Use cache-control header if present, bypass cache if not');
      console.error('        Browser TTL: Respect origin TTL');
      console.error('\nWithout this rule, every HTML/XML request invokes the Pages Function on cache miss.');
    }
    throw new Error(detail);
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

async function deployCacheRule(zoneId) {
  const { result: rulesets } = await cf(`/zones/${zoneId}/rulesets?phase=${PHASE}`);
  const ruleset = rulesets?.find((r) => r.kind === 'zone' && r.phase === PHASE);

  const rule = {
    action: CACHE_RULE.action,
    action_parameters: CACHE_RULE.action_parameters,
    expression: CACHE_RULE.expression,
    description: CACHE_RULE.description,
    enabled: true,
  };

  if (!ruleset) {
    const created = await cf(`/zones/${zoneId}/rulesets`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'devsolve-cache-rules',
        kind: 'zone',
        phase: PHASE,
        rules: [rule],
      }),
    });
    console.log('Created cache ruleset:', created.result.id);
    return;
  }

  // Upsert by description; preserve any unrelated rules the user created.
  const { result: full } = await cf(`/zones/${zoneId}/rulesets/${ruleset.id}`);
  const existing = full.rules?.find((r) => r.description === CACHE_RULE.description);
  const preserved = (full.rules ?? []).filter((r) => r.description !== CACHE_RULE.description);
  const rules = [{ ...rule, id: existing?.id }, ...preserved];

  const updated = await cf(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
    method: 'PUT',
    body: JSON.stringify({ rules }),
  });
  console.log('Updated cache ruleset:', updated.result.id);
}

async function enableTieredCache(zoneId) {
  try {
    await cf(`/zones/${zoneId}/argo/tiered_caching`, {
      method: 'PATCH',
      body: JSON.stringify({ value: 'on' }),
    });
    console.log('Tiered Cache: on');
  } catch (error) {
    console.warn('Tiered Cache could not be enabled (non-fatal):', error.message);
  }
  try {
    await cf(`/zones/${zoneId}/cache/tiered_cache_smart_topology_enable`, {
      method: 'PATCH',
      body: JSON.stringify({ value: 'on' }),
    });
    console.log('Smart Tiered Cache topology: on');
  } catch (error) {
    console.warn('Smart Tiered Cache topology could not be enabled (non-fatal):', error.message);
  }
}

async function main() {
  const zoneId = await resolveZoneId();
  await deployCacheRule(zoneId);
  await enableTieredCache(zoneId);
  console.log('Cache rules deployed. HTML/XML corpus responses are now CDN-cacheable;');
  console.log('cache HITs are served with ZERO Pages Function invocations.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

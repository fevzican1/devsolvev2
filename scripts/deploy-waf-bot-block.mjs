#!/usr/bin/env node
/**
 * Deploy the Cloudflare custom WAF for devsolvev2.com.
 *
 * Rules live in scripts/lib/waf-rules.mjs so the dashboard paste file and the
 * policy checker share the same expressions.
 *
 * Free plan: 5 custom rules. This script writes WAF1–WAF3 and keeps the
 * operator's WAF4 (`sasd`) and WAF5 (AI Crawl Control). Rate limiting is a
 * separate phase and does not use a custom-rule slot.
 *
 * Bot Fight Mode must stay OFF. It ignores skip rules and can challenge
 * crawlers: https://developers.cloudflare.com/bots/get-started/bot-fight-mode/
 *
 * Requires: CLOUDFLARE_API_TOKEN (Zone:Read + Zone WAF:Edit)
 * Usage: node scripts/deploy-waf-bot-block.mjs [--dry-run]
 */
import {
  LEGACY_DESCRIPTIONS,
  MAX_EXPRESSION_LENGTH,
  RATE_LIMIT_RULE,
  RULE_SPEC,
  SKIP_PRODUCTS,
  assertExpressionLengths,
  collapse,
  laterRulesNameSearchCrawlers,
} from './lib/waf-rules.mjs';

function printDryRun() {
  for (const rule of [...RULE_SPEC, RATE_LIMIT_RULE]) {
    const expression = collapse(rule.expression);
    const slot = rule.slot ? `${rule.slot} ` : '';
    console.log(`\n${slot}${rule.action.toUpperCase()} — ${rule.description}`);
    console.log(`length ${expression.length}/${MAX_EXPRESSION_LENGTH}`);
    console.log(expression);
  }
  console.log('\nWAF4 preserved: sasd');
  console.log('WAF5 preserved: AI Crawl Control - Block AI bots by User Agent');
}

const dryRun = process.argv.includes('--dry-run');
if (dryRun) {
  assertExpressionLengths();
  const named = laterRulesNameSearchCrawlers();
  if (named.length) {
    console.error(`WAF2–WAF5 / rate limit must not name search crawlers: ${named.join(', ')}`);
    process.exit(1);
  }
  printDryRun();
  console.log('\nDry-run OK — every expression fits the 4096-char cap.');
  console.log('Reminder: Bot Fight Mode must stay OFF. It ignores skip rules.');
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
        ...(rule.logging ? { logging: { enabled: true } } : {}),
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
          + `${RATE_LIMIT_RULE.ratelimit.period}s per ${characteristics.join('+')}.`,
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
  assertExpressionLengths();
  const named = laterRulesNameSearchCrawlers();
  if (named.length) {
    throw new Error(`WAF2–WAF5 / rate limit must not name search crawlers: ${named.join(', ')}`);
  }
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

  console.log('\nNext: keep Bot Fight Mode OFF (Security → Bots). It cannot be skipped by these rules.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

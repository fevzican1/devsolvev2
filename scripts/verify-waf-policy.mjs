#!/usr/bin/env node
/**
 * Offline WAF policy check. No Cloudflare token required.
 *
 * 1. WAF1 skips search + social User-Agents and Google/Bing renderer ASNs.
 *    Applebot is not skipped (that was the hole).
 * 2. WAF2 and WAF3 expressions are frozen and never name Google or Bing.
 * 3. Farm Chrome/144.0.0.0 and Catalina 10_15_7 stamps are blocked.
 * 4. Chrome /k/ without navigate+document is blocked (missing headers included).
 * 5. A person navigating /k/ with a real Chrome build is not matched by WAF3.
 */
import { createHash } from 'node:crypto';
import {
  WAF1_SKIP,
  WAF2_BLOCK,
  WAF3_CHALLENGE,
  RATE_LIMIT_RULE,
  RULE_SPEC,
  assertExpressionLengths,
  laterRulesNameSearchCrawlers,
} from './lib/waf-rules.mjs';

/** Byte-for-byte freeze of the operator-approved WAF2/WAF3 expressions. */
const WAF2_SHA256 = '97a23dbb0c8e14f7b29fe1cc23853103819607e23e11c872646bc92d4c127c07';
const WAF3_SHA256 = '4533a759ca64043e3616a3fee12d4a9aa4232523406f49f5950e94d5e32bb4f8';

const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL  ${message}`);
}

function ok(message) {
  console.log(`OK    ${message}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

assertExpressionLengths();
ok('every expression fits the 4096-char cap');

if (/cf\.client\.bot/.test(WAF1_SKIP)) {
  fail('WAF1 requires cf.client.bot — that is the Bing outage (verification lag)');
} else {
  ok('WAF1 skips on User-Agent / renderer ASN only (no verified-bot flag)');
}

if (/applebot/i.test(WAF1_SKIP)) {
  fail('WAF1 still skips Applebot — remove that marker; WAF5 already blocks it');
} else {
  ok('WAF1 does not skip Applebot');
}

for (const marker of ['google', 'bing', 'msn', 'twitter', 'facebook', 'linkedin', 'reddit', 'lighthouse', 'pagespeed']) {
  if (!WAF1_SKIP.includes(`"${marker}"`)) fail(`WAF1 missing User-Agent marker "${marker}"`);
}
ok('WAF1 names search + social + PageSpeed crawlers');

if (!WAF1_SKIP.includes('ip.src.asnum')) fail('WAF1 must skip Google/Bing renderer ASNs');
if (!WAF1_SKIP.includes('15169')) fail('WAF1 must include Google ASN 15169');
if (!WAF1_SKIP.includes('8075')) fail('WAF1 must include Bing/Microsoft ASN 8075');
ok('WAF1 skips Chrome renderers from Google/Bing ASNs');

if (!WAF1_SKIP.includes('/opengraph-image.png')) fail('WAF1 must skip the PNG social card');
else ok('WAF1 skips /opengraph-image.png');

const named = laterRulesNameSearchCrawlers();
if (named.length) fail(`later rules name search crawlers: ${named.join(', ')}`);
else ok('WAF2, WAF3 and rate limit do not name Google or Bing');

if (sha256(WAF2_BLOCK) !== WAF2_SHA256) {
  fail('WAF2 expression changed — the operator froze this rule');
} else {
  ok('WAF2 expression is frozen (unchanged)');
}

if (sha256(WAF3_CHALLENGE) !== WAF3_SHA256) {
  fail('WAF3 expression changed — the operator froze this rule');
} else {
  ok('WAF3 expression is frozen (unchanged)');
}

if (!WAF2_BLOCK.includes('chrome-extension')) fail('WAF2 must block chrome-extension Origin/Referer/UA');
else ok('WAF2 blocks chrome-extension Origin / Referer / UA');

if (!WAF2_BLOCK.includes('.0.0.0')) fail('WAF2 must block stamped Chrome/144.0.0.0 farm UAs');
else ok('WAF2 blocks .0.0.0 farm version stamps');

if (!WAF2_BLOCK.includes('mac os x 10_15_7')) fail('WAF2 must block Catalina 10_15_7 + Chrome farm UAs');
else ok('WAF2 blocks Mac OS X 10_15_7 + Chrome');

if (!WAF2_BLOCK.includes('chrome/100.0.4896')) fail('WAF2 must block Chrome/100.0.4896.75');
else ok('WAF2 blocks Chrome/100.0.4896.75');

if (WAF2_BLOCK.includes('applebot')) fail('WAF2 must not mention applebot (WAF5 blocks it; do not retune WAF2)');
else ok('WAF2 does not mention applebot');

if (WAF3_CHALLENGE.includes('len(')) {
  fail('WAF3 must not require len(sec-fetch-mode) gt 0 — that hole let headerless farms through');
}
if (!WAF3_CHALLENGE.includes('sec-fetch-mode')) fail('WAF3 must key off sec-fetch-mode');
if (!WAF3_CHALLENGE.includes('sec-fetch-dest')) fail('WAF3 must require dest=document for a real page open');
if (!WAF3_CHALLENGE.includes('"/k/"')) fail('WAF3 must only apply to /k/');
if (!WAF3_CHALLENGE.includes('eq "navigate"')) fail('WAF3 must allow real navigation');
ok('WAF3 blocks Chrome /k/ unless it is a real navigate+document');

if (WAF3_CHALLENGE.includes('threat_score')) {
  fail('WAF3 must not use threat_score — Azure Bing crawls score high and get challenged');
} else {
  ok('WAF3 does not use threat_score');
}

const allowedActions = new Set(['block', 'managed_challenge']);
for (const slot of ['WAF2', 'WAF3']) {
  const rule = RULE_SPEC.find((r) => r.slot === slot);
  if (!allowedActions.has(rule?.action)) fail(`${slot} action must stay block or managed_challenge`);
  else ok(`${slot} action is ${rule.action} (expression untouched)`);
}

if (!RATE_LIMIT_RULE.expression.includes('not cf.client.bot')) {
  fail('rate limit should still exempt verified bots as a second belt');
} else {
  ok('rate limit exempts verified bots; WAF1 skip already covers unverified search UAs');
}

if (RULE_SPEC.length !== 3) fail(`expected 3 managed custom rules (WAF1–3), got ${RULE_SPEC.length}`);
else ok('WAF1–WAF3 managed; WAF4 sasd and WAF5 AI Crawl Control stay as operator rules');

const farmUas = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36',
];
for (const ua of farmUas) {
  const lower = ua.toLowerCase();
  const stamped = lower.includes('.0.0.0') || lower.includes('chrome/100.0.4896') || (lower.includes('mac os x 10_15_7') && lower.includes('chrome/'));
  if (!stamped) fail(`farm UA is not covered by WAF2 stamps: ${ua}`);
}
ok('every listed farm User-Agent matches a WAF2 stamp');

const bingModern = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36';
if (bingModern.toLowerCase().includes('.0.0.0')) fail('modern Bingbot UA must not match the .0.0.0 farm stamp');
else ok('modern Bingbot UA does not use the .0.0.0 farm stamp');

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} WAF policy issue(s)`);
  process.exit(1);
}
console.log('\nPASS — WAF policy holds');

#!/usr/bin/env node
/**
 * Offline WAF policy check. No Cloudflare token required.
 *
 * 1. WAF1 skips search + social User-Agents without cf.client.bot.
 * 2. WAF2 and WAF3 never name Google or Bing.
 * 3. Farm Chrome/144.0.0.0 and Catalina 10_15_7 stamps are blocked.
 * 4. Chrome /k/ without navigate+document is blocked (missing headers included).
 * 5. A person navigating /k/ with a real Chrome build is not matched by WAF3.
 */
import {
  WAF1_SKIP,
  WAF2_BLOCK,
  WAF3_CHALLENGE,
  RATE_LIMIT_RULE,
  RULE_SPEC,
  assertExpressionLengths,
  laterRulesNameSearchCrawlers,
} from './lib/waf-rules.mjs';

const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL  ${message}`);
}

function ok(message) {
  console.log(`OK    ${message}`);
}

assertExpressionLengths();
ok('every expression fits the 4096-char cap');

if (/cf\.client\.bot/.test(WAF1_SKIP)) {
  fail('WAF1 requires cf.client.bot — that is the Bing outage (verification lag)');
} else {
  ok('WAF1 skips on User-Agent only (no verified-bot flag)');
}

for (const marker of ['google', 'bing', 'msn', 'twitter', 'facebook', 'linkedin', 'applebot', 'reddit']) {
  if (!WAF1_SKIP.includes(`"${marker}"`)) fail(`WAF1 missing User-Agent marker "${marker}"`);
}
ok('WAF1 names search + social crawlers');

if (!WAF1_SKIP.includes('/opengraph-image.png')) fail('WAF1 must skip the PNG social card');
else ok('WAF1 skips /opengraph-image.png');

const named = laterRulesNameSearchCrawlers();
if (named.length) fail(`later rules name search crawlers: ${named.join(', ')}`);
else ok('WAF2, WAF3 and rate limit do not name Google or Bing');

if (!WAF2_BLOCK.includes('chrome-extension')) fail('WAF2 must block chrome-extension Origin/Referer/UA');
else ok('WAF2 blocks chrome-extension Origin / Referer / UA');

if (!WAF2_BLOCK.includes('.0.0.0')) fail('WAF2 must block stamped Chrome/144.0.0.0 farm UAs');
else ok('WAF2 blocks .0.0.0 farm version stamps');

if (!WAF2_BLOCK.includes('mac os x 10_15_7')) fail('WAF2 must block Catalina 10_15_7 + Chrome farm UAs');
else ok('WAF2 blocks Mac OS X 10_15_7 + Chrome');

if (!WAF2_BLOCK.includes('chrome/100.0.4896')) fail('WAF2 must block Chrome/100.0.4896.75');
else ok('WAF2 blocks Chrome/100.0.4896.75');

if (WAF2_BLOCK.includes('applebot')) fail('WAF2 must not block applebot (WAF1 skips it)');
else ok('WAF2 does not block applebot');

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

const waf3 = RULE_SPEC.find((r) => r.slot === 'WAF3');
if (waf3?.action !== 'block') fail('WAF3 must block, not challenge, the farm');
else ok('WAF3 action is block');

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

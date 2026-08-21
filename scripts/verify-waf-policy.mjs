#!/usr/bin/env node
/**
 * Offline WAF policy check. No Cloudflare token required.
 *
 * 1. WAF1 skips search + social User-Agents without cf.client.bot.
 * 2. WAF2 and WAF3 never name Google or Bing.
 * 3. Chrome-extension Origin is blocked.
 * 4. Chrome fetch() of /k/ (sec-fetch-mode != navigate) is challenged.
 * 5. A person navigating /k/ with Chrome is not challenged by WAF3.
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

if (WAF2_BLOCK.includes('applebot')) fail('WAF2 must not block applebot (WAF1 skips it)');
else ok('WAF2 does not block applebot');

if (!WAF3_CHALLENGE.includes('sec-fetch-mode')) fail('WAF3 must key off sec-fetch-mode');
if (!WAF3_CHALLENGE.includes('"/k/"')) fail('WAF3 must only apply to /k/');
if (!WAF3_CHALLENGE.includes('ne "navigate"')) fail('WAF3 must allow real navigation');
ok('WAF3 challenges Chrome fetch() of /k/, not navigation');

if (WAF3_CHALLENGE.includes('threat_score')) {
  fail('WAF3 must not use threat_score — Azure Bing crawls score high and get challenged');
} else {
  ok('WAF3 does not use threat_score');
}

if (!RATE_LIMIT_RULE.expression.includes('not cf.client.bot')) {
  fail('rate limit should still exempt verified bots as a second belt');
} else {
  ok('rate limit exempts verified bots; WAF1 skip already covers unverified search UAs');
}

if (RULE_SPEC.length !== 3) fail(`expected 3 managed custom rules (WAF1–3), got ${RULE_SPEC.length}`);
else ok('WAF1–WAF3 managed; WAF4 sasd and WAF5 AI Crawl Control stay as operator rules');

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} WAF policy issue(s)`);
  process.exit(1);
}
console.log('\nPASS — WAF policy holds');

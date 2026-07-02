#!/usr/bin/env node
/**
 * Smoke tests for functions/_shared/botGuard.ts — run: node scripts/test-bot-guard.mjs
 * Uses tsx to import TypeScript directly (already in devDependencies).
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { register } = require('tsx/esm/api');
register();

const { decideAccess } = await import('../functions/_shared/botGuard.ts');

const REAL_CHROME_HEADERS = {
  secChUa: '"Chromium";v="133", "Not(A:Brand";v="99"',
  secChUaMobile: '?0',
};

const ATTACK_UAS = [
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +searchbot@anthropic.com)',
  'meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36',
];

const ALLOW_UAS = [
  {
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    cf: { asn: 15169, asOrganization: 'Google LLC' },
    headers: { secChUa: null, secChUaMobile: null },
  },
  {
    ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    cf: { asn: 8075, asOrganization: 'Microsoft Corporation' },
    headers: { secChUa: null, secChUaMobile: null },
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    cf: undefined,
    headers: REAL_CHROME_HEADERS,
  },
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    cf: undefined,
    headers: { secChUa: null, secChUaMobile: null },
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    cf: undefined,
    headers: { secChUa: null, secChUaMobile: null },
  },
  {
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    cf: undefined,
    headers: { secChUa: null, secChUaMobile: null },
  },
];

let passed = 0;

for (const ua of ATTACK_UAS) {
  const fakeBingCf = ua.includes('bingbot')
    ? { asn: 12345, asOrganization: 'DigitalOcean LLC' }
    : undefined;
  const decision = decideAccess(ua, fakeBingCf, { secChUa: null, secChUaMobile: null });
  assert.equal(decision, 'block', `expected block for attack UA: ${ua.slice(0, 72)}…`);
  passed += 1;
}

for (const { ua, cf, headers } of ALLOW_UAS) {
  const decision = decideAccess(ua, cf, headers);
  assert.equal(decision, 'allow', `expected allow for legitimate UA: ${ua.slice(0, 72)}…`);
  passed += 1;
}

console.log(`botGuard: ${passed} assertions passed`);

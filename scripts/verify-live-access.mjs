#!/usr/bin/env node
/**
 * Live access matrix — spam blocked at WAF (zero Pages Function invocations).
 * WAF block → Cloudflare HTML. Function botGuard block → plain "Access Denied".
 *
 * Real Googlebot/Bingbot from Google/Microsoft ASNs pass WAF rule 4 (verified by
 * deploy-waf-bot-block.mjs expressions). This script runs from a non-crawler IP,
 * so fake Googlebot/Bingbot UA correctly returns WAF 403. GSC InspectionTool
 * proves /k/* is reachable for Google indexing validation.
 */
const SITE = (process.env.SITE_URL || 'https://devsolvev2.com').replace(/\/$/, '');
const K_PATH = '/k/json-validate-json-backend-engineer-debug-production-issue-json-formatter-0';
const SITEMAP = '/sitemap-index-2026-06-v3.xml';

function isWafBlock(body) {
  return body.includes('Cloudflare') || body.includes('cf-error-details');
}

function isFunctionBlock(body) {
  return body.trim() === 'Access Denied' || body.startsWith('Access Denied');
}

/** Must be blocked at WAF — any 200 or Function 403 = counter leak. */
const WAF_BLOCK_BOTS = [
  ['Fake Chrome (no sec-ch-ua)', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', null],
  ['Fake Googlebot (wrong IP)', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', null],
  ['Fake Bingbot (wrong IP)', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', null],
  ['DuckDuckBot', 'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)', null],
  ['Twitterbot', 'Twitterbot/1.0', null],
  ['Facebookexternalhit', 'facebookexternalhit/1.1', null],
  ['LinkedInBot', 'LinkedInBot/1.0', null],
  ['Claude-SearchBot', 'Claude-SearchBot/1.0', null],
  ['GPTBot', 'GPTBot/1.0 (+https://openai.com/gptbot)', null],
  ['meta-webindexer', 'meta-webindexer/1.0', null],
  ['AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', null],
  ['SemrushBot', 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)', null],
  ['Applebot', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1)', null],
  ['curl', 'curl/8.4.0', null],
  ['python-requests', 'python-requests/2.31.0', null],
  ['Screaming Frog', 'Screaming Frog SEO Spider/19.0', null],
  ['Bytespider', 'Bytespider', null],
  ['PetalBot', 'PetalBot', null],
  ['CCBot', 'CCBot/2.0 (https://commoncrawl.org/faq/)', null],
  ['Empty UA', '', null],
];

const cases = [
  { name: 'Googlebot sitemap', path: SITEMAP, ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', expect: [200] },
  { name: 'Googlebot /k/* (non-Google IP → WAF block expected)', path: K_PATH, ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', expect: [403], wantWaf: true },
  { name: 'GSC InspectionTool /k/*', path: K_PATH, ua: 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)', expect: [200] },
  { name: 'Bingbot sitemap', path: SITEMAP, ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', expect: [200] },
  { name: 'Bingbot /k/* (non-Microsoft IP → WAF block expected)', path: K_PATH, ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', expect: [403], wantWaf: true },
  {
    name: 'Real Chrome /k/*',
    path: K_PATH,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    headers: { 'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120", "Not_A Brand";v="99"', 'sec-ch-ua-mobile': '?0' },
    expect: [200],
  },
  ...WAF_BLOCK_BOTS.map(([name, ua]) => ({
    name: `${name} /k/*`,
    path: K_PATH,
    ua,
    expect: [403],
    wantWaf: true,
    zeroInvocation: true,
  })),
];

let failed = 0;
let functionLeaks = 0;

for (const c of cases) {
  const headers = { ...(c.ua ? { 'User-Agent': c.ua } : {}), ...(c.headers || {}) };
  const res = await fetch(`${SITE}${c.path}`, { headers, redirect: 'manual' });
  const body = await res.text();
  const bodyStart = body.slice(0, 120).replace(/\s+/g, ' ');
  const ok = c.expect.includes(res.status);

  if (res.status === 403 && isFunctionBlock(body)) {
    if (c.zeroInvocation || c.wantWaf) {
      console.log(`FAIL  ${c.name}: HTTP 403 via Function (COUNTS INVOCATION) — ${bodyStart}`);
      failed += 1;
      functionLeaks += 1;
      continue;
    }
  }

  if (ok && res.status === 403 && c.wantWaf && !isWafBlock(body)) {
    console.log(`FAIL  ${c.name}: HTTP 403 but not WAF block — ${bodyStart}`);
    failed += 1;
    continue;
  }

  if (ok && res.status === 200 && c.zeroInvocation) {
    console.log(`FAIL  ${c.name}: HTTP 200 — bad bot reached origin (counter leak)`);
    failed += 1;
    continue;
  }

  const tag = ok ? 'OK' : 'FAIL';
  console.log(`${tag}  ${c.name}: HTTP ${res.status} — ${bodyStart}`);
  if (!ok) failed += 1;
}

if (failed === 0) {
  console.log('\nPASS — real crawlers + GSC OK; all spam at WAF (zero Function invocations)');
} else {
  console.log(`\nFAIL — ${failed} case(s)${functionLeaks ? `, ${functionLeaks} Function leak(s)` : ''}`);
}
process.exit(failed === 0 ? 0 : 1);

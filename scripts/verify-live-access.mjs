#!/usr/bin/env node
/**
 * Live access matrix — spam blocked at WAF (zero Function invocations).
 * WAF block → Cloudflare HTML. Function botGuard block → plain "Access Denied".
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

const cases = [
  { name: 'Googlebot sitemap', path: SITEMAP, ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', expect: [200] },
  { name: 'Googlebot /k/*', path: K_PATH, ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', expect: [200, 403], allowFunctionBlock: true },
  { name: 'GSC InspectionTool /k/*', path: K_PATH, ua: 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)', expect: [200] },
  { name: 'Bingbot sitemap', path: SITEMAP, ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', expect: [200] },
  { name: 'Bingbot /k/*', path: K_PATH, ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', expect: [200, 403], allowFunctionBlock: true },
  { name: 'Real Chrome', path: K_PATH, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', headers: { 'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120", "Not_A Brand";v="99"', 'sec-ch-ua-mobile': '?0' }, expect: [200] },
  { name: 'Fake Chrome (no sec-ch-ua)', path: K_PATH, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', expect: [403], wantWaf: true },
  { name: 'Fake Googlebot (wrong IP)', path: K_PATH, ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', expect: [403], wantWaf: true },
  { name: 'DuckDuckBot /k/*', path: K_PATH, ua: 'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)', expect: [403], wantWaf: true },
  { name: 'Twitterbot /k/*', path: K_PATH, ua: 'Twitterbot/1.0', expect: [403], wantWaf: true },
  { name: 'Claude-SearchBot /k/*', path: K_PATH, ua: 'Claude-SearchBot/1.0', expect: [403], wantWaf: true },
  { name: 'meta-webindexer /k/*', path: K_PATH, ua: 'meta-webindexer/1.0', expect: [403], wantWaf: true },
];

let failed = 0;

for (const c of cases) {
  const headers = { 'User-Agent': c.ua, ...(c.headers || {}) };
  const res = await fetch(`${SITE}${c.path}`, { headers, redirect: 'manual' });
  const body = await res.text();
  const bodyStart = body.slice(0, 120).replace(/\s+/g, ' ');
  const ok = c.expect.includes(res.status);

  if (ok && res.status === 403 && c.wantWaf && !isWafBlock(body)) {
    console.log(`FAIL  ${c.name}: HTTP 403 but not WAF block (possible Function leak) — ${bodyStart}`);
    failed += 1;
    continue;
  }

  if (ok && res.status === 403 && !c.wantWaf && !c.allowFunctionBlock && isFunctionBlock(body)) {
    console.log(`WARN  ${c.name}: HTTP 403 via Function (counts invocation) — ${bodyStart}`);
  }

  const tag = ok ? 'OK' : 'FAIL';
  console.log(`${tag}  ${c.name}: HTTP ${res.status} — ${bodyStart}`);
  if (!ok) failed += 1;
}

console.log(failed === 0 ? '\nPASS — access matrix clean (spam at WAF = zero invocations)' : `\nFAIL — ${failed} case(s)`);
process.exit(failed === 0 ? 0 : 1);

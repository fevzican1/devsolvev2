#!/usr/bin/env node
/**
 * Live access matrix — spam blocked at WAF (zero Pages Function invocations).
 * Real Google/Bing crawlers skip all protection from their ASNs (rule 0).
 * GSC InspectionTool always passes. Legacy sitemap URLs 301 to /sitemap.xml.
 */
const SITE = (process.env.SITE_URL || 'https://devsolvev2.com').replace(/\/$/, '');
const K_PATH = '/k/json-validate-json-backend-engineer-debug-production-issue-json-formatter-0';
const SITEMAP = '/sitemap.xml';
const FEED = '/feed.xml';
const LEGACY_SITEMAPS = [
  '/sitemap-index-2026-06-v3.xml',
  '/sitemap_index.xml',
  '/sitemaps.xml',
  '/sitemap-index.xml',
  '/sitemap-tier2-0008.xml',
  '/sitemap-priority-0001.xml',
  '/sitemap-programmatic-0008.xml',
];
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CHROME_HEADERS = { 'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120", "Not_A Brand";v="99"', 'sec-ch-ua-mobile': '?0' };

function isWafBlock(body, res) {
  // Custom-rule block page, or a Bot Fight Mode / Under Attack managed
  // challenge (cf-mitigated header). Both stop traffic at the Cloudflare
  // edge with ZERO Pages Function invocations.
  return (
    /cloudflare/i.test(body) ||
    body.includes('cf-error-details') ||
    res?.headers.get('cf-mitigated') === 'challenge'
  );
}

function isFunctionBlock(body) {
  return body.trim() === 'Access Denied' || body.startsWith('Access Denied');
}

/** Must be blocked at WAF — any 200 or Function 403 = counter leak. */
const WAF_BLOCK_BOTS = [
  ['Fake Chrome (no sec-ch-ua)', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', null],
  ['Fake Chrome (extension UA)', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Chrome-extension/abc123', null],
  ['Fake Googlebot (wrong IP)', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', null],
  ['Fake Bingbot (wrong IP)', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', null],
  ['DuckDuckBot', 'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)', null],
  ['Twitterbot', 'Twitterbot/1.0', null],
  ['Facebookexternalhit', 'facebookexternalhit/1.1', null],
  ['LinkedInBot', 'LinkedInBot/1.0', null],
  ['Claude-SearchBot', 'Claude-SearchBot/1.0', null],
  ['ClaudeBot', 'ClaudeBot/1.0', null],
  ['GPTBot', 'GPTBot/1.0 (+https://openai.com/gptbot)', null],
  ['meta-webindexer', 'meta-webindexer/1.0', null],
  ['meta-externalagent', 'meta-externalagent/1.0', null],
  ['AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', null],
  ['SemrushBot', 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)', null],
  ['Applebot', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1)', null],
  ['curl', 'curl/8.4.0', null],
  ['wget', 'Wget/1.21.4', null],
  ['python-requests', 'python-requests/2.31.0', null],
  ['go-http-client', 'Go-http-client/2.0', null],
  ['Screaming Frog', 'Screaming Frog SEO Spider/19.0', null],
  ['Bytespider', 'Bytespider', null],
  ['PetalBot', 'PetalBot', null],
  ['CCBot', 'CCBot/2.0 (https://commoncrawl.org/faq/)', null],
  ['Empty UA', '', null],
];

const REAL_CRAWLER_CASES = [
  // allowChallenge: when Bot Fight Mode / Under Attack is active, requests
  // from datacenter IPs (where this script runs) get a managed challenge even
  // with a browser UA. That is a WARN, not a failure — real browsers solve the
  // challenge and real Google/Bing crawlers are exempt (verified bots + Rule 0).
  { name: 'GSC InspectionTool sitemap', path: SITEMAP, ua: 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)', expect: [200], allowChallenge: true },
  { name: 'GSC InspectionTool feed.xml', path: FEED, ua: 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)', expect: [200], allowChallenge: true },
  { name: 'GSC InspectionTool /k/*', path: K_PATH, ua: 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)', expect: [200], allowChallenge: true },
  { name: 'Real Chrome sitemap', path: SITEMAP, ua: CHROME_UA, headers: CHROME_HEADERS, expect: [200], allowChallenge: true },
  { name: 'Real Chrome feed.xml', path: FEED, ua: CHROME_UA, headers: CHROME_HEADERS, expect: [200], allowChallenge: true },
  { name: 'Real Chrome /k/*', path: K_PATH, ua: CHROME_UA, headers: CHROME_HEADERS, expect: [200], allowChallenge: true },
  // Fake crawlers (this script never runs from Google/Microsoft IPs) must be
  // stopped at the WAF on sitemaps too — sitemap floods invoke the Function
  // exactly like /k/* floods.
  { name: 'Googlebot sitemap (non-Google IP → WAF block)', path: SITEMAP, ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', expect: [403], wantWaf: true },
  { name: 'Bingbot sitemap (non-Microsoft IP → WAF block)', path: SITEMAP, ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', expect: [403], wantWaf: true },
  { name: 'Googlebot /k/* (non-Google IP → WAF block)', path: K_PATH, ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', expect: [403], wantWaf: true },
  { name: 'Bingbot /k/* (non-Microsoft IP → WAF block)', path: K_PATH, ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', expect: [403], wantWaf: true },
  // Every sitemap URL ever submitted to GSC/Bing must 301 to /sitemap.xml —
  // a 404 here renders the HTML error page and produces the
  // "xmlParseEntityRef: no name" parse failure in Search Console.
  ...LEGACY_SITEMAPS.map((path) => ({
    name: `Legacy ${path} → 301 /sitemap.xml`,
    path,
    ua: CHROME_UA,
    headers: CHROME_HEADERS,
    expect: [301],
    expectLocation: '/sitemap.xml',
    allowChallenge: true,
  })),
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
let warned = 0;

for (const c of REAL_CRAWLER_CASES) {
  const headers = { ...(c.ua ? { 'User-Agent': c.ua } : {}), ...(c.headers || {}) };
  const res = await fetch(`${SITE}${c.path}`, { headers, redirect: 'manual' });
  const body = await res.text();
  const bodyStart = body.slice(0, 120).replace(/\s+/g, ' ');
  const challenged = res.status === 403 && res.headers.get('cf-mitigated') === 'challenge';

  if (challenged && c.allowChallenge) {
    console.log(`WARN  ${c.name}: HTTP 403 challenge (expected from datacenter IP — real crawlers/browsers exempt)`);
    warned += 1;
    continue;
  }

  const ok = c.expect.includes(res.status);

  if (res.status === 403 && isFunctionBlock(body)) {
    if (c.zeroInvocation || c.wantWaf) {
      console.log(`FAIL  ${c.name}: HTTP 403 via Function (COUNTS INVOCATION) — ${bodyStart}`);
      failed += 1;
      functionLeaks += 1;
      continue;
    }
  }

  if (ok && res.status === 403 && c.wantWaf && !isWafBlock(body, res)) {
    console.log(`FAIL  ${c.name}: HTTP 403 but not WAF block — ${bodyStart}`);
    failed += 1;
    continue;
  }

  if (ok && res.status === 200 && c.zeroInvocation) {
    console.log(`FAIL  ${c.name}: HTTP 200 — bad bot reached origin (counter leak)`);
    failed += 1;
    continue;
  }

  if (ok && c.expectLocation) {
    const location = res.headers.get('location') || '';
    if (!location.endsWith(c.expectLocation)) {
      console.log(`FAIL  ${c.name}: HTTP ${res.status} but Location is "${location}"`);
      failed += 1;
      continue;
    }
  }

  const tag = ok ? 'OK' : 'FAIL';
  console.log(`${tag}  ${c.name}: HTTP ${res.status} — ${bodyStart}`);
  if (!ok) failed += 1;
}

if (failed === 0) {
  console.log(`\nPASS — spam blocked at WAF (zero Function invocations)${warned ? `; ${warned} challenge warning(s) from datacenter IP (expected)` : ''}`);
} else {
  console.log(`\nFAIL — ${failed} case(s)${functionLeaks ? `, ${functionLeaks} Function leak(s)` : ''}`);
}
process.exit(failed === 0 ? 0 : 1);

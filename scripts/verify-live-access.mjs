#!/usr/bin/env node
/**
 * Live edge access matrix.
 *
 *   1. Scrapers and Chrome-extension Origin stop at the edge (no Function).
 *   2. Search and social User-Agents, plus ownership files, still answer 200.
 *
 * WAF1 skips search/social on User-Agent alone. A challenge on Bingbot is an
 * outage — do not "fix" it by blocking fake Bingbot.
 */
import { spawnSync } from 'node:child_process';

const SITE = (process.env.SITE_URL || 'https://devsolvev2.com').replace(/\/$/, '');
const K_PATH = '/k/json-validate-json-backend-engineer-debug-production-issue-json-formatter-0';
const INDEXNOW_KEY = '/ee5098cac2284d92b6ee1c9fca52a120.txt';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.109 Safari/537.36';
const FARM_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';
const FARM_EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0';
const FARM_MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';
const FARM_CHROME100_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36';
const CHROME_HEADERS = {
  'sec-ch-ua': '"Chromium";v="144", "Google Chrome";v="144", "Not_A Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-dest': 'document',
  'sec-fetch-user': '?1',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'accept-encoding': 'gzip, deflate, br',
};
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const GOOGLEBOT_SMARTPHONE_UA = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const INSPECTION_UA = 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)';
const BINGBOT_UA = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
const BINGBOT_MODERN_UA = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36';
const MICROSOFT_PREVIEW_UA = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MicrosoftPreview/2.0; +https://aka.ms/MicrosoftPreview) Chrome/100.0.4896.127 Safari/537.36';
const EXTENSION_UA = `${CHROME_UA} chrome-extension://abcdefghijklmnopqrstuvwxyz123456`;

const MUST_BE_STOPPED = [
  ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'],
  ['ClaudeBot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
  ['PerplexityBot', 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'],
  ['Bytespider', 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)'],
  ['AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
  ['SemrushBot', 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'],
  ['curl', 'curl/8.4.0'],
  ['python-requests', 'python-requests/2.31.0'],
  ['empty UA', ''],
  ['chrome-extension scraper UA', EXTENSION_UA],
  ['farm Chrome/144.0.0.0', FARM_CHROME_UA],
  ['farm Edge/144.0.0.0', FARM_EDGE_UA],
  ['farm Mac 10_15_7 Chrome/144.0.0.0', FARM_MAC_UA],
  ['farm Chrome/100.0.4896.75', FARM_CHROME100_UA],
];

const MUST_BE_REACHABLE = [
  { name: 'robots.txt (any client)', path: '/robots.txt' },
  { name: 'IndexNow key file (api.indexnow.org)', path: INDEXNOW_KEY },
  { name: 'ads.txt (ad verification crawlers)', path: '/ads.txt' },
  { name: 'opengraph-image.png (social unfurls)', path: '/opengraph-image.png' },
];

const MUST_BE_CRAWLABLE = [
  { name: 'corpus as Googlebot', path: K_PATH, ua: GOOGLEBOT_UA },
  { name: 'corpus as smartphone Googlebot', path: K_PATH, ua: GOOGLEBOT_SMARTPHONE_UA },
  { name: 'corpus as Google-InspectionTool', path: K_PATH, ua: INSPECTION_UA },
  { name: 'corpus as Bingbot', path: K_PATH, ua: BINGBOT_UA },
  { name: 'corpus as modern Bingbot', path: K_PATH, ua: BINGBOT_MODERN_UA },
  { name: 'corpus as MicrosoftPreview', path: K_PATH, ua: MICROSOFT_PREVIEW_UA },
  { name: 'homepage as Googlebot', path: '/', ua: GOOGLEBOT_UA },
  { name: 'robots.txt as Bingbot', path: '/robots.txt', ua: BINGBOT_UA },
];

const MUST_UNFURL = [
  { name: 'homepage as Twitterbot', path: '/', ua: 'Twitterbot/1.0' },
  { name: 'homepage as LinkedInBot', path: '/', ua: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)' },
  { name: 'homepage as facebookexternalhit', path: '/', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
  { name: 'OG image as Twitterbot', path: '/opengraph-image.png', ua: 'Twitterbot/1.0' },
];

const SHOULD_BE_REACHABLE = [
  { name: 'homepage as real Chrome', path: '/', ua: CHROME_UA, headers: CHROME_HEADERS },
  { name: 'corpus page as real Chrome', path: K_PATH, ua: CHROME_UA, headers: CHROME_HEADERS },
];

let failed = 0;
let warned = 0;
let functionLeaks = 0;

function mitigation(res) {
  return res.headers.get('cf-mitigated') === 'challenge' ? 'challenge' : 'block';
}

async function probe({ path, ua, headers }) {
  const res = await fetch(`${SITE}${path}`, {
    headers: { ...(ua !== undefined ? { 'User-Agent': ua } : {}), ...(headers || {}) },
    redirect: 'manual',
  });
  const body = await res.text();
  return { res, body };
}

function probeHttp2({ path, ua, headers }) {
  const args = ['-sS', '-D', '-', '-o', '/dev/null', '--http2', '-A', ua || 'curl'];
  for (const [name, value] of Object.entries(headers || {})) {
    args.push('-H', `${name}: ${value}`);
  }
  args.push(`${SITE}${path}`);
  const out = spawnSync('curl', args, { encoding: 'utf8' });
  const raw = `${out.stdout || ''}\n${out.stderr || ''}`;
  const status = Number((raw.match(/HTTP\/[\d.]+ (\d+)/) || [])[1] || 0);
  const kind = /cf-mitigated:\s*challenge/i.test(raw) ? 'challenge' : (status === 200 || status === 301 ? 'ok' : 'block');
  return { status, kind };
}

console.log(`[verify-live-access] ${SITE}\n`);

for (const [name, ua] of MUST_BE_STOPPED) {
  const { res, body } = await probe({ path: K_PATH, ua });
  if (body.startsWith('Access Denied')) {
    console.log(`FAIL  ${name}: stopped by the Pages Function (counts an invocation)`);
    failed += 1;
    functionLeaks += 1;
    continue;
  }
  if (res.status === 200) {
    console.log(`FAIL  ${name}: HTTP 200 — reached the corpus`);
    failed += 1;
    continue;
  }
  console.log(`OK    ${name}: HTTP ${res.status} (${mitigation(res)}) at the edge`);
}

{
  const { res, body } = await probe({
    path: K_PATH,
    ua: CHROME_UA,
    headers: { Origin: 'chrome-extension://abcdefghijklmnopqrstuvwxyz123456' },
  });
  if (body.startsWith('Access Denied')) {
    console.log('FAIL  Chrome UA + extension Origin: stopped by the Pages Function');
    failed += 1;
    functionLeaks += 1;
  } else if (res.status === 200) {
    console.log('FAIL  Chrome UA + extension Origin: HTTP 200 — the farm leak');
    failed += 1;
  } else {
    console.log(`OK    Chrome UA + extension Origin: HTTP ${res.status} (${mitigation(res)}) at the edge`);
  }
}

{
  const { status, kind } = probeHttp2({
    path: K_PATH,
    ua: CHROME_UA,
    headers: { ...CHROME_HEADERS, 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' },
  });
  if (status === 200) {
    console.log('FAIL  Chrome fetch() of /k/ (sec-fetch-mode=cors): HTTP 200 — extension scraper');
    failed += 1;
  } else {
    console.log(`OK    Chrome fetch() of /k/ (sec-fetch-mode=cors): HTTP ${status} (${kind})`);
  }
}

{
  const { status, kind } = probeHttp2({
    path: K_PATH,
    ua: FARM_CHROME_UA,
    headers: CHROME_HEADERS,
  });
  if (status === 200) {
    console.log('FAIL  farm Chrome/144.0.0.0 with fake navigate headers: HTTP 200');
    failed += 1;
  } else {
    console.log(`OK    farm Chrome/144.0.0.0 with fake navigate headers: HTTP ${status} (${kind})`);
  }
}

for (const check of MUST_BE_REACHABLE) {
  const { res } = await probe(check);
  if (res.status === 200) {
    console.log(`OK    ${check.name}: HTTP 200`);
    continue;
  }
  console.log(
    `FAIL  ${check.name}: HTTP ${res.status} (${mitigation(res)}) — ownership checks and`
    + ' robots.txt must never be gated. If this is a challenge, Bot Fight Mode is on.',
  );
  failed += 1;
}

for (const check of MUST_BE_CRAWLABLE) {
  const { res, body } = await probe(check);
  if (res.status === 200 && !body.startsWith('Access Denied')) {
    console.log(`OK    ${check.name}: HTTP 200`);
    continue;
  }
  console.log(
    `FAIL  ${check.name}: HTTP ${res.status} (${mitigation(res)}) — search crawlers must`
    + ' never be challenged. WAF1 skips them on User-Agent. Turn Bot Fight Mode OFF.',
  );
  failed += 1;
}

for (const check of MUST_UNFURL) {
  const { res } = await probe(check);
  if (res.status === 200) {
    console.log(`OK    ${check.name}: HTTP 200`);
    continue;
  }
  console.log(`FAIL  ${check.name}: HTTP ${res.status} (${mitigation(res)}) — social cards cannot render`);
  failed += 1;
}

for (const check of SHOULD_BE_REACHABLE) {
  const { status, kind } = probeHttp2(check);
  if (status === 200 || status === 301) {
    console.log(`OK    ${check.name}: HTTP ${status} (HTTP/2 navigate)`);
    continue;
  }
  if (kind === 'challenge') {
    console.log(
      `WARN  ${check.name}: HTTP ${status} challenge — expected from a datacenter IP.`
      + ' A residential browser must not see this.',
    );
    warned += 1;
    continue;
  }
  console.log(`FAIL  ${check.name}: HTTP ${status} blocked (not a challenge) — a human would see this`);
  failed += 1;
}

if (failed === 0) {
  console.log(`\nPASS — scrapers stopped, crawler and social paths open${warned ? `; ${warned} datacenter challenge warning(s)` : ''}`);
} else {
  console.log(`\nFAIL — ${failed} case(s)${functionLeaks ? `, ${functionLeaks} Function leak(s)` : ''}`);
}
process.exit(failed === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * Live edge access matrix.
 *
 * Two questions only:
 *   1. Is every scraper/AI/library agent stopped at the Cloudflare edge, with
 *      zero Pages Function invocations?
 *   2. Is everything a search engine or an ownership check needs still
 *      reachable?
 *
 * IMPORTANT about where this runs. Cloudflare classifies the runner's network,
 * not its intentions: from a datacenter IP (CI, this repo's agents, a VPS) the
 * WAF3 rule issues a managed challenge for every non-crawler request, and Bot
 * Fight Mode — if it is switched on — challenges even more, on a pipeline that
 * WAF skip rules cannot touch. Both are reported as `cf-mitigated: challenge`.
 * So a challenge on a "reachable" case is a WARNING here, not a failure; run it
 * from a residential connection to see the real answer.
 *
 * A "stopped" case, on the other hand, is a hard requirement: if a scraper UA
 * gets HTTP 200, or is stopped by the Function instead of the edge (the body is
 * `Access Denied`), that is a real regression — it means we are paying for it.
 */
const SITE = (process.env.SITE_URL || 'https://devsolvev2.com').replace(/\/$/, '');
const K_PATH = '/k/json-validate-json-backend-engineer-debug-production-issue-json-formatter-0';
const INDEXNOW_KEY = '/ee5098cac2284d92b6ee1c9fca52a120.txt';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const CHROME_HEADERS = {
  'sec-ch-ua': '"Chromium";v="145", "Google Chrome";v="145", "Not_A Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-dest': 'document',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'accept-encoding': 'gzip, deflate, br',
};

/** Agents that must never receive corpus HTML. */
const MUST_BE_STOPPED = [
  ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'],
  ['ClaudeBot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
  ['PerplexityBot', 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'],
  ['meta-externalagent', 'meta-externalagent/1.1'],
  ['Bytespider', 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)'],
  ['CCBot', 'CCBot/2.0 (https://commoncrawl.org/faq/)'],
  ['AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
  ['SemrushBot', 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'],
  ['DataForSeoBot', 'Mozilla/5.0 (compatible; DataForSeoBot/1.0)'],
  ['Screaming Frog', 'Screaming Frog SEO Spider/19.0'],
  ['curl', 'curl/8.4.0'],
  ['wget', 'Wget/1.21.4'],
  ['python-requests', 'python-requests/2.31.0'],
  ['go-http-client', 'Go-http-client/2.0'],
  ['okhttp', 'okhttp/4.12.0'],
  ['node-fetch', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)'],
  ['empty UA', ''],
  // Spoofed crawlers: a real Googlebot/Bingbot is verified by Cloudflare or
  // arrives from a Google/Microsoft network. Neither holds here, so these are
  // the exact requests the anti-spoof clause exists for.
  ['spoofed Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['spoofed Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  // Chromium UA with no Client Hints / Fetch Metadata — the farm signature.
  ['Chrome/145 without Client Hints', CHROME_UA],
  ['Chrome/99 legacy farm UA', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36'],
  ['Wikipedia example Edge/12.246', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'],
];

/** Endpoints that must answer every client, including unverified machines. */
const MUST_BE_REACHABLE = [
  { name: 'robots.txt (any client)', path: '/robots.txt' },
  { name: 'IndexNow key file (api.indexnow.org)', path: INDEXNOW_KEY },
  { name: 'ads.txt (ad verification crawlers)', path: '/ads.txt' },
];

/** Reachable for real people and search engines; datacenter runs get a challenge. */
const SHOULD_BE_REACHABLE = [
  { name: 'homepage as real Chrome', path: '/', ua: CHROME_UA, headers: CHROME_HEADERS },
  { name: 'corpus page as real Chrome', path: K_PATH, ua: CHROME_UA, headers: CHROME_HEADERS },
  { name: 'sitemap index as real Chrome', path: '/sitemap.xml', ua: CHROME_UA, headers: CHROME_HEADERS },
  { name: 'feed.xml as real Chrome', path: '/feed.xml', ua: CHROME_UA, headers: CHROME_HEADERS },
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

console.log(`[verify-live-access] ${SITE}`);
console.log('  A challenge from a datacenter IP is expected. A 200 for a scraper is not.\n');

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

for (const check of MUST_BE_REACHABLE) {
  const { res } = await probe(check);
  if (res.status === 200) {
    console.log(`OK    ${check.name}: HTTP 200`);
    continue;
  }
  console.log(
    `FAIL  ${check.name}: HTTP ${res.status} (${mitigation(res)}) — ownership checks and`
    + ' robots.txt must never be gated. If this is a challenge, Bot Fight Mode is on:'
    + ' turn it off under Security → Settings (it cannot be skipped by WAF rules).',
  );
  failed += 1;
}

for (const check of SHOULD_BE_REACHABLE) {
  const { res } = await probe(check);
  if (res.status === 200 || res.status === 301) {
    console.log(`OK    ${check.name}: HTTP ${res.status}`);
    continue;
  }
  if (mitigation(res) === 'challenge') {
    console.log(
      `WARN  ${check.name}: HTTP ${res.status} challenge — expected from a datacenter IP.`
      + ' If a residential browser sees this too, Bot Fight Mode or Security Level is the cause.',
    );
    warned += 1;
    continue;
  }
  console.log(`FAIL  ${check.name}: HTTP ${res.status} blocked (not a challenge) — a human would see this`);
  failed += 1;
}

if (failed === 0) {
  console.log(`\nPASS — scrapers stopped at the edge, crawler and ownership paths open${warned ? `; ${warned} datacenter challenge warning(s)` : ''}`);
} else {
  console.log(`\nFAIL — ${failed} case(s)${functionLeaks ? `, ${functionLeaks} Function leak(s)` : ''}`);
}
process.exit(failed === 0 ? 0 : 1);

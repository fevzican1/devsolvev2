#!/usr/bin/env node
/**
 * scripts/verify-backlinks.mjs
 * ============================================================================
 * Why a submitted profile is not showing up in Google Search Console → Links or
 * in Bing Webmaster Tools → Backlinks is almost never a mystery: the link has
 * to survive four separate tests, and a profile page usually fails one of them.
 *
 *   1. FETCHABLE   the page answers 200 to a crawler (not 404, not a login wall)
 *   2. SERVER-SIDE the link to devsolvev2.com is in the HTML a crawler receives,
 *                  not injected by JavaScript afterwards
 *   3. INDEXABLE   the page is not noindex, and not blocked in that host's
 *                  robots.txt — an unindexed page's links are not counted
 *   4. FOLLOWED    the link is not rel="nofollow"/"ugc"/"sponsored" (those are
 *                  legitimate and still send referral traffic, but they are why
 *                  a report can stay empty)
 *
 * This script reports which test each declared profile passes, so "why is it
 * not registered" has a factual answer per URL instead of a guess. It does not
 * create links: links on other people's domains are theirs to publish, and
 * buying or faking them is the one thing both rulebooks call out by name.
 *
 * Usage: node scripts/verify-backlinks.mjs [--json]
 */

const SITE_HOST = 'devsolvev2.com';
const TIMEOUT_MS = 20_000;

/**
 * Every URL the site currently claims as a reciprocal profile. Keep in sync
 * with src/lib/seo/organization.ts (BRAND_*): a `sameAs` entry that does not
 * link back is an unverified claim, which is worth less than nothing.
 */
const PROFILES = [
  { url: 'https://github.com/fevzican1/devsolvev2', label: 'GitHub repo (README + About)' },
  { url: 'https://github.com/fevzican1', label: 'GitHub profile' },
  { url: 'https://hashnode.com/@darkpurple38', label: 'Hashnode profile' },
  { url: 'https://dev.to/fevzican_aytekin_17be0651', label: 'dev.to profile' },
  { url: 'https://www.indiehackers.com/darkpurple38', label: 'Indie Hackers profile' },
  { url: 'https://www.producthunt.com/products/devsolve-2?launch=devsolve-v2', label: 'Product Hunt launch' },
  { url: 'https://www.saashub.com/devsolvev2', label: 'SaaSHub listing' },
  { url: 'https://alternativeto.net/software/devsolve/', label: 'AlternativeTo listing (pending)' },
  { url: 'https://launchstag.com', label: 'Launchstag directory (goes live on the 30th)' },
  { url: 'https://tools.cafe', label: 'tools.cafe directory (goes live on the 30th)' },
  { url: 'https://launchbison.com', label: 'Launchbison directory' },
  { url: 'https://x.com/devsolveai', label: 'X profile' },
  { url: 'https://www.linkedin.com/in/fevzican-aytekin-0b5501105', label: 'LinkedIn profile' },
];

const CRAWLER_UA =
  'Mozilla/5.0 (compatible; DevSolveLinkAudit/1.0; +https://devsolvev2.com/about)';

function anchorsTo(html, host) {
  const found = [];
  for (const [, attrs] of html.matchAll(/<a\s+([^>]*?)>/gi)) {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
    if (!href.includes(host)) continue;
    const rel = /rel\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1]?.toLowerCase() ?? '';
    found.push({ href, rel });
  }
  return found;
}

function robotsMeta(html) {
  const tags = [...html.matchAll(/<meta\s+[^>]*name\s*=\s*["'](?:robots|googlebot)["'][^>]*>/gi)]
    .map((m) => (/content\s*=\s*["']([^"']*)["']/i.exec(m[0])?.[1] ?? '').toLowerCase());
  return tags.join(' ');
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': CRAWLER_UA, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const body = res.ok ? await res.text() : '';
    return { status: res.status, body, finalUrl: res.url };
  } catch (error) {
    return { status: 0, body: '', error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

const robotsCache = new Map();
async function robotsAllows(url) {
  const { origin, pathname } = new URL(url);
  if (!robotsCache.has(origin)) {
    const { body } = await fetchText(`${origin}/robots.txt`);
    robotsCache.set(origin, body);
  }
  const robots = robotsCache.get(origin) ?? '';
  // Deliberately simple: only the wildcard group, only literal prefixes. It
  // answers "did the host tell everyone to stay out of this path", which is the
  // case that silently costs a backlink.
  const wildcard = /user-agent:\s*\*([\s\S]*?)(?:\n\s*user-agent:|$)/i.exec(robots)?.[1] ?? '';
  const disallows = [...wildcard.matchAll(/disallow:\s*(\S+)/gi)].map((m) => m[1]);
  const blocked = disallows.find((rule) => rule !== '/' + '\u0000' && rule.length > 1 && pathname.startsWith(rule.replace(/\*$/, '')));
  return { allowed: !blocked, rule: blocked ?? null, hasRobots: Boolean(robots) };
}

const results = [];
for (const profile of PROFILES) {
  const { status, body, error } = await fetchText(profile.url);
  const links = status === 200 ? anchorsTo(body, SITE_HOST) : [];
  const robots = status === 200 ? robotsMeta(body) : '';
  const { allowed, rule } = status === 200 ? await robotsAllows(profile.url) : { allowed: null, rule: null };
  const followed = links.filter((l) => !/(nofollow|ugc|sponsored)/.test(l.rel));

  results.push({
    ...profile,
    status,
    error,
    serverSideLinks: links.length,
    followedLinks: followed.length,
    rels: [...new Set(links.map((l) => l.rel || 'follow'))],
    noindex: /noindex/.test(robots),
    robotsAllowed: allowed,
    robotsRule: rule,
    mentionsHostInText: status === 200 && body.includes(SITE_HOST),
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

function verdict(r) {
  if (r.status === 0) return `unreachable from here (${r.error ?? 'network'})`;
  if (r.status === 404) return 'page does not exist — nothing to count';
  if (r.status === 401 || r.status === 403) return `HTTP ${r.status}: the page is gated, so a crawler sees no link`;
  if (r.status !== 200) return `HTTP ${r.status}`;
  if (r.noindex) return 'page is noindex — its links are not counted';
  if (r.robotsAllowed === false) return `blocked by that host's robots.txt (${r.robotsRule})`;
  if (r.serverSideLinks === 0 && r.mentionsHostInText) return 'host named in the page, but not as a server-side <a href> (JavaScript-rendered)';
  if (r.serverSideLinks === 0) return 'no link to the site in the HTML a crawler receives';
  if (r.followedLinks === 0) return `link present but rel="${r.rels.join(' ')}" — referral traffic yes, backlink report often no`;
  return `${r.followedLinks} followable link(s) — should register once the page is recrawled`;
}

let countable = 0;
console.log('Declared profile → what a crawler actually sees\n');
for (const r of results) {
  const line = verdict(r);
  if (r.followedLinks > 0 && !r.noindex && r.robotsAllowed !== false) countable += 1;
  console.log(`${r.followedLinks > 0 ? 'OK  ' : 'NOTE'} ${r.label}`);
  console.log(`     ${r.url}`);
  console.log(`     ${line}\n`);
}
console.log(`${countable} of ${results.length} declared profiles currently expose a followable, indexable link.`);
console.log('Reports lag crawling: GSC Links and Bing Backlinks update days to weeks after the linking page is recrawled.');

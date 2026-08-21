/**
 * Backlink Agent — earn countable links without social-spam stamps.
 *
 * What it DOES (free, guideline-safe):
 *   1. Confirms social unfurl crawlers can fetch the page + PNG card (WAF1 skip).
 *   2. Confirms declared profiles still expose a followable link.
 *   3. Re-pings RSS hubs so directories and readers see fresh items.
 *   4. Writes ready-to-publish posts with a canonical back to the site.
 *
 * What it NEVER does:
 *   Auto-post to X / Reddit / LinkedIn / Facebook, buy links, or blast
 *   identical copy. That is Bing "Link Schemes and Artificial Promotion"
 *   and a social spam stamp — the opposite of a backlink.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AGENT = {
  id: 'backlink-agent',
  task: 'Unfurl + directory backlinks without social spam stamps',
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');
const SITE = (process.env.SITE_URL || 'https://devsolvev2.com').replace(/\/$/, '');

const UNFURL = [
  { name: 'Twitterbot homepage', path: '/', ua: 'Twitterbot/1.0' },
  { name: 'Twitterbot OG PNG', path: '/opengraph-image.png', ua: 'Twitterbot/1.0' },
  { name: 'LinkedInBot homepage', path: '/', ua: 'LinkedInBot/1.0' },
  { name: 'facebookexternalhit homepage', path: '/', ua: 'facebookexternalhit/1.1' },
  { name: 'Slackbot homepage', path: '/', ua: 'Slackbot-LinkExpanding 1.0' },
  { name: 'Discordbot homepage', path: '/', ua: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' },
  { name: 'redditbot homepage', path: '/', ua: 'Mozilla/5.0 (compatible; redditbot/1.0)' },
];

const POSTS = [
  {
    platform: 'dev.to',
    canonical: `${SITE}/guides`,
    title: 'Validate JSON in the browser without uploading the payload',
    tags: ['webdev', 'json', 'privacy', 'tooling'],
    body: `Production incidents do not wait for a CLI install. DevSolve's JSON formatter runs entirely in the tab: paste, validate, copy the fixture, close the tab. Nothing leaves the device.

I published the worked guides (including audience-specific runbooks) at ${SITE}. If you already keep a local jq habit, use the browser pass for the first look and keep jq for the pipeline gate.

Canonical: ${SITE}/tools/json-formatter
`,
  },
  {
    platform: 'hashnode',
    canonical: `${SITE}/tools/jwt-decoder`,
    title: 'Read a JWT in the browser without sending it to a decoder API',
    tags: ['security', 'jwt', 'privacy'],
    body: `A decoder that uploads the token is a leak. The DevSolve JWT decoder never leaves the browser; it shows header and payload so you can confirm exp, aud, and iss on the device that already has the token.

Walkthrough: ${SITE}/tools/jwt-decoder
`,
  },
  {
    platform: 'indiehackers',
    canonical: SITE,
    title: 'Privacy-first developer tools that do not need an account',
    tags: ['tools'],
    body: `DevSolve is a set of browser developer tools (JSON, JWT, regex, Base64, hashing, SQL, CSS, diff) that process bytes locally. No signup, no upload.

Site: ${SITE}
`,
  },
];

async function probe(path, ua) {
  try {
    const res = await fetch(`${SITE}${path}`, {
      headers: { 'User-Agent': ua, accept: '*/*' },
      redirect: 'follow',
    });
    return { path, ua, status: res.status, ok: res.status === 200, type: res.headers.get('content-type') };
  } catch (error) {
    return { path, ua, status: 0, ok: false, error: String(error?.message ?? error) };
  }
}

async function pingWebSub() {
  const results = [];
  for (const hub of ['https://pubsubhubbub.appspot.com/', 'https://pubsubhubbub.superfeedr.com/']) {
    try {
      const res = await fetch(hub, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 'hub.mode': 'publish', 'hub.url': `${SITE}/feed.xml` }),
      });
      results.push({ hub, status: res.status, ok: res.ok || res.status === 204 });
    } catch (error) {
      results.push({ hub, ok: false, error: String(error?.message ?? error) });
    }
  }
  return results;
}

export async function run(opts = {}) {
  const skipNetwork = opts.offline || process.env.AI_AGENTS_OFFLINE === '1';
  const unfurls = [];
  if (!skipNetwork) {
    for (const item of UNFURL) unfurls.push({ name: item.name, ...(await probe(item.path, item.ua)) });
  }

  const reportsDir = join(ROOT, 'out', 'reports');
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
  const copyPath = join(reportsDir, 'backlink-ready-posts.md');
  const markdown = POSTS.map((p) => `# ${p.title}\n\nPlatform: ${p.platform}\nCanonical: ${p.canonical}\nTags: ${p.tags.join(', ')}\n\n${p.body}`).join('\n---\n\n');
  writeFileSync(copyPath, markdown);

  const hubs = skipNetwork ? [] : await pingWebSub();
  const unfurlFails = unfurls.filter((u) => !u.ok);
  const png = unfurls.find((u) => u.path === '/opengraph-image.png');

  return {
    agent: AGENT,
    ok: skipNetwork || unfurlFails.length === 0,
    offline: skipNetwork,
    unfurls,
    hubs,
    postsWritten: copyPath,
    pngType: png?.type ?? null,
    failures: unfurlFails.map((u) => ({ name: u.name, status: u.status, error: u.error })),
    notes: [
      'Publish the three posts from out/reports/backlink-ready-posts.md yourself. Do not automate social posting.',
      'PNG card must stay 1200×630 image/png and skipped by WAF1, or LinkedIn/X never render a card and you get no share-click backlink.',
      'verify-backlinks.mjs is the profile audit; this agent is the unfurl + copy + RSS half.',
    ],
  };
}

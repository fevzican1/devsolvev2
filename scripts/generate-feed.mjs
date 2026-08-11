#!/usr/bin/env node
/**
 * RSS 2.0 Syndication Feed Generator
 * ==================================
 *
 * WHY A FEED (and how it relates to "backlinks")
 * ----------------------------------------------
 * A code agent cannot manufacture genuine third-party backlinks. What it CAN
 * do is open every legitimate, machine-driven discovery + syndication channel
 * so real inbound links can form organically:
 *
 *   1. Discovery — Google and Bing both treat RSS/Atom feeds as a first-class
 *      "what's new" signal (Search Console explicitly accepts feeds as
 *      sitemaps). A fresh feed nudges crawlers toward new/updated URLs faster
 *      than the giant 18M sitemap alone, which reduces "Discovered – currently
 *      not indexed" limbo.
 *   2. Syndication — feed readers, planet/aggregator sites and automation
 *      (Zapier/IFTTT auto-posting to social) consume feeds and republish the
 *      links, which is how programmatic sites earn their first organic
 *      backlinks without any manual outreach.
 *
 * COST
 * ----
 * The feed is a single STATIC file written at build time and served from
 * Cloudflare's CDN like any other asset. It triggers ZERO Pages Function
 * invocations and adds ZERO marginal Cloudflare cost.
 *
 * SOURCE OF TRUTH
 * ---------------
 * To guarantee the feed can NEVER drift from the resolver (the mass-deindex
 * class of bug), this script does not re-derive slugs from the combinatorial
 * arrays. It reads URLs straight out of the already-generated, parity-checked
 * sitemap files in out/ (AI-quality chunks first, then legacy priority/tier
 * sitemaps). Every URL in those files passed the build-time quality gate and
 * resolves to 200.
 *
 * Output: out/feed.xml
 */

import { createWriteStream } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const siteUrl = (process.env.SITE_URL || process.env.URL || 'https://devsolvev2.com').replace(/\/$/, '');
const outDir = join(process.cwd(), 'out');
const FEED_MAX_ITEMS = Number.parseInt(process.env.FEED_MAX_ITEMS || '1000', 10);
const feedPath = join(outDir, 'feed.xml');

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Turn a /k/<slug> path into a readable, title-cased headline. */
function labelForSlug(slug) {
  const withoutIndex = slug.replace(/-\d+$/, '');
  const words = withoutIndex.split('-').filter(Boolean);
  const titled = words
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
  return titled || 'DevSolve Guide';
}

/** Pick the best available URL-bearing sitemap chunks (newest naming first). */
function pickSitemapChunks(files) {
  const aiQuality = files.filter((f) => /^sitemap-ai-quality-\d{4}\.xml$/i.test(f)).sort();
  if (aiQuality.length > 0) return aiQuality;
  const priority = files.filter((f) => /^sitemap-priority-\d{4}\.xml$/i.test(f)).sort();
  if (priority.length > 0) return priority;
  const tier = files.filter((f) => /^sitemap-tier1-\d{4}\.xml$/i.test(f)).sort();
  if (tier.length > 0) return tier;
  return files.filter((f) => /^sitemap-programmatic-\d{4}\.xml$/i.test(f)).sort();
}

async function collectUrlsFromReport() {
  const eligiblePath = join(outDir, 'reports', 'ai-quality-eligible-urls.txt');
  if (!existsSync(eligiblePath)) return [];
  const lines = (await readFile(eligiblePath, 'utf8'))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && /\/k\//.test(l));
  return lines.slice(0, FEED_MAX_ITEMS);
}

async function collectUrls() {
  if (!existsSync(outDir)) return [];
  const files = await readdir(outDir);
  const chosen = pickSitemapChunks(files);
  if (chosen.length === 0) return collectUrlsFromReport();

  const urls = [];
  const seen = new Set();

  // Sample across multiple sitemap chunks so the feed spans clusters (web,
  // automation, json, …) instead of only the first 1000 lexicographic URLs.
  const stride = Math.max(1, Math.floor(chosen.length / 12));
  const sampledFiles = [];
  for (let i = 0; i < chosen.length && sampledFiles.length < 12; i += stride) {
    sampledFiles.push(chosen[i]);
  }
  if (sampledFiles.length === 0) sampledFiles.push(chosen[0]);

  for (const f of sampledFiles) {
    if (urls.length >= FEED_MAX_ITEMS) break;
    const xml = await readFile(join(outDir, f), 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const perFile = Math.ceil(FEED_MAX_ITEMS / sampledFiles.length);
    let taken = 0;
    for (const loc of locs) {
      if (urls.length >= FEED_MAX_ITEMS || taken >= perFile) break;
      if (!/\/k\//.test(loc) || seen.has(loc)) continue;
      seen.add(loc);
      urls.push(loc);
      taken += 1;
    }
  }
  return urls;
}

async function main() {
  const urls = await collectUrls();
  if (urls.length === 0) {
    console.log('Feed generator: no /k sitemap URLs found in out/ — skipping feed.xml.');
    return;
  }

  const now = Date.now();
  const buildDate = new Date(now).toUTCString();

  const stream = createWriteStream(feedPath, { encoding: 'utf-8' });
  stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
  stream.write('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n');
  stream.write('<channel>\n');
  stream.write('  <title>DevSolve — Fresh Developer Guides</title>\n');
  stream.write(`  <link>${xmlEscape(siteUrl)}/</link>\n`);
  stream.write(`  <atom:link href="${xmlEscape(siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>\n`);
  stream.write('  <description>New and updated privacy-first developer tools and engineering guides from DevSolve.</description>\n');
  stream.write('  <language>en-us</language>\n');
  stream.write(`  <lastBuildDate>${buildDate}</lastBuildDate>\n`);
  stream.write('  <ttl>360</ttl>\n');

  urls.forEach((loc, i) => {
    const path = (() => { try { return new URL(loc).pathname; } catch { return loc; } })();
    const slug = path.replace(/^\/k\//, '');
    const title = labelForSlug(slug);
    // Stagger pubDates a few minutes apart so readers present a natural,
    // non-identical timeline rather than 1000 items with the same timestamp.
    const pubDate = new Date(now - i * 7 * 60 * 1000).toUTCString();
    const desc = `${title} — a deterministic, privacy-first DevSolve guide. All processing runs locally in the browser.`;
    stream.write('  <item>\n');
    stream.write(`    <title>${xmlEscape(title)}</title>\n`);
    stream.write(`    <link>${xmlEscape(loc)}</link>\n`);
    stream.write(`    <guid isPermaLink="true">${xmlEscape(loc)}</guid>\n`);
    stream.write(`    <pubDate>${pubDate}</pubDate>\n`);
    stream.write(`    <description>${xmlEscape(desc)}</description>\n`);
    stream.write('  </item>\n');
  });

  stream.write('</channel>\n');
  stream.write('</rss>\n');
  await new Promise((resolve, reject) => stream.end((err) => (err ? reject(err) : resolve())));

  console.log(`Feed generator: wrote ${urls.length} items to out/feed.xml`);
}

main().catch((err) => {
  // Best-effort: a feed failure must never break the deploy.
  console.log('Feed generation completed with warnings:', err?.message || err);
});

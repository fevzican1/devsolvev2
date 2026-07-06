#!/usr/bin/env node
/**
 * scripts/generate-ai-quality-sitemaps.mjs
 * ============================================================================
 * Builds sitemap chunks (max 40,000 URLs each, per Google's "keep chunks well
 * under the 50k/50MB cap" guidance) containing ONLY the URLs that passed the
 * scripts/ai-quality-gatekeeper.mjs quality gate (score >= 75, see
 * out/reports/ai-quality-eligible-urls.txt), and wires the resulting files
 * into the existing sitemap-index*.xml so Google/Bing discover them through
 * the same index they already crawl.
 *
 * This is intentionally ADDITIVE: it does not touch the existing
 * model-driven sitemap-tier / sitemap-priority chunks produced by
 * scripts/generate-programmatic-sitemaps.mjs. It is a second, independent
 * quality signal derived directly from the rendered HTML rather than the
 * page-generation model, so a page can only ever be MORE conservative
 * (harder to include, easier to exclude) than the model-level gate — never
 * the other way around.
 *
 * Runs entirely at build time against files already in out/ — zero
 * Cloudflare Worker/Function cost.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'out');
const reportsDir = join(outDir, 'reports');
const siteUrl = (process.env.SITE_URL || process.env.URL || 'https://devsolvev2.com').replace(/\/$/, '');
const CHUNK_SIZE = 40_000;
const CONTENT_UPDATED_AT = process.env.SITE_CONTENT_UPDATED_AT || '2026-06-22T00:00:00.000Z';

const eligiblePath = join(reportsDir, 'ai-quality-eligible-urls.txt');

if (!existsSync(eligiblePath)) {
  console.log('[generate-ai-quality-sitemaps] no ai-quality-eligible-urls.txt found — run ai-quality-gatekeeper.mjs first. Skipping.');
  process.exit(0);
}

const urls = readFileSync(eligiblePath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

// Purge any stale ai-quality sitemap chunks from a previous build so a
// shrinking corpus never leaves an orphaned, 404-ing chunk referenced by an
// old sitemap-index entry.
const AI_QUALITY_SITEMAP_RE = /^sitemap-ai-quality-\d{4}\.xml$/i;
if (existsSync(outDir)) {
  for (const file of readdirSync(outDir)) {
    if (AI_QUALITY_SITEMAP_RE.test(file)) {
      rmSync(join(outDir, file), { force: true });
    }
  }
}

function writeChunk(index, chunkUrls) {
  const filename = `sitemap-ai-quality-${String(index).padStart(4, '0')}.xml`;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...chunkUrls.map((u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${CONTENT_UPDATED_AT}</lastmod>\n  </url>`),
    '</urlset>',
    '',
  ];
  writeFileSync(join(outDir, filename), lines.join('\n'), 'utf8');
  return filename;
}

const chunkFiles = [];
if (urls.length === 0) {
  console.log('[generate-ai-quality-sitemaps] 0 AI-quality-eligible URLs — nothing to write.');
} else {
  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunkUrls = urls.slice(i, i + CHUNK_SIZE);
    chunkFiles.push(writeChunk(chunkFiles.length + 1, chunkUrls));
  }
  console.log(`[generate-ai-quality-sitemaps] wrote ${chunkFiles.length} chunk(s) for ${urls.length} AI-quality-eligible URL(s).`);
}

// Wire the new chunks into the existing sitemap-index*.xml (there should be
// exactly one — scripts/generate-programmatic-sitemaps.mjs purges stale ones
// before writing the current SITEMAP_INDEX_NAME).
function findSitemapIndexFile() {
  if (!existsSync(outDir)) return null;
  const candidates = readdirSync(outDir).filter((f) => /^sitemap-index.*\.xml$/i.test(f));
  return candidates[0] || null;
}

const indexFile = findSitemapIndexFile();
if (!indexFile) {
  console.log('[generate-ai-quality-sitemaps] no sitemap-index*.xml found — skipping index wiring (chunks were still written).');
} else if (chunkFiles.length > 0) {
  const indexPath = join(outDir, indexFile);
  const original = readFileSync(indexPath, 'utf8');
  const alreadyWired = chunkFiles.every((f) => original.includes(f));
  if (!alreadyWired) {
    const entries = chunkFiles
      .map((f) => `  <sitemap>\n    <loc>${siteUrl}/${f}</loc>\n    <lastmod>${CONTENT_UPDATED_AT}</lastmod>\n  </sitemap>`)
      .join('\n');
    const updated = original.replace('</sitemapindex>', `${entries}\n</sitemapindex>`);
    writeFileSync(indexPath, updated, 'utf8');
    console.log(`[generate-ai-quality-sitemaps] wired ${chunkFiles.length} chunk(s) into ${indexFile}.`);
  } else {
    console.log(`[generate-ai-quality-sitemaps] ${indexFile} already references all chunks — no change.`);
  }
}

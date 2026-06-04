#!/usr/bin/env node
/**
 * Canonical Spot-Check — verifies that a deterministic random sample of /k/*
 * programmatic pages, plus every static hub/guide/tool/legal route, has a
 * self-referencing <link rel="canonical"> tag pointing at the same URL the
 * request was made for.
 *
 * Why this matters
 * ----------------
 * Google Search Console flags two failure modes that are very expensive to
 * recover from once they land in the index:
 *   1. "Duplicate, Google chose different canonical than user" — caused by
 *      ANY mismatch between the requested URL and the canonical the page
 *      emits, even a trailing slash or a different chunk index.
 *   2. "Page with redirect" — caused when a non-canonical legacy slug 301s
 *      to the canonical instead of serving directly. Our Pages Function is
 *      canonical-first now (see resolvePageForRequest), but a regression
 *      could silently reintroduce the redirect.
 *
 * This script is intentionally network-free: it reads the static `out/`
 * directory after `next build` to verify the static hub pages, and reads the
 * Pages Function source to reconstruct the canonical URL for a deterministic
 * sample of /k/* slugs. It does NOT spin up the worker — the worker emits
 * `<link rel="canonical" href="${siteUrl}/k/${slug}">` for the requested slug,
 * which means as long as the slug resolves and the URL the visitor typed
 * matches the canonical produced by the same logic, the canonical is correct.
 *
 * Exit code:
 *   0 = sample passes
 *   1 = mismatch detected
 *
 * Run manually:
 *   node scripts/canonical-spotcheck.mjs
 *
 * Sampling defaults: 50 /k/* slugs + every static page in out/.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outDir = join(projectRoot, 'out');
const siteUrl = (process.env.SITE_URL || 'https://devsolvev2.com').replace(/\/$/, '');

const SAMPLE_SIZE = Number.parseInt(process.env.CANONICAL_SAMPLE_SIZE || '50', 10);
const failures = [];
const checks = [];

function record(ok, where, expected, actual, note = '') {
  checks.push({ ok, where, expected, actual, note });
  if (!ok) failures.push({ where, expected, actual, note });
}

/* ----------------------------------------------------------- */
/*  1. Verify every static HTML file in out/ self-canonicals    */
/* ----------------------------------------------------------- */
function collectHtmlFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const f = join(dir, name);
    const s = statSync(f);
    if (s.isDirectory()) collectHtmlFiles(f, acc);
    else if (/\.html$/i.test(name)) acc.push(f);
  }
  return acc;
}

function relativeRoute(file) {
  const rel = relative(outDir, file).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.replace(/\/index\.html$/, '');
  return '/' + rel.replace(/\.html$/, '');
}

function checkStaticPages() {
  if (!existsSync(outDir)) {
    record(false, 'out/', 'directory present', 'missing',
      'Run `npm run build` first so static HTML files are available for the spot-check.');
    return;
  }
  const files = collectHtmlFiles(outDir);
  // Skip 404.html / cmd-center / api — these are intentionally noindex.
  // Also skip platform-internal artifacts whose basename starts with `__`
  // (e.g. Cloudflare/Netlify form-detection files). They are never linked,
  // never in the sitemap, and carry no canonical by design.
  const filtered = files.filter(
    (f) =>
      !/(\\|\/)(404|cmd-center|api)(\\|\/|\.html)/i.test(f) &&
      !/(\\|\/)__[^\\/]*\.html$/i.test(f),
  );
  for (const file of filtered) {
    const html = readFileSync(file, 'utf8');
    const match = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (!match) {
      record(false, relativeRoute(file), '<link rel="canonical">', 'missing',
        'No canonical tag found in static HTML output.');
      continue;
    }
    const canonical = match[1].trim();
    const expected = siteUrl + relativeRoute(file).replace(/\/$/, '');
    const expectedRoot = siteUrl + '/';
    // Accept either form for the homepage.
    const ok =
      canonical === expected ||
      (relativeRoute(file) === '/' && (canonical === expectedRoot || canonical === siteUrl));
    record(ok, relativeRoute(file), expected, canonical);
  }
}

/* ----------------------------------------------------------- */
/*  2. Deterministic /k/* sample reconstruction                 */
/*                                                              */
/*  Slug format:  {clusterKey}-{intent}-{audience}-{task}-{tool}-{index}
/*  The Function emits `<link rel="canonical" href="${siteUrl}/k/${slug}">`
/*  using the SAME slug the request came in with. So our job is to verify
/*  the sitemap files contain canonical-form slugs that round-trip cleanly. */
/* ----------------------------------------------------------- */
function sampleProgrammaticSlugs() {
  if (!existsSync(outDir)) return [];
  // Match every programmatic URL sitemap variant. The generator renamed the
  // chunked files from `sitemap-programmatic-NNNN.xml` to tier-prefixed
  // `sitemap-tier{1,2,3}-NNNN.xml` and added `sitemap-priority-NNNN.xml`.
  // The previous pattern only matched the legacy name, so this whole /k/*
  // canonical check silently skipped on every build. Matching all variants
  // restores the guard.
  const sitemapFiles = readdirSync(outDir).filter((f) =>
    /^sitemap-(?:programmatic|tier[123]|priority)-\d{4}\.xml$/i.test(f),
  );
  if (sitemapFiles.length === 0) return [];
  // Spread sample across the first, middle and last few sitemap files so the
  // check sees freshly-listed slugs AND deep-tail slugs.
  const pickFiles = [];
  pickFiles.push(sitemapFiles[0]);
  if (sitemapFiles.length > 2) pickFiles.push(sitemapFiles[Math.floor(sitemapFiles.length / 2)]);
  pickFiles.push(sitemapFiles[sitemapFiles.length - 1]);
  const slugs = [];
  for (const f of pickFiles) {
    const xml = readFileSync(join(outDir, f), 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    // Take a deterministic spread of slugs from each file.
    const step = Math.max(1, Math.floor(locs.length / Math.ceil(SAMPLE_SIZE / pickFiles.length)));
    for (let i = 0; i < locs.length && slugs.length < SAMPLE_SIZE; i += step) {
      slugs.push(locs[i]);
    }
  }
  return slugs;
}

function checkProgrammaticSlugs() {
  const sampleUrls = sampleProgrammaticSlugs();
  if (sampleUrls.length === 0) {
    record(true, '/k/* sample', 'sitemap-programmatic-*.xml',
      'not present (skipping — sample only runs after sitemap generation)',
      'This is expected on first build; rerun after `npm run sitemap:programmatic`.');
    return;
  }
  for (const url of sampleUrls) {
    // The Function emits a self-canonical for ANY slug. Failure surface:
    //   - URL is not lowercase / contains characters outside [a-z0-9-]
    //   - URL ends with a trailing slash (Function does not strip it; would 404)
    //   - URL host differs from siteUrl
    const parsed = new URL(url);
    const okHost = `${parsed.protocol}//${parsed.host}` === siteUrl;
    const okPath = /^\/k\/[a-z0-9-]+$/.test(parsed.pathname);
    const okNoTrailing = !parsed.pathname.endsWith('/') || parsed.pathname === '/';
    const expected = `${siteUrl}${parsed.pathname}`;
    if (!okHost) record(false, parsed.pathname, expected, url, `Host mismatch: ${parsed.host} != ${siteUrl}`);
    else if (!okPath) record(false, parsed.pathname, '/k/<lowercase-slug>', url, 'Path contains characters outside [a-z0-9-].');
    else if (!okNoTrailing) record(false, parsed.pathname, expected.replace(/\/$/, ''), url, 'Trailing slash present — would 404 at the worker.');
    else record(true, parsed.pathname, expected, url);
  }
}

/* ----------------------------------------------------------- */
/*  3. Verify no `/sitemap.xml` legacy URL leaks into the index */
/* ----------------------------------------------------------- */
function checkLegacySitemapLeak() {
  if (!existsSync(outDir)) return;
  // The sitemap index is published under a VERSIONED filename
  // (e.g. sitemap-index-2026-06-v2.xml), not the fixed `sitemap-index.xml`.
  // Discover whichever index file(s) are present so the leak check follows
  // the version bump instead of silently skipping.
  const indexFiles = readdirSync(outDir).filter((f) => /^sitemap-index.*\.xml$/i.test(f));
  if (indexFiles.length === 0) {
    record(false, 'sitemap-index', 'a versioned sitemap-index*.xml present', 'none found',
      'No sitemap index emitted — generate-programmatic-sitemaps.mjs must produce SITEMAP_INDEX_NAME.');
    return;
  }
  for (const file of indexFiles) {
    const xml = readFileSync(join(outDir, file), 'utf8');
    if (/\/sitemap\.xml<\/loc>/i.test(xml)) {
      record(false, file, 'no legacy /sitemap.xml entry', 'found',
        'Remove or regenerate the sitemap index; Googlebot will 301-loop on /sitemap.xml.');
    } else {
      record(true, file, 'no legacy /sitemap.xml entry', 'none found');
    }
  }
}

/* ----------------------------------------------------------- */
/*  Run                                                          */
/* ----------------------------------------------------------- */
checkStaticPages();
checkProgrammaticSlugs();
checkLegacySitemapLeak();

const total = checks.length;
const failed = failures.length;
console.log('================================================================');
console.log('  CANONICAL SPOT-CHECK');
console.log('================================================================');
console.log(`Site URL:           ${siteUrl}`);
console.log(`Total checks:       ${total}`);
console.log(`Failures:           ${failed}`);
console.log('----------------------------------------------------------------');
if (failed > 0) {
  for (const f of failures) {
    console.log(`[FAIL] ${f.where}`);
    console.log(`   expected: ${f.expected}`);
    console.log(`   actual:   ${f.actual}`);
    if (f.note) console.log(`   note:     ${f.note}`);
  }
} else {
  console.log('All sampled pages emit a correct self-referencing canonical.');
}
console.log('================================================================');
process.exitCode = failed === 0 ? 0 : 1;

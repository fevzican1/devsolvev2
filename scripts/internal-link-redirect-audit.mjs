#!/usr/bin/env node
/**
 * Internal Link Redirect Audit ("Kontrol A" — İç Linkleme Kontrolü)
 * ===================================================================
 *
 * Google/Bing keep re-crawling stale "Page with redirect" URLs for as long as
 * something *inside the site itself* still links to them. Sitemaps and the
 * canonical resolver can be perfectly clean while a hub page, a "related
 * guides" widget, or a rotating internal-link block still emits an
 * `<a href="/k/...">` that only resolves via the legacy 301 path — every
 * crawl of that page re-teaches Googlebot/Bingbot the old URL and burns
 * crawl budget that should go to new/updated canonical pages.
 *
 * This guard scans the FINAL STATIC EXPORT (`out/` directory — exactly what
 * ships to the CDN and what bots actually parse) for every internal
 * `/k/<slug>` href and verifies, using the same index math the Pages
 * Function uses (see scripts/lib/programmatic-slug-resolver.mjs), that the
 * link already points straight at its canonical (Slot 0) destination:
 *
 *   - resolves(slug) === true   -> 200 OK, no redirect. Healthy.
 *   - resolves(slug) === false  -> the Function would 301 (or 404) this
 *     link. CRITICAL: crawl-budget waste / mass "Page with redirect" churn.
 *
 * Static, deterministic, network-free — matches the rest of this repo's
 * postbuild guard style (canonical-spotcheck.mjs, slug-parity-check.mjs).
 *
 * Exit code: 0 = every internal /k/* link is already canonical.
 *            1 = at least one internal link still points at a
 *                redirecting/broken legacy URL.
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProgrammaticSlugResolver } from './lib/programmatic-slug-resolver.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outDir = join(projectRoot, 'out');
const functionFile = join(projectRoot, 'functions', 'k', '[[slug]].ts');

const MAX_REPORTED = Number.parseInt(process.env.INTERNAL_LINK_AUDIT_MAX_REPORTED || '50', 10);

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

if (!existsSync(outDir)) {
  console.log('================================================================');
  console.log('  INTERNAL LINK REDIRECT AUDIT');
  console.log('================================================================');
  console.log('out/ not present — run `npm run build` first. Skipping (nothing to scan yet).');
  console.log('================================================================');
  process.exitCode = 0;
  process.exit();
}

const resolver = buildProgrammaticSlugResolver(functionFile);
if (!resolver) {
  console.error('================================================================');
  console.error('  INTERNAL LINK REDIRECT AUDIT');
  console.error('================================================================');
  console.error(`FAILED to parse the combinatorial universe out of ${relative(projectRoot, functionFile)}.`);
  console.error('This guard cannot verify internal links without it — treat as a hard failure.');
  console.error('================================================================');
  process.exitCode = 1;
  process.exit();
}

// Matches quoted hrefs (`href="/k/slug"`) — what Next.js/React always emits
// — and, defensively, unquoted hrefs (`href=/k/slug`), which HTML5 permits
// when the value contains no whitespace.
const HREF_RE = /href=(?:["'](\/k\/[a-z0-9-]+)["']|(\/k\/[a-z0-9-]+)(?=[\s/>]))/gi;

const htmlFiles = collectHtmlFiles(outDir);
// slug -> Set of example source files that link to it (kept small)
const slugSources = new Map();
let totalLinkOccurrences = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  let match;
  HREF_RE.lastIndex = 0;
  while ((match = HREF_RE.exec(html)) !== null) {
    totalLinkOccurrences += 1;
    const path = match[1] || match[2];
    const slug = path.replace(/^\/k\//, '');
    if (!slugSources.has(slug)) slugSources.set(slug, new Set());
    const sources = slugSources.get(slug);
    if (sources.size < 3) sources.add(relative(outDir, file));
  }
}

const uniqueSlugs = [...slugSources.keys()];
const brokenOrRedirecting = [];

for (const slug of uniqueSlugs) {
  if (resolver.resolves(slug)) continue;
  const target = resolver.legacyRedirectTarget(slug);
  brokenOrRedirecting.push({
    slug,
    kind: target ? 'redirect-301' : 'unresolvable-404',
    target,
    sources: [...slugSources.get(slug)],
  });
}

console.log('================================================================');
console.log('  INTERNAL LINK REDIRECT AUDIT (Kontrol A — İç Linkleme)');
console.log('================================================================');
console.log(`HTML files scanned:        ${htmlFiles.length}`);
console.log(`/k/* href occurrences:     ${totalLinkOccurrences}`);
console.log(`Unique /k/* link targets:  ${uniqueSlugs.length}`);
console.log(`Non-canonical (301/404):   ${brokenOrRedirecting.length}`);
console.log('----------------------------------------------------------------');

if (brokenOrRedirecting.length > 0) {
  for (const item of brokenOrRedirecting.slice(0, MAX_REPORTED)) {
    console.log(`[FAIL] /k/${item.slug}`);
    console.log(`   kind:     ${item.kind === 'redirect-301' ? '301 redirect (crawl-budget waste)' : 'does not resolve at all (would 404)'}`);
    if (item.target) console.log(`   should link directly to: /k/${item.target}`);
    console.log(`   found in: ${item.sources.join(', ')}`);
  }
  if (brokenOrRedirecting.length > MAX_REPORTED) {
    console.log(`  ...and ${brokenOrRedirecting.length - MAX_REPORTED} more (see out/reports/internal-link-audit.json).`);
  }
} else {
  console.log('All internal /k/* links already point at their canonical (Slot 0) URL.');
}
console.log('================================================================');

const reportsDir = join(outDir, 'reports');
try { mkdirSync(reportsDir, { recursive: true }); } catch (error) {
  if (error?.code !== 'EEXIST') console.error(`Could not create ${reportsDir}: ${error?.message ?? error}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  htmlFilesScanned: htmlFiles.length,
  linkOccurrences: totalLinkOccurrences,
  uniqueLinkTargets: uniqueSlugs.length,
  nonCanonicalCount: brokenOrRedirecting.length,
  nonCanonicalLinks: brokenOrRedirecting,
};
writeFileSync(join(reportsDir, 'internal-link-audit.json'), JSON.stringify(report, null, 2));
writeFileSync(
  join(reportsDir, 'internal-link-audit.txt'),
  `Internal Link Redirect Audit — ${report.generatedAt}\n` +
    `HTML files scanned: ${htmlFiles.length}\n` +
    `Unique /k/* link targets: ${uniqueSlugs.length}\n` +
    `Non-canonical (301/404): ${brokenOrRedirecting.length}\n\n` +
    brokenOrRedirecting
      .map((i) => `[${i.kind}] /k/${i.slug}${i.target ? ` -> /k/${i.target}` : ''}\n   found in: ${i.sources.join(', ')}`)
      .join('\n\n'),
);
console.log('Reports written: out/reports/internal-link-audit.{json,txt}');

process.exitCode = brokenOrRedirecting.length === 0 ? 0 : 1;

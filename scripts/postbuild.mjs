import { execSync } from 'child_process';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outDir = join(projectRoot, 'out');
const reportsDir = join(outDir, 'reports');

console.log('Starting postbuild tasks...');

// Deterministic, network-free guards whose failure means real content/indexing
// regressions (not flaky external calls) shipped to production. Every check
// below still runs to completion and writes its full report even if an
// earlier one failed, but a failure here is recorded and turns into a
// non-zero postbuild exit code at the end — previously every check in this
// file was wrapped in a try/catch that only logged a warning, so a genuine
// slug-parity drift (mass de-index risk), a sub-90 quality regression, a
// broken meta description, or a real indexability leak could reach
// production silently while the build reported success. Network-dependent
// steps (IndexNow, outbound-link audit) are intentionally excluded — they
// have their own best-effort semantics and must never block a deploy on a
// transient network failure.
const hardFailures = [];

// Remove .next/cache to avoid Cloudflare Pages 25 MiB file size limit
// The static export is already in out/, so the cache is no longer needed
const nextCacheDir = join(projectRoot, '.next', 'cache');
if (existsSync(nextCacheDir)) {
  rmSync(nextCacheDir, { recursive: true, force: true });
  console.log('Removed .next/cache directory (exceeds Cloudflare Pages size limit)');
}

try {
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  console.log('Created reports directory');
} catch (error) {
  console.log('Reports directory already exists or could not be created');
}

try {
  console.log('Generating core sitemap files with next-sitemap...');
  execSync('npm run sitemap:core', { stdio: 'inherit' });
} catch (error) {
  console.log('Core sitemap generation completed with warnings');
}

// AI Quality & Indexing Engine — build-time-only quality gate over the
// ALREADY-EXPORTED static HTML (out/k/**/*.html). Scores every programmatic
// page 0-100 against thin-content / keyword-stuffing / gibberish heuristics,
// auto-heals sub-75 pages in place, and soft-isolates (noindex, still 200)
// any page that still fails — see scripts/ai-quality-gatekeeper.mjs. This is
// SOFT-ISOLATED by design: a content-quality issue must never fail the build
// (hence no push to hardFailures here), it only ever narrows what gets
// submitted for indexing.
try {
  console.log('Running AI Quality Gatekeeper (build-time heuristic scoring + auto-heal)...');
  execSync(`node ${join(__dirname, 'ai-quality-gatekeeper.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('AI Quality Gatekeeper completed with warnings — see out/reports/ai-quality-gatekeeper.txt');
}

try {
  console.log('Generating static sitemap index from quality-approved exported pages...');
  execSync(`node ${join(__dirname, 'generate-ai-quality-sitemaps.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Static quality sitemap generation failed');
  hardFailures.push('generate-ai-quality-sitemaps');
}

// Immediately notify Bing/IndexNow about the small diff of new-or-changed,
// AI-quality-approved URLs for this build. Zero Cloudflare Worker cost,
// best-effort (never blocks the deploy).
try {
  console.log('Submitting new/changed AI-quality-approved URLs to IndexNow...');
  execSync(`node ${join(__dirname, 'ai-quality-indexnow-submit.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('AI-quality IndexNow submission completed with warnings');
}

try {
  console.log('Running canonical spot-check on generated sitemaps...');
  execSync(`node ${join(__dirname, 'canonical-spotcheck.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Canonical spot-check reported issues — see logs above');
  hardFailures.push('canonical-spotcheck');
}

try {
  console.log('Running matrix quality check (348 tool×intent seed pairs)...');
  execSync(`node ${join(__dirname, 'matrix-quality-check.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Matrix quality check failed — see out/reports/matrix-quality.txt');
  hardFailures.push('matrix-quality-check');
}

// "Kontrol A" — application-wide internal-link audit verifies every internal
// /k/* href has a matching exported HTML file.
try {
  console.log('Running static internal link audit (crawl-budget guard)...');
  execSync(`node ${join(__dirname, 'internal-link-redirect-audit.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Static internal link audit found unexported links — see out/reports/internal-link-audit.txt');
  hardFailures.push('internal-link-redirect-audit');
}

try {
  console.log('Running quality corpus audit (90-point enforcement)...');
  execSync(`node --import tsx ${join(__dirname, 'quality-corpus-audit.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Quality corpus audit FAILED — pages below 90 detected');
  hardFailures.push('quality-corpus-audit');
}

try {
  console.log('Generating quality report...');
  execSync(`node ${join(__dirname, 'quality-report.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Quality report generation completed with warnings');
}

try {
  console.log('Checking outbound links...');
  execSync(`node ${join(__dirname, 'check-outbound-links.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Outbound link check completed with warnings');
}

try {
  console.log('Running forbidden terms scan...');
  execSync(`node ${join(__dirname, 'forbidden-scan.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Forbidden scan completed with warnings');
}

try {
  console.log('Running indexability audit...');
  execSync(`node ${join(__dirname, 'indexability-audit.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Indexability audit reported critical issues — see out/reports/indexability.txt');
  hardFailures.push('indexability-audit');
}

// IndexNow ping runs LAST — only after the canonical spot-check and slug-parity
// guards above have validated the sitemaps. It notifies Bing / DuckDuckGo (and
// every IndexNow engine) INCREMENTALLY: small, paced batches and a rolling daily
// slice rather than a bulk dump, per Bing's "avoid bulk submission mode"
// guidance (prevents origin crawl spikes + indexing delays). It talks directly
// to api.indexnow.org, so it incurs ZERO Cloudflare Worker cost. Best-effort:
// a failure here never breaks the deploy (set INDEXNOW_DISABLED=1 to skip, or
// INDEXNOW_DRY_RUN=1 to scan without sending).
try {
  console.log('Pinging IndexNow (Bing / DuckDuckGo) — incremental rolling slice...');
  execSync(`node ${join(__dirname, 'indexnow-ping.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('IndexNow ping completed with warnings — see logs above');
}

try {
  console.log('Verifying SEO meta description lengths...');
  execSync(`node --import tsx ${join(__dirname, 'verify-seo-descriptions.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('SEO description verification failed — see logs above');
  hardFailures.push('verify-seo-descriptions');
}

try {
  console.log('Scanning exported HTML for short meta descriptions...');
  execSync(`node ${join(__dirname, 'scan-out-meta-descriptions.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Meta description scan reported issues — see out/reports/meta-descriptions.txt');
}

if (hardFailures.length > 0) {
  console.error(`Postbuild tasks completed WITH CRITICAL FAILURES: ${hardFailures.join(', ')}`);
  console.error('Fix the reported issues before deploying — see the logs/reports above for each check.');
  process.exit(1);
}

console.log('Postbuild tasks completed!');

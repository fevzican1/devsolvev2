#!/usr/bin/env node
/**
 * scripts/ai-quality-gatekeeper.mjs
 * ============================================================================
 * Build-Time AI Quality & Indexing Engine — "Gatekeeper" stage.
 *
 * WHAT THIS IS
 * ------------
 * A zero-runtime-cost quality gate that runs AFTER `next build` has already
 * produced static HTML under out/ and BEFORE the deploy artifact is
 * uploaded to Cloudflare Pages. It never runs at request time, never invokes
 * a Cloudflare Pages/Workers Function, and never calls an external AI API —
 * every check is plain heuristic analysis over files already on disk, so it
 * costs nothing beyond a few build-minutes of CPU.
 *
 * WHAT IT DOES
 * ------------
 *   1. Scans every exported programmatic page under out/k/ (recursively),
 *      scores it 0–100 against Google Helpful Content heuristics (thin
 *      content, keyword stuffing / gibberish, structural completeness) and
 *      audits it against the cited Bing/Google rulebook in
 *      scripts/lib/search-guidelines.mjs.
 *   2. AUTO-REPAIR: metadata outside the guideline window is rewritten in
 *      place — a title over Bing's 70-character limit is shortened at a word
 *      boundary, a meta description outside 150–160 characters is extended or
 *      trimmed — and pages that still score below the 75-point gate get a
 *      deterministic supplemental-content block injected (same input → same
 *      output, so it never introduces build-to-build drift) and are re-scored.
 *   3. SOFT ISOLATION: pages that still fail after healing are marked
 *      `<meta name="robots" content="noindex,follow">` IN PLACE. The file is
 *      NOT deleted and the build is NOT failed — the page still returns a
 *      real 200 to bots and users, it is simply excluded from sitemaps,
 *      IndexNow, and search indexing until it earns its way back above the
 *      gate on a future build.
 *   4. Writes a manifest (out/reports/ai-quality-gatekeeper.json/.txt) and a
 *      plain list of gate-eligible URLs (out/reports/ai-quality-eligible-urls.txt)
 *      consumed by scripts/generate-ai-quality-sitemaps.mjs.
 *   5. Diffs the eligible URL set against a small git-tracked state file
 *      (.ai-quality-state.json) to detect NEW or CHANGED (content-hash)
 *      URLs since the last build, and writes them to
 *      out/reports/ai-quality-new-urls.txt for scripts/ai-quality-indexnow-submit.mjs.
 *
 * This script is designed to be SOFT-ISOLATED at the postbuild level: a
 * scoring failure for an individual page never throws, and the script itself
 * exits 0 even when pages are excluded — see scripts/postbuild.mjs, which
 * treats this step as best-effort so a content-quality issue never blocks a
 * deploy. It only exits non-zero for genuine operational errors (e.g. out/
 * missing entirely).
 *
 * CONFIGURATION (env overrides)
 * ------------------------------
 *   AI_GATEKEEPER_SCAN_DIR   Directory under out/ to scan (default: k)
 *   AI_GATEKEEPER_DISABLED=1 Skip entirely (rare — e.g. debugging a build)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  scorePage,
  buildHealBlock,
  injectHealBlock,
  markNoindex,
  isNoindex,
  extractCanonicalUrl,
  repairMetadata,
  MIN_GATE_SCORE,
} from './lib/ai-quality-scoring.mjs';
import { guidelineDigest } from './lib/search-guidelines.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outDir = join(projectRoot, 'out');
const reportsDir = join(outDir, 'reports');
const scanSubdir = process.env.AI_GATEKEEPER_SCAN_DIR || 'k';
const scanDir = join(outDir, scanSubdir);
const statePath = join(projectRoot, '.ai-quality-state.json');

if (process.env.AI_GATEKEEPER_DISABLED === '1' || process.env.AI_GATEKEEPER_DISABLED === 'true') {
  console.log('[ai-quality-gatekeeper] disabled via AI_GATEKEEPER_DISABLED — skipping.');
  process.exit(0);
}

if (!existsSync(outDir)) {
  console.error('[ai-quality-gatekeeper] out/ missing — run the build first.');
  process.exit(1);
}

function listHtmlFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) listHtmlFiles(full, acc);
    else if (/\.html$/i.test(name)) acc.push(full);
  }
  return acc;
}

function loadState() {
  if (!existsSync(statePath)) return { urls: {} };
  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf8'));
    return parsed && typeof parsed === 'object' && parsed.urls ? parsed : { urls: {} };
  } catch {
    return { urls: {} };
  }
}

function contentHash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

if (!existsSync(scanDir)) {
  console.log(`[ai-quality-gatekeeper] scan dir out/${scanSubdir} not present — nothing to gate. Skipping.`);
  process.exit(0);
}

const files = listHtmlFiles(scanDir);
console.log(`[ai-quality-gatekeeper] scanning ${files.length} exported page(s) under out/${scanSubdir}/ ...`);

const eligible = [];
const healed = [];
const repaired = [];
const excluded = [];
const alreadyNoindex = [];
const violationCounts = new Map();
let filesModified = 0;

for (const file of files) {
  const rel = relative(outDir, file).replace(/\\/g, '/');
  const originalHtml = readFileSync(file, 'utf8');

  if (isNoindex(originalHtml)) {
    // Already excluded upstream (e.g. hub/utility page) — leave untouched,
    // don't count it against the corpus.
    alreadyNoindex.push(rel);
    continue;
  }

  // Metadata repair runs first: it is cheap, deterministic, and fixes the
  // exact defects Bing Webmaster Tools reports (long titles, short meta
  // descriptions) before the page is scored.
  const metadata = repairMetadata(originalHtml);
  let html = metadata.html;
  if (metadata.repairs.length > 0) {
    repaired.push({ rel, repairs: metadata.repairs });
  }

  let result = scorePage(html, { profile: 'static', expectedCanonical: extractCanonicalUrl(html) ?? undefined });
  for (const violation of result.guidelines.violations) {
    violationCounts.set(violation.id, (violationCounts.get(violation.id) || 0) + 1);
  }
  let wasHealed = false;

  if (!result.passesGate) {
    const canonical = extractCanonicalUrl(html);
    const slug = canonical ? canonical.split('/').pop() : rel.replace(/\.html$/, '').replace(/\//g, '-');
    const block = buildHealBlock(slug || rel);
    const candidateHtml = injectHealBlock(html, block);
    const candidateResult = scorePage(candidateHtml, { profile: 'static', expectedCanonical: canonical ?? undefined });
    if (candidateResult.score > result.score) {
      html = candidateHtml;
      result = candidateResult;
      wasHealed = true;
    }
  }

  const canonicalUrl = extractCanonicalUrl(html);

  if (result.passesGate) {
    if (wasHealed || metadata.repairs.length > 0) {
      writeFileSync(file, html, 'utf8');
      filesModified += 1;
      if (wasHealed) healed.push({ rel, url: canonicalUrl, score: result.score });
    }
    if (canonicalUrl) {
      eligible.push({ rel, url: canonicalUrl, score: result.score, hash: contentHash(html) });
    }
  } else {
    const isolatedHtml = markNoindex(html);
    writeFileSync(file, isolatedHtml, 'utf8');
    filesModified += 1;
    excluded.push({
      rel,
      url: canonicalUrl,
      score: result.score,
      wordCount: result.wordCount,
      breakdown: result.breakdown,
      issues: result.details.gibberishIssues,
      violations: result.violations,
      attemptedHeal: wasHealed,
    });
  }
}

// ---------------------------------------------------------------------------
// New/changed URL detection (for IndexNow) via a small git-tracked state file.
// ---------------------------------------------------------------------------
const state = loadState();
const previousUrls = state.urls || {};
const nextUrls = {};
const newOrChangedUrls = [];

for (const page of eligible) {
  if (!page.url) continue;
  nextUrls[page.url] = page.hash;
  const prevHash = previousUrls[page.url];
  if (prevHash !== page.hash) {
    newOrChangedUrls.push(page.url);
  }
}

writeFileSync(statePath, JSON.stringify({ generated: new Date().toISOString(), urls: nextUrls }, null, 2));

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

const manifest = {
  generated: new Date().toISOString(),
  gateThreshold: MIN_GATE_SCORE,
  rulebook: guidelineDigest(),
  scanned: files.length,
  alreadyNoindex: alreadyNoindex.length,
  eligible: eligible.length,
  healed: healed.length,
  metadataRepaired: repaired.length,
  excluded: excluded.length,
  filesModified,
  newOrChangedUrlCount: newOrChangedUrls.length,
  guidelineViolationCounts: Object.fromEntries(violationCounts),
  excludedSamples: excluded.slice(0, 50),
  healedSamples: healed.slice(0, 50),
  repairedSamples: repaired.slice(0, 50),
};

writeFileSync(join(reportsDir, 'ai-quality-gatekeeper.json'), JSON.stringify(manifest, null, 2));

writeFileSync(
  join(reportsDir, 'ai-quality-eligible-urls.txt'),
  eligible.map((p) => p.url).filter(Boolean).join('\n') + (eligible.length ? '\n' : ''),
);

writeFileSync(
  join(reportsDir, 'ai-quality-new-urls.txt'),
  newOrChangedUrls.join('\n') + (newOrChangedUrls.length ? '\n' : ''),
);

const summaryText = `AI Quality & Indexing Engine — Gatekeeper Report
Generated: ${manifest.generated}
Gate threshold: ${MIN_GATE_SCORE}/100
Scan directory: out/${scanSubdir}/

Scanned:            ${manifest.scanned}
Already noindex:    ${manifest.alreadyNoindex}
Eligible (>= ${MIN_GATE_SCORE}):    ${manifest.eligible}
Metadata repaired:  ${manifest.metadataRepaired}
Auto-healed:        ${manifest.healed}
Soft-isolated:      ${manifest.excluded}
New/changed URLs:   ${manifest.newOrChangedUrlCount}

Guideline violations remaining (scripts/lib/search-guidelines.mjs):
${violationCounts.size === 0 ? '  none' : [...violationCounts].map(([id, n]) => `  ${id}: ${n}`).join('\n')}

${manifest.excluded === 0
  ? 'PASS — every scanned page meets the AI quality gate (soft-isolation not needed).'
  : `${manifest.excluded} page(s) marked noindex,follow — still return 200, excluded from sitemaps/IndexNow until they pass a future build.`}
`;

writeFileSync(join(reportsDir, 'ai-quality-gatekeeper.txt'), summaryText);
console.log(summaryText);

// Soft-isolation by design: quality failures never fail the build.
process.exit(0);

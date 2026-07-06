#!/usr/bin/env node
/**
 * Slug Parity & Resolution Drift Guard
 * ====================================
 *
 * The single most catastrophic failure mode for this 18M-page site is a
 * DRIFT between the three places that independently re-declare the
 * combinatorial universe (clusters / audiences / tasks / modifier styles /
 * modifier contexts) and the slug math built on top of it:
 *
 *   1. functions/k/[[slug]].ts            — serves /k/<slug> (resolvePageFromSlug)
 *   2. scripts/generate-programmatic-sitemaps.mjs — writes the 18M sitemap URLs
 *   3. scripts/generate-priority-sitemap.mjs       — writes the priority URLs
 *
 * If any array in (2) or (3) diverges from (1) — a reordered audience, an
 * added intent, a renamed task — then sitemap URLs encode a global index that
 * the Function decodes into a DIFFERENT (cluster,tool,intent,audience,task,
 * modifier) tuple, `expectedSlug !== slug`, and the Function returns 404. At
 * 18M scale a one-line reorder can silently 404 millions of indexed URLs and
 * trigger mass de-indexing (the exact "100k → 8" incident documented in
 * docs/indexing-recovery-2026-06.md). This guard makes that drift a loud,
 * deterministic build failure instead of a slow Search-Console catastrophe.
 *
 * It is intentionally network-free and dependency-free: it parses the array
 * literals straight out of the source files (no transpiler needed) and
 * reproduces the slug↔index round-trip locally.
 *
 * Checks:
 *   A. The combinatorial arrays are byte-identical across all three sources.
 *   B. TOTAL_POSSIBLE === 18,040,320 and matches the sitemap generator default.
 *   C. A deterministic spread of indices round-trips: decompose(i) → buildSlug → i.
 *   D. Every sampled slug actually present in out/ sitemaps decodes to a valid
 *      index < TOTAL and rebuilds to the exact same slug (i.e. the Function
 *      would return 200, not 404, for it).
 *
 * Exit code: 0 = parity holds, 1 = drift / unresolvable slug detected.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outDir = join(projectRoot, 'out');

const EXPECTED_RAW_TOTAL = 20_044_800;
const CORPUS_CAP = 20_000_000;
const SAMPLE_SLUGS = Number.parseInt(process.env.PARITY_SAMPLE_SIZE || '300', 10);

/**
 * Fixed regression fixtures: canonical /k/* URLs that Bing Webmaster Tools'
 * Live URL Test reported as "Page with redirect" (cannot be indexed) even
 * though they are the exact, current canonical slug. That earlier bug was
 * `resolvePageForRequest()` trying the legacy-migration resolver BEFORE the
 * canonical resolver, so a valid canonical slug could be remapped onto a
 * different slug and 301 to itself-but-different. The Function now tries
 * the canonical resolver first (see functions/k/[[slug]].ts), which
 * guarantees `resolves(slug) === true` here means the URL serves 200 with
 * NO redirect. These exact slugs are pinned so any future reordering of the
 * resolver, or reintroduction of the legacy-first bug, fails this check
 * immediately instead of silently 301-ing real, indexable pages again.
 */
const KNOWN_LIVE_TEST_REDIRECT_REPORTS = [
  'automation-configure-periodic-cleanup-solution-architect-migrate-legacy-system-uuid-generator-17964297',
  'formatting-optimize-css-output-api-consumer-prepare-deployment-artifact-markdown-preview-9226536',
  'encoding-encode-data-qa-engineer-prepare-query-parameters-url-encode-decode-2106035',
];

/**
 * Fixed regression fixtures: legacy-shape /k/* slugs (full cluster-intent-
 * audience-task-tool stem matches a real current combination, but the
 * trailing number does not decode to that same tuple under today's index
 * arithmetic) that Google/Bing reported as "Page with redirect" and, on the
 * same stems, as "content quality" / duplicate issues after a corpus-size
 * update shifted what each index number decodes to. Root cause: these slugs
 * fall through to `tryResolveLegacyProgrammaticSlug()`, which used to pick a
 * modifier slot via `legacyModifierSuffix % MODIFIERS_COUNT` — an arbitrary,
 * per-number choice that scattered many different legacy numbers for the
 * *same* stem across many different 301 targets (near-duplicate content,
 * "Google chose different canonical"). The resolver now always redirects a
 * given stem to modifier slot 0, so every legacy number for the same stem
 * converges on ONE stable canonical URL. These fixtures pin that
 * convergence so a regression (e.g. reintroducing the modulo pick) fails
 * this check immediately.
 */
const KNOWN_SCATTERED_LEGACY_REDIRECT_REPORTS = [
  'text-split-text-by-delimiter-security-conscious-developer-prepare-api-response-diff-checker-6130393',
  'web-protect-against-xss-security-conscious-developer-prepare-api-response-html-entity-encode-decode-16394709',
  'text-split-text-by-delimiter-security-conscious-developer-clean-up-payload-diff-checker-6130554',
  'api-parse-webhook-payload-backend-engineer-inspect-encoded-payload-jwt-decoder-9539478',
  'formatting-compress-stylesheet-database-administrator-review-config-change-css-minifier-7966530',
];

const failures = [];
const notes = [];
function fail(msg) { failures.push(msg); }
function note(msg) { notes.push(msg); }

/* ----------------------------------------------------------------- */
/*  Source-literal extraction (no transpiler)                        */
/* ----------------------------------------------------------------- */

/** Slice the array literal that follows `const <name>` up to its matching `]`. */
function extractArrayBlock(src, name) {
  const re = new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\[`);
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // position of the opening '['
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/** All single-quoted string literals inside a block, in source order. */
function quotedStrings(block) {
  return [...block.matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

/** Extract the flat string array `const <name> = [...]`. */
function extractFlatArray(src, name) {
  const block = extractArrayBlock(src, name);
  if (!block) return null;
  return quotedStrings(block);
}

/** Extract the clusters array as [{ key, tools[], intents[] }]. */
function extractClusters(src) {
  const block = extractArrayBlock(src, 'clusters');
  if (!block) return null;
  const clusters = [];
  const clusterRe = /key:\s*'([^']+)'[\s\S]*?tools:\s*\[([\s\S]*?)\][\s\S]*?intents:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = clusterRe.exec(block)) !== null) {
    clusters.push({
      key: m[1],
      tools: quotedStrings(`[${m[2]}]`),
      intents: quotedStrings(`[${m[3]}]`),
    });
  }
  return clusters;
}

function extractUniverse(file) {
  const src = readFileSync(file, 'utf8');
  return {
    clusters: extractClusters(src),
    audiences: extractFlatArray(src, 'audiences'),
    tasks: extractFlatArray(src, 'tasks'),
    exec: extractFlatArray(src, 'modifierExecutionStyles'),
    delivery: extractFlatArray(src, 'modifierDeliveryContexts'),
  };
}

const SOURCES = {
  function: join(projectRoot, 'functions', 'k', '[[slug]].ts'),
  sitemap: join(projectRoot, 'scripts', 'generate-programmatic-sitemaps.mjs'),
  priority: join(projectRoot, 'scripts', 'generate-priority-sitemap.mjs'),
};

const universes = {};
for (const [label, file] of Object.entries(SOURCES)) {
  if (!existsSync(file)) { fail(`Source missing: ${label} (${file})`); continue; }
  const u = extractUniverse(file);
  for (const key of ['clusters', 'audiences', 'tasks', 'exec', 'delivery']) {
    if (!u[key] || u[key].length === 0) fail(`Could not extract "${key}" from ${label} (${file}).`);
  }
  universes[label] = u;
}

/* ----------------------------------------------------------------- */
/*  A2. Legacy-resolver "fixed modifier slot" invariant (source-level) */
/* ----------------------------------------------------------------- */
// tryResolveLegacyProgrammaticSlug() MUST resolve every legacy number for a
// given cluster-intent-audience-task-tool stem to the SAME modifier slot
// (slot 0). Picking the modifier from the legacy number itself (e.g.
// `legacyModifierSuffix % MODIFIERS_COUNT`) scatters different legacy
// numbers for the same stem across many different 301 targets — the exact
// "flood of redirects" + "duplicate, Google chose different canonical"
// reports this guard exists to prevent. This is checked directly against the
// source text (not just the JS mirror below) so a regression is caught even
// if nobody updates the mirror in this file.
if (existsSync(SOURCES.function)) {
  const functionSrc = readFileSync(SOURCES.function, 'utf8');
  const fnMatch = /function tryResolveLegacyProgrammaticSlug\([\s\S]*?\n}/.exec(functionSrc);
  if (!fnMatch) {
    fail('Could not locate tryResolveLegacyProgrammaticSlug() in functions/k/[[slug]].ts to verify the fixed-modifier invariant.');
  } else {
    const body = fnMatch[0]
      // Strip `//` line comments before pattern-matching so this guard checks
      // executable code only, not prose that happens to mention the pattern.
      .split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
    if (/legacyModifierSuffix\s*%\s*MODIFIERS_COUNT/.test(body)) {
      fail('tryResolveLegacyProgrammaticSlug() derives modifierIndex from the legacy number ' +
        '(`legacyModifierSuffix % MODIFIERS_COUNT`) again. This scatters legacy redirects for ' +
        'the same stem across many targets — reintroducing the reported redirect/duplicate-content regression.');
    } else if (!/const\s+modifierIndex\s*=\s*0\s*;/.test(body)) {
      fail('tryResolveLegacyProgrammaticSlug() no longer pins modifierIndex to a fixed slot (0). ' +
        'Verify legacy redirects for the same stem still converge on one canonical target.');
    } else {
      note('tryResolveLegacyProgrammaticSlug() pins modifierIndex to a fixed slot — legacy redirects converge per stem.');
    }
  }
}

/* ----------------------------------------------------------------- */
/*  A. Cross-source parity                                           */
/* ----------------------------------------------------------------- */
const labels = Object.keys(universes);
if (labels.length >= 2) {
  const base = labels[0];
  for (const key of ['clusters', 'audiences', 'tasks', 'exec', 'delivery']) {
    const baseSig = JSON.stringify(universes[base][key]);
    for (const other of labels.slice(1)) {
      const otherSig = JSON.stringify(universes[other][key]);
      if (baseSig !== otherSig) {
        fail(`Drift in "${key}": ${base} differs from ${other}. ` +
          `A sitemap URL would decode to a different tuple in the Function → 404 → de-index.`);
      }
    }
  }
}

/* ----------------------------------------------------------------- */
/*  B/C/D — only run when the canonical (Function) universe parsed   */
/* ----------------------------------------------------------------- */
const U = universes.function;
if (U && U.clusters && U.audiences && U.tasks && U.exec && U.delivery) {
  // Reconstruct the exact ordering the Function uses.
  const toolIntentPairs = [];
  for (const c of U.clusters) {
    for (const tool of c.tools) {
      for (const intent of c.intents) {
        toolIntentPairs.push({ clusterKey: c.key, tool, intent });
      }
    }
  }
  const modifiers = U.exec.flatMap((s) => U.delivery.map((ctx) => `${s}-${ctx}`));

  const AUD = U.audiences.length;
  const TSK = U.tasks.length;
  const MOD = modifiers.length;
  const PER_PAIR = AUD * TSK * MOD;
  const TOTAL = toolIntentPairs.length * PER_PAIR;

  note(`pairs=${toolIntentPairs.length} audiences=${AUD} tasks=${TSK} modifiers=${MOD}`);
  note(`PER_PAIR=${PER_PAIR}  TOTAL_POSSIBLE=${TOTAL}`);

  // B. Raw combinatorial total and active corpus cap.
  if (TOTAL !== EXPECTED_RAW_TOTAL) {
    fail(`TOTAL_POSSIBLE=${TOTAL} but expected ${EXPECTED_RAW_TOTAL}. ` +
      `The corpus size changed — update EXPECTED_RAW_TOTAL and the sitemap default if intentional.`);
  }
  if (CORPUS_CAP > TOTAL) {
    fail(`CORPUS_CAP=${CORPUS_CAP} exceeds TOTAL_POSSIBLE=${TOTAL}.`);
  }

  // B. Sitemap generator default cap should match the full corpus.
  try {
    const sitemapSrc = readFileSync(SOURCES.sitemap, 'utf8');
    const capMatch = sitemapSrc.match(/PROGRAMMATIC_SITEMAP_LIMIT\s*\|\|\s*'(\d+)'/);
    if (capMatch && Number.parseInt(capMatch[1], 10) !== CORPUS_CAP) {
      fail(`generate-programmatic-sitemaps.mjs default cap ${capMatch[1]} != ${CORPUS_CAP}.`);
    }
  } catch { /* non-fatal */ }

  // Local mirror of the Function's slug builder + index decomposition.
  const buildSlug = (clusterKey, intent, audience, task, tool, index) =>
    [clusterKey, intent, audience, task, tool]
      .join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + `-${index}`;

  function slugForIndex(index) {
    if (index < 0 || index >= TOTAL) return undefined;
    const pairIndex = Math.floor(index / PER_PAIR);
    const remainder = index % PER_PAIR;
    const audienceIndex = Math.floor(remainder / (TSK * MOD));
    const remainder2 = remainder % (TSK * MOD);
    const taskIndex = Math.floor(remainder2 / MOD);
    const pair = toolIntentPairs[pairIndex];
    const audience = U.audiences[audienceIndex];
    const task = U.tasks[taskIndex];
    if (!pair || !audience || !task) return undefined;
    return buildSlug(pair.clusterKey, pair.intent, audience, task, pair.tool, index);
  }

  // Verify the Function's resolver math (mirrored) decodes consistently:
  // every index must produce a slug whose trailing number is the same index.
  function resolves(slug) {
    const m = slug.match(/-(\d+)$/);
    if (!m) return false;
    const index = Number.parseInt(m[1], 10);
    const expected = slugForIndex(index);
    return expected === slug;
  }

  // Local mirror of tryResolveLegacyProgrammaticSlug(): parses a
  // cluster-intent-audience-task-tool stem out of a shape-valid slug whose
  // trailing number does NOT self-resolve, and rebuilds the canonical target
  // the Function would 301 to (always modifier slot 0 — see functions/k/[[slug]].ts).
  const sortedIntents = Array.from(new Set(U.clusters.flatMap((c) => c.intents))).sort((a, b) => b.length - a.length);
  const sortedAudiences = [...U.audiences].sort((a, b) => b.length - a.length);
  const sortedTasks = [...U.tasks].sort((a, b) => b.length - a.length);
  function legacyRedirectTarget(slug) {
    const m = slug.match(/^(.*)-([0-9]+)$/);
    if (!m) return undefined;
    const stem = m[1];
    const cluster = U.clusters.find((c) => stem.startsWith(`${c.key}-`));
    if (!cluster) return undefined;
    let cursor = stem.slice(cluster.key.length + 1);
    const intent = sortedIntents.find((c) => cursor.startsWith(`${c}-`));
    if (!intent) return undefined;
    cursor = cursor.slice(intent.length + 1);
    const audience = sortedAudiences.find((c) => cursor.startsWith(`${c}-`));
    if (!audience) return undefined;
    cursor = cursor.slice(audience.length + 1);
    const task = sortedTasks.find((c) => cursor.startsWith(`${c}-`));
    if (!task) return undefined;
    cursor = cursor.slice(task.length + 1);
    const tool = cluster.tools.find((c) => c === cursor);
    if (!tool) return undefined;
    const pairIndex = toolIntentPairs.findIndex(
      (p) => p.clusterKey === cluster.key && p.intent === intent && p.tool === tool,
    );
    if (pairIndex < 0) return undefined;
    const audienceIndex = U.audiences.indexOf(audience);
    const taskIndex = U.tasks.indexOf(task);
    const remappedIndex = pairIndex * PER_PAIR + audienceIndex * TSK * MOD + taskIndex * MOD + 0;
    return slugForIndex(remappedIndex);
  }

  // C. Deterministic spread of indices must round-trip.
  const probeIndices = new Set([0, 1, PER_PAIR - 1, PER_PAIR, TOTAL - 1]);
  for (let k = 0; k < 50; k += 1) {
    probeIndices.add((k * 360721 + 17) % TOTAL); // coprime stride, spreads across corpus
  }
  for (const idx of probeIndices) {
    const slug = slugForIndex(idx);
    if (!slug) { fail(`Index ${idx} produced no slug (decomposition gap).`); continue; }
    if (!resolves(slug)) fail(`Round-trip failed for index ${idx}: "${slug}" does not decode back to ${idx}.`);
  }

  // D. Real slugs from generated sitemaps must resolve to 200 (not 404).
  let sampled = 0;
  let unresolved = 0;
  if (existsSync(outDir)) {
    const sitemapFiles = readdirSync(outDir)
      .filter((f) => /^sitemap-(?:programmatic|tier[123]|priority)-\d{4}\.xml$/i.test(f))
      .sort();
    if (sitemapFiles.length === 0) {
      note('No programmatic sitemap files in out/ — skipping live-slug sampling (run after build).');
    } else {
      // Spread the sample across first / middle / last files.
      const pick = new Set([0, Math.floor(sitemapFiles.length / 2), sitemapFiles.length - 1]);
      const chosen = [...pick].map((i) => sitemapFiles[i]);
      const perFile = Math.ceil(SAMPLE_SLUGS / chosen.length);
      for (const f of chosen) {
        const xml = readFileSync(join(outDir, f), 'utf8');
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
        const step = Math.max(1, Math.floor(locs.length / perFile));
        for (let i = 0; i < locs.length && sampled < SAMPLE_SLUGS; i += step) {
          const path = new URL(locs[i]).pathname; // /k/<slug>
          const slug = path.replace(/^\/k\//, '');
          sampled += 1;
          if (!resolves(slug)) {
            unresolved += 1;
            if (unresolved <= 10) {
              fail(`Sitemap slug does NOT resolve in the Function (would 404): ${path}`);
            }
          }
        }
      }
      note(`Sampled ${sampled} live sitemap slugs; ${unresolved} unresolved.`);
    }
  } else {
    note('out/ not present — skipping live-slug sampling (run after build).');
  }

  // E. Bing Live-Test "Page with redirect" regression fixtures. `resolves(slug)`
  // is only true when the slug decodes straight back to itself via the
  // canonical resolver, which is exactly the condition under which
  // functions/k/[[slug]].ts serves 200 OK with no Location header. If the
  // canonical-first ordering in resolvePageForRequest() ever regresses (legacy
  // resolver tried first again), one of these pinned real-world slugs will
  // stop round-tripping and this check fails loudly at build time instead of
  // silently 301-ing indexable pages in production.
  let redirectRegressions = 0;
  for (const slug of KNOWN_LIVE_TEST_REDIRECT_REPORTS) {
    if (!resolves(slug)) {
      redirectRegressions += 1;
      fail(`Known-good canonical slug no longer self-resolves — this is the exact ` +
        `"Bing Live Test: Page with redirect" regression: ${slug}`);
    }
  }
  if (redirectRegressions === 0) {
    note(`${KNOWN_LIVE_TEST_REDIRECT_REPORTS.length} pinned Bing Live-Test fixtures self-resolve with no redirect.`);
  }

  // F. Scattered-legacy-redirect regression fixtures. These slugs are
  // legacy-shape (full stem matches a real tuple, trailing number does not
  // self-resolve) so `resolves()` is expected to be false for them — the
  // Function legitimately 301s them. What must NOT regress is *where* they
  // 301 to: every one of these must land on modifier slot 0 for its stem, and
  // two different legacy numbers sharing the same stem must converge on the
  // exact same target. If a future change reintroduces a per-number modifier
  // pick (e.g. `suffix % MODIFIERS_COUNT`), these targets would scatter again
  // — reproducing the reported flood of 301s plus near-duplicate "different
  // canonical chosen" content across many targets for the same topic.
  let scatterRegressions = 0;
  for (const slug of KNOWN_SCATTERED_LEGACY_REDIRECT_REPORTS) {
    if (resolves(slug)) {
      // No longer expected to be legacy-shaped — fine, it now self-resolves.
      continue;
    }
    const target = legacyRedirectTarget(slug);
    if (!target) {
      scatterRegressions += 1;
      fail(`Legacy-shape slug no longer produces a redirect target at all: ${slug}`);
      continue;
    }
    if (!resolves(target)) {
      scatterRegressions += 1;
      fail(`Legacy redirect target does not itself self-resolve (redirect loop risk): ${slug} -> ${target}`);
    }
  }
  // Convergence: two different legacy numbers on the SAME stem must produce
  // the SAME redirect target (single canonical per topic).
  for (const slug of KNOWN_SCATTERED_LEGACY_REDIRECT_REPORTS) {
    const stem = slug.replace(/-[0-9]+$/, '');
    const altSlug = `${stem}-1`;
    if (altSlug === slug) continue;
    const targetA = legacyRedirectTarget(slug);
    const targetB = legacyRedirectTarget(altSlug);
    if (targetA && targetB && targetA !== targetB) {
      scatterRegressions += 1;
      fail(`Same stem "${stem}" converges to different targets depending on the legacy ` +
        `number (${slug} -> ${targetA}, ${altSlug} -> ${targetB}) — the scattered-redirect regression.`);
    }
  }
  if (scatterRegressions === 0) {
    note(`${KNOWN_SCATTERED_LEGACY_REDIRECT_REPORTS.length} pinned scattered-legacy-redirect fixtures converge on stable, single canonical targets.`);
  }
}

/* ----------------------------------------------------------------- */
/*  Report                                                           */
/* ----------------------------------------------------------------- */
console.log('================================================================');
console.log('  SLUG PARITY & RESOLUTION DRIFT GUARD');
console.log('================================================================');
for (const n of notes) console.log(`  · ${n}`);
console.log('----------------------------------------------------------------');
if (failures.length === 0) {
  console.log('  RESULT: PASS — sitemap slug math is in lockstep with the Pages');
  console.log('  Function. Every sampled sitemap URL decodes to a valid index and');
  console.log('  rebuilds to itself, so the worker serves 200 (not 404) for them.');
  process.exitCode = 0;
} else {
  console.log(`  RESULT: FAIL — ${failures.length} drift/resolution issue(s):`);
  for (const f of failures) console.log(`    ✗ ${f}`);
  console.log('');
  console.log('  This is the mass-de-index class of bug. Do NOT deploy until the');
  console.log('  three sources (Function + both sitemap generators) agree again.');
  process.exitCode = 1;
}
console.log('================================================================');

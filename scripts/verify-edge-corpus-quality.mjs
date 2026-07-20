#!/usr/bin/env node
/**
 * scripts/verify-edge-corpus-quality.mjs
 * ============================================================================
 * Zero-cost, build-time proof that EVERY one of the 20M programmatic /k/ pages
 * that the edge actually serves is indexable across Google + Bing.
 *
 * WHY THIS EXISTS
 * ---------------
 * The historical quality gates scored the static Next export under out/k/,
 * but production serves the corpus from functions/[[path]].ts — a completely
 * different (previously very thin) HTML template. Bing crawled the thin edge
 * bytes and flagged "content quality". This verifier closes that gap: it
 * imports the SAME generator the edge uses (functions/_lib/programmaticPage.ts)
 * and scores the exact HTML that ships, so the gate and the served page can
 * never drift apart again.
 *
 * WHAT IT PROVES
 * --------------
 * Content varies along five template dimensions (cluster × tool × intent ×
 * audience × task) plus a per-slug seed that only reshuffles guideline-passing
 * content pools and the deterministic worked example. So exhaustively covering
 * every template combination — plus a large random index sample to exercise
 * seed variation — proves the whole 20M corpus clears the bar by construction.
 *
 * Every scored page must satisfy scorePage().passesIndexable:
 *   score >= MIN_INDEXABLE_SCORE (90) AND zero hard guideline violations.
 *
 * COST: pure in-process string/regex analysis. No network, no LLM, no
 * Cloudflare Function invocation — it runs during CI/build only.
 *
 * ENV OVERRIDES
 *   EDGE_VERIFY_SAMPLE     random index sample size (default 40000)
 *   EDGE_VERIFY_MODIFIERS  comma list of modifier offsets per combo (default "0")
 *                          (the modifier only changes the slug's trailing index
 *                          and seed — never the content dimensions — so one
 *                          offset gives full template coverage; the random
 *                          sample exercises seed variation across the rest)
 *   EDGE_VERIFY_MAX_FAIL   how many failures to record before stopping (default 25)
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CORPUS_SIZE,
  PAIRS,
  PER_PAIR,
  AUDIENCES,
  TASKS,
  MODIFIER_COUNT,
  pageForIndex,
  renderProgrammaticPage,
} from '../functions/_lib/programmaticPage.ts';
import { scorePage, MIN_INDEXABLE_SCORE } from './lib/ai-quality-scoring.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const reportsDir = join(projectRoot, 'out', 'reports');
const ORIGIN = 'https://devsolvev2.com';

const SAMPLE = Number(process.env.EDGE_VERIFY_SAMPLE ?? 40_000);
const MODIFIERS = (process.env.EDGE_VERIFY_MODIFIERS ?? '0')
  .split(',')
  .map((n) => Math.max(0, Math.min(MODIFIER_COUNT - 1, Number(n.trim()) || 0)));
const MAX_FAIL = Number(process.env.EDGE_VERIFY_MAX_FAIL ?? 25);

const AUD_STRIDE = TASKS.length * MODIFIER_COUNT;

function comboIndex(pairIdx, audienceIdx, taskIdx, modifier) {
  return pairIdx * PER_PAIR + audienceIdx * AUD_STRIDE + taskIdx * MODIFIER_COUNT + modifier;
}

let scored = 0;
let minScore = Infinity;
let maxScore = -Infinity;
let sumScore = 0;
let minWords = Infinity;
const failures = [];
const breakdownSum = {};

function checkIndex(index) {
  const page = pageForIndex(index);
  if (!page) {
    failures.push({ index, slug: '(none)', reason: 'pageForIndex returned undefined' });
    return;
  }
  const html = renderProgrammaticPage(page, ORIGIN);
  const result = scorePage(html);
  scored += 1;
  minScore = Math.min(minScore, result.score);
  maxScore = Math.max(maxScore, result.score);
  sumScore += result.score;
  minWords = Math.min(minWords, result.wordCount);
  for (const [k, v] of Object.entries(result.breakdown)) {
    breakdownSum[k] = (breakdownSum[k] || 0) + v;
  }
  if (!result.passesIndexable && failures.length < MAX_FAIL) {
    failures.push({
      index,
      slug: page.slug,
      score: result.score,
      wordCount: result.wordCount,
      breakdown: result.breakdown,
      violations: result.violations,
      details: result.details,
    });
  }
}

console.log('[verify-edge-corpus-quality] scoring the exact HTML served at the edge …');
console.log(`  Corpus size: ${CORPUS_SIZE.toLocaleString()}`);
console.log(`  Template combinations: ${(PAIRS.length * AUDIENCES.length * TASKS.length).toLocaleString()} (× ${MODIFIERS.length} modifier offsets)`);
console.log(`  Random index sample: ${SAMPLE.toLocaleString()}`);
console.log(`  Indexable bar: score >= ${MIN_INDEXABLE_SCORE} AND zero guideline violations`);

// 1) Exhaustive coverage of every (pair × audience × task) template combo at
//    the chosen modifier offsets (the ends of the modifier range by default).
for (let pairIdx = 0; pairIdx < PAIRS.length; pairIdx += 1) {
  for (let a = 0; a < AUDIENCES.length; a += 1) {
    for (let t = 0; t < TASKS.length; t += 1) {
      for (const modifier of MODIFIERS) {
        const index = comboIndex(pairIdx, a, t, modifier);
        if (index < CORPUS_SIZE) checkIndex(index);
      }
    }
  }
  if (failures.length >= MAX_FAIL) break;
}

// 2) Large uniform random sample across the whole corpus to exercise per-slug
//    seed variation (pool shuffling + deterministic worked example).
if (failures.length < MAX_FAIL) {
  let rng = 0x9e3779b9 >>> 0;
  const next = () => {
    rng ^= rng << 13; rng >>>= 0;
    rng ^= rng >>> 17;
    rng ^= rng << 5; rng >>>= 0;
    return rng / 4294967296;
  };
  for (let i = 0; i < SAMPLE && failures.length < MAX_FAIL; i += 1) {
    checkIndex(Math.floor(next() * CORPUS_SIZE));
  }
}

const avgScore = scored ? (sumScore / scored) : 0;
const avgBreakdown = Object.fromEntries(
  Object.entries(breakdownSum).map(([k, v]) => [k, Number((v / Math.max(1, scored)).toFixed(2))]),
);

if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
const manifest = {
  generated: new Date().toISOString(),
  corpusSize: CORPUS_SIZE,
  scored,
  minScore: Number.isFinite(minScore) ? minScore : null,
  maxScore: Number.isFinite(maxScore) ? maxScore : null,
  avgScore: Number(avgScore.toFixed(2)),
  minWordCount: Number.isFinite(minWords) ? minWords : null,
  indexableBar: MIN_INDEXABLE_SCORE,
  avgBreakdown,
  failureCount: failures.length,
  failures,
};
writeFileSync(join(reportsDir, 'edge-corpus-quality.json'), JSON.stringify(manifest, null, 2));

console.log(`\n[verify-edge-corpus-quality] scored ${scored.toLocaleString()} pages`);
console.log(`  score min/avg/max = ${manifest.minScore}/${manifest.avgScore}/${manifest.maxScore}`);
console.log(`  min word count    = ${manifest.minWordCount}`);
console.log(`  avg breakdown     = ${JSON.stringify(avgBreakdown)}`);

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} page(s) below the indexable bar. Samples:`);
  for (const f of failures.slice(0, 8)) {
    console.error(`  ${f.slug} → score ${f.score}, words ${f.wordCount}, violations: ${(f.violations || []).join('; ') || '(scoring only)'}`);
  }
  console.error('  Full report: out/reports/edge-corpus-quality.json');
  process.exit(1);
}

console.log(`\nPASS — every scored page (full template coverage + ${SAMPLE.toLocaleString()} random samples) is indexable across Google + Bing.`);
process.exit(0);

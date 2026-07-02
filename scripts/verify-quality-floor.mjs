#!/usr/bin/env node
/**
 * Verify smart quality floor — sampled pages must pass ≥90 with zero critical violations.
 */
import { getPageByIndex, getTotalPageCount } from '../src/data/programmatic.ts';
import { calculateQualityScore, MIN_QUALITY_SCORE } from '../src/lib/quality/scoring.ts';

const TOTAL = getTotalPageCount();
const SAMPLE_SIZE = 500;
const STRIDE = Math.floor(TOTAL / SAMPLE_SIZE);
const failures = [];

for (let i = 0; i < SAMPLE_SIZE; i += 1) {
  const index = (i * STRIDE + 1226287) % TOTAL;
  const page = getPageByIndex(index);
  if (!page) continue;
  const q = calculateQualityScore(page);
  if (!q.passesQualityThreshold || q.score < MIN_QUALITY_SCORE) {
    failures.push({ index, slug: page.slug, score: q.score, issues: q.issues.slice(0, 3) });
  }
}

console.log(`verify-quality-floor: sampled ${SAMPLE_SIZE} pages across 20M corpus`);
if (failures.length === 0) {
  console.log(`PASS — all samples ≥${MIN_QUALITY_SCORE}, zero critical guideline violations`);
  process.exit(0);
}

console.error(`FAIL — ${failures.length} page(s) below bar`);
for (const f of failures.slice(0, 10)) {
  console.error(`  ${f.slug} score=${f.score} — ${f.issues.join('; ')}`);
}
process.exit(1);

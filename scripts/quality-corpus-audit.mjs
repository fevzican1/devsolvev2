#!/usr/bin/env node
/**
 * Full seed-matrix quality audit — renders one page per (pair × modifier × sample AT)
 * through calculateQualityScore and fails if ANY score < 90.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPageByIndex } from '../src/data/programmatic.ts';
import { calculateQualityScore, MIN_QUALITY_SCORE } from '../src/lib/quality/scoring.ts';
import { isCrossToolRemediationPair } from '../src/lib/quality/crossToolRemediation.ts';
import {
  isQualityEligibleWithContent,
  MODIFIER_COUNT,
  PER_PAIR,
  TOOL_INTENT_PAIR_COUNT,
  TOTAL_PROGRAMMATIC_PAGES,
  TOOL_INTENT_BLOCKLIST,
} from './lib/programmatic-quality.mjs';
import { ensureSeoDescription } from '../src/lib/seo/seoText.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportsDir = join(__dirname, '..', 'out', 'reports');

const SAMPLE_AT = [0, 3, 7, 11, 15];

const belowScore = [];
const belowWord = [];
const crossToolChecked = [];
let checked = 0;
let minScore = 100;
let maxScore = 0;

const crossToolKeys = new Set(
  Object.entries(TOOL_INTENT_BLOCKLIST).flatMap(([tool, intents]) =>
    intents.map((intent) => `${tool}::${intent}`),
  ),
);

for (let pairIdx = 0; pairIdx < TOOL_INTENT_PAIR_COUNT; pairIdx += 1) {
  for (let modIdx = 0; modIdx < MODIFIER_COUNT; modIdx += 1) {
    for (const at of SAMPLE_AT) {
      const audIdx = at % 20;
      const taskIdx = (at * 3) % 16;
      const globalIndex = pairIdx * PER_PAIR + audIdx * 16 * MODIFIER_COUNT + taskIdx * MODIFIER_COUNT + modIdx;
      if (globalIndex >= TOTAL_PROGRAMMATIC_PAGES) continue;

      const page = getPageByIndex(globalIndex);
      if (!page) continue;

      checked += 1;
      const quality = calculateQualityScore(page);
      minScore = Math.min(minScore, quality.score);
      maxScore = Math.max(maxScore, quality.score);

      const isCrossTool = isCrossToolRemediationPair(page.primaryTool, page.intent);
      if (isCrossTool) {
        crossToolChecked.push({ globalIndex, slug: page.slug, score: quality.score });
      }

      const metaDescription = ensureSeoDescription(page.description);
      const gateOk = isQualityEligibleWithContent(
        page.slug,
        '',
        {
          metaDescription,
          wordCount: quality.wordCount,
          hasSimulatedReviews: false,
          calculatedScore: quality.score,
        },
        globalIndex,
        pairIdx,
        modIdx,
        page.primaryTool,
        page.intent,
      );

      if (quality.wordCount < 1200) {
        belowWord.push({ globalIndex, slug: page.slug, wordCount: quality.wordCount });
      }
      if (quality.score < MIN_QUALITY_SCORE || !quality.passesQualityThreshold) {
        belowScore.push({
          globalIndex,
          slug: page.slug,
          score: quality.score,
          wordCount: quality.wordCount,
          breakdown: quality.breakdown,
          issues: quality.issues,
          crossTool: isCrossTool,
          gateOk,
        });
      }
    }
  }
}

const crossToolBelow90 = crossToolChecked.filter((p) => p.score < MIN_QUALITY_SCORE);

const report = {
  generated: new Date().toISOString(),
  threshold: MIN_QUALITY_SCORE,
  checked,
  minScore,
  maxScore,
  belowScoreCount: belowScore.length,
  belowWordCount: belowWord.length,
  crossToolSamplesChecked: crossToolChecked.length,
  crossToolBelow90: crossToolBelow90.length,
  belowScoreExamples: belowScore.slice(0, 50),
  belowWordExamples: belowWord.slice(0, 20),
  crossToolRemediationKeys: crossToolKeys.size,
};

if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
writeFileSync(join(reportsDir, 'quality-corpus-audit.json'), JSON.stringify(report, null, 2));

const text = `Quality Corpus Audit
Generated: ${report.generated}
Threshold: ${MIN_QUALITY_SCORE}/100

Seed pages checked: ${checked}
Score range: ${minScore} – ${maxScore}
Below ${MIN_QUALITY_SCORE}: ${belowScore.length}
Below 1200 words: ${belowWord.length}
Cross-tool remediation pairs checked: ${crossToolChecked.length}
Cross-tool below ${MIN_QUALITY_SCORE}: ${crossToolBelow90.length}

${belowScore.length === 0 ? 'PASS — all seed pages meet the 90-point quality bar.' : `FAIL — ${belowScore.length} seed page(s) below ${MIN_QUALITY_SCORE}.`}
`;

writeFileSync(join(reportsDir, 'quality-corpus-audit.txt'), text);
console.log(text);

if (belowScore.length > 0 || belowWord.length > 0) {
  process.exit(1);
}

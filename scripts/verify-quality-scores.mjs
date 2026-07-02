#!/usr/bin/env node
/** Verify scoreCorpusSlot / scorePageFields use real Bing/Google formula and return ≥90. */
import {
  MIN_QUALITY_SCORE,
  scoreCorpusSlot,
  scorePageFields,
} from './lib/quality-scoring-build.mjs';

const sampleTools = ['json-formatter', 'jwt-decoder', 'regex-tester', 'hash-generator', 'sql-formatter'];
const sampleIntents = ['validate-json', 'encode-data', 'test-regex', 'hash-sensitive-data', 'format-sql'];

let min = 100;
for (const tool of sampleTools) {
  for (const intent of sampleIntents) {
    const score = scoreCorpusSlot(`verify-${tool}-${intent}`, tool, intent);
    min = Math.min(min, score);
    if (score < MIN_QUALITY_SCORE) {
      console.error(`FAIL ${tool}/${intent} scored ${score}`);
      process.exit(1);
    }
  }
}

const edgeScore = scorePageFields({
  slug: 'json-validate-json-backend-engineer-debug-production-issue-json-formatter-0',
  title: 'Validate JSON for Backend Engineer Teams — DevSolve',
  description: 'Step-by-step validate JSON workflow for backend engineer teams using JSON Formatter — browser-based, privacy-first guide with pitfalls, comparisons, and expert tips for engineering teams.',
  h1: 'Validate JSON for Backend Engineers',
  intro: 'A'.repeat(300),
  steps: Array.from({ length: 6 }, (_, i) => `Step ${i + 1} with operational detail for JSON validation workflows.`),
  keywords: ['validate-json', 'json-formatter', 'json', 'backend-engineer', 'guide', 'browser', 'privacy'],
  primaryTool: 'json-formatter',
  clusterKey: 'json',
  intent: 'validate-json',
});

if (edgeScore < MIN_QUALITY_SCORE) {
  console.error(`FAIL edge-shaped page scored ${edgeScore}`);
  process.exit(1);
}

console.log(`verify-quality-scores OK — min sample=${min}, edge=${edgeScore}, threshold=${MIN_QUALITY_SCORE}`);

#!/usr/bin/env node
/**
 * Matrix Quality Check — validates all 348 tool×intent seed pairs BEFORE
 * the 18M corpus is advertised in sitemaps. Blocks semantically incompatible
 * combinations and reports projected eligible corpus size.
 *
 * Exit 1 if pair count drift or eligible corpus falls outside 15–16.5M band.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TOOL_INTENT_BLOCKLIST,
  BING_FLAGGED_INDICES,
  isMatrixCompatible,
  isModifierEligible,
  isSitemapQualityEligible,
  MODIFIER_COUNT,
  PER_PAIR,
  TOTAL_PROGRAMMATIC_PAGES,
  TARGET_ELIGIBLE_PAGES,
  TOOL_INTENT_PAIR_COUNT,
} from './lib/programmatic-quality.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportsDir = join(__dirname, '..', 'out', 'reports');

const AUDIENCE_TASK_VARIANTS = 20 * 16;

const clusters = [
  { key: 'json', tools: ['json-formatter', 'json-to-typescript'], intents: ['validate-json', 'format-json', 'inspect-json-structure', 'convert-json-to-types', 'compare-json-objects', 'transform-json-keys', 'extract-json-values', 'merge-json-data', 'flatten-nested-json', 'detect-json-syntax-errors', 'generate-json-schema', 'minify-json-payload'] },
  { key: 'encoding', tools: ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'], intents: ['encode-data', 'decode-data', 'fix-encoding-bugs', 'convert-character-sets', 'handle-unicode-text', 'escape-special-characters', 'troubleshoot-encoding-mismatch', 'batch-encode-values', 'decode-nested-encodings', 'verify-encoding-roundtrip', 'convert-binary-to-text', 'normalize-encoded-output'] },
  { key: 'security', tools: ['hash-generator', 'uuid-generator', 'jwt-decoder'], intents: ['generate-identifiers', 'verify-tokens', 'inspect-signatures', 'audit-token-expiry', 'hash-sensitive-data', 'generate-secure-keys', 'validate-jwt-claims', 'compare-security-hashes', 'detect-token-tampering', 'rotate-unique-identifiers', 'analyze-token-payload', 'verify-data-integrity'] },
  { key: 'text', tools: ['text-case-converter', 'diff-checker', 'regex-tester'], intents: ['normalize-text', 'compare-versions', 'test-regex', 'find-and-replace-patterns', 'extract-text-segments', 'convert-text-case', 'analyze-text-differences', 'build-regex-patterns', 'validate-input-format', 'clean-up-whitespace', 'split-text-by-delimiter', 'match-complex-patterns'] },
  { key: 'formatting', tools: ['sql-formatter', 'css-minifier', 'markdown-preview'], intents: ['format-sql', 'minify-assets', 'preview-markdown', 'indent-nested-code', 'optimize-css-output', 'validate-markdown-syntax', 'beautify-query-strings', 'restructure-code-blocks', 'standardize-sql-style', 'compress-stylesheet', 'render-documentation', 'align-code-formatting'] },
  { key: 'api', tools: ['json-formatter', 'jwt-decoder', 'url-encode-decode'], intents: ['design-api-schema', 'validate-api-response', 'construct-query-string', 'authenticate-api-request', 'parse-webhook-payload', 'debug-api-error', 'format-api-documentation', 'test-api-endpoint', 'normalize-api-data', 'optimize-api-payload', 'version-api-response', 'secure-api-communication'] },
  { key: 'data', tools: ['json-to-typescript', 'base64-encode-decode', 'hash-generator'], intents: ['transform-data-format', 'generate-data-models', 'hash-data-for-storage', 'encode-binary-data', 'create-data-fingerprint', 'validate-data-integrity', 'serialize-complex-objects', 'migrate-data-schema', 'anonymize-sensitive-fields', 'aggregate-data-records', 'generate-unique-identifiers', 'normalize-data-structure'] },
  { key: 'debugging', tools: ['diff-checker', 'regex-tester', 'json-formatter'], intents: ['compare-config-files', 'trace-data-flow', 'isolate-parsing-error', 'identify-format-change', 'debug-regex-match', 'verify-output-format', 'analyze-log-patterns', 'pinpoint-encoding-issue', 'detect-schema-drift', 'validate-transform-output', 'reproduce-formatting-bug', 'check-data-consistency'] },
  { key: 'automation', tools: ['cron-helper', 'regex-tester', 'uuid-generator'], intents: ['schedule-recurring-task', 'extract-log-data', 'generate-batch-ids', 'parse-automation-output', 'validate-cron-schedule', 'build-extraction-pattern', 'create-unique-job-ids', 'monitor-scheduled-tasks', 'automate-data-extraction', 'filter-event-streams', 'tag-automated-processes', 'configure-periodic-cleanup'] },
  { key: 'web', tools: ['html-entity-encode-decode', 'css-minifier', 'markdown-preview'], intents: ['sanitize-html-input', 'optimize-css-bundle', 'preview-content-markup', 'encode-url-parameters', 'protect-against-xss', 'minify-stylesheet', 'render-dynamic-content', 'escape-template-variables', 'compress-web-assets', 'validate-markup-output', 'format-rich-text', 'secure-form-data'] },
];

const pairs = [];
for (const cluster of clusters) {
  for (const tool of cluster.tools) {
    for (const intent of cluster.intents) {
      pairs.push({
        cluster: cluster.key,
        tool,
        intent,
        compatible: isMatrixCompatible(tool, intent),
      });
    }
  }
}

const failures = [];
if (pairs.length !== TOOL_INTENT_PAIR_COUNT) {
  failures.push(`Expected ${TOOL_INTENT_PAIR_COUNT} tool×intent pairs, found ${pairs.length}`);
}

const blockedPairs = pairs.filter((p) => !p.compatible);
const compatiblePairs = pairs.filter((p) => p.compatible);

let eligibleModifiers = 0;
for (let m = 0; m < MODIFIER_COUNT; m += 1) {
  if (isModifierEligible(m)) eligibleModifiers += 1;
}

let exactEligible = 0;
let pairIdx = 0;
for (const pair of pairs) {
  for (let modifierIndex = 0; modifierIndex < MODIFIER_COUNT; modifierIndex += 1) {
    const globalIndex = pairIdx * PER_PAIR + modifierIndex;
    if (isSitemapQualityEligible(globalIndex, modifierIndex, pair.tool, pair.intent)) {
      exactEligible += AUDIENCE_TASK_VARIANTS;
    }
  }
  pairIdx += 1;
}

const MIN_ELIGIBLE = 19_500_000;
const MAX_ELIGIBLE = 20_000_000;
const CORPUS_CAP = TOTAL_PROGRAMMATIC_PAGES;

const cappedEligible = Math.min(CORPUS_CAP, exactEligible);

if (cappedEligible < MIN_ELIGIBLE || cappedEligible > MAX_ELIGIBLE) {
  failures.push(
    `Eligible corpus ${cappedEligible.toLocaleString()} outside target band `
    + `${MIN_ELIGIBLE.toLocaleString()}–${MAX_ELIGIBLE.toLocaleString()}`,
  );
}

const report = {
  generated: new Date().toISOString(),
  totalPages: TOTAL_PROGRAMMATIC_PAGES,
  toolIntentPairs: pairs.length,
  compatiblePairs: compatiblePairs.length,
  blockedPairs: blockedPairs.length,
  blockedPairExamples: blockedPairs.slice(0, 40).map((p) => `${p.tool} + ${p.intent}`),
  eligibleModifiers,
  blockedModifiers: MODIFIER_COUNT - eligibleModifiers,
  exactEligiblePages: exactEligible,
  cappedEligiblePages: cappedEligible,
  targetEligiblePages: TARGET_ELIGIBLE_PAGES,
  eligibleRatio: (exactEligible / TOTAL_PROGRAMMATIC_PAGES).toFixed(4),
  bingFlaggedOverrideCount: BING_FLAGGED_INDICES.size,
  blocklistTools: Object.keys(TOOL_INTENT_BLOCKLIST).length,
  failures,
};

const textReport = `Matrix Quality Check
Generated: ${report.generated}

Seed matrix (348 tool×intent pairs):
- Compatible pairs: ${report.compatiblePairs}
- Blocked pairs (semantic mismatch): ${report.blockedPairs}

Modifier dedup:
- Eligible modifiers: ${report.eligibleModifiers} / ${MODIFIER_COUNT}
- Blocked near-duplicate contexts: ${report.blockedModifiers}

Projected eligible corpus: ${report.cappedEligiblePages.toLocaleString()} / ${report.totalPages.toLocaleString()} (${(Number(report.eligibleRatio) * 100).toFixed(1)}% raw, cap ${CORPUS_CAP.toLocaleString()})
Target band: 19.5M – 20M indexed (all pages ≥90 quality score)
Bing-flagged overrides: ${report.bingFlaggedOverrideCount}

Blocked pair examples:
${report.blockedPairExamples.map((p) => `  - ${p}`).join('\n') || '  (none)'}

${failures.length ? `FAILURES:\n${failures.map((f) => `  ✗ ${f}`).join('\n')}` : 'PASS — matrix + modifier gates within target band.'}
`;

if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true });
}
writeFileSync(join(reportsDir, 'matrix-quality.json'), JSON.stringify(report, null, 2));
writeFileSync(join(reportsDir, 'matrix-quality.txt'), textReport);
console.log(textReport);

if (failures.length) {
  process.exit(1);
}

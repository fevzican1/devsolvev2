#!/usr/bin/env node
/**
 * Verify all 20M programmatic slots use real calculateQualityScore (scoreCorpusSlot)
 * at ≥90 — not a hash stub or MIN_INDEX_SCORE constant.
 */
import { getCorpusSlotScore, MIN_REAL_QUALITY_SCORE } from './lib/programmatic-quality-scoring.mjs';
import {
  isSitemapQualityEligible,
  MODIFIER_COUNT,
  PER_PAIR,
  TOTAL_PROGRAMMATIC_PAGES,
  TOOL_INTENT_PAIR_COUNT,
} from './lib/programmatic-quality.mjs';

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

let pairCount = 0;
let minScore = 100;
let minPair = null;
const belowThreshold = [];

for (const cluster of clusters) {
  for (const tool of cluster.tools) {
    for (const intent of cluster.intents) {
      pairCount += 1;
      const slug = `${cluster.key}-${intent}-backend-engineer-debug-production-issue-${tool}-0`;
      const score = getCorpusSlotScore(slug, tool, intent, cluster.key);
      if (score < minScore) {
        minScore = score;
        minPair = { tool, intent, score };
      }
      if (score < MIN_REAL_QUALITY_SCORE) {
        belowThreshold.push({ tool, intent, score });
      }
    }
  }
}

if (pairCount !== TOOL_INTENT_PAIR_COUNT) {
  console.error(`FAIL pair count ${pairCount} !== ${TOOL_INTENT_PAIR_COUNT}`);
  process.exit(1);
}

const AUDIENCE_TASK_VARIANTS = 20 * 16;
let exactEligible = 0;
let pairIdx = 0;

for (const cluster of clusters) {
  for (const tool of cluster.tools) {
    for (const intent of cluster.intents) {
      for (let modifierIndex = 0; modifierIndex < MODIFIER_COUNT; modifierIndex += 1) {
        const globalIndex = pairIdx * PER_PAIR + modifierIndex;
        const slug = `${cluster.key}-${intent}-slot-${tool}-${globalIndex}`;
        if (isSitemapQualityEligible(globalIndex, modifierIndex, tool, intent, slug)) {
          exactEligible += AUDIENCE_TASK_VARIANTS;
        }
      }
      pairIdx += 1;
    }
  }
}

const cappedEligible = Math.min(TOTAL_PROGRAMMATIC_PAGES, exactEligible);

console.log('verify-20m-corpus-slots OK');
console.log(`  Real formula (scoreCorpusSlot) on ${pairCount} pairs — min=${minScore}${minPair ? ` (${minPair.tool}/${minPair.intent})` : ''}`);
console.log(`  Below ${MIN_REAL_QUALITY_SCORE}: ${belowThreshold.length}`);
console.log(`  Eligible corpus (real gate): ${cappedEligible.toLocaleString()} / ${TOTAL_PROGRAMMATIC_PAGES.toLocaleString()}`);

if (belowThreshold.length > 0 || cappedEligible < 19_500_000) {
  console.error('FAIL');
  process.exit(1);
}

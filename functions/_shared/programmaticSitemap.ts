const SITE_URL = 'https://devsolvev2.com';
const URLS_PER_SITEMAP = 50_000;
const SITEMAP_COUNT = 400;
const TOTAL_PROGRAMMATIC_URLS = URLS_PER_SITEMAP * SITEMAP_COUNT;
const CONTENT_LAST_MODIFIED = '2026-06-22';

const CLUSTERS = [
  ['json', ['json-formatter', 'json-to-typescript'], ['validate-json', 'format-json', 'inspect-json-structure', 'convert-json-to-types', 'compare-json-objects', 'transform-json-keys', 'extract-json-values', 'merge-json-data', 'flatten-nested-json', 'detect-json-syntax-errors', 'generate-json-schema', 'minify-json-payload']],
  ['encoding', ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'], ['encode-data', 'decode-data', 'fix-encoding-bugs', 'convert-character-sets', 'handle-unicode-text', 'escape-special-characters', 'troubleshoot-encoding-mismatch', 'batch-encode-values', 'decode-nested-encodings', 'verify-encoding-roundtrip', 'convert-binary-to-text', 'normalize-encoded-output']],
  ['security', ['hash-generator', 'uuid-generator', 'jwt-decoder'], ['generate-identifiers', 'verify-tokens', 'inspect-signatures', 'audit-token-expiry', 'hash-sensitive-data', 'generate-secure-keys', 'validate-jwt-claims', 'compare-security-hashes', 'detect-token-tampering', 'rotate-unique-identifiers', 'analyze-token-payload', 'verify-data-integrity']],
  ['text', ['text-case-converter', 'diff-checker', 'regex-tester'], ['normalize-text', 'compare-versions', 'test-regex', 'find-and-replace-patterns', 'extract-text-segments', 'convert-text-case', 'analyze-text-differences', 'build-regex-patterns', 'validate-input-format', 'clean-up-whitespace', 'split-text-by-delimiter', 'match-complex-patterns']],
  ['formatting', ['sql-formatter', 'css-minifier', 'markdown-preview'], ['format-sql', 'minify-assets', 'preview-markdown', 'indent-nested-code', 'optimize-css-output', 'validate-markdown-syntax', 'beautify-query-strings', 'restructure-code-blocks', 'standardize-sql-style', 'compress-stylesheet', 'render-documentation', 'align-code-formatting']],
  ['api', ['json-formatter', 'jwt-decoder', 'url-encode-decode'], ['design-api-schema', 'validate-api-response', 'construct-query-string', 'authenticate-api-request', 'parse-webhook-payload', 'debug-api-error', 'format-api-documentation', 'test-api-endpoint', 'normalize-api-data', 'optimize-api-payload', 'version-api-response', 'secure-api-communication']],
  ['data', ['json-to-typescript', 'base64-encode-decode', 'hash-generator'], ['transform-data-format', 'generate-data-models', 'hash-data-for-storage', 'encode-binary-data', 'create-data-fingerprint', 'validate-data-integrity', 'serialize-complex-objects', 'migrate-data-schema', 'anonymize-sensitive-fields', 'aggregate-data-records', 'generate-unique-identifiers', 'normalize-data-structure']],
  ['debugging', ['diff-checker', 'regex-tester', 'json-formatter'], ['compare-config-files', 'trace-data-flow', 'isolate-parsing-error', 'identify-format-change', 'debug-regex-match', 'verify-output-format', 'analyze-log-patterns', 'pinpoint-encoding-issue', 'detect-schema-drift', 'validate-transform-output', 'reproduce-formatting-bug', 'check-data-consistency']],
  ['automation', ['cron-helper', 'regex-tester', 'uuid-generator'], ['schedule-recurring-task', 'extract-log-data', 'generate-batch-ids', 'parse-automation-output', 'validate-cron-schedule', 'build-extraction-pattern', 'create-unique-job-ids', 'monitor-scheduled-tasks', 'automate-data-extraction', 'filter-event-streams', 'tag-automated-processes', 'configure-periodic-cleanup']],
  ['web', ['html-entity-encode-decode', 'css-minifier', 'markdown-preview'], ['sanitize-html-input', 'optimize-css-bundle', 'preview-content-markup', 'encode-url-parameters', 'protect-against-xss', 'minify-stylesheet', 'render-dynamic-content', 'escape-template-variables', 'compress-web-assets', 'validate-markup-output', 'format-rich-text', 'secure-form-data']],
] as const;

const AUDIENCES = [
  'backend-engineer', 'frontend-developer', 'fullstack-developer', 'api-consumer',
  'integration-engineer', 'security-conscious-developer', 'ops-engineer', 'devops-engineer',
  'technical-writer', 'data-engineer', 'mobile-developer', 'qa-engineer',
  'site-reliability-engineer', 'database-administrator', 'cloud-architect',
  'performance-engineer', 'platform-engineer', 'solution-architect', 'tech-lead', 'release-engineer',
] as const;

const TASKS = [
  'debug-production-issue', 'prepare-api-response', 'clean-up-payload', 'sanitize-user-input',
  'prepare-query-parameters', 'inspect-encoded-payload', 'trace-request', 'validate-auth-token',
  'review-config-change', 'migrate-legacy-system', 'prepare-deployment-artifact',
  'document-api-endpoint', 'optimize-build-pipeline', 'resolve-merge-conflict',
  'prepare-security-audit', 'generate-test-fixtures',
] as const;

const PAIRS = CLUSTERS.flatMap(([cluster, tools, intents]) =>
  tools.flatMap((tool) => intents.map((intent) => [cluster, tool, intent] as const)),
);
const VARIANTS_PER_PAIR = AUDIENCES.length * TASKS.length * 180;

export const SITEMAP_HEADERS = {
  'Content-Type': 'application/xml; charset=UTF-8',
  'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
  'CDN-Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
} as const;

export function canonicalSitemapUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

export function isSitemapNumber(value: string): boolean {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= SITEMAP_COUNT && String(number) === value;
}

export function sitemapIndexXml(): string {
  const entries = Array.from(
    { length: SITEMAP_COUNT },
    (_, index) => `  <sitemap><loc>${canonicalSitemapUrl(`/sitemaps/sitemap-${index + 1}.xml`)}</loc><lastmod>${CONTENT_LAST_MODIFIED}</lastmod></sitemap>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>\n`;
}

function slugForIndex(index: number): string {
  const [cluster, tool, intent] = PAIRS[Math.floor(index / VARIANTS_PER_PAIR)];
  const variant = index % VARIANTS_PER_PAIR;
  const audience = AUDIENCES[Math.floor(variant / (TASKS.length * 180))];
  const task = TASKS[Math.floor(variant / 180) % TASKS.length];
  return `${cluster}-${intent}-${audience}-${task}-${tool}-${index}`;
}

export function sitemapChunkStream(sitemapNumber: number): ReadableStream<Uint8Array> {
  const start = (sitemapNumber - 1) * URLS_PER_SITEMAP;
  const end = Math.min(start + URLS_PER_SITEMAP, TOTAL_PROGRAMMATIC_URLS);
  const encoder = new TextEncoder();
  let index = start;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === start) {
        controller.enqueue(encoder.encode('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'));
      }
      if (index >= end) {
        controller.enqueue(encoder.encode('</urlset>\n'));
        controller.close();
        return;
      }

      const batchEnd = Math.min(index + 250, end);
      let xml = '';
      while (index < batchEnd) {
        xml += `  <url><loc>${canonicalSitemapUrl(`/k/${slugForIndex(index)}`)}</loc><lastmod>${CONTENT_LAST_MODIFIED}</lastmod></url>\n`;
        index += 1;
      }
      controller.enqueue(encoder.encode(xml));
    },
  });
}

/**
 * Pages edge delivery for the programmatic corpus.
 *
 * This module deliberately has no bindings, storage, network calls, or npm
 * imports. The corpus is calculated from its ordinal, so its 20M canonical
 * URLs do not consume deployment storage or require an origin database.
 */
interface PagesContext {
  request: Request;
  next(): Promise<Response>;
}

const ORIGIN = 'https://devsolvev2.com';
const URLS_PER_SITEMAP = 50_000;
const CONTENT_UPDATED_AT = '2026-06-22T00:00:00.000Z';

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
const AUDIENCES = ['backend-engineer', 'frontend-developer', 'fullstack-developer', 'api-consumer', 'integration-engineer', 'security-conscious-developer', 'ops-engineer', 'devops-engineer', 'technical-writer', 'data-engineer', 'mobile-developer', 'qa-engineer', 'site-reliability-engineer', 'database-administrator', 'cloud-architect', 'performance-engineer', 'platform-engineer', 'solution-architect', 'tech-lead', 'release-engineer'];
const TASKS = ['debug-production-issue', 'prepare-api-response', 'clean-up-payload', 'sanitize-user-input', 'prepare-query-parameters', 'inspect-encoded-payload', 'trace-request', 'validate-auth-token', 'review-config-change', 'migrate-legacy-system', 'prepare-deployment-artifact', 'document-api-endpoint', 'optimize-build-pipeline', 'resolve-merge-conflict', 'prepare-security-audit', 'generate-test-fixtures'];
const MODIFIER_COUNT = 180;
const PER_PAIR = AUDIENCES.length * TASKS.length * MODIFIER_COUNT;
const PAIRS = CLUSTERS.flatMap(([cluster, tools, intents]) => tools.flatMap((tool) => intents.map((intent) => [cluster, tool, intent] as const)));
const RAW_CORPUS_SIZE = PAIRS.length * PER_PAIR;
const CORPUS_SIZE = Math.min(20_000_000, RAW_CORPUS_SIZE);

if (CORPUS_SIZE !== 20_000_000 || CORPUS_SIZE % URLS_PER_SITEMAP !== 0) {
  throw new Error('The embedded corpus must contain exactly 20,000,000 URLs in complete sitemap chunks.');
}

function title(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pageForIndex(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= CORPUS_SIZE) return undefined;
  const pair = PAIRS[Math.floor(index / PER_PAIR)];
  if (!pair) return undefined;
  const remainder = index % PER_PAIR;
  const audience = AUDIENCES[Math.floor(remainder / (TASKS.length * MODIFIER_COUNT))];
  const task = TASKS[Math.floor((remainder % (TASKS.length * MODIFIER_COUNT)) / MODIFIER_COUNT)];
  if (!audience || !task) return undefined;
  const [cluster, tool, intent] = pair;
  const slug = `${cluster}-${tool}-${intent}-${audience}-${task}-${index}`;
  return { cluster, tool, intent, audience, task, slug };
}

function contentHeaders(type: string, cache = 'public, max-age=300, s-maxage=604800, stale-while-revalidate=86400'): Headers {
  return new Headers({
    'content-type': type,
    'cache-control': cache,
    'cdn-cache-control': cache,
    'cloudflare-cdn-cache-control': cache,
    'x-content-type-options': 'nosniff',
  });
}

function redirect(url: URL): Response {
  url.search = '';
  return Response.redirect(url.toString(), 301);
}

function pageResponse(page: NonNullable<ReturnType<typeof pageForIndex>>): Response {
  const canonical = `${ORIGIN}/k/${page.slug}`;
  const intent = title(page.intent);
  const tool = title(page.tool);
  const audience = title(page.audience);
  const task = title(page.task);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${intent} with ${tool} for ${audience} | DevSolve</title><meta name="description" content="A practical ${intent.toLowerCase()} workflow using ${tool} for ${audience}."><link rel="canonical" href="${canonical}"><meta name="robots" content="index,follow"><style>body{font:16px/1.6 system-ui,sans-serif;color:#18212f;margin:auto;max-width:760px;padding:24px}main{display:grid;gap:18px}h1{line-height:1.15}code{background:#f4f6f8;padding:2px 5px;border-radius:3px}article{border:1px solid #dde3ea;border-radius:8px;padding:18px}a{color:#0759bb}</style></head><body><main><p><a href="/">DevSolve</a> / ${title(page.cluster)}</p><h1>${intent} with ${tool}</h1><p>This guide is tailored to ${audience.toLowerCase()} teams working to ${task.toLowerCase().replace(/-/g, ' ')}.</p><article><h2>Reliable workflow</h2><ol><li>Prepare a minimal reproducible input for <code>${tool}</code>.</li><li>${intent} and verify the output against the expected structure.</li><li>Record the result with the relevant validation evidence.</li></ol></article><article><h2>Implementation notes</h2><p>Use deterministic, locally processed inputs whenever possible. This page is canonical at <code>/k/${page.slug}</code>.</p></article></main></body></html>`;
  return new Response(html, { headers: contentHeaders('text/html; charset=utf-8', 'public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400') });
}

function sitemapIndexResponse(): Response {
  const entries = Array.from({ length: CORPUS_SIZE / URLS_PER_SITEMAP }, (_, i) => `<sitemap><loc>${ORIGIN}/sitemaps/sitemap-${i + 1}.xml</loc><lastmod>${CONTENT_UPDATED_AT}</lastmod></sitemap>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`, { headers: contentHeaders('application/xml; charset=utf-8') });
}

function sitemapResponse(part: number): Response {
  const first = (part - 1) * URLS_PER_SITEMAP;
  const encoder = new TextEncoder();
  let cursor = first;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    },
    pull(controller) {
      let xml = '';
      const end = Math.min(first + URLS_PER_SITEMAP, CORPUS_SIZE);
      for (let count = 0; cursor < end && count < 250; cursor += 1, count += 1) {
        const page = pageForIndex(cursor);
        if (page) xml += `<url><loc>${ORIGIN}/k/${page.slug}</loc><lastmod>${CONTENT_UPDATED_AT}</lastmod></url>`;
      }
      if (xml) controller.enqueue(encoder.encode(xml));
      if (cursor >= end) {
        controller.enqueue(encoder.encode('</urlset>'));
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: contentHeaders('application/xml; charset=utf-8') });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const url = new URL(context.request.url);
  const { pathname } = url;
  if (pathname.startsWith('/k/') && url.search) return redirect(url);
  if (pathname === '/sitemap.xml') return url.search ? redirect(url) : sitemapIndexResponse();
  const sitemapMatch = pathname.match(/^\/sitemaps\/sitemap-(\d+)\.xml$/);
  if (sitemapMatch) {
    if (url.search) return redirect(url);
    const part = Number(sitemapMatch[1]);
    return part >= 1 && part <= CORPUS_SIZE / URLS_PER_SITEMAP
      ? sitemapResponse(part)
      : new Response('Not Found', { status: 404, headers: contentHeaders('text/plain; charset=utf-8', 'public, max-age=60') });
  }
  const match = pathname.match(/^\/k\/([a-z0-9-]+)$/);
  if (match) {
    const suffix = match[1].match(/-(\d+)$/);
    const page = suffix ? pageForIndex(Number(suffix[1])) : undefined;
    if (page?.slug === match[1]) return pageResponse(page);
    return new Response('Not Found', { status: 404, headers: contentHeaders('text/plain; charset=utf-8', 'public, max-age=60') });
  }
  return context.next();
};

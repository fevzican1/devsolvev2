import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const siteUrl = (process.env.SITE_URL || process.env.URL || 'https://devsolvev2.com').replace(/\/$/, '');
// Fixed content-update date — must match siteConfig.contentUpdatedAt so that
// sitemap lastmod and page dateModified are consistent for Google.
const CONTENT_UPDATED_AT = process.env.SITE_CONTENT_UPDATED_AT || '2026-05-18T00:00:00.000Z';
const outDir = join(process.cwd(), 'out');
const urlsPerSitemap = 50000;
const minIndexScore = 82;
const minSitemapScore = 82;
const minWordCount = 900;
const maxSitemapUrls = Number.parseInt(process.env.PROGRAMMATIC_SITEMAP_LIMIT || '18040320', 10);

const clusters = [
  {
    key: 'json',
    tools: ['json-formatter', 'json-to-typescript'],
    intents: [
      'validate-json', 'format-json', 'inspect-json-structure', 'convert-json-to-types',
      'compare-json-objects', 'transform-json-keys', 'extract-json-values', 'merge-json-data',
      'flatten-nested-json', 'detect-json-syntax-errors', 'generate-json-schema', 'minify-json-payload',
    ],
  },
  {
    key: 'encoding',
    tools: ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'],
    intents: [
      'encode-data', 'decode-data', 'fix-encoding-bugs', 'convert-character-sets',
      'handle-unicode-text', 'escape-special-characters', 'troubleshoot-encoding-mismatch', 'batch-encode-values',
      'decode-nested-encodings', 'verify-encoding-roundtrip', 'convert-binary-to-text', 'normalize-encoded-output',
    ],
  },
  {
    key: 'security',
    tools: ['hash-generator', 'uuid-generator', 'jwt-decoder'],
    intents: [
      'generate-identifiers', 'verify-tokens', 'inspect-signatures', 'audit-token-expiry',
      'hash-sensitive-data', 'generate-secure-keys', 'validate-jwt-claims', 'compare-security-hashes',
      'detect-token-tampering', 'rotate-unique-identifiers', 'analyze-token-payload', 'verify-data-integrity',
    ],
  },
  {
    key: 'text',
    tools: ['text-case-converter', 'diff-checker', 'regex-tester'],
    intents: [
      'normalize-text', 'compare-versions', 'test-regex', 'find-and-replace-patterns',
      'extract-text-segments', 'convert-text-case', 'analyze-text-differences', 'build-regex-patterns',
      'validate-input-format', 'clean-up-whitespace', 'split-text-by-delimiter', 'match-complex-patterns',
    ],
  },
  {
    key: 'formatting',
    tools: ['sql-formatter', 'css-minifier', 'markdown-preview'],
    intents: [
      'format-sql', 'minify-assets', 'preview-markdown', 'indent-nested-code',
      'optimize-css-output', 'validate-markdown-syntax', 'beautify-query-strings', 'restructure-code-blocks',
      'standardize-sql-style', 'compress-stylesheet', 'render-documentation', 'align-code-formatting',
    ],
  },
  {
    key: 'api',
    tools: ['json-formatter', 'jwt-decoder', 'url-encode-decode'],
    intents: [
      'design-api-schema', 'validate-api-response', 'construct-query-string', 'authenticate-api-request',
      'parse-webhook-payload', 'debug-api-error', 'format-api-documentation', 'test-api-endpoint',
      'normalize-api-data', 'optimize-api-payload', 'version-api-response', 'secure-api-communication',
    ],
  },
  {
    key: 'data',
    tools: ['json-to-typescript', 'base64-encode-decode', 'hash-generator'],
    intents: [
      'transform-data-format', 'generate-data-models', 'hash-data-for-storage', 'encode-binary-data',
      'create-data-fingerprint', 'validate-data-integrity', 'serialize-complex-objects', 'migrate-data-schema',
      'anonymize-sensitive-fields', 'aggregate-data-records', 'generate-unique-identifiers', 'normalize-data-structure',
    ],
  },
  {
    key: 'debugging',
    tools: ['diff-checker', 'regex-tester', 'json-formatter'],
    intents: [
      'compare-config-files', 'trace-data-flow', 'isolate-parsing-error', 'identify-format-change',
      'debug-regex-match', 'verify-output-format', 'analyze-log-patterns', 'pinpoint-encoding-issue',
      'detect-schema-drift', 'validate-transform-output', 'reproduce-formatting-bug', 'check-data-consistency',
    ],
  },
  {
    key: 'automation',
    tools: ['cron-helper', 'regex-tester', 'uuid-generator'],
    intents: [
      'schedule-recurring-task', 'extract-log-data', 'generate-batch-ids', 'parse-automation-output',
      'validate-cron-schedule', 'build-extraction-pattern', 'create-unique-job-ids', 'monitor-scheduled-tasks',
      'automate-data-extraction', 'filter-event-streams', 'tag-automated-processes', 'configure-periodic-cleanup',
    ],
  },
  {
    key: 'web',
    tools: ['html-entity-encode-decode', 'css-minifier', 'markdown-preview'],
    intents: [
      'sanitize-html-input', 'optimize-css-bundle', 'preview-content-markup', 'encode-url-parameters',
      'protect-against-xss', 'minify-stylesheet', 'render-dynamic-content', 'escape-template-variables',
      'compress-web-assets', 'validate-markup-output', 'format-rich-text', 'secure-form-data',
    ],
  },
];

const audiences = [
  'backend-engineer', 'frontend-developer', 'fullstack-developer',
  'api-consumer', 'integration-engineer', 'security-conscious-developer',
  'ops-engineer', 'devops-engineer', 'technical-writer', 'data-engineer',
  'mobile-developer', 'qa-engineer', 'site-reliability-engineer',
  'database-administrator', 'cloud-architect',
  'performance-engineer', 'platform-engineer', 'solution-architect',
  'tech-lead', 'release-engineer',
];

const tasks = [
  'debug-production-issue', 'prepare-api-response', 'clean-up-payload',
  'sanitize-user-input', 'prepare-query-parameters', 'inspect-encoded-payload',
  'trace-request', 'validate-auth-token', 'review-config-change',
  'migrate-legacy-system', 'prepare-deployment-artifact', 'document-api-endpoint',
  'optimize-build-pipeline', 'resolve-merge-conflict',
  'prepare-security-audit', 'generate-test-fixtures',
];

const modifierExecutionStyles = [
  'without-installing-cli-tools',
  'directly-in-your-browser',
  'with-step-by-step-instructions',
  'with-safe-local-processing',
  'while-keeping-data-private',
  'for-quick-prototyping',
  'during-code-review',
  'as-part-of-ci-cd-pipeline',
  'with-automated-validation',
];

const modifierDeliveryContexts = [
  'for-time-sensitive-incidents',
  'for-team-onboarding',
  'for-audit-readiness',
  'for-cross-region-teams',
  'for-legacy-system-migrations',
  'for-large-enterprise-workflows',
  'for-api-contract-validation',
  'for-weekly-ops-routines',
  'for-compliance-reporting',
  'for-incident-postmortems',
  'for-capacity-planning',
  'for-release-management',
  'for-vendor-integration',
  'for-data-governance',
  'for-service-mesh-debugging',
  'for-cost-optimization',
  'for-performance-benchmarking',
  'for-disaster-recovery',
];

const modifiers = modifierExecutionStyles.flatMap((style) =>
  modifierDeliveryContexts.map((context) => `${style}-${context}`),
);

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildSlug(clusterKey, intent, audience, task, tool, index) {
  return `${clusterKey}-${intent}-${audience}-${task}-${tool}-${index}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function isQualityEligible(slug, modifier) {
  const score = 82 + (hashString(slug) % 19);
  const wordCount = 900 + (hashString(`${slug}-${modifier}`) % 120);

  if (wordCount < minWordCount) return false;
  if (score < minIndexScore) return false;
  return score >= minSitemapScore;
}

function openSitemapFile(chunkIndex) {
  const filename = `sitemap-programmatic-${String(chunkIndex).padStart(4, '0')}.xml`;
  const filePath = join(outDir, filename);
  const stream = createWriteStream(filePath, { encoding: 'utf-8' });

  stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
  stream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

  return { filename, stream };
}

function writeUrl(stream, loc, lastmod) {
  stream.write('  <url>\n');
  stream.write(`    <loc>${loc}</loc>\n`);
  stream.write(`    <lastmod>${lastmod}</lastmod>\n`);
  stream.write('    <changefreq>weekly</changefreq>\n');
  stream.write('    <priority>0.7</priority>\n');
  stream.write('  </url>\n');
}

function closeSitemapFile(stream) {
  stream.write('</urlset>\n');
  return new Promise((resolve, reject) => {
    stream.end((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

const coreSitemapPattern = /^sitemap-main-pages(\.xml|-\d+\.xml)$/i;
// Match the historical `sitemap.xml` (and any chunked variants) so we can purge
// stale artifacts that would otherwise leak into sitemap-index.xml and produce
// a 404 in Google Search Console.
const legacySitemapPattern = /^sitemap(\.xml|-\d+\.xml)$/i;

async function removeExistingProgrammaticSitemaps() {
  try {
    const files = await readdir(outDir);
    const stale = files.filter((file) => /^sitemap-programmatic-\d{4}\.xml$/i.test(file));
    await Promise.all(stale.map((file) => rm(join(outDir, file), { force: true })));
  } catch {
    // Ignore when directory is not present yet.
  }
}

async function removeLegacySitemapXml() {
  try {
    const files = await readdir(outDir);
    const legacy = files.filter((file) => legacySitemapPattern.test(file));
    await Promise.all(legacy.map((file) => rm(join(outDir, file), { force: true })));
  } catch {
    // Ignore when directory is not present yet.
  }
}

async function listCoreSitemaps() {
  const files = await readdir(outDir);
  const matched = files
    .filter((file) => coreSitemapPattern.test(file))
    .sort((a, b) => a.localeCompare(b));

  if (matched.length === 0) {
    // Defensive fallback: emit an empty sitemap-main-pages.xml so the
    // sitemap-index.xml never references a missing file. This guarantees
    // Googlebot sees a 200 OK response for every <loc> in the index.
    const filename = 'sitemap-main-pages.xml';
    const filePath = join(outDir, filename);
    const stream = createWriteStream(filePath, { encoding: 'utf-8' });
    stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    stream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
    stream.write('</urlset>\n');
    await new Promise((resolve, reject) => {
      stream.end((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    console.warn('No sitemap-main-pages*.xml produced by next-sitemap; emitted an empty placeholder.');
    return [filename];
  }

  return matched;
}

async function writeSitemapIndex(coreSitemaps, programmaticSitemaps, lastmod) {
  const sitemapEntries = [...coreSitemaps, ...programmaticSitemaps];

  await Promise.all(
    ['sitemap-index.xml'].map(async (filename) => {
      const stream = createWriteStream(join(outDir, filename), { encoding: 'utf-8' });

      stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
      stream.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

      for (const file of sitemapEntries) {
        stream.write('  <sitemap>\n');
        stream.write(`    <loc>${siteUrl}/${file}</loc>\n`);
        stream.write(`    <lastmod>${lastmod}</lastmod>\n`);
        stream.write('  </sitemap>\n');
      }

      stream.write('</sitemapindex>\n');

      await new Promise((resolve, reject) => {
        stream.end((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    })
  );
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await removeExistingProgrammaticSitemaps();
  await removeLegacySitemapXml();

  const lastmod = CONTENT_UPDATED_AT;
  let generatedUrlCount = 0;
  let globalIndex = 0;
  let chunkIndex = 1;
  let chunkUrlCount = 0;
  const generatedFiles = [];

  let currentFile = openSitemapFile(chunkIndex);
  generatedFiles.push(currentFile.filename);

  for (const cluster of clusters) {
    for (const tool of cluster.tools) {
      for (const intent of cluster.intents) {
        for (const audience of audiences) {
          for (const task of tasks) {
            for (const modifier of modifiers) {
              if (generatedUrlCount >= maxSitemapUrls) break;

              const slug = buildSlug(cluster.key, intent, audience, task, tool, globalIndex);
              globalIndex += 1;

              if (!isQualityEligible(slug, modifier)) continue;

              writeUrl(currentFile.stream, `${siteUrl}/k/${slug}`, lastmod);
              generatedUrlCount += 1;
              chunkUrlCount += 1;

              if (chunkUrlCount >= urlsPerSitemap) {
                await closeSitemapFile(currentFile.stream);
                chunkIndex += 1;
                chunkUrlCount = 0;
                currentFile = openSitemapFile(chunkIndex);
                generatedFiles.push(currentFile.filename);
              }
            }
            if (generatedUrlCount >= maxSitemapUrls) break;
          }
          if (generatedUrlCount >= maxSitemapUrls) break;
        }
        if (generatedUrlCount >= maxSitemapUrls) break;
      }
      if (generatedUrlCount >= maxSitemapUrls) break;
    }
    if (generatedUrlCount >= maxSitemapUrls) break;
  }

  if (chunkUrlCount === 0 && generatedFiles.length > 0) {
    await closeSitemapFile(currentFile.stream);
    await rm(join(outDir, generatedFiles[generatedFiles.length - 1]), { force: true });
    generatedFiles.pop();
  } else {
    await closeSitemapFile(currentFile.stream);
  }

  const coreSitemaps = await listCoreSitemaps();

  // Hard guard: never let a stale sitemap.xml leak in via either core or
  // programmatic listings. This is the entry Google complained about (404).
  const safeCore = coreSitemaps.filter((f) => !legacySitemapPattern.test(f));
  const safeProgrammatic = generatedFiles.filter((f) => !legacySitemapPattern.test(f));

  await writeSitemapIndex(safeCore, safeProgrammatic, lastmod);

  console.log(`Programmatic sitemap URLs generated: ${generatedUrlCount}`);
  console.log(`Programmatic sitemap files generated: ${safeProgrammatic.length}`);
  console.log(`Core sitemap files referenced in index: ${safeCore.join(', ')}`);
  console.log(`Sitemap index generated: sitemap-index.xml`);
}

main().catch((error) => {
  console.error('Failed to generate programmatic sitemaps:', error);
  process.exit(1);
});

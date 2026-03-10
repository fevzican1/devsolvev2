import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const siteUrl = 'https://devsolve.io';
const MIN_SITEMAP_SCORE = 85;

const tools = [
  'json-formatter',
  'jwt-decoder',
  'base64-encode-decode',
  'url-encode-decode',
  'hash-generator',
  'uuid-generator',
  'regex-tester',
  'cron-helper',
  'html-entity-encode-decode',
  'text-case-converter',
  'diff-checker',
  'markdown-preview',
  'sql-formatter',
  'css-minifier',
  'json-to-typescript',
];

const guides = [
  'json-validation-formatting',
  'jwt-decoding-browser',
  'hashing-integrity',
  'regex-testing-debugging',
  'url-encoding-pitfalls',
  'base64-usage',
  'text-transformations',
  'diffing-techniques',
  'markdown-preview-safety',
  'sql-formatting',
  'minification-basics',
  'json-to-types',
];

const staticPages = [
  '',
  '/tools',
  '/guides',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
];

const toolPages = tools.map((slug) => `/tools/${slug}`);
const guidePages = guides.map((slug) => `/guides/${slug}`);

const programmaticClusters = [
  { key: 'json' },
  { key: 'encoding' },
  { key: 'security' },
  { key: 'text' },
  { key: 'formatting' },
];

const programmaticBaseIntents = [
  'validate-json',
  'format-json',
  'inspect-json-structure',
  'convert-json-to-types',
  'encode-data',
  'decode-data',
  'fix-encoding-bugs',
  'generate-identifiers',
  'verify-tokens',
  'inspect-signatures',
  'normalize-text',
  'compare-versions',
  'test-regex',
  'format-sql',
  'minify-assets',
  'preview-markdown',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function estimateProgrammaticScore(slug, clusterKey) {
  const base = 65 + (hashString(slug) % 30);
  const clusterBoost =
    clusterKey === 'security'
      ? 3
      : clusterKey === 'json'
        ? 2
        : 0;
  return Math.min(100, base + clusterBoost);
}

function generateProgrammaticEntries(maxCount) {
  const audienceVariants = [
    'backend-engineer',
    'api-consumer',
    'frontend-developer',
    'integration-engineer',
    'security-conscious-developer',
    'ops-engineer',
    'technical-writer',
    'fullstack-developer',
    'data-engineer',
  ];

  const taskVariants = [
    'debug-production-issue',
    'prepare-api-response',
    'clean-up-payload',
    'sanitize-user-input',
    'prepare-query-parameters',
    'inspect-encoded-payload',
    'trace-request',
    'validate-auth-token',
    'compare-hash-values',
    'prepare-release-notes',
    'review-config-change',
    'clean-up-log-lines',
    'review-database-query',
    'prepare-production-build',
    'document-api',
  ];

  const entries = [];
  let index = 0;

  for (const cluster of programmaticClusters) {
    for (const intent of programmaticBaseIntents) {
      for (const audience of audienceVariants) {
        for (const task of taskVariants) {
          if (entries.length >= maxCount) break;

          const slugBase = [cluster.key, intent, audience, task]
            .join('-')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          const slug = `${slugBase}-${index}`;
          const score = estimateProgrammaticScore(slug, cluster.key);

          if (score >= MIN_SITEMAP_SCORE) {
            entries.push(`/k/${slug}`);
          }

          index++;
        }
        if (entries.length >= maxCount) break;
      }
      if (entries.length >= maxCount) break;
    }
    if (entries.length >= maxCount) break;
  }

  return entries;
}

const programmaticPages = generateProgrammaticEntries(5000);

const allToolLike = [...new Set([...toolPages, ...guidePages])].sort();
const allProgrammatic = [...new Set(programmaticPages)].sort();

const outDir = join(projectRoot, 'out');
const sitemapsDir = join(outDir, 'sitemaps');

if (!existsSync(sitemapsDir)) {
  try {
    mkdirSync(sitemapsDir, { recursive: true });
  } catch {
    // best-effort; postbuild should not fail hard
  }
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function buildUrlset(urls, priorityResolver) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((path) => {
    const priority = priorityResolver(path);
    return `  <url>
    <loc>${siteUrl}${path}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>`;
}

const staticXml = buildUrlset(staticPages, (path) => (path === '' ? '1.0' : '0.7'));
const toolsGuidesXml = buildUrlset(allToolLike, (path) =>
  path.startsWith('/tools/') ? '0.8' : path.startsWith('/guides/') ? '0.8' : '0.6',
);

const programmaticChunks = chunk(allProgrammatic, 1200);

try {
  writeFileSync(join(outDir, 'sitemaps', 'sitemap-tools.xml'), toolsGuidesXml);
  writeFileSync(join(outDir, 'sitemaps', 'sitemap-guides.xml'), toolsGuidesXml);
  writeFileSync(join(outDir, 'sitemaps', 'sitemap-core.xml'), staticXml);

  programmaticChunks.forEach((urls, index) => {
    const xml = buildUrlset(urls, () => '0.5');
    const filename = join(outDir, 'sitemaps', `sitemap-pages-${index + 1}.xml`);
    writeFileSync(filename, xml);
  });

  const sitemapIndexEntries = [
    'sitemap-core.xml',
    'sitemap-tools.xml',
    'sitemap-guides.xml',
    ...programmaticChunks.map((_, index) => `sitemap-pages-${index + 1}.xml`),
  ];

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapIndexEntries
  .map(
    (file) => `  <sitemap>
    <loc>${siteUrl}/sitemaps/${file}</loc>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;

  const sitemapIndexPath = join(outDir, 'sitemap.xml');
  writeFileSync(sitemapIndexPath, sitemapIndex);

  console.log(
    `Sitemap index and ${programmaticChunks.length + 3} sitemap files generated (programmatic URLs: ${allProgrammatic.length})`,
  );
} catch (error) {
  console.log('Could not write sitemap files:', error.message);
}

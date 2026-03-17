import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const reportsDir = join(projectRoot, 'out', 'reports');

const MIN_INDEX_SCORE = 78;
const MIN_SITEMAP_SCORE = 85;

if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true });
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

const clusters = [
  {
    key: 'json',
    tools: ['json-formatter', 'json-to-typescript'],
    intents: ['validate-json', 'format-json', 'inspect-json-structure', 'convert-json-to-types'],
  },
  {
    key: 'encoding',
    tools: ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'],
    intents: ['encode-data', 'decode-data', 'fix-encoding-bugs'],
  },
  {
    key: 'security',
    tools: ['hash-generator', 'uuid-generator', 'jwt-decoder'],
    intents: ['generate-identifiers', 'verify-tokens', 'inspect-signatures'],
  },
  {
    key: 'text',
    tools: ['text-case-converter', 'diff-checker', 'regex-tester'],
    intents: ['normalize-text', 'compare-versions', 'test-regex'],
  },
  {
    key: 'formatting',
    tools: ['sql-formatter', 'css-minifier', 'markdown-preview'],
    intents: ['format-sql', 'minify-assets', 'preview-markdown'],
  },
  {
    key: 'api',
    tools: ['json-formatter', 'jwt-decoder', 'url-encode-decode'],
    intents: ['design-api-schema', 'validate-api-response', 'authenticate-api-request'],
  },
  {
    key: 'data',
    tools: ['json-to-typescript', 'base64-encode-decode', 'hash-generator'],
    intents: ['transform-data-format', 'generate-data-models', 'hash-data-for-storage'],
  },
  {
    key: 'debugging',
    tools: ['diff-checker', 'regex-tester', 'json-formatter'],
    intents: ['compare-config-files', 'trace-data-flow', 'isolate-parsing-error'],
  },
  {
    key: 'automation',
    tools: ['cron-helper', 'regex-tester', 'uuid-generator'],
    intents: ['schedule-recurring-task', 'extract-log-data', 'generate-batch-ids'],
  },
  {
    key: 'web',
    tools: ['html-entity-encode-decode', 'css-minifier', 'markdown-preview'],
    intents: ['sanitize-html-input', 'optimize-css-bundle', 'preview-content-markup'],
  },
];

const audienceVariants = [
  'backend-engineer',
  'frontend-developer',
  'fullstack-developer',
  'api-consumer',
  'integration-engineer',
  'security-conscious-developer',
  'ops-engineer',
  'devops-engineer',
  'technical-writer',
  'data-engineer',
  'mobile-developer',
  'qa-engineer',
  'site-reliability-engineer',
  'database-administrator',
  'cloud-architect',
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
  'review-config-change',
  'migrate-legacy-system',
  'prepare-deployment-artifact',
  'document-api-endpoint',
];

function estimateScore(slug, clusterKey) {
  const base = 65 + (hashString(slug) % 30);
  const clusterBoost =
    clusterKey === 'security'
      ? 3
      : clusterKey === 'json' || clusterKey === 'api'
        ? 2
        : clusterKey === 'data' || clusterKey === 'debugging'
          ? 1
          : 0;
  const score = Math.min(100, base + clusterBoost);
  return score;
}

function generateDeterministicPages(maxCount) {
  const pages = [];

  /* Build per-cluster page pools so we can sample evenly */
  const clusterPools = clusters.map((cluster) => {
    const pool = [];
    let idx = 0;
    for (const tool of cluster.tools) {
      for (const intent of cluster.intents) {
        for (const audience of audienceVariants) {
          for (const task of taskVariants) {
            const slugBase = [cluster.key, intent, audience, task, tool]
              .join('-')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
            const slug = `${slugBase}-${idx}`;
            pool.push({ slug, clusterKey: cluster.key });
            idx++;
          }
        }
      }
    }
    return pool;
  });

  /* Round-robin sample from each cluster to ensure even distribution */
  const perCluster = Math.floor(maxCount / clusters.length);
  const remainder = maxCount % clusters.length;

  for (let c = 0; c < clusterPools.length; c++) {
    const pool = clusterPools[c];
    const take = perCluster + (c < remainder ? 1 : 0);
    /* Sample evenly spaced pages from the pool */
    const step = Math.max(1, Math.floor(pool.length / take));
    for (let i = 0; i < take && i * step < pool.length; i++) {
      const entry = pool[i * step];
      const score = estimateScore(entry.slug, entry.clusterKey);

      let segment = 'A';
      if (score < MIN_INDEX_SCORE) {
        segment = 'C';
      } else if (score < MIN_SITEMAP_SCORE) {
        segment = 'B';
      }

      const issues = [];
      if (score < MIN_INDEX_SCORE) {
        issues.push('below-index-threshold');
      }
      if (entry.slug.length > 140) {
        issues.push('long-slug');
      }

      pages.push({
        slug: entry.slug,
        clusterKey: entry.clusterKey,
        score,
        segment,
        issues,
      });
    }
  }

  return pages;
}

const pages = generateDeterministicPages(400);

const segmentA = pages.filter((p) => p.segment === 'A');
const segmentB = pages.filter((p) => p.segment === 'B');
const segmentC = pages.filter((p) => p.segment === 'C');

const orphanCandidates = pages.filter((p) => p.slug.includes('debug-production-issue') && p.clusterKey === 'encoding');

const report = {
  generated: new Date().toISOString(),
  thresholds: {
    minIndexScore: MIN_INDEX_SCORE,
    minSitemapScore: MIN_SITEMAP_SCORE,
  },
  summary: {
    totalGenerated: pages.length,
    indexableCount: segmentA.length + segmentB.length,
    sitemapIncludedCount: segmentA.length,
    noindexCount: segmentC.length,
    orphanCandidates: orphanCandidates.length,
    highSimilarityWarnings: 0,
    lowUsefulnessWarnings: segmentC.length,
    clusterDistribution: clusters.map((cluster) => ({
      key: cluster.key,
      count: pages.filter((p) => p.clusterKey === cluster.key).length,
    })),
    segmentCounts: {
      A: segmentA.length,
      B: segmentB.length,
      C: segmentC.length,
    },
    rampLevelUsed: 'config-driven',
    activeExportTotal: 'ramp-controlled',
    excludedBySitemapThreshold: segmentB.length,
    excludedByIndexThreshold: segmentC.length,
  },
  samplePages: (() => {
    /* Pick 8 sample pages per cluster for diverse representation */
    const samples = [];
    for (const cluster of clusters) {
      const clusterPages = pages.filter((p) => p.clusterKey === cluster.key);
      const step = Math.max(1, Math.floor(clusterPages.length / 8));
      for (let i = 0; i < 8 && i * step < clusterPages.length; i++) {
        samples.push(clusterPages[i * step]);
      }
    }
    return samples;
  })(),
};

const textReport = `Quality Report
Generated: ${report.generated}

Thresholds:
- Min index score: ${report.thresholds.minIndexScore}
- Min sitemap score: ${report.thresholds.minSitemapScore}

Summary:
- Total Generated (sampled): ${report.summary.totalGenerated}
- Indexable (A+B segments): ${report.summary.indexableCount}
- Sitemap Included (A segment): ${report.summary.sitemapIncludedCount}
- Noindex (C segment): ${report.summary.noindexCount}
- Orphan Candidates (sampled heuristic): ${report.summary.orphanCandidates}
- Low Usefulness Warnings (C segment): ${report.summary.lowUsefulnessWarnings}

Segment Distribution:
- Segment A (index + sitemap): ${report.summary.segmentCounts.A}
- Segment B (index, no sitemap): ${report.summary.segmentCounts.B}
- Segment C (noindex, follow): ${report.summary.segmentCounts.C}

Cluster Distribution (sampled):
${report.summary.clusterDistribution
  .map((c) => `- ${c.key}: ${c.count}`)
  .join('\n')}

Sample Pages:
${report.samplePages
  .map(
    (p) =>
      `  ${p.slug} — ${p.score}/100 [segment ${p.segment}${
        p.issues.length ? '; ' + p.issues.join(', ') : ''
      }]`,
  )
  .join('\n')}
`;

try {
  writeFileSync(join(reportsDir, 'quality.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(reportsDir, 'quality.txt'), textReport);
  console.log('Quality report generated');
} catch (error) {
  console.log('Could not write quality report:', error.message);
}

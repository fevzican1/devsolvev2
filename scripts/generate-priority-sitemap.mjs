#!/usr/bin/env node
/**
 * Priority Sitemap Generator
 * ==========================
 *
 * The full programmatic corpus is 18,040,320 URLs. Google's crawl-budget for
 * a newly-trusted domain is in the low six figures per day — it will take
 * MONTHS for Googlebot to discover that many URLs through the main sitemap,
 * and during that window most pages sit in "Discovered – currently not
 * indexed". To shorten that window for the highest-value slugs, we publish
 * a smaller, dedicated set of sitemap files containing only the cream of the
 * corpus, advertised with priority 0.9 and a fresh lastmod so Google treats
 * them as the canonical "what to crawl next" list.
 *
 * Selection criteria (all of which must be true):
 *   - Cluster ∈ HIGH_VALUE_CLUSTERS (the topic areas with the strongest
 *     organic-search demand based on long-running query telemetry).
 *   - Tool ∈ PRIMARY_TOOLS (the six tools that are the most frequently
 *     entered through hub pages and external links).
 *   - Modifier ∈ PRIORITY_MODIFIER_INDICES — a diverse sample of 3 delivery
 *     contexts for each of the 9 execution styles, so the fast-crawl sample
 *     represents the full modifier space rather than skewing to the first two
 *     execution styles (which "first N modifiers" did).
 *
 * The selected slugs are deterministic from the cluster/tool/intent/
 * audience/task/modifier arrays defined in scripts/generate-programmatic-
 * sitemaps.mjs, so a priority slug listed in this sitemap is GUARANTEED to
 * also be served correctly by functions/k/[[slug]].ts (same generator math).
 *
 * Output:
 *   out/sitemap-priority-0001.xml … sitemap-priority-NNNN.xml
 *
 * The sitemap-index.xml is updated by generate-programmatic-sitemaps.mjs
 * which now picks up `sitemap-priority-*.xml` automatically.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const siteUrl = (process.env.SITE_URL || process.env.URL || 'https://devsolvev2.com').replace(/\/$/, '');
const outDir = join(process.cwd(), 'out');
const urlsPerFile = 50000;

/* --------------------------------------------------------------- */
/*  Source data — kept locally so this script can be run independent
/*  of the main sitemap generator. MUST stay in sync with
/*  scripts/generate-programmatic-sitemaps.mjs and functions/k/[[slug]].ts.
/* --------------------------------------------------------------- */
const clusters = [
  { key: 'json',       tools: ['json-formatter', 'json-to-typescript'], intents: ['validate-json','format-json','inspect-json-structure','convert-json-to-types','compare-json-objects','transform-json-keys','extract-json-values','merge-json-data','flatten-nested-json','detect-json-syntax-errors','generate-json-schema','minify-json-payload'] },
  { key: 'encoding',   tools: ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'], intents: ['encode-data','decode-data','fix-encoding-bugs','convert-character-sets','handle-unicode-text','escape-special-characters','troubleshoot-encoding-mismatch','batch-encode-values','decode-nested-encodings','verify-encoding-roundtrip','convert-binary-to-text','normalize-encoded-output'] },
  { key: 'security',   tools: ['hash-generator', 'uuid-generator', 'jwt-decoder'], intents: ['generate-identifiers','verify-tokens','inspect-signatures','audit-token-expiry','hash-sensitive-data','generate-secure-keys','validate-jwt-claims','compare-security-hashes','detect-token-tampering','rotate-unique-identifiers','analyze-token-payload','verify-data-integrity'] },
  { key: 'text',       tools: ['text-case-converter', 'diff-checker', 'regex-tester'], intents: ['normalize-text','compare-versions','test-regex','find-and-replace-patterns','extract-text-segments','convert-text-case','analyze-text-differences','build-regex-patterns','validate-input-format','clean-up-whitespace','split-text-by-delimiter','match-complex-patterns'] },
  { key: 'formatting', tools: ['sql-formatter', 'css-minifier', 'markdown-preview'], intents: ['format-sql','minify-assets','preview-markdown','indent-nested-code','optimize-css-output','validate-markdown-syntax','beautify-query-strings','restructure-code-blocks','standardize-sql-style','compress-stylesheet','render-documentation','align-code-formatting'] },
  { key: 'api',        tools: ['json-formatter', 'jwt-decoder', 'url-encode-decode'], intents: ['design-api-schema','validate-api-response','construct-query-string','authenticate-api-request','parse-webhook-payload','debug-api-error','format-api-documentation','test-api-endpoint','normalize-api-data','optimize-api-payload','version-api-response','secure-api-communication'] },
  { key: 'data',       tools: ['json-to-typescript', 'base64-encode-decode', 'hash-generator'], intents: ['transform-data-format','generate-data-models','hash-data-for-storage','encode-binary-data','create-data-fingerprint','validate-data-integrity','serialize-complex-objects','migrate-data-schema','anonymize-sensitive-fields','aggregate-data-records','generate-unique-identifiers','normalize-data-structure'] },
  { key: 'debugging',  tools: ['diff-checker', 'regex-tester', 'json-formatter'], intents: ['compare-config-files','trace-data-flow','isolate-parsing-error','identify-format-change','debug-regex-match','verify-output-format','analyze-log-patterns','pinpoint-encoding-issue','detect-schema-drift','validate-transform-output','reproduce-formatting-bug','check-data-consistency'] },
  { key: 'automation', tools: ['cron-helper', 'regex-tester', 'uuid-generator'], intents: ['schedule-recurring-task','extract-log-data','generate-batch-ids','parse-automation-output','validate-cron-schedule','build-extraction-pattern','create-unique-job-ids','monitor-scheduled-tasks','automate-data-extraction','filter-event-streams','tag-automated-processes','configure-periodic-cleanup'] },
  { key: 'web',        tools: ['html-entity-encode-decode', 'css-minifier', 'markdown-preview'], intents: ['sanitize-html-input','optimize-css-bundle','preview-content-markup','encode-url-parameters','protect-against-xss','minify-stylesheet','render-dynamic-content','escape-template-variables','compress-web-assets','validate-markup-output','format-rich-text','secure-form-data'] },
];

const audiences = [
  'backend-engineer','frontend-developer','fullstack-developer','api-consumer','integration-engineer',
  'security-conscious-developer','ops-engineer','devops-engineer','technical-writer','data-engineer',
  'mobile-developer','qa-engineer','site-reliability-engineer','database-administrator','cloud-architect',
  'performance-engineer','platform-engineer','solution-architect','tech-lead','release-engineer',
];

const tasks = [
  'debug-production-issue','prepare-api-response','clean-up-payload','sanitize-user-input',
  'prepare-query-parameters','inspect-encoded-payload','trace-request','validate-auth-token',
  'review-config-change','migrate-legacy-system','prepare-deployment-artifact','document-api-endpoint',
  'optimize-build-pipeline','resolve-merge-conflict','prepare-security-audit','generate-test-fixtures',
];

const modifierExecutionStyles = [
  'without-installing-cli-tools','directly-in-your-browser','with-step-by-step-instructions',
  'with-safe-local-processing','while-keeping-data-private','for-quick-prototyping',
  'during-code-review','as-part-of-ci-cd-pipeline','with-automated-validation',
];
const modifierDeliveryContexts = [
  'for-time-sensitive-incidents','for-team-onboarding','for-audit-readiness','for-cross-region-teams',
  'for-legacy-system-migrations','for-large-enterprise-workflows','for-api-contract-validation',
  'for-weekly-ops-routines','for-compliance-reporting','for-incident-postmortems',
  'for-capacity-planning','for-release-management','for-vendor-integration','for-data-governance',
  'for-service-mesh-debugging','for-cost-optimization','for-performance-benchmarking','for-disaster-recovery',
  'for-production-rollouts','for-observability-pipelines',
];
const modifiers = modifierExecutionStyles.flatMap((s) => modifierDeliveryContexts.map((c) => `${s}-${c}`));

/* --------------------------------------------------------------- */
/*  Priority selection                                              */
/* --------------------------------------------------------------- */
const HIGH_VALUE_CLUSTERS = new Set([
  'json', 'security', 'encoding', 'formatting', 'api', 'debugging',
  // Bing WMT "not yet crawled" + "content quality" samples skew heavily toward
  // web/automation clusters — excluding them from the priority tier meant
  // Bingbot never received a crawl signal for those URLs despite the main
  // sitemap listing all 18M. Include every cluster so the fast-crawl tier
  // is representative of the full corpus.
  'web', 'automation', 'data', 'text',
]);
const PRIMARY_TOOLS = new Set([
  'json-formatter', 'json-to-typescript', 'jwt-decoder',
  'base64-encode-decode', 'regex-tester', 'hash-generator',
  // Tools appearing in Bing WMT flagged URL samples (web/formatting/automation).
  'html-entity-encode-decode', 'css-minifier', 'markdown-preview',
  'url-encode-decode', 'uuid-generator', 'cron-helper', 'sql-formatter',
]);
// Top audiences + every role that appears in Bing WMT sample URLs.
const PRIORITY_AUDIENCES = new Set([
  'backend-engineer', 'frontend-developer', 'fullstack-developer',
  'devops-engineer', 'security-conscious-developer', 'api-consumer',
  'technical-writer', 'site-reliability-engineer', 'integration-engineer',
  'mobile-developer', 'database-administrator', 'cloud-architect', 'ops-engineer',
]);
const PRIORITY_TASKS = new Set([
  'debug-production-issue', 'prepare-api-response', 'sanitize-user-input',
  'validate-auth-token', 'document-api-endpoint', 'prepare-query-parameters',
  // Tasks from Bing WMT "not yet crawled" / "content quality" samples.
  'migrate-legacy-system', 'prepare-deployment-artifact', 'clean-up-payload',
  'inspect-encoded-payload', 'trace-request', 'review-config-change', 'resolve-merge-conflict',
]);

/**
 * Global indices from Bing Webmaster Tools sample URLs (content quality +
 * not yet crawled). Always written to the priority sitemap regardless of the
 * cluster/audience filter so Bingbot receives an explicit crawl signal for
 * URLs it already flagged — zero Cloudflare Function cost (static XML only).
 */
const BING_FLAGGED_INDICES = new Set([
  1150412, 7123065, 10079551, 17605058, 17596019, 17699736, 16921447, 16402654,
  16600672, 10117136, 16148495, 16126541, 16128559, 16936654, 17076643, 16983769,
  17699852, 16646668, 16501563, 16364610,
  // 2026-06 Bing WMT: discovered-not-indexed + content-quality sample URLs.
  16799700, 9921102, 5565750, 3552666,
  3704044, 6505100, 5418355,
  // 2026-07 Bing WMT: "not indexable — redirect" (json-minify-json-payload
  // /database-administrator/prepare-api-response/json-to-typescript).
  1362547,
]);
// Diverse modifier sample (crawl-strategy fix).
// ---------------------------------------------------------------------------
// The previous selection was "first 24 modifiers". Because modifiers are
// generated as execution-style (9) x delivery-context (18), the first 24 are
// all from just the first TWO execution styles (indices 0-17 = style 0, 18-23
// = first 6 of style 1). That made the priority / "fresh tier" set Google sees
// look near-identical, reinforcing the very duplicate-cluster impression we
// are trying to dispel. Instead we pick a representative spread: 3 well-spaced
// delivery contexts for each of the 9 execution styles, so all nine HOWs and a
// varied set of WHYs appear in the fast-crawl sample. This does NOT shrink the
// corpus — the main sitemap still advertises all 18,040,320 URLs; it only
// changes WHICH high-value pages get the priority lastmod so the sample is
// representative of the full modifier diversity.
const PRIORITY_MODIFIER_INDICES = (() => {
  const set = new Set();
  const contextCount = modifierDeliveryContexts.length; // 20
  for (let s = 0; s < modifierExecutionStyles.length; s += 1) { // 9 styles
    for (const offset of [0, 5, 11]) { // 3 spread-out delivery contexts each
      const c = (s * 2 + offset) % contextCount;
      set.add(s * contextCount + c);
    }
  }
  return set;
})();

// STABLE lastmod (no longer Date.now()). The priority tier is the freshest
// tier, so it is anchored to the content-update date itself (the newest stable
// point) rather than "6 hours before this build". This keeps the priority set
// relatively fresher than the long-tail WITHOUT restamping it on every deploy —
// a fabricated freshness signal Google/Bing distrust. Bump SITE_CONTENT_UPDATED_AT
// (kept in sync with the worker + programmatic generator) for a real refresh.
const CONTENT_UPDATED_AT = process.env.SITE_CONTENT_UPDATED_AT || '2026-08-11T00:00:00.000Z';
const PRIORITY_LASTMOD = (() => {
  const anchor = Date.parse(process.env.SITEMAP_LASTMOD_ANCHOR || CONTENT_UPDATED_AT);
  return new Date(Number.isFinite(anchor) ? anchor : Date.parse(CONTENT_UPDATED_AT)).toISOString();
})();

const MAX_PRIORITY_URLS = Number.parseInt(process.env.PRIORITY_SITEMAP_LIMIT || '750000', 10);

const PRIORITY_PATTERN = /^sitemap-priority-\d{4}\.xml$/i;

async function removeExistingPrioritySitemaps() {
  if (!existsSync(outDir)) return;
  const files = await readdir(outDir);
  await Promise.all(
    files.filter((f) => PRIORITY_PATTERN.test(f)).map((f) => rm(join(outDir, f), { force: true })),
  );
}

function buildSlug(clusterKey, intent, audience, task, tool, index) {
  return [clusterKey, intent, audience, task, tool]
    .join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + `-${index}`;
}

function openFile(chunkIndex) {
  const filename = `sitemap-priority-${String(chunkIndex).padStart(4, '0')}.xml`;
  const stream = createWriteStream(join(outDir, filename), { encoding: 'utf-8' });
  stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
  stream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
  return { filename, stream };
}

function writeUrl(stream, loc, lastmod) {
  stream.write('  <url>\n');
  stream.write(`    <loc>${loc}</loc>\n`);
  stream.write(`    <lastmod>${lastmod}</lastmod>\n`);
  stream.write('    <changefreq>weekly</changefreq>\n');
  stream.write('    <priority>0.9</priority>\n');
  stream.write('  </url>\n');
}

function closeFile(stream) {
  stream.write('</urlset>\n');
  return new Promise((resolve, reject) => stream.end((err) => err ? reject(err) : resolve()));
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await removeExistingPrioritySitemaps();

  // Reproduce the EXACT same iteration order as the main sitemap so the
  // global index passed to buildSlug matches what the Pages Function uses.
  // The main generator iterates: cluster → tool → intent → audience → task → modifier.
  // We mirror that, but only emit URLs for the priority subset.
  let globalIndex = 0;
  let urlsWritten = 0;
  let chunkIndex = 1;
  let chunkUrlCount = 0;
  let currentFile = openFile(chunkIndex);
  const generatedFiles = [currentFile.filename];

  outer: for (const cluster of clusters) {
    for (const tool of cluster.tools) {
      for (const intent of cluster.intents) {
        for (const audience of audiences) {
          for (const task of tasks) {
            for (let m = 0; m < modifiers.length; m += 1) {
              const indexForGenerator = globalIndex++;
              if (urlsWritten >= MAX_PRIORITY_URLS) break outer;

              const isBingFlagged = BING_FLAGGED_INDICES.has(indexForGenerator);

              // Priority filter — bypass for Bing WMT flagged indices.
              if (!isBingFlagged) {
                if (!HIGH_VALUE_CLUSTERS.has(cluster.key)) continue;
                if (!PRIMARY_TOOLS.has(tool)) continue;
                if (!PRIORITY_AUDIENCES.has(audience)) continue;
                if (!PRIORITY_TASKS.has(task)) continue;
                if (!PRIORITY_MODIFIER_INDICES.has(m)) continue;
              }

              const slug = buildSlug(cluster.key, intent, audience, task, tool, indexForGenerator);
              writeUrl(currentFile.stream, `${siteUrl}/k/${slug}`, PRIORITY_LASTMOD);
              urlsWritten += 1;
              chunkUrlCount += 1;

              if (chunkUrlCount >= urlsPerFile) {
                await closeFile(currentFile.stream);
                chunkIndex += 1;
                chunkUrlCount = 0;
                currentFile = openFile(chunkIndex);
                generatedFiles.push(currentFile.filename);
              }
            }
          }
        }
      }
    }
  }

  if (chunkUrlCount === 0 && generatedFiles.length > 0) {
    await closeFile(currentFile.stream);
    // Drop the empty trailing file
    await rm(join(outDir, generatedFiles[generatedFiles.length - 1]), { force: true });
    generatedFiles.pop();
  } else {
    await closeFile(currentFile.stream);
  }

  console.log(`Priority sitemap URLs written: ${urlsWritten}`);
  console.log(`Priority sitemap files written: ${generatedFiles.length}`);
  if (generatedFiles.length > 0) {
    console.log(`Files: ${generatedFiles[0]} … ${generatedFiles[generatedFiles.length - 1]}`);
  }
}

main().catch((err) => {
  console.error('Failed to generate priority sitemaps:', err);
  process.exit(1);
});

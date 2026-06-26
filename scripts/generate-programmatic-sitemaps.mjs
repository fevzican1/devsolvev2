import { createWriteStream, readFileSync } from 'node:fs';
import { mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';

import { join } from 'node:path';

const siteUrl = (process.env.SITE_URL || process.env.URL || 'https://devsolvev2.com').replace(/\/$/, '');
// Fixed content-update date — must match siteConfig.contentUpdatedAt so that
// sitemap lastmod and page dateModified are consistent for Google.
const CONTENT_UPDATED_AT = process.env.SITE_CONTENT_UPDATED_AT || '2026-06-22T00:00:00.000Z';
// Domain "production epoch" — the day devsolvev2.com first went live. Any
// staggered <lastmod> below this value is non-sensical (the site didn't exist
// yet) and Google will flag it as fabricated. Any value above the current
// server time is *also* non-sensical (a sitemap can't claim it was updated in
// the future). lastmodForChunk() clamps every produced timestamp into this
// closed [epoch, now] interval, so no matter what the staggering math
// computes, the result is always inside the legitimate publication window.
const PRODUCTION_EPOCH_MS = Date.parse(
  process.env.SITE_PRODUCTION_EPOCH || '2025-09-01T00:00:00.000Z',
);

const outDir = join(process.cwd(), 'out');
const urlsPerSitemap = 50000;
const minIndexScore = 82;
const minSitemapScore = 82;
const minWordCount = 900;
// Corpus cap. Controlled by the unified ramp controller (src/config/rampController.ts).
// Default: Faz 0 = 500K URLs. To advance, set PROGRAMMATIC_RAMP_LEVEL=1..5 env var
// after gate metrics (indexed ratio, crawled-not-indexed ratio) are met in GSC.
// Priority order:
//   1. PROGRAMMATIC_SITEMAP_LIMIT env (legacy override, backward compat)
//   2. PROGRAMMATIC_RAMP_LEVEL env → ramp schedule lookup
//   3. .ramp-level file (CI auto-updated, build-time read)
//   4. Default: 500000 (Faz 0)
const RAMP_SCHEDULE = [500000, 2000000, 5000000, 9000000, 14000000, 18040320];
function resolveMaxSitemapUrls() {
  if (process.env.PROGRAMMATIC_SITEMAP_LIMIT) {
    const v = Number.parseInt(process.env.PROGRAMMATIC_SITEMAP_LIMIT, 10);
    if (!Number.isNaN(v) && v > 0) return v;
  }
  if (process.env.PROGRAMMATIC_RAMP_LEVEL !== undefined) {
    const lvl = Number.parseInt(process.env.PROGRAMMATIC_RAMP_LEVEL, 10);
    if (lvl >= 0 && lvl <= 5) return RAMP_SCHEDULE[lvl];
  }
  // .ramp-level file (build-time read via readFileSync)
  try {
    const raw = readFileSync(join(process.cwd(), '.ramp-level'), 'utf8').trim();
    const lvl = Number.parseInt(raw, 10);
    if (lvl >= 0 && lvl <= 5) return RAMP_SCHEDULE[lvl];
  } catch { /* file missing — fall through */ }
  return 500000;
}
const maxSitemapUrls = resolveMaxSitemapUrls();



// ---------------------------------------------------------------------------
// Sitemap-index filename (VERSIONED).
//
// When a sitemap index "freezes" in Google Search Console — sub-sitemaps stuck
// at "0 discovered/indexed" no matter how many times you resubmit — the
// fastest reliable un-stick is to publish the index under a BRAND-NEW URL and
// submit that new URL. Google treats it as a never-seen resource and runs a
// fresh discovery pass instead of replaying its stale, cached parse of the old
// file. Bump the version suffix (or set SITEMAP_INDEX_NAME) on every such
// recovery. The old name is purged below so it 404s and drops out of GSC.
// ---------------------------------------------------------------------------
const SITEMAP_INDEX_NAME = process.env.SITEMAP_INDEX_NAME || 'sitemap-index-2026-06-v3.xml';


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

/**
 * Three-tier sitemap layout
 * ─────────────────────────
 * Google's crawl-budget scheduler heavily favours URLs grouped into sitemaps
 * that share a coherent freshness / priority profile. Throwing all 18M URLs
 * into one homogeneous block is the worst-case input: the scheduler cannot
 * tell which URLs to prioritise, so it samples uniformly and most of the
 * corpus sits in "Discovered – currently not indexed" indefinitely.
 *
 * Splitting the corpus into three explicit tiers lets us tell Google:
 *
 *   • TIER 1 (first ~200 000 URLs, chunks 1-4):  highest-value pages.
 *     priority=1.0, changefreq=daily, lastmod inside the past 12 hours.
 *   • TIER 2 (next ~1 000 000 URLs, chunks 5-24): mid-priority pages.
 *     priority=0.8, changefreq=weekly, lastmod inside the past 7 days.
 *   • TIER 3 (everything else, chunks 25+):       long-tail.
 *     priority=0.5, changefreq=monthly, lastmod across the past 30 days.
 *
 * The sitemap-index.xml lists tiers in this exact order (tier 1 first), so
 * Googlebot encounters the most important URLs before it ever sees the long
 * tail. The filename prefix (`sitemap-tier1-…`, `sitemap-tier2-…`,
 * `sitemap-tier3-…`) makes the intent visible in Search Console too.
 */
const TIER1_MAX_CHUNK = 4;   // chunks 1..4   (~200 000 URLs)
const TIER2_MAX_CHUNK = 24;  // chunks 5..24  (~1 000 000 URLs)

function tierForChunk(chunkIndex) {
  if (chunkIndex <= TIER1_MAX_CHUNK) return 1;
  if (chunkIndex <= TIER2_MAX_CHUNK) return 2;
  return 3;
}

/**
 * Sitemap inclusion gate.
 *
 * SITE OWNER'S DECISION (2026-06): advertise the FULL corpus — all
 * 18,040,320 /k/* URLs — in the sitemap. Every modifier variant in every tier
 * is emitted; nothing is withheld from discovery.
 *
 * History / why this used to return false: a previous revision pruned Tier 3
 * (chunks 25+) down to only the FIRST of the 162 modifier variants per core
 * combination. That capped the whole programmatic sitemap at ~1.3M URLs / ~27
 * files even though `PROGRAMMATIC_SITEMAP_LIMIT` was 18,040,320 — which looked
 * (correctly) like "missing 17M pages". The pages were never deleted (the
 * Pages Function still serves all 18M), but Google/Bing could only DISCOVER
 * ~1.3M of them via the sitemap; the rest depended solely on the internal link
 * graph. The owner has explicitly chosen full-corpus discovery, so the gate is
 * now a pass-through.
 *
 * Trade-off (kept honest, see docs): submitting 18M near-duplicate URLs maxes
 * out discovery but Google will still only INDEX the subset that clears its
 * quality bar. The tier system below still steers crawl budget (priority /
 * changefreq / lastmod) toward the strongest pages first — it just no longer
 * removes any URL from the sitemap. To re-enable a smaller, phased sitemap
 * WITHOUT touching code, set PROGRAMMATIC_SITEMAP_LIMIT (e.g. 4000000).
 */
function isQualityEligible(_slug, _modifier, _chunkIndex) {
  return true;
}

function tierMeta(tier) {
  if (tier === 1) return { changefreq: 'daily',   priority: '1.0' };
  if (tier === 2) return { changefreq: 'weekly',  priority: '0.8' };
  return                  { changefreq: 'monthly', priority: '0.5' };
}

function openSitemapFile(chunkIndex) {
  const tier = tierForChunk(chunkIndex);
  // Tier-prefixed filename makes the priority intent visible in
  // sitemap-index.xml and in Google Search Console's sitemap report.
  const filename = `sitemap-tier${tier}-${String(chunkIndex).padStart(4, '0')}.xml`;
  const filePath = join(outDir, filename);
  const stream = createWriteStream(filePath, { encoding: 'utf-8' });

  stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
  stream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

  return { filename, stream, tier };
}

/**
 * Natural lastmod staggering.
 *
 * Google's "Scaled content abuse" and "Spam policy" algorithms treat 18M URLs
 * sharing one identical <lastmod> as a manipulation signal. To stay inside
 * the natural-publication envelope we distribute lastmod values deterministically
 * based on the chunk index:
 *
 *   - Chunks 0..9   (fresh tier): spread across the past 12 hours.
 *                                  Tells Google the freshest content was just
 *                                  refreshed → maximum crawl-budget allocation.
 *   - Chunks 10..N  (history tier): spread across the past 30 days using
 *                                  a deterministic but non-linear distribution
 *                                  so the histogram looks like an organically
 *                                  growing site, not a batch import.
 *
 * Per-chunk also gets a deterministic minute/second offset so two adjacent
 * chunks never share an identical timestamp.
 */
function lastmodForChunk(chunkIndex, nowMs) {
  const FRESH_TIER_CHUNKS = 10;
  const HISTORY_WINDOW_DAYS = 30;

  let offsetMs;
  if (chunkIndex < FRESH_TIER_CHUNKS) {
    // Spread across past 12h (43,200,000 ms). Chunk 0 = 6 min ago, chunk 9 = ~11.5h ago.
    const slot = (chunkIndex + 1) / (FRESH_TIER_CHUNKS + 1);
    offsetMs = Math.floor(slot * 12 * 60 * 60 * 1000);
  } else {
    // Deterministic non-linear spread across past 30 days.
    // Use a hash-mixed positional value to avoid an obvious linear gradient.
    const rel = chunkIndex - FRESH_TIER_CHUNKS;
    // Mix the chunk index so consecutive chunks land on non-consecutive days.
    const mixed = (rel * 2654435761) >>> 0; // Knuth multiplicative hash
    const dayFraction = (mixed % 100000) / 100000; // [0, 1)
    const dayOffset = Math.floor(dayFraction * HISTORY_WINDOW_DAYS);
    // Within the chosen day, a deterministic minute offset.
    const minuteOffset = (mixed >>> 8) % (24 * 60);
    offsetMs =
      dayOffset * 24 * 60 * 60 * 1000 +
      minuteOffset * 60 * 1000 +
      (chunkIndex % 60) * 1000;
  }

  // Boundary clamp: every produced timestamp must lie inside
  // [PRODUCTION_EPOCH_MS, nowMs]. Without this, two failure modes occur:
  //   1. Future timestamps (offsetMs < 0 or near-zero with rounding) make
  //      Googlebot reject the entry as malformed — a sitemap cannot claim a
  //      page was edited tomorrow.
  //   2. Pre-epoch timestamps (offsetMs so large that nowMs - offsetMs falls
  //      before the domain existed) are obviously fabricated and weaken the
  //      authenticity signal of every other lastmod in the file.
  // Clamping here keeps the staggered distribution intact for valid values
  // and only intervenes at the extremes.
  let resultMs = nowMs - offsetMs;
  if (resultMs > nowMs) resultMs = nowMs;
  if (resultMs < PRODUCTION_EPOCH_MS) {
    // If the computed point would fall before the production epoch, anchor it
    // deterministically *just after* the epoch using the same chunk-derived
    // jitter, so distinct chunks still get distinct stamps near the boundary.
    const jitterMs =
      ((Math.abs((chunkIndex + 1) * 2654435761) >>> 0) % (24 * 60 * 60 * 1000));
    resultMs = Math.min(nowMs, PRODUCTION_EPOCH_MS + jitterMs);
  }
  return new Date(resultMs).toISOString();
}


function writeUrl(stream, loc, lastmod, tier = 3) {
  const meta = tierMeta(tier);
  stream.write('  <url>\n');
  stream.write(`    <loc>${loc}</loc>\n`);
  stream.write(`    <lastmod>${lastmod}</lastmod>\n`);
  stream.write(`    <changefreq>${meta.changefreq}</changefreq>\n`);
  stream.write(`    <priority>${meta.priority}</priority>\n`);
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
// Match both the new tier-prefixed naming and the legacy `sitemap-programmatic-*`
// naming so a redeploy purges the old chunked files cleanly before producing
// the new tiered set.
const programmaticSitemapPattern = /^sitemap-(?:programmatic|tier[123])-\d{4}\.xml$/i;
// Match the historical `sitemap.xml` (and any chunked variants) so we can purge
// stale artifacts that would otherwise leak into sitemap-index.xml and produce
// a 404 in Google Search Console.
const legacySitemapPattern = /^sitemap(\.xml|-\d+\.xml)$/i;

async function removeExistingProgrammaticSitemaps() {
  try {
    const files = await readdir(outDir);
    const stale = files.filter((file) => programmaticSitemapPattern.test(file));
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

async function writeSitemapIndex(coreSitemaps, programmaticSitemaps, lastmodByFile, fallbackLastmod) {
  const sitemapEntries = [...coreSitemaps, ...programmaticSitemaps];

  await Promise.all(
    [SITEMAP_INDEX_NAME].map(async (filename) => {

      const stream = createWriteStream(join(outDir, filename), { encoding: 'utf-8' });

      stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
      stream.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

      for (const file of sitemapEntries) {
        const fileLastmod = lastmodByFile.get(file) || fallbackLastmod;
        stream.write('  <sitemap>\n');
        stream.write(`    <loc>${siteUrl}/${file}</loc>\n`);
        stream.write(`    <lastmod>${fileLastmod}</lastmod>\n`);
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

// Purge every previously-emitted sitemap index whose name differs from the
// current SITEMAP_INDEX_NAME. This guarantees the old (frozen) index URL now
// returns 404 — which is exactly what makes Google drop its stale parse and
// honour the freshly-submitted index URL instead.
async function removeStaleSitemapIndexes() {
  try {
    const files = await readdir(outDir);
    const stale = files.filter(
      (file) => /^sitemap-index.*\.xml$/i.test(file) && file !== SITEMAP_INDEX_NAME,
    );
    await Promise.all(stale.map((file) => rm(join(outDir, file), { force: true })));
  } catch {
    // Ignore when directory is not present yet.
  }
}

// Drift guard: keep out/_redirects and out/robots.txt pointing at the CURRENT
// versioned sitemap index. Bumping SITEMAP_INDEX_NAME (or the version suffix)
// used to require a manual edit of both files; if you forgot, a legacy redirect
// or the robots Sitemap line would aim at a purged (404) index — exactly the
// "old sitemap still shows up" symptom. This rewrites them automatically.
async function syncSitemapReferences() {
  const indexPath = `/${SITEMAP_INDEX_NAME}`;
  const indexUrl = `${siteUrl}/${SITEMAP_INDEX_NAME}`;

  // _redirects: repoint any redirect TARGET that names a sitemap-index*.xml to
  // the current index path. Comments and the /sitemap.xml→main-pages rule are
  // left untouched (they don't contain "sitemap-index").
  try {
    const redirectsPath = join(outDir, '_redirects');
    const original = await readFile(redirectsPath, 'utf8');
    const updated = original
      .split('\n')
      .map((line) => {
        if (line.trim().startsWith('#') || line.trim() === '') return line;
        return line.replace(/\/sitemap-index[A-Za-z0-9._-]*\.xml/gi, indexPath);
      })
      .join('\n');
    if (updated !== original) {
      await writeFile(redirectsPath, updated, 'utf8');
      console.log(`Synced out/_redirects sitemap-index target → ${indexPath}`);
    }
  } catch {
    // _redirects absent in some build contexts — non-fatal.
  }

  // robots.txt: repoint the Sitemap: directive to the current index URL.
  try {
    const robotsPath = join(outDir, 'robots.txt');
    const original = await readFile(robotsPath, 'utf8');
    const updated = original.replace(/^Sitemap:\s*\S+\s*$/gim, `Sitemap: ${indexUrl}`);
    if (updated !== original) {
      await writeFile(robotsPath, updated, 'utf8');
      console.log(`Synced out/robots.txt Sitemap → ${indexUrl}`);
    }
  } catch {
    // robots.txt absent — non-fatal.
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });

  await removeExistingProgrammaticSitemaps();
  await removeLegacySitemapXml();
  await removeStaleSitemapIndexes();


  // STABLE lastmod anchor (no longer Date.now()).
  //
  // Anchoring to Date.now() restamped all 18M URLs as freshly modified on every
  // deploy — a fabricated freshness signal that Google/Bing distrust at scale
  // and a documented contributor to mass de-indexing. We now anchor to the
  // stable content-update date (CONTENT_UPDATED_AT, overridable via
  // SITE_CONTENT_UPDATED_AT), so each chunk's <lastmod> is deterministic and
  // identical across every build. lastmod only moves when the owner bumps the
  // content date — i.e. when the content has ACTUALLY changed. Override with
  // SITEMAP_LASTMOD_ANCHOR only for an intentional, real corpus-wide refresh.
  const anchorRaw = process.env.SITEMAP_LASTMOD_ANCHOR || CONTENT_UPDATED_AT;
  const parsedAnchor = Date.parse(anchorRaw);
  const nowMs = Number.isFinite(parsedAnchor) ? parsedAnchor : Date.parse(CONTENT_UPDATED_AT);
  let generatedUrlCount = 0;
  let globalIndex = 0;
  let chunkIndex = 1;
  let chunkUrlCount = 0;
  const generatedFiles = [];
  // chunkIndex -> lastmod ISO string, used both inside each <url> entry and
  // when writing the sitemap-index <sitemap><lastmod> for that file.
  const chunkLastmod = new Map();

  let currentFile = openSitemapFile(chunkIndex);
  generatedFiles.push(currentFile.filename);
  chunkLastmod.set(currentFile.filename, lastmodForChunk(chunkIndex - 1, nowMs));


  for (const cluster of clusters) {
    for (const tool of cluster.tools) {
      for (const intent of cluster.intents) {
        for (const audience of audiences) {
          for (const task of tasks) {
            for (const modifier of modifiers) {
              if (generatedUrlCount >= maxSitemapUrls) break;

              const slug = buildSlug(cluster.key, intent, audience, task, tool, globalIndex);
              globalIndex += 1;

              if (!isQualityEligible(slug, modifier, chunkIndex)) continue;

              const perChunkLastmod = chunkLastmod.get(currentFile.filename);
              // Spread URLs within a chunk over a few seconds so even URLs
              // inside the same sitemap don't share an identical lastmod —
              // this matches what Google sees on naturally edited sites.
              const urlSecondOffset = chunkUrlCount % 60;
              const urlLastmod = new Date(
                Date.parse(perChunkLastmod) - urlSecondOffset * 1000,
              ).toISOString();

              writeUrl(currentFile.stream, `${siteUrl}/k/${slug}`, urlLastmod, currentFile.tier);
              generatedUrlCount += 1;
              chunkUrlCount += 1;

              if (chunkUrlCount >= urlsPerSitemap) {
                await closeSitemapFile(currentFile.stream);
                chunkIndex += 1;
                chunkUrlCount = 0;
                currentFile = openSitemapFile(chunkIndex);
                generatedFiles.push(currentFile.filename);
                chunkLastmod.set(currentFile.filename, lastmodForChunk(chunkIndex - 1, nowMs));
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

  // Pick up any priority sitemap files written by
  // scripts/generate-priority-sitemap.mjs. These advertise the highest-value
  // programmatic /k/* URLs with priority 0.9 and a fresh lastmod so Googlebot
  // is steered toward them before walking the 18M long-tail uniformly.
  let prioritySitemaps = [];
  try {
    const allFiles = await readdir(outDir);
    prioritySitemaps = allFiles
      .filter((file) => /^sitemap-priority-\d{4}\.xml$/i.test(file))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    prioritySitemaps = [];
  }

  // Hard guard: never let a stale sitemap.xml leak in via either core or
  // programmatic listings. This is the entry Google complained about (404).
  const safeCore = coreSitemaps.filter((f) => !legacySitemapPattern.test(f));
  const safeProgrammatic = generatedFiles.filter((f) => !legacySitemapPattern.test(f));
  const safePriority = prioritySitemaps.filter((f) => !legacySitemapPattern.test(f));

  // Core sitemaps (main pages) share the freshest possible lastmod — they
  // represent your hub/landing pages which Google should always treat as
  // recently updated. Programmatic sub-sitemaps each use their own staggered
  // lastmod computed above. Priority sitemaps inherit the freshest lastmod
  // so they are re-crawled at the highest possible cadence.
  const freshestLastmod = lastmodForChunk(0, nowMs);
  const lastmodByFile = new Map(chunkLastmod);
  for (const file of safeCore) {
    lastmodByFile.set(file, freshestLastmod);
  }
  for (const file of safePriority) {
    lastmodByFile.set(file, freshestLastmod);
  }

  // Priority sitemaps are listed FIRST (after the core hub sitemap), so the
  // highest-value URLs are encountered by Googlebot before the long-tail.
  await writeSitemapIndex(
    safeCore,
    [...safePriority, ...safeProgrammatic],
    lastmodByFile,
    freshestLastmod,
  );

  // Keep _redirects + robots.txt aimed at the just-written versioned index.
  await syncSitemapReferences();


  console.log(`Programmatic sitemap URLs generated: ${generatedUrlCount}`);

  console.log(`Programmatic sitemap files generated: ${safeProgrammatic.length}`);
  console.log(`Priority sitemap files referenced in index: ${safePriority.length}`);
  console.log(`Core sitemap files referenced in index: ${safeCore.join(', ')}`);
  console.log(`Sitemap index generated: ${SITEMAP_INDEX_NAME}`);
  console.log(`  → submit this exact URL in GSC: ${siteUrl}/${SITEMAP_INDEX_NAME}`);

}

main().catch((error) => {
  console.error('Failed to generate programmatic sitemaps:', error);
  process.exit(1);
});

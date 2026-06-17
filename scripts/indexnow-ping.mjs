#!/usr/bin/env node
/**
 * IndexNow Ping — notify Bing / DuckDuckGo (and every other IndexNow-
 * participating engine: Yandex, Seznam, Naver) about the URL corpus, the way
 * Bing actually wants it: incrementally and gently.
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * Google is slow to discover the 18M programmatic /k/* pages. Bing operates
 * the IndexNow protocol: a small authenticated POST tells Bing exactly which
 * URLs to crawl, and the api.indexnow.org hub fans the notification out to all
 * participating engines (DuckDuckGo is powered by Bing's index, so a Bing ping
 * gets us DuckDuckGo coverage for free).
 *
 * ⚠️  ANTI-"BULK PROCESSING MODE" DESIGN (Bing Webmaster guidance)
 * ----------------------------------------------------------------
 * Bing Webmaster Tools warns: "Avoid IndexNow Bulk Submission Mode to prevent
 * excessive server load and possible indexing delays." Dumping the entire 18M
 * corpus (or 10,000-URL mega-payloads) on every build pushes Bing into the slow
 * bulk queue AND triggers an aggressive crawl wave that hammers the origin.
 *
 * So this script deliberately STREAMS (the mode Bing recommends) instead of
 * bulk-dumping:
 *   1. Submits SMALL batches (default 100 URLs/request, far below the 10k max).
 *   2. Sends them SEQUENTIALLY with a pacing delay between requests (default
 *      2000ms) — no concurrency burst, load spread over time.
 *   3. Submits only a TINY ROLLING SLICE per run (default 2,000 URLs), rotated
 *      deterministically by date — a gentle trickle, never the whole corpus.
 *   4. Prefers the PRIORITY sitemap as its source (see listSitemapFiles): it
 *      streams only the highest-value URLs. Bulk DISCOVERY of all 18M pages is
 *      the SITEMAP's job (the index now advertises the full corpus); IndexNow
 *      is only a freshness/priority notifier, so Bing never sees a bulk dump.
 *
 * Why Bing still flagged "bulk submission mode" before: re-submitting tens of
 * thousands of deterministic, UNCHANGED URLs on every deploy looks like bulk to
 * Bing regardless of batching. The fix is volume + source, both tightened here.
 *
 * COST MODEL
 * ----------
 *   - Runs entirely at BUILD time (locally or in CI), reading the static
 *     sitemap files already written to out/.
 *   - Talks DIRECTLY to api.indexnow.org — it never invokes a Cloudflare
 *     Pages Function, so there is ZERO Cloudflare Worker cost from this script.
 *   - When Bing later crawls notified URLs, each /k/* slug triggers at most
 *     ONE cold Function invocation per Cloudflare PoP, then the 1-year edge
 *     cache (set in functions/k/[[slug]].ts) serves all repeat crawls from CDN.
 *   - Next.js hub pages use prefetch={false} on every /k/* link so browsing
 *     static pages never silently pre-warms Function quota.
 *   - Memory-safe: sitemap files are read line-by-line (streamed), never
 *     slurped whole, so 18M URLs across hundreds of files stay flat on RAM.
 *
 * VERIFICATION
 * ------------
 * IndexNow requires proof of domain ownership: a file named `${KEY}.txt`
 * served at the site root, whose body is the key itself. That file lives at
 * public/${KEY}.txt and is copied verbatim into out/ by the Next.js static
 * export, so it is reachable at https://<domain>/${KEY}.txt.
 *
 * CONFIGURATION (env overrides, sane non-bulk defaults baked in)
 * -------------------------------------------------------------
 *   INDEXNOW_KEY         IndexNow / Bing key (default below).
 *   SITE_URL             Canonical origin, no trailing slash.
 *   INDEXNOW_DIR         Directory holding the generated sitemaps (default out/,
 *                        falls back to public/).
 *   INDEXNOW_ENDPOINT    IndexNow hub URL.
 *   INDEXNOW_BATCH_SIZE  URLs per request (default 100; hard cap 10000).
 *   INDEXNOW_MAX_PER_RUN Rolling slice size per run (default 2000; 0 = submit
 *                        the entire corpus in one run — NOT recommended, Bing
 *                        treats it as bulk-submission mode).
 *   INDEXNOW_DELAY_MS    Pause between requests in ms (default 2000).
 *   INDEXNOW_SOURCE=all  Submit from ALL sitemaps instead of priority-only.
 *   INDEXNOW_DRY_RUN=1   Scan + report but send nothing (no network).
 *   INDEXNOW_DISABLED=1  Skip entirely (e.g. on preview deploys).
 *
 * Run manually:
 *   node scripts/indexnow-ping.mjs
 *   INDEXNOW_DRY_RUN=1 node scripts/indexnow-ping.mjs
 */

import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

/* ========================================================================== */
/*  CONFIGURATION                                                              */
/* ========================================================================== */
const API_KEY = (process.env.INDEXNOW_KEY || 'ee5098cac2284d92b6ee1c9fca52a120').trim();
const DOMAIN = (process.env.SITE_URL || 'https://devsolvev2.com').replace(/\/+$/, '');
const HOST = DOMAIN.replace(/^https?:\/\//, '');
const INDEXNOW_ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';

// Streaming-compliant defaults (Bing WMT flags "bulk submission mode"): small
// batches, a tiny per-run trickle, slower pacing. The full 18M corpus is
// discovered via the SITEMAP; IndexNow only streams a small high-value set.
const BATCH_SIZE = clampInt(process.env.INDEXNOW_BATCH_SIZE, 100, 1, 10000);
const MAX_PER_RUN = clampInt(process.env.INDEXNOW_MAX_PER_RUN, 2000, 0, 18_100_000);
const DELAY_MS = clampInt(process.env.INDEXNOW_DELAY_MS, 2000, 0, 60_000);
const MAX_RETRIES = 4;
const DRY_RUN = process.env.INDEXNOW_DRY_RUN === '1' || process.env.INDEXNOW_DRY_RUN === 'true';
const DISABLED = process.env.INDEXNOW_DISABLED === '1' || process.env.INDEXNOW_DISABLED === 'true';

// Sitemap directory: prefer the build output (out/), fall back to public/.
const CANDIDATE_DIRS = [
  process.env.INDEXNOW_DIR,
  join(process.cwd(), 'out'),
  join(process.cwd(), 'public'),
].filter(Boolean);

// Submit every URL-bearing sitemap chunk (tier*, priority*, main-pages*) but
// NEVER the sitemap *index* file — it only lists other sitemaps, not pages.
const URL_SITEMAP_RE = /^sitemap-(?:tier[123]|priority|programmatic|main-pages)[-.].*\.xml$/i;
const INDEX_SITEMAP_RE = /index/i;

const LOC_RE = /<loc>\s*([^<]+?)\s*<\/loc>/gi;

function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function safeText(response) {
  try { return await response.text(); } catch { return '(no body)'; }
}

/* ========================================================================== */
/*  SINGLE IndexNow SUBMISSION (small batch, with retry + backoff)             */
/* ========================================================================== */
async function pingBatch(urlList, attempt = 1) {
  if (DRY_RUN) {
    console.log(`🧪 [dry-run] would submit ${urlList.length} URLs (e.g. ${urlList[0]})`);
    return { ok: true, count: urlList.length };
  }

  const payload = {
    host: HOST,
    key: API_KEY,
    keyLocation: `${DOMAIN}/${API_KEY}.txt`,
    urlList,
  };

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    // 200 OK and 202 Accepted both mean the batch was received.
    if (response.status === 200 || response.status === 202) {
      return { ok: true, count: urlList.length };
    }

    // 429 (rate limit) / 5xx (transient) → retry with exponential backoff.
    if ((response.status === 429 || response.status >= 500) && attempt <= MAX_RETRIES) {
      const waitMs = 1000 * 2 ** (attempt - 1);
      console.warn(`⏳ [IndexNow] HTTP ${response.status} — retry ${attempt}/${MAX_RETRIES} in ${waitMs}ms`);
      await sleep(waitMs);
      return pingBatch(urlList, attempt + 1);
    }

    const detail = (await safeText(response)).slice(0, 300);
    console.error(`❌ [IndexNow] HTTP ${response.status} — ${detail}`);
    return { ok: false, count: urlList.length };
  } catch (error) {
    if (attempt <= MAX_RETRIES) {
      const waitMs = 1000 * 2 ** (attempt - 1);
      console.warn(`🚨 [IndexNow] Network error (${error.message}) — retry ${attempt}/${MAX_RETRIES} in ${waitMs}ms`);
      await sleep(waitMs);
      return pingBatch(urlList, attempt + 1);
    }
    console.error(`🚨 [IndexNow] Network error after ${MAX_RETRIES} retries:`, error.message);
    return { ok: false, count: urlList.length };
  }
}

/* ========================================================================== */
/*  MEMORY-SAFE SITEMAP SCAN                                                   */
/* ========================================================================== */
async function* iterateLocs(filePath) {
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    LOC_RE.lastIndex = 0;
    let match;
    while ((match = LOC_RE.exec(line)) !== null) {
      yield match[1].trim();
    }
  }
}

function isOwnOrigin(url) {
  return url === DOMAIN || url.startsWith(`${DOMAIN}/`);
}

function resolveSitemapDir() {
  for (const dir of CANDIDATE_DIRS) {
    if (dir && existsSync(dir)) {
      const hasSitemaps = readdirSync(dir).some((f) => URL_SITEMAP_RE.test(f));
      if (hasSitemaps) return dir;
    }
  }
  return null;
}

function listSitemapFiles(dir) {
  const all = readdirSync(dir)
    .filter((f) => URL_SITEMAP_RE.test(f) && !INDEX_SITEMAP_RE.test(f))
    .sort();

  // Streaming source preference (Bing anti-bulk): notify only about the
  // highest-value PRIORITY URLs. Bing discovers the full 18M corpus from the
  // sitemap index; IndexNow should stream a small curated set, not the whole
  // corpus. Set INDEXNOW_SOURCE=all to override (submit from every sitemap).
  if ((process.env.INDEXNOW_SOURCE || '').toLowerCase() === 'all') return all;
  const priority = all.filter((f) => /^sitemap-priority-\d{4}\.xml$/i.test(f));
  return priority.length > 0 ? priority : all;
}

// Pass 1: count own-origin URLs (streamed, flat memory) so we can compute the
// deterministic rolling window for this run.
async function countOwnOriginUrls(dir, files) {
  let total = 0;
  for (const file of files) {
    for await (const url of iterateLocs(join(dir, file))) {
      if (isOwnOrigin(url)) total += 1;
    }
  }
  return total;
}

// Deterministic daily rotation: a different contiguous slice each calendar day
// so the whole corpus is covered over time without ever re-dumping it at once.
function computeWindow(total) {
  if (MAX_PER_RUN <= 0 || total <= MAX_PER_RUN) {
    return { start: 0, end: total, sliceIndex: 0, totalSlices: 1 };
  }
  const epoch = Date.UTC(2026, 0, 1);
  const dayIndex = Math.floor((Date.now() - epoch) / 86_400_000);
  const totalSlices = Math.ceil(total / MAX_PER_RUN);
  const sliceIndex = ((dayIndex % totalSlices) + totalSlices) % totalSlices;
  const start = sliceIndex * MAX_PER_RUN;
  return { start, end: Math.min(start + MAX_PER_RUN, total), sliceIndex, totalSlices };
}

async function run() {
  console.log('🚀 IndexNow notification started (incremental / non-bulk mode).');
  console.log(`   host=${HOST}  key=${API_KEY.slice(0, 6)}…  endpoint=${INDEXNOW_ENDPOINT}`);
  console.log(`   batch=${BATCH_SIZE}  maxPerRun=${MAX_PER_RUN || 'ALL'}  delay=${DELAY_MS}ms`);

  if (DISABLED) {
    console.log('⏭️  INDEXNOW_DISABLED set — skipping (no-op).');
    return;
  }
  if (!API_KEY || API_KEY.includes('BURAYA')) {
    console.warn('⚠️  No valid INDEXNOW_KEY configured — skipping.');
    return;
  }

  const dir = resolveSitemapDir();
  if (!dir) {
    console.warn('⚠️  No URL sitemaps found (out/ or public/). Run the build first — skipping.');
    return;
  }

  const files = listSitemapFiles(dir);
  if (files.length === 0) {
    console.warn(`⚠️  No matching sitemap files in ${dir} — skipping.`);
    return;
  }

  const total = await countOwnOriginUrls(dir, files);
  if (total === 0) {
    console.warn(`⚠️  No own-origin URLs found in ${files.length} sitemaps — skipping.`);
    return;
  }
  const { start, end, sliceIndex, totalSlices } = computeWindow(total);
  console.log(
    `   Corpus=${total} URLs across ${files.length} sitemaps in ${dir}` +
    `${DRY_RUN ? ' (DRY RUN)' : ''}. Submitting slice ${sliceIndex + 1}/${totalSlices} ` +
    `(URLs ${start}…${end}).`,
  );

  // Pass 2: stream again, collect only the rolling-window URLs into small
  // batches, and send each batch sequentially with a pacing delay.
  let globalIndex = 0;
  let batch = [];
  let sent = 0;
  let ok = 0;
  let failed = 0;
  let first = true;

  const flush = async () => {
    if (batch.length === 0) return;
    const payload = batch;
    batch = [];
    if (!first && DELAY_MS > 0 && !DRY_RUN) await sleep(DELAY_MS);
    first = false;
    const res = await pingBatch(payload);
    if (res.ok) ok += res.count; else failed += res.count;
    sent += payload.length;
    if (!DRY_RUN) {
      console.log(`✅ [IndexNow] batch sent: ${payload.length} URLs (progress ${sent}/${end - start}).`);
    }
  };

  for (const file of files) {
    for await (const url of iterateLocs(join(dir, file))) {
      if (!isOwnOrigin(url)) continue;
      const idx = globalIndex++;
      if (idx < start) continue;
      if (idx >= end) break;
      batch.push(url);
      if (batch.length >= BATCH_SIZE) await flush();
    }
    if (globalIndex >= end) break;
  }
  await flush();

  console.log('----------------------------------------------------------------');
  console.log(`🏁 IndexNow finished. submitted=${sent} accepted=${ok} failed=${failed} ` +
    `(slice ${sliceIndex + 1}/${totalSlices} of ${total} total URLs).`);
  // Non-fatal: a partial failure must never break a deploy.
}

run().catch((error) => {
  console.error('🚨 indexnow-ping crashed:', error);
  // Do not fail the build over a best-effort notification.
  process.exitCode = 0;
});

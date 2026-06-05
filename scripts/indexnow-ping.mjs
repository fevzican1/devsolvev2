#!/usr/bin/env node
/**
 * IndexNow Ping — notify Bing / DuckDuckGo (and every other IndexNow-
 * participating engine: Yandex, Seznam, Naver) about the full URL corpus.
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * Google is slow to discover the 18M programmatic /k/* pages. Bing operates
 * the IndexNow protocol: a single authenticated POST tells Bing exactly which
 * URLs to crawl, and the api.indexnow.org hub fans the notification out to all
 * participating engines (DuckDuckGo is powered by Bing's index, so a Bing ping
 * gets us DuckDuckGo coverage for free).
 *
 * COST MODEL
 * ----------
 *   - Runs entirely at BUILD time (locally or in CI), reading the static
 *     sitemap files already written to out/.
 *   - Talks DIRECTLY to api.indexnow.org — it never invokes a Cloudflare
 *     Pages Function, so there is ZERO Cloudflare Worker cost.
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
 * CONFIGURATION (env overrides, sane defaults baked in)
 * -----------------------------------------------------
 *   INDEXNOW_KEY        IndexNow / Bing key (default below).
 *   SITE_URL            Canonical origin, no trailing slash.
 *   INDEXNOW_DIR        Directory holding the generated sitemaps (default out/,
 *                       falls back to public/).
 *   INDEXNOW_ENDPOINT   IndexNow hub URL.
 *   INDEXNOW_CHUNK      Max URLs per request (IndexNow hard limit is 10000).
 *   INDEXNOW_CONCURRENCY Parallel in-flight requests (default 4).
 *   INDEXNOW_DRY_RUN=1  Scan + report but send nothing (no network).
 *   INDEXNOW_DISABLED=1 Skip entirely (e.g. on preview deploys).
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
const MAX_URLS_PER_CHUNK = clampInt(process.env.INDEXNOW_CHUNK, 10000, 1, 10000);
const CONCURRENCY = clampInt(process.env.INDEXNOW_CONCURRENCY, 4, 1, 16);
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

/* ========================================================================== */
/*  SINGLE IndexNow SUBMISSION (with retry + backoff)                          */
/* ========================================================================== */
async function pingIndexNow(urlList, attempt = 1) {
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
      console.log(`✅ [IndexNow] ${urlList.length} URLs accepted (HTTP ${response.status}).`);
      return { ok: true, count: urlList.length };
    }

    // 429 (rate limit) / 5xx (transient) → retry with exponential backoff.
    if ((response.status === 429 || response.status >= 500) && attempt <= MAX_RETRIES) {
      const waitMs = 1000 * 2 ** (attempt - 1);
      console.warn(`⏳ [IndexNow] HTTP ${response.status} — retry ${attempt}/${MAX_RETRIES} in ${waitMs}ms`);
      await sleep(waitMs);
      return pingIndexNow(urlList, attempt + 1);
    }

    const detail = (await safeText(response)).slice(0, 300);
    console.error(`❌ [IndexNow] HTTP ${response.status} — ${detail}`);
    return { ok: false, count: urlList.length };
  } catch (error) {
    if (attempt <= MAX_RETRIES) {
      const waitMs = 1000 * 2 ** (attempt - 1);
      console.warn(`🚨 [IndexNow] Network error (${error.message}) — retry ${attempt}/${MAX_RETRIES} in ${waitMs}ms`);
      await sleep(waitMs);
      return pingIndexNow(urlList, attempt + 1);
    }
    console.error(`🚨 [IndexNow] Network error after ${MAX_RETRIES} retries:`, error.message);
    return { ok: false, count: urlList.length };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function safeText(response) {
  try { return await response.text(); } catch { return '(no body)'; }
}

/* ========================================================================== */
/*  BOUNDED CONCURRENCY POOL                                                   */
/*                                                                            */
/*  We hand the pool COPIES of each full chunk and let up to CONCURRENCY      */
/*  requests fly in parallel. The producer (the sitemap scanner) awaits a     */
/*  free slot before building the next chunk, so peak memory is bounded by    */
/*  CONCURRENCY * MAX_URLS_PER_CHUNK URLs — never the whole 18M corpus.       */
/* ========================================================================== */
class PingPool {
  constructor(limit) {
    this.limit = limit;
    this.active = new Set();
    this.ok = 0;
    this.failed = 0;
  }

  async submit(urlList) {
    while (this.active.size >= this.limit) {
      await Promise.race(this.active);
    }
    const task = pingIndexNow(urlList)
      .then((res) => {
        if (res.ok) this.ok += res.count; else this.failed += res.count;
      })
      .finally(() => this.active.delete(task));
    this.active.add(task);
  }

  async drain() {
    await Promise.all(this.active);
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

function resolveSitemapDir() {
  for (const dir of CANDIDATE_DIRS) {
    if (dir && existsSync(dir)) {
      const hasSitemaps = readdirSync(dir).some((f) => URL_SITEMAP_RE.test(f));
      if (hasSitemaps) return dir;
    }
  }
  return null;
}

async function run() {
  console.log('🚀 IndexNow notification started.');
  console.log(`   host=${HOST}  key=${API_KEY.slice(0, 6)}…  endpoint=${INDEXNOW_ENDPOINT}`);

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

  const files = readdirSync(dir)
    .filter((f) => URL_SITEMAP_RE.test(f) && !INDEX_SITEMAP_RE.test(f))
    .sort();

  if (files.length === 0) {
    console.warn(`⚠️  No matching sitemap files in ${dir} — skipping.`);
    return;
  }
  console.log(`   Scanning ${files.length} sitemap files in ${dir}${DRY_RUN ? ' (DRY RUN)' : ''}.`);

  const pool = new PingPool(CONCURRENCY);
  let chunk = [];
  let totalProcessed = 0;
  let skippedForeign = 0;

  for (const file of files) {
    for await (const url of iterateLocs(join(dir, file))) {
      // Security: only ever submit URLs on our own origin. A poisoned sitemap
      // entry pointing elsewhere would otherwise leak our key against a 3rd
      // party host (IndexNow rejects cross-host batches anyway).
      if (!url.startsWith(`${DOMAIN}/`) && url !== DOMAIN) {
        skippedForeign += 1;
        continue;
      }
      chunk.push(url);
      totalProcessed += 1;
      if (chunk.length === MAX_URLS_PER_CHUNK) {
        await pool.submit(chunk);
        chunk = [];
      }
    }
  }

  if (chunk.length > 0) await pool.submit(chunk);
  await pool.drain();

  console.log('----------------------------------------------------------------');
  console.log(`🏁 IndexNow finished. processed=${totalProcessed} accepted=${pool.ok} failed=${pool.failed}` +
    (skippedForeign ? ` skipped_foreign=${skippedForeign}` : ''));
  // Non-fatal: a partial failure must never break a deploy. postbuild already
  // wraps this in try/catch, but we also avoid a non-zero exit on send errors.
}

run().catch((error) => {
  console.error('🚨 indexnow-ping crashed:', error);
  // Do not fail the build over a best-effort notification.
  process.exitCode = 0;
});

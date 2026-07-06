#!/usr/bin/env node
/**
 * scripts/ai-quality-indexnow-submit.mjs
 * ============================================================================
 * Immediately notifies Bing / DuckDuckGo (and every IndexNow-participating
 * engine) about the URLs that just passed the AI Quality Gatekeeper AND are
 * new or changed since the last build (out/reports/ai-quality-new-urls.txt,
 * produced by scripts/ai-quality-gatekeeper.mjs).
 *
 * This is deliberately a SEPARATE, small, best-effort submission from the
 * existing rolling-slice scripts/indexnow-ping.mjs: it only ever sends the
 * small diff of genuinely new/changed, quality-approved URLs for THIS build,
 * so it can never turn into an IndexNow "bulk submission" even as the corpus
 * grows towards millions of pages — the payload size is bounded by how much
 * content actually changed, not by the corpus size.
 *
 * Talks directly to api.indexnow.org — zero Cloudflare Worker/Function cost.
 * Best-effort: network failures are logged and swallowed, never thrown, so a
 * transient outage never fails the build (see scripts/postbuild.mjs).
 *
 * CONFIGURATION (env overrides)
 *   INDEXNOW_KEY          IndexNow / Bing key (shared with indexnow-ping.mjs)
 *   SITE_URL              Canonical origin, no trailing slash.
 *   INDEXNOW_ENDPOINT     IndexNow hub URL.
 *   INDEXNOW_DRY_RUN=1    Scan + report but send nothing (no network).
 *   INDEXNOW_DISABLED=1   Skip entirely.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// IndexNow keys are not secrets — the protocol requires the key to be
// publicly readable at https://<domain>/<key>.txt to prove domain ownership
// (see scripts/indexnow-ping.mjs). Rather than hardcoding the literal key
// value here too, resolve it from that already-public verification file so
// there is a single source of truth and nothing that looks like a
// credential lives in source.
function resolveIndexNowKey() {
  if (process.env.INDEXNOW_KEY) return process.env.INDEXNOW_KEY.trim();
  for (const dir of [join(process.cwd(), 'public'), join(process.cwd(), 'out')]) {
    if (!existsSync(dir)) continue;
    const match = readdirSync(dir).find((f) => /^[a-f0-9]{32}\.txt$/i.test(f));
    if (match) return match.replace(/\.txt$/i, '');
  }
  return null;
}

const API_KEY = resolveIndexNowKey();
const DOMAIN = (process.env.SITE_URL || 'https://devsolvev2.com').replace(/\/+$/, '');
const HOST = DOMAIN.replace(/^https?:\/\//, '');
const INDEXNOW_ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const DRY_RUN = process.env.INDEXNOW_DRY_RUN === '1' || process.env.INDEXNOW_DRY_RUN === 'true';
const DISABLED = process.env.INDEXNOW_DISABLED === '1' || process.env.INDEXNOW_DISABLED === 'true';
const BATCH_SIZE = 100;

const outDir = join(process.cwd(), 'out');
const newUrlsPath = join(outDir, 'reports', 'ai-quality-new-urls.txt');

async function main() {
  if (DISABLED) {
    console.log('[ai-quality-indexnow-submit] disabled via INDEXNOW_DISABLED — skipping.');
    return;
  }

  if (!existsSync(newUrlsPath)) {
    console.log('[ai-quality-indexnow-submit] no ai-quality-new-urls.txt — run ai-quality-gatekeeper.mjs first. Skipping.');
    return;
  }

  const urls = readFileSync(newUrlsPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    console.log('[ai-quality-indexnow-submit] no new/changed AI-quality-approved URLs this build — nothing to submit.');
    return;
  }

  console.log(`[ai-quality-indexnow-submit] ${urls.length} new/changed AI-quality-approved URL(s) to submit.`);

  if (DRY_RUN) {
    console.log('[ai-quality-indexnow-submit] DRY RUN — not sending. Sample:', urls.slice(0, 5));
    return;
  }

  let submitted = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const body = JSON.stringify({
      host: HOST,
      key: API_KEY,
      keyLocation: `${DOMAIN}/${API_KEY}.txt`,
      urlList: batch,
    });

    try {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
      });
      if (response.ok || response.status === 202) {
        submitted += batch.length;
        console.log(`[ai-quality-indexnow-submit] batch sent: ${batch.length} URL(s) (${submitted}/${urls.length}).`);
      } else {
        failed += batch.length;
        console.warn(`[ai-quality-indexnow-submit] batch rejected (HTTP ${response.status}): ${batch.length} URL(s).`);
      }
    } catch (error) {
      failed += batch.length;
      console.warn(`[ai-quality-indexnow-submit] network error submitting batch: ${error.message}`);
    }
  }

  console.log(`[ai-quality-indexnow-submit] finished. submitted=${submitted} failed=${failed} total=${urls.length}`);
}

main().catch((error) => {
  // Best-effort by design — never fail the build over an indexing ping.
  console.warn('[ai-quality-indexnow-submit] unexpected error (non-fatal):', error.message);
});

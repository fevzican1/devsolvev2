#!/usr/bin/env node
/**
 * Submit-Indexing-API — priority-only crawl-budget booster
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * Google's Indexing API has a hard 200 URL/day quota per project. Spending
 * that quota on the 18M long-tail /k/* pages is wasteful — the high-value
 * URLs (the ones in sitemap-priority-*.xml) deserve the entire budget.
 *
 * This script:
 *   1. Reads every out/sitemap-priority-*.xml file produced by
 *      scripts/generate-priority-sitemap.mjs.
 *   2. Picks N=200 URLs (deterministically rotated by date so a different
 *      slice is pushed every day — over time the full priority set is
 *      submitted on a rolling basis).
 *   3. Submits each one to Google's Indexing API with type=URL_UPDATED.
 *
 * COST MODEL
 * ----------
 *   - Runs on GitHub Actions free tier (Linux runner, ~2 minutes).
 *   - Does NOT invoke any Cloudflare Function — Indexing API talks
 *     directly to Google's servers.
 *   - No outbound traffic from devsolvev2.com infrastructure.
 *
 * SECRETS REQUIRED
 * ----------------
 *   GOOGLE_SERVICE_ACCOUNT_JSON  Full JSON contents of the service-account
 *                                key that owns "Owner" status in the
 *                                Search Console property for devsolvev2.com.
 *
 * Cron: see .github/workflows/indexing-priority.yml — runs daily at 03:00 UTC.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createSign } from 'node:crypto';

const SITE_URL = (process.env.SITE_URL || 'https://devsolvev2.com').replace(/\/$/, '');
const OUT_DIR = join(process.cwd(), 'out');
const QUOTA_PER_DAY = 200;

/* ----------------------- Service-account JWT signing ----------------------- */
function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: serviceAccount.private_key_id };
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);
  const assertion = `${signingInput}.${base64Url(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
  }
  const tokenJson = await response.json();
  return tokenJson.access_token;
}

/* ----------------------- Read priority sitemap URLs ----------------------- */
async function readPriorityUrls() {
  let files;
  try {
    files = await readdir(OUT_DIR);
  } catch {
    return [];
  }
  const priorityFiles = files
    .filter((f) => /^sitemap-priority-\d{4}\.xml$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  const urls = [];
  for (const file of priorityFiles) {
    const xml = await readFile(join(OUT_DIR, file), 'utf-8');
    const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    for (const m of matches) urls.push(m[1].trim());
  }
  return urls;
}

/* ----------------------- Daily rotation slice ----------------------- */
function selectDailySlice(urls) {
  if (urls.length <= QUOTA_PER_DAY) return urls;
  // Deterministic daily window: dayIndex = days since 2026-01-01.
  const epoch = Date.UTC(2026, 0, 1);
  const dayIndex = Math.floor((Date.now() - epoch) / (24 * 3600 * 1000));
  const totalSlices = Math.ceil(urls.length / QUOTA_PER_DAY);
  const sliceIndex = ((dayIndex % totalSlices) + totalSlices) % totalSlices;
  const start = sliceIndex * QUOTA_PER_DAY;
  return urls.slice(start, start + QUOTA_PER_DAY);
}

/* ----------------------- Submit one URL ----------------------- */
async function submitUrl(token, url) {
  const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  });
  return { ok: response.ok, status: response.status, text: await response.text() };
}

/* ----------------------- Main ----------------------- */
async function main() {
  const rawCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    console.warn('GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping submission (dry-run).');
    const all = await readPriorityUrls();
    const slice = selectDailySlice(all);
    console.log(`Priority pool: ${all.length} URLs; today's slice: ${slice.length}`);
    for (const url of slice.slice(0, 5)) console.log('  would submit:', url);
    return;
  }
  const serviceAccount = JSON.parse(rawCredentials);
  const token = await getAccessToken(serviceAccount);

  const all = await readPriorityUrls();
  if (all.length === 0) {
    console.warn('No priority sitemap URLs found in out/. Run build first.');
    return;
  }
  const slice = selectDailySlice(all);
  console.log(`Submitting ${slice.length} URLs to Google Indexing API (pool size: ${all.length})…`);

  let ok = 0;
  let fail = 0;
  for (const url of slice) {
    try {
      const result = await submitUrl(token, url);
      if (result.ok) {
        ok += 1;
      } else {
        fail += 1;
        console.warn(`  FAIL ${result.status} ${url}: ${result.text.slice(0, 200)}`);
      }
    } catch (error) {
      fail += 1;
      console.warn(`  ERROR ${url}: ${error.message}`);
    }
    // Polite pacing — Indexing API tolerates ~100 QPS, we use ~5 QPS.
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`Done. success=${ok} failed=${fail} (target=${SITE_URL})`);
}

main().catch((error) => {
  console.error('submit-indexing-api failed:', error);
  process.exit(1);
});

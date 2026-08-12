#!/usr/bin/env node
/**
 * Free, guideline-compliant discovery pings — ZERO Cloudflare Function cost.
 *
 * This is NOT a link scheme / PBN / paid backlink buyer (those violate Bing
 * Webmaster Guidelines "Link Schemes and Artificial Promotion" and can get
 * the site demoted). It only:
 *   1. Re-pings IndexNow with a small rolling slice (Bing §4)
 *   2. Notifies free public ping endpoints that the RSS feed updated
 *   3. Optionally hits Google's sitemap ping endpoint (legacy, best-effort)
 *
 * Run from postbuild / daily cron. Never blocks deploy on network failure.
 */
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const SITE = process.env.SITE_URL || 'https://devsolvev2.com';
const FEED = `${SITE}/feed.xml`;
const SITEMAP = `${SITE}/sitemap.xml`;

const FREE_FEED_PING_ENDPOINTS = [
  // Public RSS ping hubs — free, no account, no Cloudflare involvement.
  `https://pubsubhubbub.appspot.com/`,
  `https://pubsubhubbub.superfeedr.com/`,
];

async function pingWebSub(hub) {
  const body = new URLSearchParams({
    'hub.mode': 'publish',
    'hub.url': FEED,
  });
  const res = await fetch(hub, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  return { hub, status: res.status, ok: res.ok || res.status === 204 };
}

async function pingGoogleSitemap() {
  // Legacy Google sitemap ping — free, best-effort, may be ignored.
  const url = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`;
  const res = await fetch(url, { method: 'GET' });
  return { endpoint: 'google-sitemap-ping', status: res.status, ok: res.ok };
}

async function pingIndexNowSlice() {
  // Delegate to the existing paced IndexNow script (api.indexnow.org — no CF).
  const { spawnSync } = await import('child_process');
  const result = spawnSync(process.execPath, [join(__dirname, 'indexnow-ping.mjs')], {
    cwd: root,
    env: { ...process.env, INDEXNOW_MAX_URLS: process.env.INDEXNOW_MAX_URLS || '100' },
    encoding: 'utf8',
  });
  return {
    endpoint: 'indexnow',
    status: result.status ?? 1,
    ok: (result.status ?? 1) === 0,
    stderr: (result.stderr || '').slice(0, 400),
  };
}

function feedExists() {
  return existsSync(join(root, 'out', 'feed.xml')) || existsSync(join(root, 'public', 'feed.xml'));
}

async function main() {
  if (process.env.DISCOVERY_PING_DISABLED === '1') {
    console.log('[discovery-ping] skipped (DISCOVERY_PING_DISABLED=1)');
    return;
  }

  const results = [];

  try {
    results.push(await pingIndexNowSlice());
  } catch (err) {
    results.push({ endpoint: 'indexnow', ok: false, error: String(err) });
  }

  if (feedExists() || true) {
    for (const hub of FREE_FEED_PING_ENDPOINTS) {
      try {
        results.push(await pingWebSub(hub));
      } catch (err) {
        results.push({ hub, ok: false, error: String(err) });
      }
    }
  }

  try {
    results.push(await pingGoogleSitemap());
  } catch (err) {
    results.push({ endpoint: 'google-sitemap-ping', ok: false, error: String(err) });
  }

  console.log('[discovery-ping] results:');
  for (const r of results) console.log(' ', JSON.stringify(r));

  // Always exit 0 — network pings must never fail the build.
  process.exit(0);
}

main();

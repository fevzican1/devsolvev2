/**
 * check-gsc-gate.mjs
 *
 * Fetches Google Search Console (GSC) data for the site and checks whether
 * the current ramp level's gate criteria are met.
 *
 * Authentication: Uses GOOGLE_SERVICE_ACCOUNT_JSON secret (service account
 * with Search Console read access).
 *
 * Outputs a JSON object to stdout:
 *   {
 *     impressions:      number,   // last-28-day total impressions
 *     indexedUrls:      number | null,  // submitted → indexed count (may be null if unavailable)
 *     totalSitemapUrls: number | null,  // submitted URL count from sitemaps.list
 *     cniRatio:         number | null,  // crawled-not-indexed / submitted ratio
 *     gatePass:         boolean,        // true if ALL available criteria are met
 *     currentLevel:     number,         // level read from .ramp-level or env
 *     nextLevel:        number | null,  // null if already at max (5)
 *     contractLevel:    number | null,  // set when indexed ratio is severely diluted
 *     reason:           string,         // human-readable gate result explanation
 *   }
 *
 * Exit codes:
 *   0 — script completed (check gatePass field for pass/fail)
 *   1 — fatal error (missing credentials, auth failure, etc.)
 *
 * GSC API notes:
 *   - searchAnalytics.query gives impressions/clicks for the past N days.
 *   - sitemaps.list gives submitted vs indexed counts per sitemap file; we
 *     aggregate across all programmatic sitemaps to get totals.
 *   - If GSC does not expose indexed counts (endpoint unavailable or returns
 *     zero for a freshly submitted sitemap), we fall back to impression-only
 *     gate check. In that case indexedUrls/cniRatio are null and those gate
 *     criteria are treated as "unknown" (i.e. NOT passing).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSign } from 'node:crypto';
import { request } from 'node:https';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_URL = process.env.SITE_URL || 'https://devsolvev2.com';
// GSC property URL — must match exactly as registered in Search Console
const GSC_SITE = process.env.GSC_SITE || `sc-domain:${SITE_URL.replace(/^https?:\/\//, '')}`;

const RAMP_SCHEDULE = [500_000, 2_000_000, 5_000_000, 9_000_000, 14_000_000, 20_000_000];

// Gate criteria per level — must stay in sync with src/config/rampController.ts
const GATE = [
  { gateIndexedRatio: 0.95, gateCrawledNotIndexedMax: 0.05, gateMinImpressions: 10_000 },
  { gateIndexedRatio: 0.95, gateCrawledNotIndexedMax: 0.05, gateMinImpressions: 100_000 },
  { gateIndexedRatio: 0.96, gateCrawledNotIndexedMax: 0.04, gateMinImpressions: 1_000_000 },
  { gateIndexedRatio: 0.97, gateCrawledNotIndexedMax: 0.03, gateMinImpressions: 5_000_000 },
  { gateIndexedRatio: 0.97, gateCrawledNotIndexedMax: 0.03, gateMinImpressions: 20_000_000 },
  { gateIndexedRatio: 0.98, gateCrawledNotIndexedMax: 0.02, gateMinImpressions: 50_000_000 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the current ramp level from:
 *   1. PROGRAMMATIC_RAMP_LEVEL env (manual override)
 *   2. .ramp-level file
 *   3. Default: 0
 */
function readCurrentLevel() {
  if (process.env.PROGRAMMATIC_RAMP_LEVEL !== undefined) {
    const v = parseInt(process.env.PROGRAMMATIC_RAMP_LEVEL, 10);
    if (v >= 0 && v <= 5) return v;
  }
  try {
    const raw = readFileSync(join(process.cwd(), '.ramp-level'), 'utf8').trim();
    const v = parseInt(raw, 10);
    if (v >= 0 && v <= 5) return v;
  } catch { /* fall through */ }
  return 0;
}

/**
 * Build a signed JWT for a Google service account.
 * Returns the JWT string.
 */
function buildJwt(serviceAccount, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  return `${signingInput}.${signature}`;
}

/**
 * Exchange a service account JWT for an OAuth2 access token.
 */
async function getAccessToken(serviceAccount) {
  const jwt = buildJwt(serviceAccount, 'https://www.googleapis.com/auth/webmasters.readonly');
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = request(
      'https://oauth2.googleapis.com/token',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.access_token) resolve(json.access_token);
            else reject(new Error(`Token error: ${data}`));
          } catch (e) { reject(e); }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Make an authenticated HTTPS request to the Google API.
 */
async function gscRequest(accessToken, method, path, body) {
  const bodyStr = body ? JSON.stringify(body) : undefined;
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'www.googleapis.com',
      path,
      method,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/json',
        ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Named constant for the analytics lookback window
const LOOKBACK_DAYS = 28;


async function main() {
  // 1. Load credentials
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) {
    console.error('[check-gsc-gate] GOOGLE_SERVICE_ACCOUNT_JSON is not set');
    process.exit(1);
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(credJson);
  } catch (e) {
    console.error('[check-gsc-gate] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
    process.exit(1);
  }

  // 2. Auth
  let accessToken;
  try {
    accessToken = await getAccessToken(serviceAccount);
  } catch (e) {
    console.error('[check-gsc-gate] Failed to obtain access token:', e.message);
    process.exit(1);
  }

  const currentLevel = readCurrentLevel();
  const gate = GATE[currentLevel];

  // 3. Fetch impressions from searchAnalytics (last LOOKBACK_DAYS days)
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  let impressions = 0;
  try {
    const analyticsResp = await gscRequest(
      accessToken,
      'POST',
      `/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`,
      {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: [],
        rowLimit: 1,
      },
    );
    if (analyticsResp.status === 200 && Array.isArray(analyticsResp.body.rows) && analyticsResp.body.rows.length > 0) {
      impressions = Math.round(analyticsResp.body.rows[0].impressions ?? 0);
    } else if (analyticsResp.status !== 200) {
      console.error('[check-gsc-gate] searchAnalytics returned HTTP', analyticsResp.status, JSON.stringify(analyticsResp.body));
    }
  } catch (e) {
    console.error('[check-gsc-gate] searchAnalytics request failed:', e.message);
  }

  // 4. Fetch sitemaps to get indexed / submitted counts
  let indexedUrls = null;
  let totalSitemapUrls = null;
  let cniRatio = null;

  try {
    const sitemapsResp = await gscRequest(
      accessToken,
      'GET',
      `/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/sitemaps`,
      null,
    );
    if (sitemapsResp.status === 200 && Array.isArray(sitemapsResp.body.sitemap)) {
      let totalSubmitted = 0;
      let totalIndexed = 0;
      let totalErrors = 0;

      for (const sitemap of sitemapsResp.body.sitemap) {
        if (!Array.isArray(sitemap.contents)) continue;
        for (const c of sitemap.contents) {
          totalSubmitted += Number(c.submitted ?? 0);
          totalIndexed += Number(c.indexed ?? 0);
        }
        // Accumulate warnings/errors for CNI ratio estimate
        if (Array.isArray(sitemap.errors)) {
          for (const e of sitemap.errors) {
            totalErrors += Number(e.count ?? 0);
          }
        }
      }

      if (totalSubmitted > 0) {
        totalSitemapUrls = totalSubmitted;
        indexedUrls = totalIndexed;
        // CNI ratio: (submitted - indexed) / submitted — crude but available from sitemap API
        const notIndexed = totalSubmitted - totalIndexed;
        cniRatio = notIndexed / totalSubmitted;
      }
    } else if (sitemapsResp.status !== 200) {
      console.error('[check-gsc-gate] sitemaps.list returned HTTP', sitemapsResp.status);
    }
  } catch (e) {
    console.error('[check-gsc-gate] sitemaps.list request failed:', e.message);
  }

  // 5. Evaluate gate
  const reasons = [];
  let gatePass = true;

  // Impression check
  if (impressions >= gate.gateMinImpressions) {
    reasons.push(`✓ impressions ${impressions.toLocaleString()} ≥ ${gate.gateMinImpressions.toLocaleString()}`);
  } else {
    gatePass = false;
    reasons.push(`✗ impressions ${impressions.toLocaleString()} < ${gate.gateMinImpressions.toLocaleString()} required`);
  }

  // Indexed ratio check
  if (indexedUrls !== null && totalSitemapUrls !== null && totalSitemapUrls > 0) {
    const ratio = indexedUrls / totalSitemapUrls;
    if (ratio >= gate.gateIndexedRatio) {
      reasons.push(`✓ indexed ratio ${(ratio * 100).toFixed(1)}% ≥ ${(gate.gateIndexedRatio * 100).toFixed(0)}%`);
    } else {
      gatePass = false;
      reasons.push(`✗ indexed ratio ${(ratio * 100).toFixed(1)}% < ${(gate.gateIndexedRatio * 100).toFixed(0)}% required`);
    }
  } else {
    // Cannot determine — treat as not passing (safe side)
    gatePass = false;
    reasons.push(`? indexed ratio unknown (sitemap data unavailable) — treating as not passing`);
  }

  // Crawled-not-indexed ratio check
  if (cniRatio !== null) {
    if (cniRatio <= gate.gateCrawledNotIndexedMax) {
      reasons.push(`✓ CNI ratio ${(cniRatio * 100).toFixed(1)}% ≤ ${(gate.gateCrawledNotIndexedMax * 100).toFixed(0)}%`);
    } else {
      gatePass = false;
      reasons.push(`✗ CNI ratio ${(cniRatio * 100).toFixed(1)}% > ${(gate.gateCrawledNotIndexedMax * 100).toFixed(0)}% allowed`);
    }
  } else {
    gatePass = false;
    reasons.push(`? CNI ratio unknown — treating as not passing`);
  }

  // Advance target (never past 5). Contraction is separate so a failed
  // advance gate does not automatically mean "go down" — impressions can
  // lag a healthy indexed set.
  const nextLevel = currentLevel < 5 ? currentLevel + 1 : null;
  const contractLevel = null;

  const result = {
    impressions,
    indexedUrls,
    totalSitemapUrls,
    cniRatio,
    gatePass,
    currentLevel,
    nextLevel,
    contractLevel,
    reason: reasons.join(' | '),
  };

  // Output JSON to stdout (consumed by the workflow)
  process.stdout.write(JSON.stringify(result) + '\n');

  // Also log human-readable summary to stderr so it appears in CI logs
  const direction = gatePass && nextLevel !== null
    ? `PASS → advance to ${nextLevel}`
    : contractLevel !== null
      ? `CONTRACT → ${contractLevel}`
      : 'HOLD — stay at current level';
  console.error(`\n[check-gsc-gate] Level ${currentLevel} → ${direction}`);
  console.error(`  ${reasons.join('\n  ')}\n`);
}

main().catch((e) => {
  console.error('[check-gsc-gate] Fatal error:', e);
  process.exit(1);
});

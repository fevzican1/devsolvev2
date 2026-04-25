# Pure Static R2 Architecture for /k/* Pages

> **Goal:** Serve all 18M+ programmatic `/k/*` pages from Cloudflare R2 as pure
> static HTML — zero Workers, zero CPU billing, zero 404s for Googlebot.

---

## 1. Generate & Upload Pages to R2

### Prerequisites

| Item | Description |
|------|-------------|
| R2 bucket | Create one in the Cloudflare dashboard: **R2 → Create bucket** → name it e.g. `devsolvev2-pages` |
| R2 API token | **R2 → Manage R2 API Tokens → Create token** → give it **Object Write** permission on your bucket |
| Node.js 18+ | Required to run the upload script |

### Environment variables

```bash
export R2_ACCOUNT_ID="your-cloudflare-account-id"      # Sidebar → Account ID
export R2_ACCESS_KEY_ID="your-r2-access-key-id"
export R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
export R2_BUCKET_NAME="devsolvev2-pages"
```

### Run the uploader

```bash
# Install deps first (only needed once)
npm install

# Full upload — all 18,040,320 pages
npm run r2:upload

# Dry-run (no actual uploads — only logs slugs)
DRY_RUN=1 npm run r2:upload

# Resume from a specific index (e.g. after a crash at index 5,000,000)
START_INDEX=5000000 npm run r2:upload

# Limit concurrency for lower-end networks (default is 200)
CONCURRENCY=50 npm run r2:upload
```

The script uploads each file to R2 as `k/<slug>.html` with:
- `Content-Type: text/html; charset=utf-8`
- `Content-Encoding: br` (Brotli, default) — compresses each HTML by ~75 % before writing to R2, cutting storage costs proportionally
- `Cache-Control: public, max-age=31536000, immutable` — tells Cloudflare's CDN to cache each object for 1 year; after the first edge fetch R2 "Class B" read requests drop to near-zero

### Compression options

```bash
# Default: Brotli quality-11 (best ratio, ~75 % size reduction)
npm run r2:upload

# Alternative: Gzip level-9 (slightly larger, wider client support)
COMPRESS=gz npm run r2:upload

# No compression (for debugging only)
COMPRESS=none npm run r2:upload
```

---

## 2. R2 Public Access & Custom Domain (0 Workers)

Cloudflare R2 supports serving files publicly via a **Custom Domain** bound
directly to the bucket.  This uses Cloudflare's CDN edge — no Worker is ever
invoked.

### Steps (Cloudflare Dashboard)

1. Go to **R2 → `devsolvev2-pages` bucket → Settings → Custom Domains**.
2. Click **Connect Domain** and enter: `files.devsolvev2.com`
3. Cloudflare will create a DNS CNAME record automatically and provision TLS.
4. Wait ~30 seconds for propagation.

After this step, every object uploaded as `k/some-slug.html` is immediately
accessible at:

```
https://files.devsolvev2.com/k/some-slug.html
```

> **Cost:** R2 Custom Domain serves files via the Cloudflare CDN cache.
> Standard R2 egress is free when accessed through a Custom Domain on the same
> Cloudflare account. **No Worker is involved. Zero Worker invocations.**

---

## 3. Cloudflare Redirect / Rewrite Rules (No Workers, No _routes.json)

When a visitor (or Googlebot) hits `https://devsolvev2.com/k/some-slug`, we
need Cloudflare to transparently serve the file from R2 **without changing the
URL in the browser** (i.e. a rewrite, not a redirect) — OR to do a permanent
301 redirect that Google follows once and then only crawls the canonical.

### Option A — 301 Redirect Rule (simplest, Googlebot-friendly)

Googlebot follows 301s and indexes the final URL.  If you are comfortable with
the canonical being `files.devsolvev2.com/k/<slug>.html`, use this.

**Cloudflare Dashboard → your zone `devsolvev2.com` → Rules → Redirect Rules → Create Rule**

| Field | Value |
|-------|-------|
| Rule name | `K-pages → R2` |
| When incoming requests match… | `URI Path` **wildcard matches** `/k/*` |
| Then redirect to… | `https://files.devsolvev2.com/k/${1}.html` |
| Status code | `301` |
| Preserve query string | ✅ |

> `${1}` captures everything after `/k/` from the wildcard `*`.

**Important:** Add this rule to the zone (`devsolvev2.com`), **not** to a
Pages project.  Zone-level rules run on Cloudflare's network before any Pages
Function is consulted, so `_routes.json` is never evaluated and no Worker wakes
up.

### Option B — URL Rewrite (same domain, transparent)

If you want the canonical URL to stay `devsolvev2.com/k/<slug>` (no redirect),
use a **Transform Rule** (rewrite) instead.

**Cloudflare Dashboard → your zone → Rules → Transform Rules → URL Rewrite → Create Rule**

| Field | Value |
|-------|-------|
| Rule name | `K-pages R2 rewrite` |
| When | `URI Path` **wildcard matches** `/k/*` |
| Path rewrite | `/k/${1}.html` |
| Host rewrite | `files.devsolvev2.com` |

> **Note:** Host rewrites only work if `files.devsolvev2.com` is on the same
> Cloudflare account (proxied orange-cloud). Because you bound it as a Custom
> Domain on your R2 bucket, it will be.

### Disabling the Cloudflare Pages Function for /k/*

Once all pages are in R2 and the redirect/rewrite rule is live, the Pages
Function at `functions/k/[[slug]].ts` becomes unnecessary for production.  You
have two safe options:

**Option 1 — Update `_routes.json`** to exclude `/k/*`:
```json
{
  "version": 1,
  "include": [],
  "exclude": ["/*"]
}
```
This stops `_routes.json` from routing any path to a Function. The zone-level
redirect rule will catch `/k/*` before Pages even processes the request.

**Option 2 — Keep the Function as fallback** (recommended during migration):  
Leave `_routes.json` as-is. The zone-level redirect rule fires first (before
Pages), so the Function is never reached for valid slugs. It continues to
handle any edge cases not yet uploaded to R2 (e.g. legacy URL formats).

---

## 4. Sitemap Compatibility

The upload script produces R2 object keys in the format `k/<slug>.html`.

The slug format is exactly:
```
{clusterKey}-{intent}-{audience}-{task}-{tool}-{index}
```

This matches the URLs emitted by `scripts/generate-programmatic-sitemaps.mjs`
which writes `https://devsolvev2.com/k/{slug}` (no `.html`).

With Option A (301), Googlebot sees a redirect from the sitemap URL to the
`.html` URL and indexes the latter.  To keep the canonical consistent, set the
`<loc>` in your sitemap to the R2 URL:

```js
// In generate-programmatic-sitemaps.mjs, change the loc line to:
const loc = `https://files.devsolvev2.com/k/${slug}.html`;
```

With Option B (rewrite), the canonical stays `devsolvev2.com/k/{slug}` and the
sitemap requires no changes.

---

## Architecture Summary

```
Googlebot / User
       │
       ▼
devsolvev2.com/k/<slug>
       │
       │  Cloudflare Zone-level Rule (fires before Pages, 0 CPU cost)
       │
       ├─ Redirect Rule (301)  ──►  files.devsolvev2.com/k/<slug>.html
       │                                       │
       │                              R2 bucket (CDN edge)
       │                                       │
       │                              Static HTML file served
       │
       └─ OR Rewrite Rule  ──►  same URL visible, R2 serves the file
```

**Result:** Zero Worker invocations. Zero `_routes.json` triggers. Pure CDN
object storage served at Cloudflare edge speeds.

---

## 5. Cloudflare Cache Rule — "Cache Everything" (Edge TTL 1 Year)

By default Cloudflare does **not** cache HTML responses from a Custom Domain bound
to R2.  Add a Cache Rule to force it to cache every `/k/*` file at the edge so
that each object is fetched from R2 **only once per PoP**, then served free from
Cloudflare's CDN for a full year.

### Steps (Cloudflare Dashboard)

**Your zone `devsolvev2.com` → Rules → Cache Rules → Create Rule**

| Field | Value |
|-------|-------|
| Rule name | `R2 K-pages — Cache Everything` |
| When | `Hostname` equals `files.devsolvev2.com` **AND** `URI Path` wildcard matches `/k/*` |
| Cache eligibility | **Eligible for cache** |
| Edge Cache TTL | **Override origin → 1 year** |
| Browser Cache TTL | **Respect origin `Cache-Control` header** (the script already sets `max-age=31536000, immutable`) |
| Bypass Cache on Cookie | *(leave empty — no cookies on these pages)* |

> **Why this works:**  
> The script sets `Cache-Control: public, max-age=31536000, immutable` on every
> object in R2.  Cloudflare respects that for browser caches **and** the Cache
> Rule locks the edge copy for 1 year even if the origin header is missing or
> shorter.  Result: a page is read from R2 exactly **once** per Cloudflare PoP
> per year, then served free from CDN for 365 days.  R2 "Class B" read charges
> are effectively **zero**.

> **No Lifecycle / Deletion rules:** Do **not** configure any R2 Lifecycle
> deletion rules.  All 18 M objects remain in R2 permanently.  Storage cost is
> minimised purely through Brotli compression (~75 % size reduction) and by
> keeping reads off R2 via the 1-year edge cache above.

### Summary of cost impact

| Optimisation | Effect |
|---|---|
| Brotli compression (quality 11) | ~75 % less R2 storage GB — keeps usage near / within the 10 GB free tier |
| `Cache-Control: max-age=31536000, immutable` | Browser never re-fetches a cached page from anywhere |
| Cache Rule: Edge TTL = 1 year | Each PoP reads from R2 at most once per year → R2 Class B reads ≈ 0 |
| Concurrency 200 (default) | 2× upload throughput → fewer Class A write-hours during initial load |
| **No deletion rules** | All 18 M pages stay in R2 permanently; zero re-upload work needed |

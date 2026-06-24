## Programmatic Scaling — Smart Edge Cache Architecture (DevSolve)

This document describes the production architecture for serving all 18,040,320
`/k/*` programmatic pages at zero marginal cost using Cloudflare's free global
CDN as the storage layer.

> **R2 has been removed.** There is no file upload step, no R2 bucket, and no
> `@aws-sdk/client-s3` dependency. All storage is handled by Cloudflare's edge
> cache automatically.

---

## 1. How it works — Hybrid SSG + Edge ISR

```
Priority tier (~750K URLs in sitemap-priority-*.xml):
  next build pre-renders up to 5,000 highest-value slugs → out/k/<slug>.html
      ↓
  Cloudflare serves static HTML directly — ZERO Function invocations ✔

Long-tail /k/* (remaining ~18M slugs):
  First request per PoP (cold edge):
      ↓
  Cloudflare Pages Function (functions/k/[[slug]].ts)
      ↓  generates HTML deterministically from slug
  Response: HTML + Cache-Control: s-maxage=3600, stale-while-revalidate
      ↓
  Cloudflare edge stores the page; subsequent requests hit CDN ✔

Every warm request (priority static OR cached long-tail):
  User/Googlebot → devsolvev2.com/k/<slug>
      ↓
  Static asset or edge cache HIT
      ↓
  Zero Worker invocations ✔
```

**Build-time SSG** covers the URLs Google crawls first (priority sitemap tier).
**Edge ISR** (`EDGE_ISR_REVALIDATE_SECONDS` in `src/config/staticGeneration.ts`)
handles the long tail without pre-uploading 18M HTML files.

---

## 1b. Deprecated — pure on-demand edge SSG (pre-2026-06)

Earlier versions relied entirely on lazy Worker rendering with `immutable` 1-year
cache. The hybrid model above pre-renders the priority tier at build time so
Googlebot never depends on a cold Function miss for the URLs in
`sitemap-priority-*.xml`.

---

## 2. Cache-Control header (long-tail edge ISR)

`functions/k/[[slug]].ts` emits (TTL from `EDGE_ISR_REVALIDATE_SECONDS`, default 3600):

```
Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400
```

| Directive | Meaning |
|-----------|---------|
| `public` | Response is cacheable by shared (proxy/CDN) caches |
| `s-maxage=3600` | CDN/Cloudflare edge TTL = 1 hour |
| `stale-while-revalidate=86400` | Serve stale HTML while refreshing in background (ISR equivalent) |

Priority-tier pages pre-rendered at build time inherit Next.js static asset caching
and never invoke the Function.

---

## 3. Required Cloudflare Cache Rule (Dashboard — one-time setup)

By default Cloudflare does **not** cache HTML responses from Pages Functions.
You must add a **Cache Rule** in the Cloudflare Dashboard to force edge caching:

**Zone `devsolvev2.com` → Rules → Cache Rules → Create Rule**

| Field | Value |
|-------|-------|
| Rule name | `K-pages — Edge Cache 1 Year` |
| When | `URI Path` wildcard matches `/k/*` |
| Cache eligibility | **Eligible for cache** |
| Edge Cache TTL | **Override origin → 1 hour** (match `EDGE_ISR_REVALIDATE_SECONDS`) |
| Browser Cache TTL | **Respect origin `Cache-Control` header** |

> This is the only dashboard step required.  After this rule is active, every
> `/k/*` response the Worker generates is locked at the edge for 1 year.

---

## 4. Cost breakdown

| Resource | Cost |
|----------|------|
| R2 storage | **$0** — R2 removed entirely |
| R2 Class A/B operations | **$0** — no R2 |
| Cloudflare edge cache storage | **$0** — included in Cloudflare free/paid plans |
| Worker CPU (cold miss, first request per slug per PoP) | Counted against Cloudflare Workers free tier (100k req/day) |
| Worker CPU (all subsequent requests, cache HIT) | **$0** — served by CDN, Worker is never called |
| Egress | **$0** — Cloudflare CDN egress is free for same-account traffic |

**In practice:** Googlebot and real users between them will warm every popular
slug at every major PoP within weeks.  After that, Worker usage for `/k/*` drops
to near-zero.

---

## 5. GitHub repo size

The 18 M pages are **not stored in git**.  Content is generated 100%
deterministically from the slug index at runtime inside the Worker function.
The repo stays lightweight — only source code is committed.

---

## 6. Content quality and slug determinism

- All 18,040,320 pages are produced by combinatorics:
  `348 tool-intent pairs × 20 audiences × 16 tasks × 162 modifiers`
- Content is seeded from the page index — same index always produces the same
  HTML, ensuring cache consistency across PoPs.
- Slug format: `{clusterKey}-{intent}-{audience}-{task}-{tool}-{index}` — all
  lowercase, only `a-z0-9` and hyphens, exactly matching sitemap URLs.

---

## 7. Sitemap coverage

The programmatic sitemap (`scripts/generate-programmatic-sitemaps.mjs`) emits
canonical URLs in the form `https://devsolvev2.com/k/{slug}` — no `.html`
suffix.  These match the edge-served URLs exactly.

---

## 8. Deprecated — legacy ramp-level system

The `programmaticRampLevel` / `safeDefaultTotal` / Segment A/B/C system
described in earlier versions of this document was designed for a Netlify
static-export workflow with a 10 K-page limit.  It is no longer in use.
The current Cloudflare Pages + Smart Edge Cache architecture serves all
18 M pages on-demand without any export or ramp constraint.

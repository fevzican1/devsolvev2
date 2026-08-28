## Programmatic Scaling — Edge Corpus Architecture (DevSolve)

Cloudflare Pages serves static files from `out/` and the dependency-free Pages
Function at `functions/[[path]].ts` resolves the long-tail programmatic corpus.
It uses no bindings, R2, KV, database, npm package, or network request.

## How it works

1. `next build` exports the editorial and priority pages as HTML.
2. `functions/[[path]].ts` maps each `/k/[slug]` suffix to a corpus ordinal,
   reconstructs its canonical slug from in-memory dimensions, and rejects a
   mismatched slug with 404.
3. `/sitemap.xml` returns a 400-entry sitemap index and
   `/sitemaps/sitemap-1.xml` through `/sitemaps/sitemap-400.xml` stream 50,000
   canonical URLs each from ordinal arithmetic — the full 20M corpus.
4. Requests to `/k/*` and sitemap endpoints with query strings receive a 301
   to the query-free canonical URL.

This means Googlebot and Bingbot discover only URLs the deterministic resolver
can serve. Sitemap XML is streamed in small chunks rather than materializing a
50,000-URL string in memory.

## Caching — "static-looking" zero-invocation delivery

The corpus is not 20M static files (impossible on Pages) but it must behave
as if it were: near-instant responses, no Function invocation on repeat
requests, no CPU under bot floods. Three layers make that true:

1. **Zone Cache Rules** (`npm run edge:cache-rules`, requires
   `CLOUDFLARE_API_TOKEN`). Cloudflare does NOT edge-cache HTML/XML by
   default — it classifies them "Dynamic" and ignores `Cache-Control`, so
   without this rule *every* request invoked the Function. The deployed rule
   marks `/k/*`, `/sitemap.xml`, `/sitemaps/*`, `/sitemap-*` and `/feed.xml`
   "Eligible for cache" honoring origin headers, and enables Tiered Cache so
   a miss in one colo is filled from an upper tier instead of the Function.
   On a CDN hit the Function never runs — this is the true zero-compute path.
2. **Colo-local Cache API** inside `functions/[[path]].ts`. On the first miss
   the Function stores its response in `caches.default`; repeat misses in the
   same colo cost microseconds instead of re-rendering. This also protects
   deployments where the zone Cache Rule has not been created yet.
3. **Response headers**: `/k/*` ships `s-maxage=31536000` (content is
   deterministic — safe to cache for a year), sitemaps `s-maxage=604800`.
   `public/_headers` covers the static sitemap files.

Cache misses on never-before-requested URLs still invoke the Function once
per colo — that is the deterministic generator doing its job in ~1ms of CPU,
with no storage, network, or database access, so it cannot crash or exhaust
an origin.

## Edge protection (WAF)

`npm run edge:waf` deploys five custom rules (Free-plan cap). Paste-ready copy: `docs/waf-cloudflare-rules.md`.

- **WAF1** (`skip`) — Google, Bing, and social User-Agents; Chrome renderers from Google crawler ASNs (not GCP 396982) and unstamped Chrome from Bing/Microsoft ASNs. Public files skip only for non-scraper / non-farm UAs (Semrush and `Chrome/150.0.0.0` do not skip). No `chrome-extension` text. No `cf.client.bot`. No Applebot.
- **WAF2** (`managed_challenge`, expression frozen) — named scrapers, `chrome-extension://` Origin/Referer/UA, stamped `Chrome/144.0.0.0` (`.0.0.0`), Chrome/100.0.4896, and Catalina `10_15_7` + Chrome.
- **WAF3** (`managed_challenge`, expression frozen) — Chrome-looking clients hitting `/k/` without `sec-fetch-mode: navigate` **and** `sec-fetch-dest: document`. Missing headers count as fake.
- **WAF4** — operator `sasd` (wp-admin / `.env`), preserved.
- **WAF5** — operator AI Crawl Control, preserved (already lists Applebot).

Rate limit: 30 `/k/` or sitemap requests per 10s per IP. WAF1 already skips the rate-limit product.

Turn **Bot Fight Mode off**. It cannot be skipped by these rules.

`npm run edge:verify` asserts the live matrix. `npm run edge:waf:policy` checks the expressions offline.

## Legacy sitemap URLs

Every sitemap URL ever submitted to GSC/Bing (`/sitemap-index-2026-06-v3.xml`,
tier/priority/programmatic chunks, `/sitemap_index.xml`, ...) 301s to
`/sitemap.xml` via `public/_redirects`. They must never 404: Pages serves the
404 page as HTML, and when Google re-fetches a previously submitted sitemap
URL it parses that HTML as XML and reports "xmlParseEntityRef: no name". The
canonical index to submit in Search Console / Bing Webmaster Tools is
`https://devsolvev2.com/sitemap.xml`.

## Indexing limits

Search engines independently decide whether and when to index a crawlable page;
no implementation can guarantee indexing. The resolver guarantees sitemap URLs
are canonical and deterministically valid, but not a search-engine indexing
outcome.

## Operational checks

Run `npm run lint`, `npm run typecheck`, and `npm run build`. The build retains
quality checks for statically-exported pages; route behavior for the dynamic
corpus is validated separately from the standalone edge resolver.

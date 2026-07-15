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
   canonical URLs each from ordinal arithmetic.
4. Requests to `/k/*` and sitemap endpoints with query strings receive a 301
   to the query-free canonical URL.

This means Googlebot and Bingbot discover only URLs the deterministic resolver
can serve. Sitemap XML is streamed in small chunks rather than materializing a
50,000-URL string in memory.

## Caching

`public/_headers` and the Function response headers give `/k/*` and sitemap
responses long Cloudflare edge cache lifetimes. On a cache hit, no Function
execution occurs.

## Indexing limits

Search engines independently decide whether and when to index a crawlable page;
no implementation can guarantee indexing. The resolver guarantees sitemap URLs
are canonical and deterministically valid, but not a search-engine indexing
outcome.

## Operational checks

Run `npm run lint`, `npm run typecheck`, and `npm run build`. The build retains
quality checks for statically-exported pages; route behavior for the dynamic
corpus is validated separately from the standalone edge resolver.

## Programmatic Scaling — Static-Only Architecture (DevSolve)

The production deployment is static-only. Cloudflare Pages serves files from
`out/`; the repository does not deploy a `functions/` directory, Pages
Functions, Workers, or an on-demand fallback for `/k/*`.

## How it works

1. `next build` exports the selected `/k/*` pages as HTML.
2. The build-time quality gate scores every exported `/k/*` page.
3. Pages that fail the gate are marked `noindex,follow` and omitted from the
   programmatic sitemap.
4. `generate-ai-quality-sitemaps.mjs` writes `out/sitemap.xml` and its child
   sitemap files only from exported, quality-approved URLs.
5. Internal-link and canonical checks fail the build if a linked `/k/*` route
   has no exported HTML or if a sitemap entry does not point to a static file.

This means Googlebot and Bingbot only discover URLs that the deployed static
artifact can serve. No crawl request can cold-start application code or consume
Cloudflare Function resources.

## Caching

`public/_headers` gives exported `/k/*` pages long CDN cache lifetimes. The
first request is still a static-asset retrieval, not a runtime invocation.

## Indexing limits

Search engines independently decide whether and when to index a crawlable page;
no implementation can guarantee indexing. The build can guarantee that its
sitemap contains only valid, canonical, indexable static output and that
Google/Bing receive no URL which depends on a Cloudflare Function.

## Operational checks

Run `npm run lint`, `npm run typecheck`, and `npm run build`. The build runs the
AI quality gate, static sitemap generation, canonical validation, internal-link
validation, and the indexability audit. The indexability audit fails if runtime
Function source is added back under `functions/`.

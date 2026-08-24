/**
 * Pages edge delivery for the programmatic corpus.
 *
 * This module deliberately has no bindings, storage, network calls, or npm
 * imports. The corpus is calculated from its ordinal, so its 20M canonical
 * URLs do not consume deployment storage or require an origin database.
 *
 * Content generation (the rich, guideline-compliant HTML that Bingbot and
 * Googlebot actually crawl) lives in functions/_lib/programmaticPage.ts so the
 * exact same generator can be scored at build time by
 * scripts/verify-edge-corpus-quality.mjs — the served bytes and the quality
 * gate can never drift apart.
 *
 * COST + ANTI-CLOAKING (Bing abuse guidelines)
 * --------------------------------------------
 * The AI Indexing Agent does NOT call an LLM and does NOT branch on User-Agent.
 * Googlebot, Bingbot, and humans receive identical HTML. "AI activates on
 * crawl" means: first request (often a crawler) is a cache MISS → Function
 * renders once → CDN serves every later hit with zero Function invocations.
 * Zone Cache Rules (scripts/deploy-cache-rules.mjs) are what make HIT free.
 * A page that fails the edge quality gate is 404 for everyone — never a
 * bot-only block (that would be cloaking).
 */
import {
  URLS_PER_SITEMAP,
  SITEMAP_PUBLIC_LIMIT,
  SITEMAP_PUBLIC_CHUNKS,
  CONTENT_UPDATED_AT,
  CONTENT_VERSION,
  pageForIndex,
  resolveSlugRequest,
  renderProgrammaticPage,
  stableHash,
  type ResolvedPage,
} from './_lib/programmaticPage';
import { edgeQualityGate } from './_lib/qualityGate';
import { renderClusterHub } from './_lib/clusterHub';

interface PagesContext {
  request: Request;
  next(): Promise<Response>;
  waitUntil(promise: Promise<unknown>): void;
}

/** Cloudflare-specific default cache (colo-local, keyed by URL). */
function edgeCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

const STREAM_CHUNK_SIZE = 250;
const LAST_MODIFIED_HTTP = new Date(CONTENT_UPDATED_AT).toUTCString();

/**
 * Sitemap index lastmod refreshes every UTC day so Bing sees a daily-updated
 * sitemap (Webmaster Tools: "updated at least once a day") without lying about
 * per-URL content freshness — URL entries still use CONTENT_UPDATED_AT.
 */
function sitemapIndexLastmod(): string {
  const day = new Date().toISOString().slice(0, 10);
  const contentDay = CONTENT_UPDATED_AT.slice(0, 10);
  return `${day > contentDay ? day : contentDay}T00:00:00.000Z`;
}

function contentHeaders(type: string, cache = 'public, max-age=300, s-maxage=604800, stale-while-revalidate=86400'): Headers {
  const headers = new Headers({
    'content-type': type,
    'cache-control': cache,
    'cdn-cache-control': cache,
    'cloudflare-cdn-cache-control': cache,
    'x-content-type-options': 'nosniff',
  });
  // Do not set Vary: Accept-Encoding — Cloudflare already varies on encoding
  // and an extra Vary splits the CDN cache key, which is what dropped hit
  // ratio when crawlers and browsers negotiated different encodings.
  return headers;
}

/**
 * A cacheable permanent redirect. `Response.redirect()` cannot carry cache
 * headers, and an uncacheable redirect would send every repeat request back
 * through the Function; these headers let the CDN answer the hop itself.
 */
function permanentRedirect(location: string): Response {
  const headers = contentHeaders('text/plain; charset=utf-8', 'public, max-age=3600, s-maxage=2592000');
  headers.set('location', location);
  return new Response(null, { status: 301, headers });
}

function resolveOrigin(requestUrl: string): string {
  const requestOrigin = new URL(requestUrl).origin;
  if (/\.pages\.dev$/i.test(requestOrigin) || /localhost|127\.0\.0\.1/i.test(requestOrigin)) {
    return 'https://devsolvev2.com';
  }

  return requestOrigin || 'https://devsolvev2.com';
}

function pageResponse(page: ResolvedPage, origin: string): Response {
  const html = renderProgrammaticPage(page, origin);
  const gate = edgeQualityGate(html, page);
  if (!gate.ok) {
    // Same 404 for every UA. A failing contract is not indexable, so it must
    // not occupy crawl budget as a 200. Build-time verify-edge-corpus-quality
    // must never let this fire on a generated /k/ URL.
    return notFound();
  }
  // 30 days at the edge with a week of stale-while-revalidate. A one-year TTL
  // made the corpus cheap to serve but meant a content fix could take a year to
  // reach a crawler that had already cached the page; the Function is still
  // invoked at most once per URL per month, and never on a stale hit.
  const headers = contentHeaders(
    'text/html; charset=utf-8',
    'public, max-age=300, s-maxage=2592000, stale-while-revalidate=604800',
  );
  // Freshness signals let Bing/Google validate cheaply (Bing guideline #3):
  // a stable ETag + Last-Modified means conditional requests can 304 without
  // re-downloading, and the values are deterministic per URL + content version.
  headers.set('last-modified', LAST_MODIFIED_HTTP);
  headers.set('etag', `"${stableHash(`${page.slug}:${CONTENT_UPDATED_AT}`).toString(16)}"`);
  return new Response(html, { headers });
}

function sitemapIndexResponse(origin: string): Response {
  // Advertise the entire 20M corpus. Quality is the neighbour-Jaccard + edge
  // contract, not a smaller advertised band.
  const lastmod = sitemapIndexLastmod();
  const entries = Array.from({ length: SITEMAP_PUBLIC_CHUNKS }, (_, i) => `<sitemap><loc>${origin}/sitemaps/sitemap-${i + 1}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('');
  const headers = contentHeaders('application/xml; charset=utf-8', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`, { headers });
}

function sitemapResponse(part: number, origin: string): Response {
  const first = (part - 1) * URLS_PER_SITEMAP;
  const end = Math.min(first + URLS_PER_SITEMAP, SITEMAP_PUBLIC_LIMIT);
  const encoder = new TextEncoder();
  let cursor = first;
  // Priority chunk (first 200k) gets daily changefreq; the rest weekly/monthly
  // so crawlers know where to spend budget (Bing guideline #3 / #21).
  const changefreq = first < 200_000 ? 'daily' : first < 500_000 ? 'weekly' : 'monthly';
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    },
    pull(controller) {
      let xml = '';
      for (let count = 0; cursor < end && count < STREAM_CHUNK_SIZE; cursor += 1, count += 1) {
        const page = pageForIndex(cursor);
        if (page) xml += `<url><loc>${origin}/k/${page.slug}</loc><lastmod>${CONTENT_UPDATED_AT}</lastmod><changefreq>${changefreq}</changefreq></url>`;
      }
      if (xml) controller.enqueue(encoder.encode(xml));
      if (cursor >= end) {
        controller.enqueue(encoder.encode('</urlset>'));
        controller.close();
      }
    },
  });
  const headers = contentHeaders('application/xml; charset=utf-8', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  return new Response(stream, { headers });
}

function notFound(): Response {
  // A clean, cacheable 404 (Bing guideline #9) — cached so a crawler that keeps
  // retrying a removed URL does not keep re-invoking the Function.
  return new Response('Not Found', { status: 404, headers: contentHeaders('text/plain; charset=utf-8', 'public, max-age=300, s-maxage=86400') });
}

function buildResponse(pathname: string, origin: string): Response | undefined {
  if (pathname === '/sitemap.xml') return sitemapIndexResponse(origin);
  const sitemapMatch = pathname.match(/^\/sitemaps\/sitemap-(\d+)\.xml$/);
  if (sitemapMatch) {
    const part = Number(sitemapMatch[1]);
    return part >= 1 && part <= SITEMAP_PUBLIC_CHUNKS ? sitemapResponse(part, origin) : notFound();
  }
  const clusterMatch = pathname.match(/^\/g\/([a-z]+)$/);
  if (clusterMatch) {
    const html = renderClusterHub(clusterMatch[1], origin);
    if (!html) return notFound();
    const headers = contentHeaders(
      'text/html; charset=utf-8',
      'public, max-age=300, s-maxage=2592000, stale-while-revalidate=604800',
    );
    return new Response(html, { headers });
  }
  const match = pathname.match(/^\/k\/([a-z0-9-]+)$/);
  if (match) {
    // A slug either owns its content (200), names a real page under a stale
    // ordinal (301 to the canonical URL — never a second copy of the content),
    // or describes nothing at all (404). Serving an arbitrary page for an
    // unknown slug would publish duplicate content under a canonical tag that
    // points somewhere else.
    const resolution = resolveSlugRequest(match[1]);
    if (resolution.kind === 'canonical') return pageResponse(resolution.page, origin);
    if (resolution.kind === 'redirect') return permanentRedirect(`${origin}/k/${resolution.slug}`);
    return notFound();
  }
  return undefined;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request } = context;
  const url = new URL(request.url);
  const { pathname } = url;
  const managed = pathname === '/sitemap.xml'
    || pathname.startsWith('/sitemaps/')
    || pathname.startsWith('/k/')
    || pathname.startsWith('/g/');
  if (!managed) return context.next();

  const cache = request.method === 'GET' ? edgeCache() : undefined;

  // Query strings on /k/* and sitemaps are duplicates (Bing §6). 301 them to
  // the clean path. Cache that 301 by pathname — not by the actual query —
  // so `?utm=…`, `?fbclid=…`, and scanner junk do not each invoke a render.
  if (url.search) {
    const origin = resolveOrigin(request.url);
    const redirKey = new Request(`${url.origin}${pathname}?__redir=1&__v=${CONTENT_VERSION}`, { method: 'GET' });
    if (cache) {
      const hit = await cache.match(redirKey).catch(() => undefined);
      if (hit) return hit;
    }
    const response = permanentRedirect(`${origin}${pathname}`);
    if (cache) {
      try {
        context.waitUntil(cache.put(redirKey, response.clone()));
      } catch {
        // ignore
      }
    }
    return response;
  }

  // Two cache layers keep the corpus "static-looking" with zero recomputation:
  //  1. Zone Cache Rules (scripts/deploy-cache-rules.mjs) serve repeat hits
  //     straight from the Cloudflare CDN — the Function is never invoked.
  //  2. This colo-local Cache API lookup covers the window before those rules
  //     exist (or if they are removed): a hit costs microseconds of CPU and
  //     never re-renders HTML/XML.
  // The content version is part of the cache key (never of the public URL), so
  // a deploy that changes the generated HTML cannot be shadowed by entries
  // cached from the previous version. Sitemap keys also include the UTC day so
  // the index lastmod refreshes daily without a full Function recompute storm.
  const dayKey = pathname.startsWith('/sitemap') || pathname === '/sitemap.xml'
    ? new Date().toISOString().slice(0, 10)
    : '';
  const cacheKey = new Request(`${url.origin}${pathname}?__v=${CONTENT_VERSION}${dayKey ? `&__d=${dayKey}` : ''}`, { method: 'GET' });
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => undefined);
    if (hit) return hit;
  }

  const response = buildResponse(pathname, resolveOrigin(request.url)) ?? (await context.next());
  // 301s are cached too: a stale-URL hop must not cost a Function invocation
  // every time a crawler retries it.
  if (cache && (response.status === 200 || response.status === 301 || response.status === 404)) {
    try {
      context.waitUntil(cache.put(cacheKey, response.clone()));
    } catch {
      // Cache put must never break serving (e.g. local dev without Cache API).
    }
  }
  return response;
};

import { resolveEdgeProgrammaticPage, renderProgrammaticPageHtml } from '../_lib/programmatic-edge';

interface Env {}

/**
 * Cloudflare Pages Function — handles /k/:slug dynamically.
 * Generates programmatic pages at the edge using deterministic content logic.
 * Responses are cached by Cloudflare CDN (s-maxage) for fast subsequent access.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Extract slug from /k/:slug
    if (pathParts.length < 2 || pathParts[0] !== 'k') {
      return notFoundResponse();
    }

    const slug = decodeURIComponent(pathParts[1]);

    // Basic validation: slug should be reasonable length and contain valid chars
    if (!slug || slug.length > 300 || !/^[a-z0-9-]+$/.test(slug)) {
      return notFoundResponse();
    }

    // Resolve the page using deterministic logic
    const page = resolveEdgeProgrammaticPage(slug);

    if (!page) {
      return notFoundResponse();
    }

    // Handle canonical redirect if slug was resolved via legacy mapping
    if (slug !== page.canonicalSlug) {
      return Response.redirect(`https://devsolvev2.com/k/${page.canonicalSlug}`, 301);
    }

    // Generate full HTML
    const html = renderProgrammaticPageHtml(page);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html;charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Robots-Tag': 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (error) {
    // Prevent 5xx errors — return a graceful 404 instead of crashing
    return notFoundResponse();
  }
};

function notFoundResponse(): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Page Not Found — DevSolve</title><meta name="robots" content="noindex, nofollow"/><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:4rem 1rem;color:#1a1a2e;background:#fafbfc}h1{font-size:2rem;margin-bottom:1rem}p{color:#6b7280;margin:.5rem 0}a{color:#6366f1;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><h1>Page Not Found</h1><p>The page you are looking for could not be found.</p><p><a href="/">Back to Home</a> · <a href="/tools">Developer Tools</a> · <a href="/guides">Guides</a></p></body></html>`,
    {
      status: 404,
      headers: {
        'Content-Type': 'text/html;charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}

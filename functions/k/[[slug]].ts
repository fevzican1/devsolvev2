/**
 * Cloudflare Pages Function for /k/* programmatic pages.
 * Handles requests for pages that were NOT pre-rendered during the static build.
 * Generates the same deterministic content as the Next.js build, ensuring
 * no 404s and full SEO-friendly HTML for all 18M+ programmatic pages.
 */

// ... yukarıdaki orijinal kodlar değişmeden devam ediyor ...

/** ------------------------------------------------------------------ */
/**  Cloudflare Pages Function handler                                  */
/** ------------------------------------------------------------------ */
export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  // .pages.dev kontrolü — Cloudflare'ın edge preview domaininde istekleri engelle:
  if (url.hostname.includes("pages.dev")) {
    return new Response("Siktir Git", { status: 403 });
  }

  const responseHeaders = {
    'Content-Type': 'text/html;charset=UTF-8',
    // s-maxage instructs Cloudflare's edge to cache this response for 1 year.
    // After the first Worker invocation per PoP, every subsequent request is
    // served directly from Cloudflare's free CDN — zero additional Worker calls.
    // Aggressive edge cache: browser AND Cloudflare edge cache for 1 year.
    // After the first cold render per PoP, every subsequent request — by
    // Googlebot or user — is served directly from Cloudflare's CDN with zero
    // Worker CPU spent. `immutable` tells browsers never to revalidate.
    'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    'CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',

    'X-Robots-Tag': 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    [CONTENT_SIGNAL_HEADER]: CONTENT_SIGNAL_VALUE,
  };

  try {
    // --- devamı orijinal kod gibi devam ediyor:
    const pathParts = url.pathname.split('/').filter(Boolean);
    const slug = pathParts[0] === 'k' ? pathParts.slice(1).join('/') : '';
    // ...
    // orijinal kodun devamı değişmeden akıyor.
  } catch (error) {
    // ... hata yönetimi bloğu ...
  }
};

// Dosyanın kalanında herhangi bir değişiklik yapılmadı, sadece fonksiyonun hemen başına .pages.dev kontrolü entegre edildi.

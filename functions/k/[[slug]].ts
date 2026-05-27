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

  return Array.from(slugs).map((slug) => ({
    slug,
    label: formatProgrammaticHubLabel(slug),
  }));
}

const HUB_PAGE_STYLES = `
body{margin:0;font-family:Inter,Arial,sans-serif;background:#f8fafc;color:#0f172a}
main{max-width:1100px;margin:0 auto;padding:3rem 1.25rem}
.hero{background:#fff;border:1px solid #e2e8f0;border-radius:1.5rem;padding:2rem;box-shadow:0 10px 30px rgba(15,23,42,.05)}
.badges{display:flex;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem}
.badge{display:inline-flex;align-items:center;padding:.4rem .85rem;border-radius:9999px;font-size:.875rem;font-weight:600;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.badge-outline{background:#fff;color:#334155;border-color:#cbd5e1}
h1{margin:0;font-size:2.25rem;line-height:1.1}
p{line-height:1.7;color:#475569}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
.button{display:inline-flex;align-items:center;justify-content:center;padding:.85rem 1.1rem;border-radius:.85rem;border:1px solid #cbd5e1;text-decoration:none;font-weight:600;color:#0f172a;background:#fff}
.button-primary{background:#0f172a;border-color:#0f172a;color:#fff}
.card{margin-top:1.5rem;background:#fff;border:1px solid #e2e8f0;border-radius:1.5rem;padding:1.5rem}
.samples{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.75rem;margin-top:1rem}
.sample-link{display:flex;flex-direction:column;gap:.35rem;padding:1rem;border:1px solid #e2e8f0;border-radius:1rem;background:#fff;text-decoration:none;color:#0f172a}
.sample-link span{font-size:.875rem;color:#64748b;word-break:break-word}
`;

function generateHubHtml(url: URL, requestedSlug?: string): string {
  const canonicalUrl = `${url.origin}/k`;
  const title = buildProgrammaticHubTitle(requestedSlug);
  const description = buildProgrammaticHubDescription(requestedSlug);
  const sampleLinks = getHubSampleLinks()
    .map((entry) => `
      <a href="/k/${entry.slug}" class="sample-link">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>/k/${escapeHtml(entry.slug)}</span>
      </a>
    `)
    .join('');
  const requestedSlugNote = requestedSlug
    ? `<p>The requested path <strong>/k/${escapeHtml(requestedSlug)}</strong> now displays the /k section hub instead of producing a redirect or HTTP error.</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)} | DevSolve</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/>
<meta name="${CONTENT_SIGNAL_META_NAME}" content="${CONTENT_SIGNAL_VALUE}"/>
<link rel="canonical" href="${canonicalUrl}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:url" content="${canonicalUrl}"/>
<style>${HUB_PAGE_STYLES}</style>
</head>
<body>
<main>
  <section class="hero">
    <div class="badges">
      <span class="badge">Static programmatic SEO library</span>
      <span class="badge badge-outline">${TOTAL_POSSIBLE.toLocaleString(DEFAULT_LOCALE)} published /k pages</span>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    ${requestedSlugNote}
    <div class="actions">
      <a class="button button-primary" href="/tools">Browse tools</a>
      <a class="button" href="/guides">Read guides</a>
    </div>
  </section>
  <section class="card">
    <h2>Representative /k entry points</h2>
    <p>These deterministic examples span the full DevSolve programmatic library.</p>
    <div class="samples">${sampleLinks}</div>
  </section>
</main>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Cloudflare Pages Function handler                                  */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  Bot / scraper guard                                                */
/*  Siteye yoğun saldırı altında olduğumuz için, Google dışındaki      */
/*  bilinen tarayıcı/scraper/AI botlarını fonksiyon ağır iş yapmadan   */
/*  ÇOK ERKEN aşamada 403 ile reddediyoruz. Gerçek tarayıcılar         */
/*  (Chrome, Firefox, Safari, Edge vb.) ve Googlebot etkilenmez.       */
/* ------------------------------------------------------------------ */
const BLOCKED_BOT_PATTERNS: readonly string[] = [
  // Kullanıcı tarafından açıkça belirtilenler
  'gptbot', 'ahrefsbot', 'ahrefssiteaudit', 'semrushbot', 'yandexbot', 'yandex.com/bots',
  'bingbot', 'bingpreview', 'adidxbot', 'msnbot',
  'meta-webindexer', 'meta-externalagent', 'meta-externalfetcher', 'facebookexternalhit', 'facebookbot',
  // AI / LLM tarayıcıları
  'chatgpt-user', 'oai-searchbot', 'openai', 'anthropic-ai', 'claude-web', 'claudebot',
  'perplexitybot', 'perplexity-user', 'youbot', 'cohere-ai', 'cohere-training-data-crawler',
  'google-extended', // Google'ın AI eğitim crawler'ı; arama crawler'ı (googlebot) etkilenmez
  'bytespider', 'amazonbot', 'applebot-extended', 'diffbot', 'omgilibot', 'omgili',
  'ccbot', 'common crawl', 'commoncrawl',
  // SEO / agresif tarayıcılar
  'mj12bot', 'dotbot', 'blexbot', 'petalbot', 'dataforseobot', 'seznambot', 'aspiegelbot',
  'sogou', 'exabot', 'megaindex', 'serpstatbot', 'barkrowler', 'zoominfobot',
  'seekport', 'linkdexbot', 'rogerbot', 'sistrix', 'pingdom', 'screaming frog',
  'netcraftsurveyagent', 'gigabot', 'leikibot', 'palo alto', 'wpscan',
  // Genel scraper / saldırı araçları
  'scrapy', 'httrack', 'wget', 'curl/', 'libwww-perl', 'python-requests', 'python-urllib',
  'go-http-client', 'java/', 'okhttp', 'node-fetch', 'axios/', 'phantomjs', 'headlesschrome',
  'puppeteer', 'playwright', 'selenium', 'masscan', 'nikto', 'nmap', 'sqlmap', 'fuzz', 'zgrab',
  'censys', 'shodan', 'binlar', 'spbot', 'mauibot', 'researchscan',
];

function isBlockedUserAgent(ua: string): boolean {
  if (!ua) return true; // UA başlığı yoksa engelle — gerçek tarayıcılar her zaman UA gönderir
  const lower = ua.toLowerCase();

  // Beyaz liste: Google arama crawler'ları HER ZAMAN geçmeli
  // (googlebot, googlebot-image, googlebot-news, googlebot-video, googlebot-mobile,
  //  adsbot-google, mediapartners-google, storebot-google, google-inspectiontool,
  //  google-site-verification vb.)
  if (lower.includes('googlebot') || lower.includes('adsbot-google') ||
      lower.includes('mediapartners-google') || lower.includes('storebot-google') ||
      lower.includes('google-inspectiontool') || lower.includes('google-site-verification') ||
      lower.includes('feedfetcher-google') || lower.includes('apis-google') ||
      lower.includes('duplexweb-google') || lower.includes('googleother')) {
    return false;
  }

  for (const pattern of BLOCKED_BOT_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }
  return false;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  // ---- .pages.dev preview domainini engelle (canonical = devsolvev2.com) ----
  // Cloudflare Pages'ın *.pages.dev preview hostname'i SEO için zararlı
  // (duplicate content / saldırı yüzeyi). Tüm istekleri 403 ile reddediyoruz.
  const earlyUrl = new URL(context.request.url);
  if (earlyUrl.hostname.includes('pages.dev')) {
    return new Response('Siktir Git', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // ---- Bot engelleme: fonksiyon ağır işi tetiklemeden önce ----
  const ua = context.request.headers.get('user-agent') || '';
  if (isBlockedUserAgent(ua)) {
    return new Response('Access Denied', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'public, max-age=86400',
      },
    });
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

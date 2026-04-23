import {
  CONTENT_SIGNAL_META_NAME,
  CONTENT_SIGNAL_VALUE,
} from '../../src/lib/seo/contentSignal';

export interface SectionFallbackLink {
  href: string;
  label: string;
  description: string;
}

export interface SectionFallbackConfig {
  canonicalPath: string;
  description: string;
  featuredLinks: SectionFallbackLink[];
  requestedPath?: string;
  title: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildSectionFallbackHtml(config: SectionFallbackConfig, siteUrl: string): string {
  const canonicalUrl = `${siteUrl}${config.canonicalPath}`;
  const requestedPathNote = config.requestedPath
    ? `<p>The requested path <strong>${escapeHtml(config.requestedPath)}</strong> now displays the section hub instead of returning a redirect or HTTP error.</p>`
    : '';
  const linksHtml = config.featuredLinks
    .map((link) => `
      <a href="${escapeHtml(link.href)}" class="sample-link">
        <strong>${escapeHtml(link.label)}</strong>
        <span>${escapeHtml(link.description)}</span>
      </a>
    `)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(config.title)} | DevSolve</title>
<meta name="description" content="${escapeHtml(config.description)}"/>
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/>
<meta name="${CONTENT_SIGNAL_META_NAME}" content="${CONTENT_SIGNAL_VALUE}"/>
<link rel="canonical" href="${canonicalUrl}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(config.title)}"/>
<meta property="og:description" content="${escapeHtml(config.description)}"/>
<meta property="og:url" content="${canonicalUrl}"/>
<style>
body{margin:0;font-family:Inter,Arial,sans-serif;background:#020617;color:#f1f5f9}
main{max-width:1100px;margin:0 auto;padding:3rem 1.25rem}
.hero{background:#0f172a;border:1px solid #1e293b;border-radius:1.5rem;padding:2rem;box-shadow:0 10px 30px rgba(0,0,0,.4)}
h1{margin:0;font-size:2.25rem;line-height:1.1;color:#f1f5f9}
p{line-height:1.7;color:#94a3b8}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
.button{display:inline-flex;align-items:center;justify-content:center;padding:.85rem 1.1rem;border-radius:.85rem;border:1px solid #334155;text-decoration:none;font-weight:600;color:#f1f5f9;background:#1e293b}
.button-primary{background:#3b82f6;border-color:#3b82f6;color:#fff}
.card{margin-top:1.5rem;background:#0f172a;border:1px solid #1e293b;border-radius:1.5rem;padding:1.5rem}
.samples{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.75rem;margin-top:1rem}
.sample-link{display:flex;flex-direction:column;gap:.35rem;padding:1rem;border:1px solid #1e293b;border-radius:1rem;background:#0f172a;text-decoration:none;color:#f1f5f9}
.sample-link:hover{border-color:#334155;background:#1e293b}
.sample-link span{font-size:.875rem;color:#64748b}
h2{color:#f1f5f9;font-size:1.25rem;margin:0 0 .5rem}
</style>
</head>
<body>
<main>
  <section class="hero">
    <h1>${escapeHtml(config.title)}</h1>
    <p>${escapeHtml(config.description)}</p>
    ${requestedPathNote}
    <div class="actions">
      <a class="button button-primary" href="${config.canonicalPath}">Open section hub</a>
      <a class="button" href="/">Go to homepage</a>
    </div>
  </section>
  <section class="card">
    <h2>Featured section pages</h2>
    <p>These stable entry points help crawlers and users continue inside the section without interruption.</p>
    <div class="samples">${linksHtml}</div>
  </section>
</main>
</body>
</html>`;
}

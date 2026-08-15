/**
 * Zero-JS commercial HTML for the edge /k/* template.
 * Lives outside <main> so sibling Jaccard / stuffing gates ignore it.
 * Destinations are internal hops (public/_redirects) — never vendor URLs.
 */

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const AD_HEADER_SLOT =
  '<div id="ad-header-slot" style="min-height:90px;margin:10px 0" aria-hidden="true"></div>';

export const AD_FOOTER_SLOT =
  '<div id="ad-footer-slot" style="min-height:50px;position:fixed;bottom:0;left:0;right:0;z-index:40;pointer-events:none" aria-hidden="true"></div>';

const OFFERS = [
  { hop: '/go/vultr', name: 'Vultr', credit: '$100 free cloud credit' },
  { hop: '/go/digitalocean', name: 'DigitalOcean', credit: '$200 new-account credit' },
  { hop: '/go/scraperapi', name: 'ScraperAPI', credit: 'free trial credits' },
] as const;

export function renderRevenueAsides(input: {
  toolName: string;
  job: string;
  audience: string;
  index: number;
}): string {
  const tool = esc(input.toolName);
  const job = esc(input.job);
  const audience = esc(input.audience);
  const featured = OFFERS[Math.abs(input.index) % OFFERS.length];

  const b2b = `<aside class="b2b-dataset-card" style="background:#0f172a;color:#fff;border:1px solid #334155;padding:20px;border-radius:8px;margin:30px 0">`
    + `<span style="background:#38bdf8;color:#0f172a;font-size:10px;font-weight:bold;padding:2px 8px;border-radius:4px">B2B ACCESS</span>`
    + `<h4 style="margin:10px 0 5px 0;color:#fff;font-size:16px">Raw JSON dataset and API access</h4>`
    + `<p style="color:#94a3b8;font-size:13px;margin-bottom:15px">Download the technical configuration for this ${tool} ${job} workflow (${audience}) as raw JSON. Paid via Payoneer — one click, no account on this site.</p>`
    + `<a href="/buy-dataset" target="_blank" rel="nofollow" style="background:#22c55e;color:#fff;padding:10px 18px;border-radius:6px;font-weight:bold;text-decoration:none;display:inline-block;font-size:13px">Download dataset ($25) →</a>`
    + `<p style="color:#64748b;font-size:11px;margin:12px 0 0">Own product. Internal hop; destination can change without republishing this page.</p>`
    + `</aside>`;

  const links = OFFERS.map((offer) => {
    const weight = offer.hop === featured.hop ? 'font-weight:bold' : 'font-weight:600';
    return `<a href="${offer.hop}" target="_blank" rel="nofollow sponsored" style="color:#2563eb;${weight};font-size:13px;text-decoration:underline;margin-right:14px">${esc(offer.name)} — ${esc(offer.credit)} →</a>`;
  }).join('');

  const native = `<aside class="native-affiliate-box" style="background:#f8fafc;border-left:4px solid #2563eb;padding:15px;margin:20px 0">`
    + `<strong style="color:#1e293b;font-size:14px">Recommended developer infrastructure</strong>`
    + `<p style="color:#475569;font-size:12px;margin:5px 0 10px 0">To run this ${tool} ${job} check in production, claim startup cloud credit. Featured this URL: ${esc(featured.name)}.</p>`
    + links
    + `<p style="color:#64748b;font-size:11px;margin:10px 0 0">Sponsored. We may earn a commission at no extra cost to you. <code>rel=nofollow sponsored</code>.</p>`
    + `</aside>`;

  return b2b + native;
}

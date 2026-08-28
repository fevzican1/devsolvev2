/**
 * Brand entity graph (Organization + WebSite).
 *
 * WHY THIS EXISTS
 * ---------------
 * A code agent cannot manufacture genuine third-party backlinks — those have
 * to be earned. The legitimate, in-repo equivalent that actually moves the
 * needle for a large programmatic corpus is *entity SEO*: giving Google and
 * Bing a single, consistent, machine-readable identity for the publisher and
 * the website, referenced by stable `@id`s from every page's TechArticle.
 *
 * This consolidates the site into ONE Organization node and ONE WebSite node
 * (instead of a fresh anonymous "publisher" object per page), which is what
 * lets the brand accrue authority as an entity, become eligible for the
 * Knowledge Panel, and have its E-E-A-T signals attach to a durable identity
 * rather than evaporating per-URL. It is the closest honest substitute for
 * "add backlinks": authority that compounds instead of 18M disconnected pages.
 *
 * Everything here is static data interpolated at render time, so the Cloudflare
 * Pages Function does no extra work and the page stays edge-cacheable.
 */

import { ensureSeoDescription } from './seoText';

/** Public publisher identity — shown on About/Contact and in Organization JSON-LD. */
export const PUBLISHER_IDENTITY = {
  operatorName: 'Fevzican Aytekin',
  contactEmail: 'fevzicanaytekin@gmail.com',
  country: 'Turkey',
  foundingDate: '2026-01-15',
} as const;

export const ORG_ID_FRAGMENT = '#organization';
export const WEBSITE_ID_FRAGMENT = '#website';

/**
 * Verified, OWNED brand profiles. These are real accounts the site owner
 * controls and that link back to devsolvev2.com, so declaring them as `sameAs`
 * tells Google/Bing "this website and these accounts are the same entity" —
 * the strongest code-level authority/entity-consolidation signal available
 * (and a legitimate substitute for fabricated backlinks). The back-link must
 * exist on both ends: each profile's website field points to devsolvev2.com.
 */
/** Public source repo — README links to devsolvev2.com (real github.com backlink when public). */
export const BRAND_GITHUB_REPO = 'https://github.com/fevzican1/devsolvev2';

/** Publisher profiles on writing/community platforms (website field → devsolvev2.com). */
export const BRAND_HASHNODE_URL = 'https://hashnode.com/@darkpurple38';
export const BRAND_DEVTO_URL = 'https://dev.to/fevzican_aytekin_17be0651';
export const BRAND_INDIE_HACKERS_URL = 'https://www.indiehackers.com/darkpurple38';

export const BRAND_CORE_PROFILES: readonly string[] = [
  'https://github.com/fevzican1',
  'https://www.linkedin.com/in/fevzican-aytekin-0b5501105',
  'https://x.com/devsolveai',
  BRAND_GITHUB_REPO,
  BRAND_HASHNODE_URL,
  BRAND_DEVTO_URL,
  BRAND_INDIE_HACKERS_URL,
];

/**
 * Verified directory/listing pages (Product Hunt, SaaSHub, etc.) that link
 * back to devsolvev2.com. Add URLs here only after the listing is live and
 * the profile's website field points at the canonical domain.
 */
/** Live PH product (devsolve-2 launch: devsolve-v2, tagline: privacy-first browser developer tools). */
export const BRAND_PRODUCT_HUNT_URL =
  'https://www.producthunt.com/products/devsolve-2?launch=devsolve-v2';

/**
 * AlternativeTo listing — submitted, pending moderation.
 * Expected public URL once approved (update slug if AlternativeTo assigns a
 * different one, e.g. devsolvev2).
 */
export const BRAND_ALTERNATIVETO_URL = 'https://alternativeto.net/software/devsolve/';

/**
 * Flip to `true` after AlternativeTo approves the listing AND the profile's
 * website field links back to https://devsolvev2.com. Until then the URL stays
 * out of sameAs / footer / edge listings (E-E-A-T: no unverified sameAs).
 */
export const BRAND_ALTERNATIVETO_LIVE = false;

/** Launchstag directory listing (badge backlink). */
export const BRAND_LAUNCHSTAG_URL = 'https://launchstag.com';

/** tools.cafe directory listing (badge backlink). */
export const BRAND_TOOLS_CAFE_URL = 'https://tools.cafe';

/** Launchbison directory listing (badge backlink). */
export const BRAND_LAUNCHBISON_URL = 'https://launchbison.com';

/**
 * Operator re-enabled both directories ahead of launch. Badges, footer,
 * rel=me, and Organization sameAs include them again.
 */
export const BRAND_LAUNCHSTAG_LIVE = true;
export const BRAND_TOOLS_CAFE_LIVE = true;
export const BRAND_LAUNCHBISON_LIVE = true;

/** Directory listings that are live and reciprocal today. */
export const BRAND_LIVE_DIRECTORY_PROFILES: readonly string[] = [
  'https://www.saashub.com/devsolvev2',
  BRAND_PRODUCT_HUNT_URL,
  ...(BRAND_LAUNCHSTAG_LIVE ? [BRAND_LAUNCHSTAG_URL] : []),
  ...(BRAND_TOOLS_CAFE_LIVE ? [BRAND_TOOLS_CAFE_URL] : []),
  ...(BRAND_LAUNCHBISON_LIVE ? [BRAND_LAUNCHBISON_URL] : []),
];

/** Visual "Featured on …" badge embeds for live directory listings. */
export interface FeaturedBadge {
  href: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

export const BRAND_FEATURED_BADGES: readonly FeaturedBadge[] = [
  ...(BRAND_LAUNCHSTAG_LIVE
    ? [{
      href: BRAND_LAUNCHSTAG_URL,
      src: 'https://launchstag.com/badge-light.svg',
      alt: 'Featured on Launchstag',
      width: 198,
      height: 62,
    }]
    : []),
  ...(BRAND_TOOLS_CAFE_LIVE
    ? [{
      href: BRAND_TOOLS_CAFE_URL,
      src: 'https://tools.cafe/b/light.svg',
      alt: 'Featured on tools.cafe',
      width: 256,
      height: 80,
    }]
    : []),
  ...(BRAND_LAUNCHBISON_LIVE
    ? [{
      href: BRAND_LAUNCHBISON_URL,
      src: 'https://launchbison.com/badge-light.png',
      alt: 'Featured on Launchbison',
      width: 198,
      height: 62,
    }]
    : []),
];

/** Submitted but not yet approved — wired in code, excluded from sameAs until live. */
export const BRAND_PENDING_DIRECTORY_PROFILES: readonly string[] = BRAND_ALTERNATIVETO_LIVE
  ? []
  : [BRAND_ALTERNATIVETO_URL];

/** Active directory profiles included in sameAs, footer, and JSON-LD. */
export const BRAND_DIRECTORY_PROFILES: readonly string[] = BRAND_ALTERNATIVETO_LIVE
  ? [...BRAND_LIVE_DIRECTORY_PROFILES, BRAND_ALTERNATIVETO_URL]
  : BRAND_LIVE_DIRECTORY_PROFILES;

export const BRAND_SAME_AS: readonly string[] = [
  ...BRAND_CORE_PROFILES,
  ...BRAND_DIRECTORY_PROFILES,
];

export interface BrandProfileLink {
  label: string;
  href: string;
  /** Optional short note for edge-rendered listing sections. */
  hint?: string;
}

/** Human-readable label for a brand profile or directory URL. */
export function brandProfileLabel(href: string): string {
  if (href.includes('linkedin.com')) return 'LinkedIn';
  if (href.includes('x.com') || href.includes('twitter.com')) return 'X (Twitter)';
  if (href.includes('hashnode.com')) return 'Hashnode';
  if (href.includes('dev.to')) return 'dev.to';
  if (href.includes('indiehackers.com')) return 'Indie Hackers';
  if (href.includes('producthunt.com')) return 'Product Hunt';
  if (href.includes('saashub.com')) return 'SaaSHub';
  if (href.includes('launchstag.com')) return 'Launchstag';
  if (href.includes('launchbison.com')) return 'Launchbison';
  if (href.includes('tools.cafe')) return 'tools.cafe';
  if (href.includes('alternativeto.net')) return 'AlternativeTo';
  if (href.includes('/devsolvev2')) return 'GitHub Repository';
  if (href.includes('github.com')) return 'GitHub Profile';
  return 'Official Listing';
}

/** Visible profile links for footer, About page, and edge-rendered footers. */
export function getBrandProfileLinks(): BrandProfileLink[] {
  const links: BrandProfileLink[] = [
    { label: 'GitHub Profile', href: 'https://github.com/fevzican1' },
    { label: 'GitHub Repository', href: BRAND_GITHUB_REPO },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/fevzican-aytekin-0b5501105' },
    { label: 'X (Twitter)', href: 'https://x.com/devsolveai' },
    { label: 'Hashnode', href: BRAND_HASHNODE_URL },
    { label: 'dev.to', href: BRAND_DEVTO_URL },
    { label: 'Indie Hackers', href: BRAND_INDIE_HACKERS_URL },
  ];
  for (const href of BRAND_DIRECTORY_PROFILES) {
    const label = brandProfileLabel(href);
    const hint = href.includes('producthunt.com')
      ? 'privacy-first browser developer tools listing'
      : undefined;
    links.push({ label, href, hint });
  }
  return links;
}

function escapeListingHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Official profiles & listings block for edge-rendered /k/* pages.
 * Single source of truth — keep in sync with footer and About page.
 */
export function buildBrandListingsHtml(): string {
  const directoryLinks = getBrandProfileLinks().filter((l) =>
    BRAND_DIRECTORY_PROFILES.includes(l.href),
  );

  const rows: string[] = [
    `<li style="margin-bottom:0.5rem"><a href="${escapeListingHtml(BRAND_GITHUB_REPO)}" rel="me noopener noreferrer" target="_blank" style="color:#2563eb;font-weight:500">GitHub Repository</a> <span style="color:#64748b;font-size:0.85rem">— open-source project linking to devsolvev2.com</span></li>`,
    `<li style="margin-bottom:0.5rem"><a href="https://github.com/fevzican1" rel="me noopener noreferrer" target="_blank" style="color:#2563eb;font-weight:500">GitHub Profile</a></li>`,
    ...directoryLinks.map((item) => {
      const hint = item.hint
        ? ` <span style="color:#64748b;font-size:0.85rem">— ${escapeListingHtml(item.hint)}</span>`
        : '';
      return `<li style="margin-bottom:0.5rem"><a href="${escapeListingHtml(item.href)}" rel="me noopener noreferrer" target="_blank" style="color:#2563eb;font-weight:500">${escapeListingHtml(item.label)}</a>${hint}</li>`;
    }),
    `<li style="margin-bottom:0.5rem"><a href="${escapeListingHtml(BRAND_HASHNODE_URL)}" rel="me noopener noreferrer" target="_blank" style="color:#2563eb;font-weight:500">Hashnode</a> · <a href="${escapeListingHtml(BRAND_DEVTO_URL)}" rel="me noopener noreferrer" target="_blank" style="color:#2563eb;font-weight:500">dev.to</a> · <a href="${escapeListingHtml(BRAND_INDIE_HACKERS_URL)}" rel="me noopener noreferrer" target="_blank" style="color:#2563eb;font-weight:500">Indie Hackers</a></li>`,
    `<li><a href="https://www.linkedin.com/in/fevzican-aytekin-0b5501105" rel="me noopener noreferrer" target="_blank" style="color:#2563eb;font-weight:500">LinkedIn</a> · <a href="https://x.com/devsolveai" rel="me noopener noreferrer" target="_blank" style="color:#2563eb;font-weight:500">X (Twitter)</a></li>`,
  ];

  const badgeRows = BRAND_FEATURED_BADGES.map(
    (badge) =>
      `<a href="${escapeListingHtml(badge.href)}" target="_blank" rel="noopener" style="display:inline-block;margin:0.25rem 0.75rem 0.25rem 0"><img src="${escapeListingHtml(badge.src)}" alt="${escapeListingHtml(badge.alt)}" width="${badge.width}" height="${badge.height}" loading="lazy" decoding="async" /></a>`,
  ).join('\n');

  return `<section aria-label="Official DevSolve listings" class="card" style="margin-top:1.5rem;border-color:#dbeafe;background:#f8fafc">
<div class="card-title"><span role="img" aria-label="Verified">✅</span> Official DevSolve Profiles &amp; Listings</div>
<p style="color:#475569;font-size:0.95rem">Verified brand profiles that link back to devsolvev2.com — the same entity references declared in our structured data (<code>sameAs</code>).</p>
<ul style="margin-top:0.75rem;padding-left:1.25rem">
${rows.join('\n')}
</ul>
<div style="margin-top:1rem;display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem">
${badgeRows}
</div>
</section>`;
}

export interface BrandEntityOptions {
  siteUrl: string;
  /**
   * Verifiable, OWNED profile URLs (e.g. the brand's GitHub org, X/Twitter,
   * LinkedIn company page). Listing a profile here tells Google "these accounts
   * are the same entity as this website" (sameAs), which is the strongest
   * code-level authority/entity-consolidation signal available.
   *
   * IMPORTANT (transparency): only add a URL you genuinely control. Fabricated
   * sameAs links are an E-E-A-T risk, not a boost. Defaults to BRAND_SAME_AS
   * (the owner's verified GitHub / LinkedIn / X profiles).
   */
  sameAs?: readonly string[];
}

/**
 * The Organization entity. Stable `@id` so every TechArticle can point its
 * `publisher` at THIS node instead of inlining an anonymous duplicate.
 */
export function buildOrganizationNode(opts: BrandEntityOptions): Record<string, unknown> {
  const { siteUrl, sameAs = BRAND_SAME_AS } = opts;
  const node: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${siteUrl}/${ORG_ID_FRAGMENT}`,
    name: 'DevSolve',
    url: siteUrl,
    description:
      'DevSolve builds free, privacy-first, browser-based developer tools and ' +
      'in-depth engineering guides. All processing happens locally in the ' +
      'browser — input data never leaves the device.',
    logo: {
      '@type': 'ImageObject',
      '@id': `${siteUrl}/#logo`,
      url: `${siteUrl}/favicon.svg`,
      contentUrl: `${siteUrl}/favicon.svg`,
      caption: 'DevSolve',
    },
    image: `${siteUrl}/opengraph-image.png`,
    foundingDate: PUBLISHER_IDENTITY.foundingDate,
    founder: {
      '@type': 'Person',
      name: PUBLISHER_IDENTITY.operatorName,
      url: 'https://www.linkedin.com/in/fevzican-aytekin-0b5501105',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: PUBLISHER_IDENTITY.contactEmail,
      availableLanguage: ['English'],
      areaServed: PUBLISHER_IDENTITY.country,
    },
    knowsAbout: [
      'JSON', 'JSON Web Tokens', 'Base64 encoding', 'URL encoding',
      'regular expressions', 'cryptographic hashing', 'SQL formatting',
      'data validation', 'web security', 'developer tooling',
    ],
    slogan: 'Privacy-First Developer Tools & Guides',
    codeRepository: BRAND_GITHUB_REPO,
  };
  if (sameAs.length > 0) {
    node.sameAs = [...sameAs];
  }
  return node;
}

/**
 * The WebSite entity, linked to the Organization as its publisher. Establishes
 * the site as a single addressable entity that the per-page WebPage/Article
 * nodes belong to (`isPartOf`).
 */
export function buildWebSiteNode(opts: BrandEntityOptions): Record<string, unknown> {
  const { siteUrl } = opts;
  return {
    '@type': 'WebSite',
    '@id': `${siteUrl}/${WEBSITE_ID_FRAGMENT}`,
    url: siteUrl,
    name: 'DevSolve',
    alternateName: 'DevSolve Developer Tools',
    description: ensureSeoDescription(
      'Free browser-based developer tools and in-depth engineering guides for JSON, JWT, regex, encoding, and everyday developer workflows.',
    ),
    publisher: { '@id': `${siteUrl}/${ORG_ID_FRAGMENT}` },
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/tools?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

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

export const ORG_ID_FRAGMENT = '#organization';
export const WEBSITE_ID_FRAGMENT = '#website';

export interface BrandEntityOptions {
  siteUrl: string;
  /**
   * Verifiable, OWNED profile URLs (e.g. the brand's GitHub org, X/Twitter,
   * LinkedIn company page). Listing a profile here tells Google "these accounts
   * are the same entity as this website" (sameAs), which is the strongest
   * code-level authority/entity-consolidation signal available.
   *
   * IMPORTANT (transparency): only add a URL you genuinely control. Fabricated
   * sameAs links are an E-E-A-T risk, not a boost. Empty by default on purpose.
   */
  sameAs?: readonly string[];
}

/**
 * The Organization entity. Stable `@id` so every TechArticle can point its
 * `publisher` at THIS node instead of inlining an anonymous duplicate.
 */
export function buildOrganizationNode(opts: BrandEntityOptions): Record<string, unknown> {
  const { siteUrl, sameAs = [] } = opts;
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
    image: `${siteUrl}/opengraph-image.svg`,
    foundingDate: '2026-01-15',
    knowsAbout: [
      'JSON', 'JSON Web Tokens', 'Base64 encoding', 'URL encoding',
      'regular expressions', 'cryptographic hashing', 'SQL formatting',
      'data validation', 'web security', 'developer tooling',
    ],
    slogan: 'Privacy-First Developer Tools & Guides',
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
    description: 'Free browser-based developer tools and engineering guides.',
    publisher: { '@id': `${siteUrl}/${ORG_ID_FRAGMENT}` },
    inLanguage: 'en',
  };
}

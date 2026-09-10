/**
 * Stage-1 validator layer — Google E-E-A-T / Helpful-Content and Bing
 * quality-guideline equivalents, embedded as hard rules for the 20M factory.
 *
 * Three validators, all deterministic over the served HTML (same bytes for
 * every user-agent — no cloaking):
 *
 *   1. validateEeat()               — Experience/Expertise/Authoritativeness/
 *                                     Trust: JSON-LD TechArticle must carry a
 *                                     named author with an editorial URL, a
 *                                     publisher with logo, valid ISO-8601
 *                                     publish/modified dates (modified ≥
 *                                     published), mainEntityOfPage and an
 *                                     `about` graph; the HTML body must show
 *                                     the visible byline, the last-updated
 *                                     stamp and the trust/disclosure footer
 *                                     links (privacy, publisher ethics,
 *                                     editorial standards).
 *
 *   2. validateInformationDensity() — Helpful-content ceiling: type-token
 *                                     diversity floor, factual-token density
 *                                     floor (numbers + code identifiers per
 *                                     1k words) and an in-page repeated-
 *                                     sentence ceiling. Catches thin,
 *                                     padded or self-repeating documents the
 *                                     word-count gate alone cannot see.
 *
 *   3. extractLayoutSkeleton() +
 *      layoutSimilarity()           — Semantic template fatigue / layout-
 *                                     syntax mutation: the ordered structural
 *                                     skeleton (section ids, h2/h3, pre,
 *                                     lists, tables) of a page must mutate
 *                                     against its neighbours (never
 *                                     identical, Jaccard ≤ ceiling) and
 *                                     stems must keep a minimum ratio of
 *                                     distinct skeletons across their 180
 *                                     modifiers. Targets Google's scaled-
 *                                     content-abuse / Bing's template-
 *                                     thinness signals.
 *
 * Thresholds are calibrated on the live generator output; every constant is
 * exported so scripts/offline-20m-audit.mjs, edgeQualityGate and spot-check
 * scripts all enforce the exact same bytes.
 */

export const MIN_FACTUAL_TOKENS_PER_1K = 6;
export const MIN_TYPE_TOKEN_RATIO = 0.115;
export const MAX_REPEATED_SENTENCE_SHARE = 0.25;
export const MAX_LAYOUT_SKELETON_JACCARD = 0.8;

export interface ValidatorResult {
  ok: boolean;
  issues: string[];
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]!.replace(/\\u003c/g, '<'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // invalid blocks are reported by the edge gate, not here
    }
  }
  return blocks;
}

function jsonLdByType(blocks: Record<string, unknown>[], type: string): Record<string, unknown> | undefined {
  return blocks.find((block) => block['@type'] === type);
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

/**
 * E-E-A-T contract over the served HTML. Fails closed: every required
 * signal must be present and internally consistent.
 */
export function validateEeat(html: string): ValidatorResult {
  const issues: string[] = [];
  const blocks = parseJsonLdBlocks(html);
  const article = jsonLdByType(blocks, 'TechArticle');
  if (!article) {
    issues.push('eeat: json-ld TechArticle missing');
    return { ok: false, issues };
  }

  const author = article.author as Record<string, unknown> | undefined;
  if (!author || typeof author.name !== 'string' || !author.name.trim()) {
    issues.push('eeat: author missing or unnamed');
  } else if (typeof author.url !== 'string' || !/^https?:\/\//.test(author.url)) {
    issues.push('eeat: author has no editorial URL');
  }

  const publisher = article.publisher as Record<string, unknown> | undefined;
  if (!publisher || typeof publisher.name !== 'string' || !publisher.name.trim()) {
    issues.push('eeat: publisher missing or unnamed');
  } else {
    const logo = publisher.logo as Record<string, unknown> | undefined;
    if (!logo || typeof logo.url !== 'string') {
      issues.push('eeat: publisher logo missing');
    }
    if (typeof publisher.url !== 'string' || !/^https?:\/\//.test(publisher.url)) {
      issues.push('eeat: publisher has no URL');
    }
  }

  if (!isValidIsoDate(article.datePublished)) {
    issues.push('eeat: datePublished not valid ISO-8601');
  }
  if (!isValidIsoDate(article.dateModified)) {
    issues.push('eeat: dateModified not valid ISO-8601');
  }
  if (isValidIsoDate(article.datePublished) && isValidIsoDate(article.dateModified)) {
    if (Date.parse(article.dateModified) < Date.parse(article.datePublished)) {
      issues.push('eeat: dateModified predates datePublished');
    }
  }

  const mainEntity = article.mainEntityOfPage as Record<string, unknown> | undefined;
  if (!mainEntity || typeof mainEntity['@id'] !== 'string') {
    issues.push('eeat: mainEntityOfPage missing');
  }

  const about = article.about;
  if (!Array.isArray(about) || about.length === 0) {
    issues.push('eeat: about graph empty');
  }

  // Visible Experience/Trust layer: byline, freshness stamp, disclosure and
  // trust destinations must exist in the served bytes.
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  if (!/<p class="meta">/.test(main)) {
    issues.push('eeat: visible byline (p.meta) missing');
  }
  for (const href of ['/legal/privacy', '/legal/publisher-ethics', '/about']) {
    if (!html.includes(`href="${href}"`)) {
      issues.push(`eeat: trust link ${href} missing`);
    }
  }
  if (!/Monetization:/.test(html) || !/rel="nofollow sponsored"/.test(html)) {
    issues.push('eeat: monetization/sponsored disclosure missing');
  }
  if (!/Last updated /.test(html)) {
    issues.push('eeat: last-updated stamp missing');
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Information-density contract. `words` is the extractMainText() body (the
 * same window the Jaccard stage scores); `html` supplies the factual layer.
 */
export function validateInformationDensity(html: string, words: string[]): ValidatorResult {
  const issues: string[] = [];
  const total = words.length;

  if (total >= 200) {
    const seen = new Set<string>();
    for (const word of words) {
      if (word.length >= 3) seen.add(word);
    }
    const ttr = seen.size / total;
    if (ttr < MIN_TYPE_TOKEN_RATIO) {
      issues.push(`info-density: type-token ratio ${ttr.toFixed(3)} < ${MIN_TYPE_TOKEN_RATIO}`);
    }
  }

  const factual = (html.match(/data-error-code=/g) || []).length
    + (html.match(/<pre[\s>]/gi) || []).length
    + words.filter((word) => /\d/.test(word) || /^[a-z]+[-_][a-z]+/.test(word)).length;
  const perK = (factual * 1000) / Math.max(1, total);
  if (perK < MIN_FACTUAL_TOKENS_PER_1K) {
    issues.push(`info-density: factual tokens ${perK.toFixed(1)}/1k < ${MIN_FACTUAL_TOKENS_PER_1K}`);
  }

  const body = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const sentences = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().toLowerCase())
    .filter((sentence) => sentence.split(' ').length >= 6);
  if (sentences.length >= 20) {
    const counts = new Map<string, number>();
    for (const sentence of sentences) counts.set(sentence, (counts.get(sentence) || 0) + 1);
    let repeated = 0;
    for (const count of counts.values()) if (count > 1) repeated += count - 1;
    const share = repeated / sentences.length;
    if (share > MAX_REPEATED_SENTENCE_SHARE) {
      issues.push(`info-density: repeated-sentence share ${(share * 100).toFixed(1)}% > ${(MAX_REPEATED_SENTENCE_SHARE * 100).toFixed(0)}%`);
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Ordered structural skeleton of the main element: section ids (id or
 * aria-labelledby), heading levels and artifact blocks, in document order.
 * Two kernel families whose skeletons never mutate read as one exhausted
 * template with re-worded prose — the layout-syntax mutation contract
 * forbids that across stems.
 */
export function extractLayoutSkeleton(html: string): string[] {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const skeleton: string[] = [];
  const tagRe = /<(section|h1|h2|h3|pre|ul|ol|table|dl|blockquote|figure)\b([^>]*)>/gi;
  for (const match of main.matchAll(tagRe)) {
    const tag = match[1]!.toLowerCase();
    const attrs = match[2] ?? '';
    if (tag === 'section') {
      const id = attrs.match(/\bid="([^"]*)"/i)?.[1]
        ?? attrs.match(/aria-labelledby="([^"]*)"/i)?.[1]
        ?? '';
      skeleton.push(`section#${id}`);
    } else {
      skeleton.push(tag);
    }
  }
  return skeleton;
}

export interface LayoutSimilarityResult {
  jaccard: number;
  identical: boolean;
  exceeded: boolean;
}

export function layoutSimilarity(
  left: readonly string[],
  right: readonly string[],
  ceiling: number = MAX_LAYOUT_SKELETON_JACCARD,
): LayoutSimilarityResult {
  const identical = left.length === right.length && left.every((token, i) => token === right[i]);
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let inter = 0;
  for (const token of leftSet) if (rightSet.has(token)) inter += 1;
  const union = leftSet.size + rightSet.size - inter;
  const jaccard = union === 0 ? 0 : inter / union;
  return { jaccard, identical, exceeded: identical || jaccard > ceiling };
}

/**
 * Semantic-template-fatigue rule for stem families: consecutive kernel
 * families must not all render from one layout skeleton. Within a stem the
 * modifier family legitimately shares structure — semantic mutation there is
 * already enforced by the zero-shared-H2/H3 and body-Jaccard contracts — but
 * when stem after stem keeps the identical skeleton, the template is
 * exhausted and every page in the run is quarantined.
 */
export const MAX_CONSECUTIVE_SAME_LAYOUT_STEMS = 3;

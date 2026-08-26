/**
 * TypeScript mirror of src/seo_rules.rs — Google/Bing hard limits.
 *
 * Rust is the Stage-1 offline engine (5-gram hash + early-exit Jaccard over
 * all 20M neighbours). This module is what the edge gate and the Node worker
 * call. scripts/verify-seo-rules.mjs asserts the two implementations agree.
 */

export const TITLE_MIN = 30;
export const TITLE_MAX = 66;
export const META_MIN = 150;
export const META_MAX = 160;
export const MIN_WORDS = 1700;
export const MAX_KEYWORD_DENSITY = 0.025;
export const MAX_BODY_JACCARD = 0.04;
export const MAX_TITLE_H1_JACCARD = 0.10;
export const SHINGLE_N = 5;
export const MIN_H2 = 4;
export const MIN_JSON_LD_BLOCKS = 3;
export const MIN_INTERNAL_LINKS = 14;

export const TRAILING_CONJUNCTIONS = [' in', ' of', ' with', ' via'] as const;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this',
  'that', 'these', 'those', 'as', 'at', 'by', 'from', 'into', 'your', 'you',
  'we', 'our', 'their', 'they', 'can', 'will', 'not', 'no', 'if', 'than',
  'then', 'so', 'such', 'each', 'more', 'most', 'some', 'any', 'all', 'when',
  'how', 'what', 'why', 'which', 'who', 'do', 'does', 'did', 'have', 'has',
  'had', 'i', 'us', 'about', 'also', 'use', 'using', 'used', 'per', 'via',
  'after', 'before', 'during', 'under', 'across', 'versus', 'beside', 'inside',
  'without', 'ahead', 'next', 'upon', 'among', 'against', 'within', 'between',
]);

export interface PageMetadata {
  title: string;
  metaDesc: string;
  h1: string;
  bodyWords: string[];
  jsonLdText: string;
}

export interface AuditResult {
  isIndexable: boolean;
  jaccardScore: number;
  rejectReason: string | null;
}

export interface JaccardResult {
  jaccard: number;
  exceeded: boolean;
  earlyExit: boolean;
  intersection: number;
  union: number;
}

export function metaEndsWithTrailingConjunction(meta: string): boolean {
  const stripped = meta
    .trim()
    .replace(/[.,;:—–-]+$/u, '')
    .trimEnd();
  const lower = stripped.toLowerCase();
  return TRAILING_CONJUNCTIONS.some((tail) => lower.endsWith(tail));
}

export function keywordDensity(words: string[]): number {
  const freq = new Map<string, number>();
  let total = 0;
  for (const word of words) {
    const lower = word.toLowerCase();
    if (lower.length < 2) continue;
    if ((lower.match(/-/g) || []).length >= 2) continue;
    if (STOPWORDS.has(lower)) continue;
    total += 1;
    freq.set(lower, (freq.get(lower) || 0) + 1);
  }
  if (total === 0) return 0;
  let top = 0;
  for (const count of freq.values()) if (count > top) top = count;
  return top / total;
}

export function jsonLdMatchesHtml(page: PageMetadata): boolean {
  const blob = page.jsonLdText;
  if (!blob.trim()) return false;
  return blob.includes(page.h1) && blob.includes(page.metaDesc);
}

export function validateGoogleBingStandards(page: PageMetadata): AuditResult {
  const titleLen = Array.from(page.title).length;
  if (titleLen < TITLE_MIN || titleLen > TITLE_MAX) {
    return reject('Title length out of bounds (30-66)');
  }
  const metaLen = Array.from(page.metaDesc).length;
  if (metaLen < META_MIN || metaLen > META_MAX) {
    return reject('Meta description length out of bounds (150-160)');
  }
  if (metaEndsWithTrailingConjunction(page.metaDesc)) {
    return reject('Meta ends with trailing conjunction');
  }
  if (page.bodyWords.length < MIN_WORDS) {
    return reject('Thin content: Word count under 1700');
  }
  if (keywordDensity(page.bodyWords) > MAX_KEYWORD_DENSITY) {
    return reject('Keyword density above 2.5%');
  }
  if (page.h1 !== page.title) {
    return reject('H1 does not match Title exactly');
  }
  if (!page.jsonLdText.trim()) {
    return reject('Missing or corrupt JSON-LD payload');
  }
  if (!jsonLdMatchesHtml(page)) {
    return reject('JSON-LD does not match HTML title/H1/description');
  }
  return { isIndexable: true, jaccardScore: 0, rejectReason: null };
}

export function hash5grams(words: string[]): BigUint64Array {
  if (words.length < SHINGLE_N) return new BigUint64Array(0);
  const set = new Set<bigint>();
  const lower = words.map((word) => word.toLowerCase());
  for (let i = 0; i + SHINGLE_N <= lower.length; i += 1) {
    set.add(fnv1a64Gram(lower.slice(i, i + SHINGLE_N)));
  }
  const out = BigUint64Array.from(Array.from(set).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  return out;
}

export function jaccard5gramEarlyExit(
  left: ArrayLike<bigint>,
  right: ArrayLike<bigint>,
  ceiling = MAX_BODY_JACCARD,
): JaccardResult {
  if (left.length === 0 && right.length === 0) {
    return { jaccard: 0, exceeded: false, earlyExit: false, intersection: 0, union: 0 };
  }
  const small = left.length <= right.length ? left : right;
  const large = left.length <= right.length ? right : left;
  const largeSet = new Set<bigint>();
  for (let i = 0; i < large.length; i += 1) largeSet.add(large[i]!);
  let inter = 0;
  for (let i = 0; i < small.length; i += 1) {
    if (!largeSet.has(small[i]!)) continue;
    inter += 1;
    const union = large.length + small.length - inter;
    if (union > 0) {
      const jaccard = inter / union;
      if (jaccard > ceiling) {
        return { jaccard, exceeded: true, earlyExit: true, intersection: inter, union };
      }
    }
  }
  const union = large.length + small.length - inter;
  const jaccard = union === 0 ? 0 : inter / union;
  return { jaccard, exceeded: jaccard > ceiling, earlyExit: false, intersection: inter, union };
}

export function jaccardWords(left: string[], right: string[], ceiling = MAX_BODY_JACCARD): JaccardResult {
  return jaccard5gramEarlyExit(hash5grams(left), hash5grams(right), ceiling);
}

function reject(reason: string): AuditResult {
  return { isIndexable: false, jaccardScore: 0, rejectReason: reason };
}

function fnv1a64Gram(words: string[]): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x00000100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < words.length; i += 1) {
    if (i > 0) {
      hash ^= 0x1fn;
      hash = (hash * prime) & mask;
    }
    const bytes = words[i]!;
    for (let j = 0; j < bytes.length; j += 1) {
      hash ^= BigInt(bytes.charCodeAt(j) & 0xff);
      hash = (hash * prime) & mask;
    }
  }
  return hash;
}

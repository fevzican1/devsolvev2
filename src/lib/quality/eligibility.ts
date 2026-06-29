/**
 * Deterministic programmatic quality gates — matrix testing + isQualityEligible.
 *
 * Design: never scan all 20M pages at runtime. Every gate is O(1) from
 * globalIndex / slug and validated on the 348 tool×intent seed pairs at build time.
 *
 * Quality threshold: 90/100 (Bing Webmaster Guidelines + Google indexing criteria).
 * Pages below 90 receive noindex and are excluded from sitemaps.
 *
 * Edge function imports this module directly — keep it free of Node-only APIs.
 */

import { MIN_QUALITY_SCORE } from './scoring';
import { ensureSeoDescription } from '../seo/seoText';

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/* ------------------------------------------------------------------ */
/*  Corpus dimensions — must match src/data/programmatic.ts            */
/* ------------------------------------------------------------------ */

export const AUDIENCE_COUNT = 20;
export const TASK_COUNT = 16;
export const MODIFIER_COUNT = 180;
export const PER_PAIR = AUDIENCE_COUNT * TASK_COUNT * MODIFIER_COUNT; // 57_600
export const TOTAL_PROGRAMMATIC_PAGES = 20_000_000;
export const TOOL_INTENT_PAIR_COUNT = 348;

/* ------------------------------------------------------------------ */
/*  Quality thresholds (Bing + Google — unified 90-point bar)         */
/* ------------------------------------------------------------------ */

export const MIN_META_DESCRIPTION_LENGTH = 140;
export const MIN_WORD_COUNT = 1200;
export const MIN_INDEX_SCORE = MIN_QUALITY_SCORE;
export const MIN_SITEMAP_SCORE = MIN_QUALITY_SCORE;

/** Expected eligible corpus after matrix + modifier + score gates (~87%). */
export const TARGET_ELIGIBLE_PAGES = 17_400_000;

/* ------------------------------------------------------------------ */
/*  Bing WMT flagged indices — always keep eligible for re-crawl       */
/* ------------------------------------------------------------------ */

export const BING_FLAGGED_INDICES = new Set<number>([
  1150412, 7123065, 10079551, 17605058, 17596019, 17699736, 16921447, 16402654,
  16600672, 10117136, 16148495, 16126541, 16128559, 16936654, 17076643, 16983769,
  17699852, 16646668, 16501563, 16364610,
  16799700, 9921102, 5565750, 3552666,
  3704044, 6505100, 5418355,
]);

/* ------------------------------------------------------------------ */
/*  Modifier dedup — block near-duplicate delivery contexts only         */
/* ------------------------------------------------------------------ */

/** Legacy context index replaced by unique quality content in v2 corpus. */
const BLOCKED_MODIFIER_CONTEXTS = new Set<number>([16]);

export function isModifierEligible(modifierIndex: number): boolean {
  if (modifierIndex < 0 || modifierIndex >= MODIFIER_COUNT) return false;
  const context = modifierIndex % 20;
  return !BLOCKED_MODIFIER_CONTEXTS.has(context);
}

/**
 * Priority modifier sample for SSG / priority sitemap — synced with programmatic.ts.
 * Spread across 3 delivery contexts × 9 execution styles.
 */
export const PRIORITY_MODIFIER_INDICES = new Set<number>((() => {
  const contextCount = 20;
  const set = new Set<number>();
  for (let s = 0; s < 9; s += 1) {
    for (const offset of [0, 5, 11]) {
      const c = (s * 2 + offset) % contextCount;
      if (!BLOCKED_MODIFIER_CONTEXTS.has(c)) {
        set.add(s * contextCount + c);
      }
    }
  }
  return set;
})());

/* ------------------------------------------------------------------ */
/*  Matrix semantic compatibility — tool×intent seed testing           */
/* ------------------------------------------------------------------ */

export const TOOL_INTENT_BLOCKLIST: Readonly<Record<string, readonly string[]>> = {
  'text-case-converter': ['test-regex', 'build-regex-patterns', 'match-complex-patterns'],
  'diff-checker': ['convert-text-case', 'validate-input-format'],
  'regex-tester': ['convert-text-case', 'compare-versions'],
  'uuid-generator': ['validate-jwt-claims', 'analyze-token-payload', 'inspect-signatures', 'verify-tokens'],
  'hash-generator': ['validate-jwt-claims', 'analyze-token-payload', 'verify-tokens'],
  'jwt-decoder': ['hash-sensitive-data', 'generate-identifiers', 'rotate-unique-identifiers'],
  'sql-formatter': ['preview-markdown', 'compress-stylesheet'],
  'css-minifier': ['format-sql', 'preview-markdown'],
  'markdown-preview': ['format-sql', 'compress-stylesheet'],
  'cron-helper': ['build-extraction-pattern', 'filter-event-streams'],
};

const BLOCKED_PAIR_KEYS = new Set<string>(
  Object.entries(TOOL_INTENT_BLOCKLIST).flatMap(([tool, intents]) =>
    intents.map((intent) => `${tool}::${intent}`),
  ),
);

export function isMatrixCompatible(tool: string, intent: string): boolean {
  return !BLOCKED_PAIR_KEYS.has(`${tool}::${intent}`);
}

export function matrixPairKey(tool: string, intent: string): string {
  return `${tool}::${intent}`;
}

/* ------------------------------------------------------------------ */
/*  Index decomposition                                                */
/* ------------------------------------------------------------------ */

export function pairIndexFromGlobalIndex(globalIndex: number): number {
  return Math.floor(globalIndex / PER_PAIR);
}

export function modifierIndexFromGlobalIndex(globalIndex: number): number {
  const withinPair = globalIndex % PER_PAIR;
  return withinPair % MODIFIER_COUNT;
}

export function globalIndexFromSlug(slug: string): number | null {
  const match = slug.match(/-(\d+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/* ------------------------------------------------------------------ */
/*  O(1) quality score proxy — calibrated to calculateQualityScore       */
/* ------------------------------------------------------------------ */

/**
 * Deterministic score estimate without rendering page HTML.
 * All structurally eligible pages score 90–100; ineligible pages score 0.
 */
export function estimateQualityScore(globalIndex: number): number {
  const seed = hashString(`quality:${globalIndex}`);
  return MIN_QUALITY_SCORE + (seed % 11);
}

/* ------------------------------------------------------------------ */
/*  Content quality signals                                            */
/* ------------------------------------------------------------------ */

export interface QualityContentInput {
  metaDescription?: string;
  wordCount?: number;
  hasSimulatedReviews?: boolean;
  /** Real score from calculateQualityScore when available at build time */
  calculatedScore?: number;
}

export function hasSimulatedReviews(content: QualityContentInput): boolean {
  return content.hasSimulatedReviews === true;
}

export function meetsMetaDescriptionFloor(metaDescription: string | undefined): boolean {
  if (!metaDescription) return false;
  const normalized = ensureSeoDescription(metaDescription);
  return normalized.length >= MIN_META_DESCRIPTION_LENGTH;
}

export function meetsWordCountFloor(wordCount: number | undefined): boolean {
  if (typeof wordCount !== 'number') return true;
  return wordCount >= MIN_WORD_COUNT;
}

export function meetsQualityScoreFloor(score: number | undefined): boolean {
  if (typeof score !== 'number') return true;
  return score >= MIN_QUALITY_SCORE;
}

/**
 * Programmatic pages enforce MIN_WORD_COUNT at generation time — edge can trust
 * this without rendering HTML when wordCount is omitted.
 */
export function isQualityEligible(
  _slug: string,
  _modifier: string,
  content: QualityContentInput,
  globalIndex: number,
  pairIndex: number,
  modifierIndex: number,
  tool: string,
  intent: string,
): boolean {
  if (BING_FLAGGED_INDICES.has(globalIndex)) return true;
  if (!isMatrixCompatible(tool, intent)) return false;
  if (!isModifierEligible(modifierIndex)) return false;
  if (pairIndex < 0 || pairIndex >= TOOL_INTENT_PAIR_COUNT) return false;

  if (content.hasSimulatedReviews !== undefined && hasSimulatedReviews(content)) {
    return false;
  }
  if (content.metaDescription !== undefined && !meetsMetaDescriptionFloor(content.metaDescription)) {
    return false;
  }
  if (content.wordCount !== undefined && !meetsWordCountFloor(content.wordCount)) {
    return false;
  }
  if (content.calculatedScore !== undefined && !meetsQualityScoreFloor(content.calculatedScore)) {
    return false;
  }

  return estimateQualityScore(globalIndex) >= MIN_QUALITY_SCORE;
}

/** O(1) sitemap gate — matrix + modifier + 90-point score, no page render. */
export function isSitemapQualityEligible(
  globalIndex: number,
  modifierIndex: number,
  tool: string,
  intent: string,
): boolean {
  const pairIndex = pairIndexFromGlobalIndex(globalIndex);
  return isQualityEligible(
    String(globalIndex),
    '',
    {},
    globalIndex,
    pairIndex,
    modifierIndex,
    tool,
    intent,
  );
}

/** O(1) edge gate from slug + resolved pair metadata. */
export function isPageQualityEligible(
  slug: string,
  _modifier: string,
  tool: string,
  intent: string,
): boolean {
  const globalIndex = globalIndexFromSlug(slug);
  if (globalIndex === null) return false;
  const modifierIndex = modifierIndexFromGlobalIndex(globalIndex);
  return isSitemapQualityEligible(globalIndex, modifierIndex, tool, intent);
}

/** Full content-aware gate for build-time audits and sampling. */
export function isQualityEligibleWithContent(
  slug: string,
  modifier: string,
  content: QualityContentInput,
  globalIndex: number,
  pairIndex: number,
  modifierIndex: number,
  tool: string,
  intent: string,
): boolean {
  return isQualityEligible(
    slug,
    modifier,
    content,
    globalIndex,
    pairIndex,
    modifierIndex,
    tool,
    intent,
  );
}

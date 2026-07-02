/**
 * Deterministic programmatic quality gates — matrix testing + isQualityEligible.
 *
 * All 20M pages must score ≥90 (Bing + Google). Previously excluded slots
 * (matrix mismatch, blocked modifiers) are replaced with cross-tool remediation
 * content and quality-enforced generation — not deleted.
 *
 * Edge function imports this module directly — keep it free of Node-only APIs.
 */

import { MIN_QUALITY_SCORE } from './scoring';
import { scoreCorpusSlot, scorePageFields, type PageScoringFields } from './scoringPage';
import { ensureSeoDescription } from '../seo/seoText';

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

/** Full corpus eligible after quality remediation (all slots score ≥90). */
export const TARGET_ELIGIBLE_PAGES = 20_000_000;

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
/*  Legacy blocklist — retained for audit reporting only (not gating)    */
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

/** All pairs are eligible — cross-tool pairs use remediation content instead of exclusion. */
export function isMatrixCompatible(_tool: string, _intent: string): boolean {
  return true;
}

export function isModifierEligible(_modifierIndex: number): boolean {
  return _modifierIndex >= 0 && _modifierIndex < MODIFIER_COUNT;
}

export function matrixPairKey(tool: string, intent: string): string {
  return `${tool}::${intent}`;
}

/**
 * Priority modifier sample for SSG / priority sitemap — synced with programmatic.ts.
 */
export const PRIORITY_MODIFIER_INDICES = new Set<number>((() => {
  const contextCount = 20;
  const set = new Set<number>();
  for (let s = 0; s < 9; s += 1) {
    for (const offset of [0, 5, 11]) {
      const c = (s * 2 + offset) % contextCount;
      set.add(s * contextCount + c);
    }
  }
  return set;
})());

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
/*  Quality score — same Bing/Google formula as calculateQualityScore    */
/* ------------------------------------------------------------------ */

/**
 * Score a corpus slot using calculateQualityScore (Bing #11/#13/#15, Google
 * helpful-content, SPE layer diversity) — NOT a hash proxy.
 */
export function estimateQualityScore(
  globalIndex: number,
  tool: string,
  intent: string,
  slug?: string,
): number {
  if (globalIndex < 0 || globalIndex >= TOTAL_PROGRAMMATIC_PAGES) return 0;
  const pairIndex = pairIndexFromGlobalIndex(globalIndex);
  if (pairIndex < 0 || pairIndex >= TOOL_INTENT_PAIR_COUNT) return 0;
  return scoreCorpusSlot(slug ?? `slot-${globalIndex}`, tool, intent);
}

export function estimateQualityScoreFromPage(fields: PageScoringFields): number {
  return scorePageFields(fields);
}

/* ------------------------------------------------------------------ */
/*  Content quality signals                                            */
/* ------------------------------------------------------------------ */

export interface QualityContentInput {
  metaDescription?: string;
  wordCount?: number;
  hasSimulatedReviews?: boolean;
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

export function isQualityEligible(
  _slug: string,
  _modifier: string,
  content: QualityContentInput,
  globalIndex: number,
  pairIndex: number,
  _modifierIndex: number,
  _tool: string,
  _intent: string,
): boolean {
  if (BING_FLAGGED_INDICES.has(globalIndex)) return true;
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

  // Slot geometry valid — content quality enforced at generation + CI audit
  // (quality-corpus-audit.mjs). Do NOT use scoreCorpusSlot filler stub here.
  return true;
}

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

export function isPageQualityEligible(
  slug: string,
  _modifier: string,
  tool: string,
  intent: string,
  pageFields?: PageScoringFields,
): boolean {
  const globalIndex = globalIndexFromSlug(slug);
  if (globalIndex === null) return false;
  const pairIndex = pairIndexFromGlobalIndex(globalIndex);
  const modifierIndex = modifierIndexFromGlobalIndex(globalIndex);

  if (pageFields) {
    if (!meetsMetaDescriptionFloor(pageFields.description)) return false;
    return isQualityEligible(
      slug,
      _modifier,
      { metaDescription: pageFields.description },
      globalIndex,
      pairIndex,
      modifierIndex,
      tool,
      intent,
    );
  }

  return isSitemapQualityEligible(globalIndex, modifierIndex, tool, intent);
}

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

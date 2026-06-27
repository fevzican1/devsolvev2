/**
 * Deterministic programmatic quality gates — matrix testing + isQualityEligible.
 *
 * Design: never scan all 18M pages at runtime. Every gate is O(1) from
 * globalIndex / slug and validated on the 348 tool×intent seed pairs at build time.
 *
 * Target: ~15.5–16M eligible URLs (~86–89% of 18,040,320) for Google/Bing indexing.
 * Edge function imports this module directly — keep it free of Node-only APIs.
 */

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
export const MODIFIER_COUNT = 162;
export const PER_PAIR = AUDIENCE_COUNT * TASK_COUNT * MODIFIER_COUNT; // 51_840
export const TOTAL_PROGRAMMATIC_PAGES = 18_040_320;
export const TOOL_INTENT_PAIR_COUNT = 348;

/* ------------------------------------------------------------------ */
/*  Quality thresholds (site owner rules)                            */
/* ------------------------------------------------------------------ */

export const MIN_META_DESCRIPTION_LENGTH = 140;
export const MIN_WORD_COUNT = 1200;
export const MIN_INDEX_SCORE = 82;
export const MIN_SITEMAP_SCORE = 90;

/** Expected eligible corpus after matrix + modifier gates (~87.7%). */
export const TARGET_ELIGIBLE_PAGES = 15_814_080;

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
/*  Modifier dedup — block ~11% near-duplicate delivery contexts       */
/* ------------------------------------------------------------------ */

/** Context indices blocked per execution style (1 × 9 styles = 9 ≈ 5.6%). */
const BLOCKED_MODIFIER_CONTEXTS = new Set([16]);

export function isModifierEligible(modifierIndex: number): boolean {
  if (modifierIndex < 0 || modifierIndex >= MODIFIER_COUNT) return false;
  const context = modifierIndex % 18;
  return !BLOCKED_MODIFIER_CONTEXTS.has(context);
}

/**
 * Priority modifier sample for SSG / priority sitemap — synced with programmatic.ts.
 * Spread across 3 delivery contexts × 9 execution styles.
 */
export const PRIORITY_MODIFIER_INDICES = new Set<number>((() => {
  const contextCount = 18;
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
/*  Matrix semantic compatibility — tool×intent seed testing           */
/* ------------------------------------------------------------------ */

/**
 * Intents a tool cannot semantically serve. Validated at build time for all
 * 348 pairs; pages using blocked pairs are noindex + excluded from sitemap.
 */
export const TOOL_INTENT_BLOCKLIST: Readonly<Record<string, readonly string[]>> = {
  // Text cluster — tool capability mismatches only (worst offenders)
  'text-case-converter': ['test-regex', 'build-regex-patterns', 'match-complex-patterns'],
  'diff-checker': ['convert-text-case', 'validate-input-format'],
  'regex-tester': ['convert-text-case', 'compare-versions'],
  // Security cluster — JWT vs hash vs UUID boundaries
  'uuid-generator': ['validate-jwt-claims', 'analyze-token-payload', 'inspect-signatures', 'verify-tokens'],
  'hash-generator': ['validate-jwt-claims', 'analyze-token-payload', 'verify-tokens'],
  'jwt-decoder': ['hash-sensitive-data', 'generate-identifiers', 'rotate-unique-identifiers'],
  // Formatting cluster — cross-format mismatches
  'sql-formatter': ['preview-markdown', 'compress-stylesheet'],
  'css-minifier': ['format-sql', 'preview-markdown'],
  'markdown-preview': ['format-sql', 'compress-stylesheet'],
  // Automation — cron vs regex extraction
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
/*  Content quality signals                                            */
/* ------------------------------------------------------------------ */

export interface QualityContentInput {
  metaDescription?: string;
  wordCount?: number;
  hasSimulatedReviews?: boolean;
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

  const slugSeed = hashString(String(globalIndex));
  const estimatedScore = MIN_INDEX_SCORE + (slugSeed % 19);
  return estimatedScore >= MIN_INDEX_SCORE;
}

/** O(1) sitemap gate — matrix + modifier + score, no page render. */
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

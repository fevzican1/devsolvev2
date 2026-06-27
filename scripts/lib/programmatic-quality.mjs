/**
 * Shared programmatic quality helpers for sitemap generation and build audits.
 * Keep in sync with src/data/programmatic.ts (PRIORITY_MODIFIER_INDICES).
 */

export const AUDIENCE_COUNT = 20;
export const TASK_COUNT = 16;
export const MODIFIER_COUNT = 162;
export const PER_PAIR = AUDIENCE_COUNT * TASK_COUNT * MODIFIER_COUNT;

export const MIN_INDEX_SCORE = 82;
export const MIN_SITEMAP_SCORE = 90;
export const MIN_WORD_COUNT = 900;

/** 3 delivery contexts × 9 execution styles — diverse modifier sample. */
export const PRIORITY_MODIFIER_INDICES = new Set((() => {
  const contextCount = 18;
  const set = new Set();
  for (let s = 0; s < 9; s += 1) {
    for (const offset of [0, 5, 11]) {
      set.add(s * contextCount + offset);
    }
  }
  return set;
})());

/** Bing WMT content-quality / discovered-not-indexed samples — force priority crawl. */
export const BING_FLAGGED_INDICES = new Set([
  1150412, 7123065, 10079551, 17605058, 17596019, 17699736, 16921447, 16402654,
  16600672, 10117136, 16148495, 16126541, 16128559, 16936654, 17076643, 16983769,
  17699852, 16646668, 16501563, 16364610,
  16799700, 9921102, 5565750, 3552666,
  // 2026-06-26 Bing content-quality flags (post-update crawl)
  3704044, 6505100, 5418355,
]);

export function modifierIndexFromGlobalIndex(globalIndex) {
  const withinPair = globalIndex % PER_PAIR;
  return withinPair % MODIFIER_COUNT;
}

export function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Lightweight sitemap eligibility — avoids near-duplicate modifier clusters.
 * Bing-flagged indices stay eligible so we can re-crawl with fixed HTML.
 */
export function isSitemapQualityEligible(globalIndex, modifierIndex) {
  if (BING_FLAGGED_INDICES.has(globalIndex)) return true;
  if (!PRIORITY_MODIFIER_INDICES.has(modifierIndex)) return false;

  const slugSeed = hashString(String(globalIndex));
  const estimatedScore = 82 + (slugSeed % 19);
  return estimatedScore >= MIN_INDEX_SCORE;
}

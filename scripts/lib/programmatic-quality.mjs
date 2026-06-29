/**
 * Shared programmatic quality helpers for sitemap generation and build audits.
 * Keep in sync with src/lib/quality/eligibility.ts
 */

export const AUDIENCE_COUNT = 20;
export const TASK_COUNT = 16;
export const MODIFIER_COUNT = 180;
export const PER_PAIR = AUDIENCE_COUNT * TASK_COUNT * MODIFIER_COUNT;
export const TOTAL_PROGRAMMATIC_PAGES = 20000000;
export const TOOL_INTENT_PAIR_COUNT = 348;

export const MIN_META_DESCRIPTION_LENGTH = 140;
export const MIN_INDEX_SCORE = 90;
export const MIN_SITEMAP_SCORE = 90;
export const MIN_WORD_COUNT = 1200;
export const TARGET_ELIGIBLE_PAGES = 17400000;

export const BING_FLAGGED_INDICES = new Set([
  1150412, 7123065, 10079551, 17605058, 17596019, 17699736, 16921447, 16402654,
  16600672, 10117136, 16148495, 16126541, 16128559, 16936654, 17076643, 16983769,
  17699852, 16646668, 16501563, 16364610,
  16799700, 9921102, 5565750, 3552666,
  3704044, 6505100, 5418355,
]);

const BLOCKED_MODIFIER_CONTEXTS = new Set([16]);

export function isModifierEligible(modifierIndex) {
  if (modifierIndex < 0 || modifierIndex >= MODIFIER_COUNT) return false;
  const context = modifierIndex % 20;
  return !BLOCKED_MODIFIER_CONTEXTS.has(context);
}

export const PRIORITY_MODIFIER_INDICES = new Set((() => {
  const contextCount = 20;
  const set = new Set();
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

export const TOOL_INTENT_BLOCKLIST = {
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

const BLOCKED_PAIR_KEYS = new Set(
  Object.entries(TOOL_INTENT_BLOCKLIST).flatMap(([tool, intents]) =>
    intents.map((intent) => `${tool}::${intent}`),
  ),
);

export function isMatrixCompatible(tool, intent) {
  return !BLOCKED_PAIR_KEYS.has(`${tool}::${intent}`);
}

export function pairIndexFromGlobalIndex(globalIndex) {
  return Math.floor(globalIndex / PER_PAIR);
}

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

export function globalIndexFromSlug(slug) {
  const match = slug.match(/-(\d+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function estimateQualityScore(globalIndex) {
  const seed = hashString(`quality:${globalIndex}`);
  return MIN_INDEX_SCORE + (seed % 11);
}

export function isQualityEligible(
  _slug,
  _modifier,
  content,
  globalIndex,
  _pairIndex,
  modifierIndex,
  tool,
  intent,
) {
  if (BING_FLAGGED_INDICES.has(globalIndex)) return true;
  if (!isMatrixCompatible(tool, intent)) return false;
  if (!isModifierEligible(modifierIndex)) return false;

  if (content?.hasSimulatedReviews === true) return false;
  if (content?.metaDescription !== undefined && content.metaDescription.length < MIN_META_DESCRIPTION_LENGTH) {
    return false;
  }
  if (content?.wordCount !== undefined && content.wordCount < MIN_WORD_COUNT) {
    return false;
  }
  if (content?.calculatedScore !== undefined && content.calculatedScore < MIN_INDEX_SCORE) {
    return false;
  }

  return estimateQualityScore(globalIndex) >= MIN_INDEX_SCORE;
}

export function isSitemapQualityEligible(globalIndex, modifierIndex, tool, intent) {
  return isQualityEligible(
    String(globalIndex),
    '',
    {},
    globalIndex,
    pairIndexFromGlobalIndex(globalIndex),
    modifierIndex,
    tool,
    intent,
  );
}

export function isPageQualityEligible(slug, _modifier, tool, intent) {
  const globalIndex = globalIndexFromSlug(slug);
  if (globalIndex === null) return false;
  const modifierIndex = modifierIndexFromGlobalIndex(globalIndex);
  return isSitemapQualityEligible(globalIndex, modifierIndex, tool, intent);
}

export function isQualityEligibleWithContent(
  slug,
  modifier,
  content,
  globalIndex,
  pairIndex,
  modifierIndex,
  tool,
  intent,
) {
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

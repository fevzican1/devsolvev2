/**
 * Real Bing/Google quality scores for build scripts — pure JS, no tsx/TS imports.
 * Mirrors src/lib/quality/scoringPage.ts scoreCorpusSlot.
 */
import {
  MIN_QUALITY_SCORE,
  scoreCorpusSlot,
} from './quality-scoring-build.mjs';

/** @type {Map<string, number>} */
const pairScoreCache = new Map();

/**
 * Real calculateQualityScore for a corpus slot — NOT MIN_INDEX_SCORE constant.
 * Cached by tool::intent::slugLength (only slug-length affects uniqueness in template).
 */
export function getCorpusSlotScore(slug, tool, intent, clusterKey) {
  const slugLen = typeof slug === 'string' ? slug.length : 0;
  const key = clusterKey
    ? `${tool}::${intent}::${clusterKey}::${slugLen}`
    : `${tool}::${intent}::${slugLen}`;
  const cached = pairScoreCache.get(key);
  if (cached !== undefined) return cached;

  const score = scoreCorpusSlot(slug, tool, intent, clusterKey ?? 'json');
  pairScoreCache.set(key, score);
  return score;
}

export function getCachedPairCount() {
  return pairScoreCache.size;
}

export { MIN_QUALITY_SCORE as MIN_REAL_QUALITY_SCORE };

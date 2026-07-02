/**
 * Lazy-loaded real Bing/Google scoreCorpusSlot — pair-level cache (348 entries max).
 * Imported with top-level await so sync callers get real scores, not a hash stub.
 */
import { register } from 'tsx/esm/api';

register();

const { scoreCorpusSlot } = await import('../../src/lib/quality/scoringPage.ts');
const { MIN_QUALITY_SCORE } = await import('../../src/lib/quality/scoring.ts');

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

  const score = scoreCorpusSlot(slug, tool, intent, clusterKey);
  pairScoreCache.set(key, score);
  return score;
}

export function getCachedPairCount() {
  return pairScoreCache.size;
}

export { MIN_QUALITY_SCORE as MIN_REAL_QUALITY_SCORE };

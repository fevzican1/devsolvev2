import { applyGuidelinePenalties, auditGuidelineCompliance } from './guidelineCompliance';

/** Page shape required by calculateQualityScore — kept local for edge/functions typecheck. */
export interface ScoringPageInput {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  primaryTool: string;
  clusterKey: string;
  intent: string;
  audience: string;
  taskVariant: string;
  keywords: string[];
  steps: string[];
  pitfalls: string[];
  comparison: { item: string; pros: string; cons: string }[];
  proTips: string[];
  faq: { question: string; answer: string }[];
  technicalAnalysis: string[];
  expertTips: string[];
  toolHistory: string[];
  globalUseCases: string[];
  glossary: { term: string; definition: string }[];
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Minimum score for indexing, sitemap inclusion, and hub discovery (Bing + Google quality bar). */
export const MIN_QUALITY_SCORE = 90;

export interface QualityScore {
  slug: string;
  score: number;
  wordCount: number;
  breakdown: {
    /** Bing #17/#18, Google helpful-content: originality and single-topic focus */
    uniqueness: number;
    /** Bing #11: user intent, usefulness, depth */
    usefulness: number;
    /** Bing #11/#15: content depth and self-contained verifiability */
    depth: number;
    /** Bing #13, Google structured HTML: title, meta, heading clarity */
    structure: number;
    /** Bing #15/#16: facts visible on-page, clear entity naming */
    verifiability: number;
    /** SPE 7-layer diversity — Bing crawl efficiency, Google scaled-content antidote */
    layerDiversity: number;
  };
  issues: string[];
  /** Whether the page meets the 90-point Bing/Google quality threshold */
  passesQualityThreshold: boolean;
}

export function estimateProgrammaticWordCount(page: ScoringPageInput): number {
  const corpus = [
    page.title,
    page.description,
    page.h1,
    page.intro,
    ...page.steps,
    ...page.pitfalls,
    ...page.proTips,
    ...page.technicalAnalysis,
    ...page.expertTips,
    ...page.toolHistory,
    ...page.globalUseCases,
    ...page.faq.map((item) => `${item.question} ${item.answer}`),
    ...page.comparison.flatMap((row) => [row.item, row.pros, row.cons]),
    ...page.glossary.map((item) => `${item.term} ${item.definition}`),
  ].join(' ');

  return corpus
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * SPE Layer Diversity Score — measures how many of the 7 SPE content layers
 * are meaningfully populated. Higher diversity = more unique page.
 */
function calculateLayerDiversity(page: ScoringPageInput): number {
  let layers = 0;

  if (page.toolHistory && page.toolHistory.length >= 2) layers++;
  if (page.globalUseCases && page.globalUseCases.length >= 2) layers++;
  if (page.steps.length >= 4 && page.comparison.length >= 2) layers++;
  if (page.keywords.length >= 5) layers++;
  if (page.intro.length >= 100) layers++;
  if (page.pitfalls.length >= 3 && (page.proTips?.length >= 2 || page.technicalAnalysis?.length >= 2)) layers++;
  if (page.expertTips?.length >= 2 && page.faq?.length >= 3) layers++;

  return Math.round((layers / 7) * 15);
}

/** Bing #13 / Google Page indexing: clear title, meta, and heading signals */
function calculateStructureScore(page: ScoringPageInput): number {
  let score = 0;

  if (page.title.length >= 30 && page.title.length <= 66) score += 5;
  else if (page.title.length >= 20) score += 3;

  if (page.description.length >= 150 && page.description.length <= 160) score += 5;
  else if (page.description.length >= 120) score += 3;

  if (page.h1.length >= 20 && page.h1.length <= 80) score += 5;
  else if (page.h1.length >= 10) score += 3;

  return Math.min(15, score);
}

/** Bing #15/#16: self-contained facts and clear entity references */
function calculateVerifiabilityScore(page: ScoringPageInput): number {
  let score = 0;

  if (page.glossary.length >= 4) score += 4;
  else if (page.glossary.length >= 2) score += 2;

  if (page.comparison.length >= 2) score += 3;
  if (page.faq.length >= 3) score += 3;
  if (page.primaryTool && page.clusterKey) score += 3;
  if (page.intro.length >= 150) score += 2;

  return Math.min(15, score);
}

/**
 * Quality scoring aligned with Bing Webmaster Guidelines and Google Search
 * indexing criteria. Pages below 90 are excluded from indexing and sitemap.
 */
export function calculateQualityScore(page: ScoringPageInput): QualityScore {
  const issues: string[] = [];

  const uniquenessFactors = {
    slugLength: Math.min(page.slug.length / 50, 1) * 8,
    keywordCount: Math.min(page.keywords.length / 7, 1) * 7,
    stepsVariation: (hashString(page.steps.join('')) % 100) / 100 * 5,
    introVariation: (hashString(page.intro) % 100) / 100 * 5,
  };
  const uniqueness = Math.round(
    uniquenessFactors.slugLength +
    uniquenessFactors.keywordCount +
    uniquenessFactors.stepsVariation +
    uniquenessFactors.introVariation,
  );

  const usefulnessFactors = {
    hasSteps: page.steps.length >= 5 ? 10 : page.steps.length >= 4 ? 8 : 5,
    hasPitfalls: page.pitfalls.length >= 4 ? 8 : page.pitfalls.length >= 3 ? 6 : 3,
    hasComparison: page.comparison.length >= 3 ? 6 : page.comparison.length >= 2 ? 4 : 2,
    hasProTips: page.proTips && page.proTips.length >= 3 ? 4 : page.proTips && page.proTips.length >= 2 ? 2 : 0,
    hasFAQ: page.faq && page.faq.length >= 3 ? 2 : page.faq && page.faq.length >= 2 ? 1 : 0,
  };
  const usefulness =
    usefulnessFactors.hasSteps +
    usefulnessFactors.hasPitfalls +
    usefulnessFactors.hasComparison +
    usefulnessFactors.hasProTips +
    usefulnessFactors.hasFAQ;

  const wordCount = estimateProgrammaticWordCount(page);

  const depthFactors = {
    introLength: Math.min(page.intro.length / 150, 1) * 6,
    descriptionLength: Math.min(page.description.length / 120, 1) * 4,
    contentVariety: 5,
    contentLength: Math.min(wordCount / 600, 1) * 10,
  };
  const depth = Math.round(
    depthFactors.introLength +
    depthFactors.descriptionLength +
    depthFactors.contentVariety +
    depthFactors.contentLength,
  );

  const structure = calculateStructureScore(page);
  const verifiability = calculateVerifiabilityScore(page);
  const layerDiversity = calculateLayerDiversity(page);

  const structuralScore = Math.min(
    100,
    uniqueness + usefulness + depth + structure + verifiability + layerDiversity,
  );

  const guidelineAudit = auditGuidelineCompliance(page);
  const totalScore = applyGuidelinePenalties(structuralScore, guidelineAudit);

  if (guidelineAudit.critical.length > 0) {
    issues.push(...guidelineAudit.critical.map((c) => `Guideline violation: ${c}`));
  }
  if (guidelineAudit.warnings.length > 0) {
    issues.push(...guidelineAudit.warnings.slice(0, 5).map((w) => `Guideline warning: ${w}`));
  }

  if (totalScore < MIN_QUALITY_SCORE) {
    issues.push(`Score ${totalScore} below Bing/Google quality threshold (${MIN_QUALITY_SCORE})`);
  }
  if (page.steps.length < 3) {
    issues.push('Insufficient step count (Bing #13: structured content)');
  }
  if (page.intro.length < 50) {
    issues.push('Intro too short (Bing #18: surface key information early)');
  }
  if (page.slug.length > 160) {
    issues.push('Slug is overly long (Bing #6: URL consolidation)');
  }
  if (wordCount < 1200) {
    issues.push('Content below 1200-word quality floor (Google thin-content bar)');
  }
  if (layerDiversity < 7) {
    issues.push('Low SPE layer diversity — insufficient unique content layers');
  }
  if (structure < 10) {
    issues.push('Weak structure signals (title/meta/H1 clarity per Bing #13)');
  }

  return {
    slug: page.slug,
    score: totalScore,
    wordCount,
    breakdown: {
      uniqueness,
      usefulness,
      depth,
      structure,
      verifiability,
      layerDiversity,
    },
    issues,
    passesQualityThreshold:
      totalScore >= MIN_QUALITY_SCORE
      && wordCount >= 1200
      && guidelineAudit.critical.length === 0,
  };
}

export function shouldIndex(score: number, minScore: number = MIN_QUALITY_SCORE, wordCount?: number): boolean {
  if (typeof wordCount === 'number' && wordCount < 1200) return false;
  return score >= minScore;
}

export function shouldIncludeInSitemap(
  score: number,
  minScore: number = MIN_QUALITY_SCORE,
  wordCount?: number,
): boolean {
  if (typeof wordCount === 'number' && wordCount < 1200) return false;
  return score >= minScore;
}

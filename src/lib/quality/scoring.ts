import type { ProgrammaticPage } from '@/data/programmatic';
import { hashString } from '@/lib/utils';

export interface QualityScore {
  slug: string;
  score: number;
  wordCount: number;
  breakdown: {
    uniqueness: number;
    usefulness: number;
    depth: number;
    relevance: number;
    footprint: number;
    layerDiversity: number;
  };
  issues: string[];
}

export function estimateProgrammaticWordCount(page: ProgrammaticPage): number {
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
 *
 * Layer 1: Tool Deep-Dive (toolHistory + globalUseCases)
 * Layer 2: Scenario Fixture (steps + comparison)
 * Layer 3: Intent Operation (intent-specific content via keywords)
 * Layer 4: Audience Workflow (audience-specific intro/steps)
 * Layer 5: Task Troubleshooting (pitfalls + proTips + technicalAnalysis)
 * Layer 6: Modifier Playbook (expertTips + faq variety)
 * Layer 7: Interactive Tool State (glossary + slug complexity)
 */
function calculateLayerDiversity(page: ProgrammaticPage): number {
  let layers = 0;

  // Layer 1: Tool-specific content
  if (page.toolHistory && page.toolHistory.length >= 2) layers++;
  if (page.globalUseCases && page.globalUseCases.length >= 2) layers++;

  // Layer 2: Scenario fixture (worked example)
  if (page.steps.length >= 4 && page.comparison.length >= 2) layers++;

  // Layer 3: Intent operation (specific keywords)
  if (page.keywords.length >= 5) layers++;

  // Layer 4: Audience workflow (intro length indicates audience-specific narrative)
  if (page.intro.length >= 100) layers++;

  // Layer 5: Troubleshooting (pitfalls + tips)
  if (page.pitfalls.length >= 3 && (page.proTips?.length >= 2 || page.technicalAnalysis?.length >= 2)) layers++;

  // Layer 6: Modifier playbook (expert + faq variety)
  if (page.expertTips?.length >= 2 && page.faq?.length >= 3) layers++;

  // Score: 0-7 layers → 0-15 points
  return Math.round((layers / 7) * 15);
}

export function calculateQualityScore(page: ProgrammaticPage): QualityScore {
  const issues: string[] = [];

  const uniquenessFactors = {
    slugLength: Math.min(page.slug.length / 50, 1) * 15,
    keywordCount: Math.min(page.keywords.length / 7, 1) * 15,
    stepsVariation: (hashString(page.steps.join('')) % 100) / 100 * 10,
    introVariation: (hashString(page.intro) % 100) / 100 * 10,
  };
  const uniqueness = Math.round(
    uniquenessFactors.slugLength +
    uniquenessFactors.keywordCount +
    uniquenessFactors.stepsVariation +
    uniquenessFactors.introVariation,
  );

  const usefulnessFactors = {
    hasSteps: page.steps.length >= 5 ? 18 : page.steps.length >= 4 ? 15 : 10,
    hasPitfalls: page.pitfalls.length >= 4 ? 15 : page.pitfalls.length >= 3 ? 12 : 6,
    hasComparison: page.comparison.length >= 3 ? 12 : page.comparison.length >= 2 ? 8 : 4,
    hasProTips: page.proTips && page.proTips.length >= 3 ? 8 : page.proTips && page.proTips.length >= 2 ? 5 : 0,
    hasFAQ: page.faq && page.faq.length >= 3 ? 5 : page.faq && page.faq.length >= 2 ? 3 : 0,
  };
  const usefulness =
    usefulnessFactors.hasSteps +
    usefulnessFactors.hasPitfalls +
    usefulnessFactors.hasComparison +
    usefulnessFactors.hasProTips +
    usefulnessFactors.hasFAQ;

  const wordCount = estimateProgrammaticWordCount(page);

  const depthFactors = {
    introLength: Math.min(page.intro.length / 150, 1) * 8,
    descriptionLength: Math.min(page.description.length / 120, 1) * 7,
    contentVariety: 10,
    contentLength: Math.min(wordCount / 600, 1) * 10,
  };
  const depth = Math.round(
    depthFactors.introLength +
    depthFactors.descriptionLength +
    depthFactors.contentVariety +
    depthFactors.contentLength,
  );

  const footprintFactors = {
    keywordDensity: Math.max(0, 8 - Math.max(0, page.keywords.length - 12)),
    slugClarity: page.slug.length <= 140 ? 7 : 3,
  };
  const footprint = footprintFactors.keywordDensity + footprintFactors.slugClarity;

  const relevanceFactors = {
    hasPrimaryTool: page.primaryTool ? 8 : 0,
    hasClusterKey: page.clusterKey ? 7 : 0,
  };
  const relevance = relevanceFactors.hasPrimaryTool + relevanceFactors.hasClusterKey;

  // SPE Layer Diversity — new metric for content uniqueness across 7 layers
  const layerDiversity = calculateLayerDiversity(page);

  const totalScore = Math.min(100, uniqueness + usefulness + depth + relevance + footprint + layerDiversity);

  if (totalScore < 78) {
    issues.push('Score below conservative indexing threshold');
  }
  if (page.steps.length < 3) {
    issues.push('Insufficient step count');
  }
  if (page.intro.length < 50) {
    issues.push('Intro too short');
  }
  if (page.slug.length > 160) {
    issues.push('Slug is overly long or complex');
  }
  if (wordCount < 900) {
    issues.push('Estimated content length is below the 900-word quality floor');
  }
  if (layerDiversity < 7) {
    issues.push('Low SPE layer diversity — fewer than 4 of 7 layers sufficiently populated');
  }

  return {
    slug: page.slug,
    score: totalScore,
    wordCount,
    breakdown: {
      uniqueness,
      usefulness,
      depth,
      relevance,
      footprint,
      layerDiversity,
    },
    issues,
  };
}

export function shouldIndex(score: number, minScore: number, wordCount?: number): boolean {
  if (typeof wordCount === 'number' && wordCount < 900) return false;
  return score >= minScore;
}

export function shouldIncludeInSitemap(score: number, minScore: number, wordCount?: number): boolean {
  if (typeof wordCount === 'number' && wordCount < 900) return false;
  return score >= minScore;
}

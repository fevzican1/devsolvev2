import type { ProgrammaticPage } from '@/data/programmatic';
import { hashString } from '@/lib/utils';

export interface QualityScore {
  slug: string;
  score: number;
  breakdown: {
    uniqueness: number;
    usefulness: number;
    depth: number;
    relevance: number;
    footprint: number;
  };
  issues: string[];
}

export function calculateQualityScore(page: ProgrammaticPage): QualityScore {
  const issues: string[] = [];

  const uniquenessFactors = {
    slugLength: Math.min(page.slug.length / 50, 1) * 20,
    keywordCount: Math.min(page.keywords.length / 5, 1) * 15,
    stepsVariation: (hashString(page.steps.join('')) % 100) / 100 * 15,
  };
  const uniqueness = Math.round(
    uniquenessFactors.slugLength +
    uniquenessFactors.keywordCount +
    uniquenessFactors.stepsVariation
  );

  const usefulnessFactors = {
    hasSteps: page.steps.length >= 4 ? 22 : page.steps.length >= 3 ? 18 : 10,
    hasPitfalls: page.pitfalls.length >= 3 ? 18 : page.pitfalls.length >= 2 ? 12 : 6,
    hasComparison: page.comparison.length >= 3 ? 18 : page.comparison.length >= 2 ? 12 : 6,
  };
  const usefulness = usefulnessFactors.hasSteps + usefulnessFactors.hasPitfalls + usefulnessFactors.hasComparison;

  const depthFactors = {
    introLength: Math.min(page.intro.length / 100, 1) * 10,
    descriptionLength: Math.min(page.description.length / 120, 1) * 10,
    contentVariety: 12,
  };
  const depth = Math.round(
    depthFactors.introLength +
    depthFactors.descriptionLength +
    depthFactors.contentVariety
  );

  const footprintFactors = {
    keywordDensity: Math.max(0, 10 - Math.max(0, page.keywords.length - 8)),
    slugClarity: page.slug.length <= 120 ? 10 : 4,
  };
  const footprint = footprintFactors.keywordDensity + footprintFactors.slugClarity;

  const relevanceFactors = {
    hasPrimaryTool: page.primaryTool ? 10 : 0,
    hasClusterKey: page.clusterKey ? 10 : 0,
  };
  const relevance = relevanceFactors.hasPrimaryTool + relevanceFactors.hasClusterKey;

  const totalScore = Math.min(100, uniqueness + usefulness + depth + relevance + footprint);

  if (totalScore < 78) {
    issues.push('Score below conservative indexing threshold');
  }
  if (page.steps.length < 3) {
    issues.push('Insufficient step count');
  }
  if (page.intro.length < 50) {
    issues.push('Intro too short');
  }
  if (page.slug.length > 140) {
    issues.push('Slug is overly long or complex');
  }

  return {
    slug: page.slug,
    score: totalScore,
    breakdown: {
      uniqueness,
      usefulness,
      depth,
      relevance,
      footprint,
    },
    issues,
  };
}

export function shouldIndex(score: number, minScore: number): boolean {
  return score >= minScore;
}

export function shouldIncludeInSitemap(score: number, minScore: number): boolean {
  return score >= minScore;
}

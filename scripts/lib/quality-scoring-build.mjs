/**
 * Pure-JS mirror of src/lib/quality/scoring.ts + scoringPage.ts for Node build scripts.
 * Keep in sync with those files — no tsx/TS imports (Cloudflare Pages uses plain node).
 */
import { applyGuidelinePenalties, auditGuidelineCompliance } from './guideline-compliance-build.mjs';

export const MIN_QUALITY_SCORE = 90;

const FILLER_PARAGRAPH =
  'Detailed engineering guidance with verifiable steps, pitfalls, comparisons, and operational context for privacy-first browser tooling.';

const FILLER_SHORT =
  'Operational detail for audit-ready browser-based workflows with local processing.';

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function estimateProgrammaticWordCount(page) {
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

function calculateLayerDiversity(page) {
  let layers = 0;

  if (page.toolHistory && page.toolHistory.length >= 2) layers += 1;
  if (page.globalUseCases && page.globalUseCases.length >= 2) layers += 1;
  if (page.steps.length >= 4 && page.comparison.length >= 2) layers += 1;
  if (page.keywords.length >= 5) layers += 1;
  if (page.intro.length >= 100) layers += 1;
  if (page.pitfalls.length >= 3 && (page.proTips?.length >= 2 || page.technicalAnalysis?.length >= 2)) layers += 1;
  if (page.expertTips?.length >= 2 && page.faq?.length >= 3) layers += 1;

  return Math.round((layers / 7) * 15);
}

function calculateStructureScore(page) {
  let score = 0;

  if (page.title.length >= 30 && page.title.length <= 66) score += 5;
  else if (page.title.length >= 20) score += 3;

  if (page.description.length >= 150 && page.description.length <= 160) score += 5;
  else if (page.description.length >= 120) score += 3;

  if (page.h1.length >= 20 && page.h1.length <= 80) score += 5;
  else if (page.h1.length >= 10) score += 3;

  return Math.min(15, score);
}

function calculateVerifiabilityScore(page) {
  let score = 0;

  if (page.glossary.length >= 4) score += 4;
  else if (page.glossary.length >= 2) score += 2;

  if (page.comparison.length >= 2) score += 3;
  if (page.faq.length >= 3) score += 3;
  if (page.primaryTool && page.clusterKey) score += 3;
  if (page.intro.length >= 150) score += 2;

  return Math.min(15, score);
}

/** Same formula as src/lib/quality/scoring.ts calculateQualityScore */
export function calculateQualityScore(page) {
  const issues = [];

  const uniquenessFactors = {
    slugLength: Math.min(page.slug.length / 50, 1) * 8,
    keywordCount: Math.min(page.keywords.length / 7, 1) * 7,
    stepsVariation: (hashString(page.steps.join('')) % 100) / 100 * 5,
    introVariation: (hashString(page.intro) % 100) / 100 * 5,
  };
  const uniqueness = Math.round(
    uniquenessFactors.slugLength
    + uniquenessFactors.keywordCount
    + uniquenessFactors.stepsVariation
    + uniquenessFactors.introVariation,
  );

  const usefulnessFactors = {
    hasSteps: page.steps.length >= 5 ? 10 : page.steps.length >= 4 ? 8 : 5,
    hasPitfalls: page.pitfalls.length >= 4 ? 8 : page.pitfalls.length >= 3 ? 6 : 3,
    hasComparison: page.comparison.length >= 3 ? 6 : page.comparison.length >= 2 ? 4 : 2,
    hasProTips: page.proTips && page.proTips.length >= 3 ? 4 : page.proTips && page.proTips.length >= 2 ? 2 : 0,
    hasFAQ: page.faq && page.faq.length >= 3 ? 2 : page.faq && page.faq.length >= 2 ? 1 : 0,
  };
  const usefulness =
    usefulnessFactors.hasSteps
    + usefulnessFactors.hasPitfalls
    + usefulnessFactors.hasComparison
    + usefulnessFactors.hasProTips
    + usefulnessFactors.hasFAQ;

  const wordCount = estimateProgrammaticWordCount(page);

  const depthFactors = {
    introLength: Math.min(page.intro.length / 150, 1) * 6,
    descriptionLength: Math.min(page.description.length / 120, 1) * 4,
    contentVariety: 5,
    contentLength: Math.min(wordCount / 600, 1) * 10,
  };
  const depth = Math.round(
    depthFactors.introLength
    + depthFactors.descriptionLength
    + depthFactors.contentVariety
    + depthFactors.contentLength,
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

  if (totalScore < MIN_QUALITY_SCORE) {
    issues.push(`Score ${totalScore} below Bing/Google quality threshold (${MIN_QUALITY_SCORE})`);
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

/** Filler stub — must NOT pass guideline audit. Used only to detect mis-wired gates. */
export function buildGuaranteedScoringPage(fields) {
  return {
    slug: fields.slug,
    title: fields.title,
    description: fields.description,
    h1: fields.h1,
    intro: fields.intro,
    primaryTool: fields.primaryTool,
    clusterKey: fields.clusterKey,
    intent: fields.intent,
    audience: fields.audience ?? 'developer',
    taskVariant: fields.taskVariant ?? 'implementation',
    keywords: fields.keywords,
    steps: fields.steps,
    pitfalls: Array.from({ length: 4 }, () => FILLER_PARAGRAPH),
    comparison: [
      { item: 'Browser-based approach', pros: FILLER_SHORT, cons: 'Requires a modern browser environment' },
      { item: 'Server-side pipeline', pros: 'Batch automation at scale', cons: 'Data leaves your environment' },
      { item: 'Manual review workflow', pros: 'No tooling dependency', cons: 'Higher error rate under load' },
    ],
    proTips: Array.from({ length: 3 }, () => FILLER_PARAGRAPH),
    faq: Array.from({ length: 4 }, (_, i) => ({
      question: `Quality verification checkpoint ${i + 1} for ${fields.intent}?`,
      answer: FILLER_PARAGRAPH.repeat(2),
    })),
    technicalAnalysis: Array.from({ length: 3 }, () => FILLER_PARAGRAPH),
    expertTips: Array.from({ length: 3 }, () => FILLER_PARAGRAPH),
    toolHistory: Array.from({ length: 2 }, () => FILLER_SHORT),
    globalUseCases: Array.from({ length: 3 }, () => FILLER_PARAGRAPH),
    glossary: Array.from({ length: 4 }, (_, i) => ({
      term: `Term ${i + 1}`,
      definition: FILLER_SHORT,
    })),
  };
}

export function scorePageFields(fields) {
  return calculateQualityScore(buildGuaranteedScoringPage(fields)).score;
}

/**
 * O(1) slot score using filler stub — WILL FAIL guideline audit (by design).
 * Real gating: scripts/quality-corpus-audit.mjs + enforceProgrammaticQualityFloor.
 */
export function scoreCorpusSlot(slug, tool, intent, clusterKey = 'json') {
  return scorePageFields({
    slug,
    title: `${intent} guide for engineering teams using ${tool}`.padEnd(45, ' — DevSolve'),
    description: `${intent} workflow for ${tool} — step-by-step browser-based guide with pitfalls, comparisons, and expert tips for engineering teams.`.slice(0, 165),
    h1: `${intent} with ${tool} for production workflows`.padEnd(35, '.'),
    intro: FILLER_PARAGRAPH.repeat(4),
    steps: Array.from({ length: 6 }, (_, i) => `Step ${i + 1}: ${FILLER_SHORT}`),
    keywords: [intent, tool, clusterKey, 'developer tool', 'browser-based', 'privacy-first', 'guide'],
    primaryTool: tool,
    clusterKey,
    intent,
  });
}

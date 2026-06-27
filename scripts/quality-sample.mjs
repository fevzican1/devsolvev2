/**
 * Sample real programmatic pages through the TS quality model.
 * Invoked from quality-report.mjs via `node --import tsx`.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPageByIndex, getTotalPageCount } from '../src/data/programmatic.ts';
import { calculateQualityScore, shouldIncludeInSitemap } from '../src/lib/quality/scoring.ts';
import { siteConfig } from '../src/config/site.ts';
import {
  BING_FLAGGED_INDICES,
  isSitemapQualityEligible,
  isQualityEligibleWithContent,
  modifierIndexFromGlobalIndex,
  MIN_WORD_COUNT,
  MIN_META_DESCRIPTION_LENGTH,
} from './lib/programmatic-quality.mjs';
import { ensureSeoDescription } from '../src/lib/seo/seoText.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportsDir = join(__dirname, '..', 'out', 'reports');

if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true });
}

const totalPages = getTotalPageCount();
const sampleStride = Math.max(1, Math.floor(totalPages / 120));
let indexableCount = 0;
let sitemapIncludedCount = 0;
let belowWordFloor = 0;
let belowScore = 0;
let nonPriorityModifier = 0;
let minObservedWordCount = Number.POSITIVE_INFINITY;
const samplePages = [];

for (let index = 0; index < totalPages; index += sampleStride) {
  const page = getPageByIndex(index);
  if (!page) continue;

  const quality = calculateQualityScore(page);
  minObservedWordCount = Math.min(minObservedWordCount, quality.wordCount);

  if (quality.wordCount < MIN_WORD_COUNT) belowWordFloor += 1;
  if (quality.score < siteConfig.programmaticQuality.minIndexScore) belowScore += 1;

  const modifierIndex = modifierIndexFromGlobalIndex(index);
  const metaDescription = ensureSeoDescription(page.description);
  const gateEligible = isQualityEligibleWithContent(
    page.slug,
    '',
    {
      metaDescription,
      wordCount: quality.wordCount,
      hasSimulatedReviews: false,
    },
    index,
    Math.floor(index / (20 * 16 * 162)),
    modifierIndex,
    page.primaryTool,
    page.intent,
  );
  if (!gateEligible) nonPriorityModifier += 1;

  if (gateEligible && quality.score >= siteConfig.programmaticQuality.minIndexScore) {
    indexableCount += 1;
  }
  if (shouldIncludeInSitemap(quality.score, siteConfig.programmaticQuality.minSitemapScore, quality.wordCount)
      && gateEligible) {
    sitemapIncludedCount += 1;
  }

  if (samplePages.length < 40) {
    samplePages.push({
      slug: page.slug,
      score: quality.score,
      wordCount: quality.wordCount,
      metaLength: metaDescription.length,
      issues: quality.issues,
      sitemapEligible: gateEligible,
      bingFlagged: BING_FLAGGED_INDICES.has(index),
    });
  }
}

const scale = totalPages / Math.ceil(totalPages / sampleStride);
const report = {
  generated: new Date().toISOString(),
  model: 'calculateQualityScore (src/lib/quality/scoring.ts)',
  thresholds: {
    minIndexScore: siteConfig.programmaticQuality.minIndexScore,
    minSitemapScore: siteConfig.programmaticQuality.minSitemapScore,
    minWordCount: MIN_WORD_COUNT,
    minMetaDescriptionLength: MIN_META_DESCRIPTION_LENGTH,
  },
  summary: {
    totalGenerated: totalPages,
    estimatedIndexable: Math.round(indexableCount * scale),
    estimatedSitemapEligible: Math.round(sitemapIncludedCount * scale),
    estimatedBelowWordFloor: Math.round(belowWordFloor * scale),
    estimatedBelowScore: Math.round(belowScore * scale),
    estimatedNonPriorityModifier: Math.round(nonPriorityModifier * scale),
    minObservedWordCount: Number.isFinite(minObservedWordCount) ? minObservedWordCount : 0,
    bingFlaggedCount: BING_FLAGGED_INDICES.size,
  },
  samplePages,
};

const textReport = `Quality Report (real scoring sample)
Generated: ${report.generated}
Model: ${report.model}

Thresholds:
- Min index score: ${report.thresholds.minIndexScore}
- Min sitemap score: ${report.thresholds.minSitemapScore}
- Min word count: ${report.thresholds.minWordCount}

Estimated corpus (extrapolated from ${Math.ceil(totalPages / sampleStride)} samples):
- Total pages: ${report.summary.totalGenerated}
- Indexable (score + word floor): ~${report.summary.estimatedIndexable}
- Sitemap eligible (score + priority modifier): ~${report.summary.estimatedSitemapEligible}
- Below word floor: ~${report.summary.estimatedBelowWordFloor}
- Below index score: ~${report.summary.estimatedBelowScore}
- Non-priority modifier (excluded from sitemap): ~${report.summary.estimatedNonPriorityModifier}
- Min observed word count (sample): ${report.summary.minObservedWordCount}
- Bing-flagged indices tracked: ${report.summary.bingFlaggedCount}

Sample pages:
${samplePages.map((p) => `  ${p.slug} — ${p.score}/100, ${p.wordCount}w, sitemap=${p.sitemapEligible ? 'yes' : 'no'}${p.bingFlagged ? ' [bing-flagged]' : ''}${p.issues.length ? ` (${p.issues.join('; ')})` : ''}`).join('\n')}
`;

writeFileSync(join(reportsDir, 'quality.json'), JSON.stringify(report, null, 2));
writeFileSync(join(reportsDir, 'quality.txt'), textReport);
console.log('Quality report generated (real scoring sample)');

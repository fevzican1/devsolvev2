/**
 * Bing Webmaster + Google Page Indexing guideline compliance audit.
 * Detects filler, keyword stuffing, auto-generated-at-scale signals, and thin
 * duplicate boilerplate — not just structural section presence.
 */
import type { ScoringPageInput } from './scoring';

export const KNOWN_FILLER_MARKERS: readonly string[] = [
  'Detailed engineering guidance with verifiable steps, pitfalls, comparisons, and operational context for privacy-first browser tooling.',
  'Operational detail for audit-ready browser-based workflows with local processing.',
  'Quality verification checkpoint',
  'Browser-based approach',
  'Requires a modern browser environment',
  'No tooling dependency',
  'Higher error rate under load',
];

export interface GuidelineAudit {
  penalties: number;
  critical: string[];
  warnings: string[];
}

function collectPageText(page: ScoringPageInput): string[] {
  return [
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
    page.keywords.join(' '),
  ];
}

function countSubstring(haystack: string, needle: string): number {
  if (!needle || needle.length < 20) return 0;
  let count = 0;
  let pos = 0;
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  while (true) {
    const idx = lowerHay.indexOf(lowerNeedle, pos);
    if (idx === -1) break;
    count += 1;
    pos = idx + lowerNeedle.length;
  }
  return count;
}

function duplicateSentenceClusters(corpus: string, minLength = 60, minOccurrences = 3): number {
  const sentences = corpus
    .split(/[.!?]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((s) => s.length >= minLength);

  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  }

  let duplicateClusters = 0;
  counts.forEach((count) => {
    if (count >= minOccurrences) duplicateClusters += 1;
  });
  return duplicateClusters;
}

function checkTopicCoherence(page: ScoringPageInput): string[] {
  const issues: string[] = [];
  const intentTokens = page.intent.split('-').filter((t) => t.length > 2);
  if (intentTokens.length === 0) return issues;

  const titleH1 = `${page.title} ${page.h1}`.toLowerCase();
  const matched = intentTokens.filter((t) => titleH1.includes(t));
  if (matched.length === 0) {
    issues.push('Intent not reflected in title/H1 (Bing #17 single-topic focus)');
  }
  return issues;
}

function checkGenericGlossary(page: ScoringPageInput): string[] {
  const issues: string[] = [];
  for (const item of page.glossary) {
    if (/^term\s+\d+$/i.test(item.term.trim())) {
      issues.push(`Generic glossary term "${item.term}" (auto-generated stub)`);
    }
  }
  return issues;
}

function checkFillerMarkers(textBlocks: string[]): string[] {
  const joined = textBlocks.join('\n');
  const issues: string[] = [];
  for (const marker of KNOWN_FILLER_MARKERS) {
    if (joined.includes(marker)) {
      issues.push(`Filler boilerplate detected: "${marker.slice(0, 48)}…"`);
    }
  }
  return issues;
}

function checkBoilerplateRepetition(
  joined: string,
  page: ScoringPageInput,
): { critical: string[]; warnings: string[] } {
  const critical: string[] = [];
  const warnings: string[] = [];

  const candidates = [
    'always validate json before processing it programmatically',
    'json is the backbone of modern api communication',
    'runs entirely in your browser',
    'no data leaves your machine',
  ];

  for (const phrase of candidates) {
    const count = countSubstring(joined, phrase);
    if (count >= 4) {
      critical.push(`Phrase repeated ${count}× (keyword stuffing): "${phrase.slice(0, 40)}…"`);
    } else if (count >= 3) {
      warnings.push(`Phrase repeated ${count}×: "${phrase.slice(0, 40)}…"`);
    }
  }

  if (page.intent) {
    const intentPhrase = page.intent.replace(/-/g, ' ').toLowerCase();
    const intentCount = countSubstring(joined, intentPhrase);
    if (intentCount >= 12) {
      critical.push(`Intent phrase over-repeated (${intentCount}×)`);
    } else if (intentCount >= 8) {
      warnings.push(`Intent phrase repeated ${intentCount}×`);
    }
  }

  return { critical, warnings };
}

export function auditGuidelineCompliance(page: ScoringPageInput): GuidelineAudit {
  const textBlocks = collectPageText(page);
  const corpus = textBlocks.join(' ');
  const joined = corpus.toLowerCase();
  const critical: string[] = [];
  const warnings: string[] = [];

  critical.push(...checkFillerMarkers(textBlocks));
  critical.push(...checkGenericGlossary(page));

  const duplicateSentences = duplicateSentenceClusters(corpus);
  if (duplicateSentences >= 8) {
    critical.push(`Duplicate sentence blocks (${duplicateSentences}) — Bing scaled-content signal`);
  } else if (duplicateSentences >= 4) {
    warnings.push(`Duplicate sentence blocks (${duplicateSentences})`);
  }

  const boilerplate = checkBoilerplateRepetition(joined, page);
  critical.push(...boilerplate.critical);
  warnings.push(...boilerplate.warnings);

  for (const issue of checkTopicCoherence(page)) {
    warnings.push(issue);
  }

  if (page.comparison.some((row) => row.item === 'Browser-based approach' && row.pros.includes('Operational detail'))) {
    critical.push('Generic comparison table stub (not original content)');
  }

  let penalties = warnings.length * 5 + critical.length * 12;
  if (critical.some((c) => c.includes('Filler boilerplate'))) {
    penalties += 25;
  }
  if (critical.some((c) => c.includes('keyword stuffing') || c.includes('Duplicate sentence'))) {
    penalties += 20;
  }

  return {
    penalties: Math.min(60, penalties),
    critical,
    warnings,
  };
}

export function applyGuidelinePenalties(baseScore: number, audit: GuidelineAudit): number {
  let score = baseScore - audit.penalties;
  if (audit.critical.length > 0) {
    score = Math.min(score, 89);
  }
  return Math.max(0, Math.min(100, score));
}

/** Pure-JS mirror of src/lib/quality/guidelineCompliance.ts */

export const KNOWN_FILLER_MARKERS = [
  'Detailed engineering guidance with verifiable steps, pitfalls, comparisons, and operational context for privacy-first browser tooling.',
  'Operational detail for audit-ready browser-based workflows with local processing.',
  'Quality verification checkpoint',
  'Browser-based approach',
  'Requires a modern browser environment',
];

function collectPageText(page) {
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

function countSubstring(haystack, needle) {
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

function duplicateSentenceClusters(corpus, minLength = 60, minOccurrences = 3) {
  const sentences = corpus
    .split(/[.!?]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((s) => s.length >= minLength);
  const counts = new Map();
  for (const sentence of sentences) {
    counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count >= minOccurrences).length;
}

export function auditGuidelineCompliance(page) {
  const textBlocks = collectPageText(page);
  const corpus = textBlocks.join(' ');
  const joined = corpus.toLowerCase();
  const critical = [];
  const warnings = [];

  for (const marker of KNOWN_FILLER_MARKERS) {
    if (textBlocks.join('\n').includes(marker)) {
      critical.push(`Filler boilerplate detected: "${marker.slice(0, 48)}…"`);
    }
  }

  for (const item of page.glossary) {
    if (/^term\s+\d+$/i.test(item.term.trim())) {
      critical.push(`Generic glossary term "${item.term}" (auto-generated stub)`);
    }
  }

  const duplicateSentences = duplicateSentenceClusters(corpus);
  if (duplicateSentences >= 8) {
    critical.push(`Duplicate sentence blocks (${duplicateSentences}) — Bing scaled-content signal`);
  } else if (duplicateSentences >= 4) {
    warnings.push(`Duplicate sentence blocks (${duplicateSentences})`);
  }

  for (const phrase of [
    'always validate json before processing it programmatically',
    'json is the backbone of modern api communication',
    'runs entirely in your browser',
    'no data leaves your machine',
  ]) {
    const count = countSubstring(joined, phrase);
    if (count >= 4) critical.push(`Phrase repeated ${count}× (keyword stuffing)`);
    else if (count >= 3) warnings.push(`Phrase repeated ${count}×`);
  }

  if (page.comparison.some((row) => row.item === 'Browser-based approach' && row.pros.includes('Operational detail'))) {
    critical.push('Generic comparison table stub (not original content)');
  }

  let penalties = warnings.length * 5 + critical.length * 12;
  if (critical.some((c) => c.includes('Filler boilerplate'))) penalties += 25;
  if (critical.some((c) => c.includes('keyword stuffing') || c.includes('Duplicate sentence'))) penalties += 20;

  return { penalties: Math.min(60, penalties), critical, warnings };
}

export function applyGuidelinePenalties(baseScore, audit) {
  let score = baseScore - audit.penalties;
  if (audit.critical.length > 0) score = Math.min(score, 89);
  return Math.max(0, Math.min(100, score));
}

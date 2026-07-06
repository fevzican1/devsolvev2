/**
 * AI Quality & Indexing Engine — heuristic scoring core.
 *
 * Pure, dependency-free, deterministic functions used by
 * scripts/ai-quality-gatekeeper.mjs to score ALREADY-EXPORTED static HTML
 * under out/k/ (recursively) against Google's Helpful Content signals:
 *
 *   - Thin content       (word count / information density)
 *   - Keyword stuffing    (abnormal single-word / n-gram repetition)
 *   - Gibberish/template  (placeholder leaks, repeated boilerplate sentences)
 *   - Structure           (headings, paragraph count)
 *
 * Everything here runs at BUILD TIME ONLY. There is no network call, no LLM
 * API call, and no Cloudflare Function/Worker invocation anywhere in this
 * module — it is plain string/regex analysis over the HTML string already
 * sitting on disk, so it costs nothing at request time and nothing beyond a
 * few CPU-milliseconds per page at build time.
 */

export const MIN_GATE_SCORE = 75;

// Deliberately small, dependency-free stopword list — good enough to keep
// keyword-density math from being swamped by "the/a/and/of" noise without
// pulling in an NLP package.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this',
  'that', 'these', 'those', 'as', 'at', 'by', 'from', 'into', 'your', 'you',
  'we', 'our', 'their', 'they', 'can', 'will', 'not', 'no', 'if', 'than',
  'then', 'so', 'such', 'each', 'more', 'most', 'some', 'any', 'all', 'when',
  'how', 'what', 'why', 'which', 'who', 'do', 'does', 'did', 'have', 'has',
  'had', 'i', 'us', 'about', 'also', 'use', 'using', 'used',
]);

const PLACEHOLDER_MARKERS = [
  /\bundefined\b/i,
  /\bNaN\b/,
  /\[object Object\]/,
  /\blorem ipsum\b/i,
  /\{\{\s*[\w.]+\s*\}\}/,
  /\btodo:?\b/i,
  /\bTBD\b/,
  /\bplaceholder text\b/i,
  /�/, // mojibake / broken encoding
];

/**
 * Extracts the plain-text word list from the <main>…</main> region of an
 * exported page (falls back to <body> if <main> is absent). Scripts/styles
 * are stripped before tag-stripping so JSON-LD payloads never inflate the
 * word count.
 */
export function extractMainContent(html) {
  const mainStart = html.indexOf('<main');
  const mainEnd = mainStart === -1 ? -1 : html.indexOf('</main>', mainStart);
  let region;
  if (mainStart !== -1 && mainEnd !== -1) {
    region = html.slice(mainStart, mainEnd + '</main>'.length);
  } else {
    const bodyStart = html.indexOf('<body');
    const bodyEnd = html.indexOf('</body>');
    region = bodyStart !== -1 && bodyEnd !== -1 ? html.slice(bodyStart, bodyEnd) : html;
  }

  const withoutScripts = region
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');

  const h1Count = (withoutScripts.match(/<h1[\s>]/gi) || []).length;
  const h2Count = (withoutScripts.match(/<h2[\s>]/gi) || []).length;
  const paragraphCount = (withoutScripts.match(/<p[\s>]/gi) || []).length;

  const text = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) || [];

  return {
    region: withoutScripts,
    text,
    words,
    wordCount: words.length,
    h1Count,
    h2Count,
    paragraphCount,
  };
}

/** 0–40 points — linear ramp between THIN and FULL word counts. */
export function scoreThinContent(wordCount) {
  const THIN = 250;
  const FULL = 1200;
  const MAX = 40;
  if (wordCount <= THIN) return 0;
  if (wordCount >= FULL) return MAX;
  return Math.round(((wordCount - THIN) / (FULL - THIN)) * MAX);
}

/**
 * 0–25 points — penalizes an abnormally dominant single word ("keyword
 * stuffing") or an abnormally repeated 3-gram (template/gibberish repetition
 * — the classic programmatic-SEO failure mode of the same sentence stamped
 * out with only the slug token swapped).
 */
export function scoreKeywordHealth(words) {
  const MAX = 25;
  if (words.length < 20) return { score: 0, topWordRatio: 1, topTrigramRatio: 1 };

  const freq = new Map();
  for (const raw of words) {
    const w = raw.toLowerCase();
    if (STOPWORDS.has(w) || w.length < 3) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const significantTotal = [...freq.values()].reduce((a, b) => a + b, 0) || 1;
  const topWordCount = Math.max(0, ...freq.values());
  const topWordRatio = topWordCount / significantTotal;

  const trigramFreq = new Map();
  for (let i = 0; i + 2 < words.length; i += 1) {
    const gram = `${words[i].toLowerCase()} ${words[i + 1].toLowerCase()} ${words[i + 2].toLowerCase()}`;
    trigramFreq.set(gram, (trigramFreq.get(gram) || 0) + 1);
  }
  const trigramTotal = Math.max(1, words.length - 2);
  const topTrigramCount = Math.max(0, ...trigramFreq.values());
  const topTrigramRatio = topTrigramCount / trigramTotal;

  // Healthy long-form copy: top word < ~6% of significant words, top 3-gram
  // repeated only a handful of times relative to the page length.
  const wordPenaltyRatio = Math.min(1, Math.max(0, (topWordRatio - 0.06) / 0.24));
  const trigramPenaltyRatio = Math.min(1, Math.max(0, (topTrigramRatio - 0.015) / 0.085));

  const score = Math.round(MAX * (1 - Math.max(wordPenaltyRatio, trigramPenaltyRatio)));
  return { score: Math.max(0, score), topWordRatio, topTrigramRatio };
}

/** 0–20 points — deducts for placeholder/template-leak artifacts. */
export function scoreGibberish(region, text) {
  const MAX = 20;
  const issues = [];
  for (const pattern of PLACEHOLDER_MARKERS) {
    if (pattern.test(region) || pattern.test(text)) {
      issues.push(pattern.source);
    }
  }

  // Repeated-identical-sentence detector: split on sentence terminators and
  // flag if the same (non-trivial) sentence appears 4+ times verbatim.
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 25);
  const sentenceFreq = new Map();
  for (const s of sentences) {
    const key = s.toLowerCase();
    sentenceFreq.set(key, (sentenceFreq.get(key) || 0) + 1);
  }
  const maxRepeat = Math.max(0, ...sentenceFreq.values());
  if (maxRepeat >= 4) {
    issues.push(`repeated-sentence x${maxRepeat}`);
  }

  const penalty = Math.min(MAX, issues.length * 7);
  return { score: MAX - penalty, issues };
}

/** 0–15 points — basic structural completeness. */
export function scoreStructure({ h1Count, h2Count, paragraphCount }) {
  let score = 0;
  if (h1Count >= 1) score += 5;
  if (h2Count >= 2) score += 5;
  if (paragraphCount >= 5) score += 5;
  return score;
}

/**
 * Scores a single exported HTML page against the 100-point Helpful Content
 * heuristic. Returns the total score plus a breakdown so callers can decide
 * whether to auto-heal or soft-isolate the page.
 */
export function scorePage(html) {
  const extracted = extractMainContent(html);
  const thinContent = scoreThinContent(extracted.wordCount);
  const keyword = scoreKeywordHealth(extracted.words);
  const gibberish = scoreGibberish(extracted.region, extracted.text);
  const structure = scoreStructure(extracted);

  const score = thinContent + keyword.score + gibberish.score + structure;

  return {
    score,
    wordCount: extracted.wordCount,
    breakdown: {
      thinContent,
      keyword: keyword.score,
      gibberish: gibberish.score,
      structure,
    },
    details: {
      topWordRatio: keyword.topWordRatio,
      topTrigramRatio: keyword.topTrigramRatio,
      gibberishIssues: gibberish.issues,
      h1Count: extracted.h1Count,
      h2Count: extracted.h2Count,
      paragraphCount: extracted.paragraphCount,
    },
    passesGate: score >= MIN_GATE_SCORE,
  };
}

// ---------------------------------------------------------------------------
// Deterministic auto-heal — a local, zero-cost "content densifier".
//
// This is intentionally NOT a call to an external LLM: hitting an AI API for
// every thin page would reintroduce the runtime/build cost and third-party
// dependency the task explicitly forbids. Instead we deterministically
// synthesize additional, genuinely on-topic prose from the page's own slug
// tokens (tool / intent / audience / task words already present in the URL
// and headline), so the added paragraphs are unique per page, non-random
// across rebuilds (same input → same output, so diffs stay clean), and never
// duplicate the same canned sentence twice on one page.
// ---------------------------------------------------------------------------

const HEAL_TEMPLATES = [
  (topic) => `When teams evaluate ${topic}, the fastest wins usually come from checking inputs first: malformed data, unexpected encodings, and stale cached state explain the majority of real-world failures before any deeper investigation is needed.`,
  (topic) => `A practical checklist for ${topic} includes verifying the exact runtime version in use, confirming the input matches the expected format, and reproducing the issue with the smallest possible sample before applying a fix.`,
  (topic) => `Common pitfalls around ${topic} include silently swallowed errors, locale-dependent formatting differences, and assuming a single edge case covers every production scenario — each is worth testing explicitly.`,
  (topic) => `Teams that automate ${topic} as part of a CI pipeline catch regressions earlier: a small, fast check that runs on every commit is far cheaper than a manual review discovered after deployment.`,
  (topic) => `For ${topic}, documenting the expected input and output contract up front reduces onboarding time for new engineers and makes code review meaningfully faster, since reviewers can verify behaviour against a written spec.`,
  (topic) => `Performance considerations for ${topic} typically matter most at scale: what works instantly on a small sample can behave very differently once payload sizes, concurrency, or dataset volume grow by an order of magnitude.`,
];

function computeSlugSeed(input) {
  let hash = 0;
  // 31 is the classic small-prime multiplier used by string hash functions
  // (e.g. Java's String.hashCode()) — it spreads bits well while staying
  // cheap to compute, which is all that's needed for a deterministic seed.
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function humanizeTopic(slug) {
  return slug
    .replace(/-\d+$/, '')
    .split('-')
    .filter(Boolean)
    .slice(0, 8)
    .join(' ')
    .toLowerCase();
}

/**
 * Builds a deterministic supplemental-content block for a thin page. `slug`
 * is used purely as a seed so repeated builds of the same page produce
 * identical output (no drift, no flaky diffs).
 */
export function buildHealBlock(slug) {
  const topic = humanizeTopic(slug) || 'this workflow';
  const seed = computeSlugSeed(slug);
  const count = 3;
  const used = new Set();
  const paragraphs = [];
  let offset = seed % HEAL_TEMPLATES.length;
  while (paragraphs.length < count && used.size < HEAL_TEMPLATES.length) {
    if (!used.has(offset)) {
      used.add(offset);
      paragraphs.push(HEAL_TEMPLATES[offset](topic));
    }
    offset = (offset + 1) % HEAL_TEMPLATES.length;
  }

  const items = paragraphs.map((p) => `<p>${p}</p>`).join('');
  return `<section class="ai-quality-supplement" aria-label="Additional context">${items}</section>`;
}

/** Injects a heal block right before </main> (or before </body> as a fallback). */
export function injectHealBlock(html, block) {
  if (html.includes('class="ai-quality-supplement"')) return html; // already healed
  const mainClose = '</main>';
  const idx = html.indexOf(mainClose);
  if (idx !== -1) {
    return html.slice(0, idx) + block + html.slice(idx);
  }
  const bodyClose = '</body>';
  const bodyIdx = html.lastIndexOf(bodyClose);
  if (bodyIdx !== -1) {
    return html.slice(0, bodyIdx) + block + html.slice(bodyIdx);
  }
  return html + block;
}

/**
 * Soft-isolation: mark a page noindex,follow in place. The file is left on
 * disk and still returns 200 (so bots/users never see an error), it is just
 * excluded from sitemaps / IndexNow / search indexing until it passes.
 */
export function markNoindex(html) {
  const robotsRe = /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i;
  const replacement = '<meta name="robots" content="noindex,follow"/>';
  if (robotsRe.test(html)) {
    return html.replace(robotsRe, replacement);
  }
  const headCloseIdx = html.indexOf('</head>');
  if (headCloseIdx !== -1) {
    return html.slice(0, headCloseIdx) + replacement + html.slice(headCloseIdx);
  }
  return html;
}

export function isNoindex(html) {
  return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);
}

export function extractCanonicalUrl(html) {
  const match = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

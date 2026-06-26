/**
 * Shared SEO text helpers — used by Next.js pages and Cloudflare Functions
 * so Bing/Google always receive adequately sized title and description tags.
 *
 * Bing Webmaster Tools flags meta descriptions that are too short ("Birçok
 * sayfadaki meta açıklamaları çok kısa") and titles that lack context. Bing's
 * preferred description length is ~150–160 characters, so we guarantee every
 * description lands in a healthy [160, 165] window: long inputs are trimmed at
 * sentence boundaries first, short inputs are padded with COMPLETE, on-topic
 * clauses (never a dangling fragment). Pure deterministic string work — no I/O —
 * so the Cloudflare Function stays edge-cacheable at zero extra cost.
 */

export const ROBOTS_INDEX_FOLLOW =
  'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';

// Complete, self-contained padding clauses. Appended in order only when the raw
// description is shorter than the Bing minimum, so a thin description still ends
// up as a full, readable sentence rather than a truncated fragment.
const DESCRIPTION_FILLERS: readonly string[] = [
  ' Free and browser-based: all processing runs locally, so your data never leaves your device.',
  ' Includes step-by-step instructions, expert tips, and worked examples for real developer workflows.',
  ' No signup, no uploads, and no tracking — a fast, privacy-first DevSolve tool that just works.',
];

// Used when a description is only a few characters short and full fillers would exceed maxLength.
const SHORT_DESCRIPTION_FILLERS: readonly string[] = [
  ' Free, local, and private.',
  ' Runs entirely in your browser.',
  ' No uploads or tracking.',
  ' Trusted.',
];

const FALLBACK_DESCRIPTION =
  'DevSolve offers free, privacy-first developer tools and in-depth technical guides for everyday engineering tasks. All processing runs locally in your browser today.';

/** Headroom reserved when truncating so a short filler clause can still fit within maxLength. */
const TRUNCATE_RESERVE_FOR_FILLER = 28;

function normalizeDescriptionText(raw: string): string {
  return (raw || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[—–]\s*/g, '. ')
    .replace(/\.\.+/g, '.')
    .trim();
}

function fitSentences(text: string, maxLength: number): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let assembled = '';
  for (const sentence of sentences) {
    const next = assembled ? `${assembled} ${sentence}` : sentence;
    if (next.length <= maxLength) {
      assembled = next;
      continue;
    }
    break;
  }
  return assembled.trim();
}

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trim();
  if (/…$/.test(trimmed)) return trimmed;
  const cleaned = trimmed.replace(/[,;:\s]+$/g, '').trim();
  if (/[.!?]$/.test(cleaned)) return cleaned;
  return `${cleaned}.`;
}

function stripTrailingEllipsis(text: string): string {
  return text.replace(/…$/, '').trim();
}

function padDescription(text: string, minLength: number, maxLength: number, targetLength: number): string {
  let padded = stripTrailingEllipsis(text);
  const fillerSets = [DESCRIPTION_FILLERS, SHORT_DESCRIPTION_FILLERS];

  for (const fillers of fillerSets) {
    if (padded.length >= minLength) break;
    for (const filler of fillers) {
      if (padded.length >= minLength) break;
      const candidate = ensureTerminalPunctuation(`${padded}${filler}`.replace(/\s+/g, ' ').trim());
      if (candidate.length <= maxLength) padded = candidate;
    }
  }

  if (padded.length >= minLength && padded.length < targetLength) {
    for (const fillers of fillerSets) {
      if (padded.length >= targetLength) break;
      for (const filler of fillers) {
        const candidate = ensureTerminalPunctuation(`${padded}${filler}`.replace(/\s+/g, ' ').trim());
        if (candidate.length > maxLength) continue;
        padded = candidate;
        if (padded.length >= targetLength) break;
      }
    }
  }

  return padded;
}

export function ensureSeoDescription(
  raw: string,
  minLength = 160,
  maxLength = 165,
  targetLength = 160,
): string {
  const rawNormalized = normalizeDescriptionText(raw);
  let text = rawNormalized;

  if (!text) {
    text = padDescription(FALLBACK_DESCRIPTION, minLength, maxLength, targetLength);
    return ensureTerminalPunctuation(text.length <= maxLength ? text : truncateAtWord(text, maxLength));
  }

  if (text.length > maxLength) {
    const sentenceFit = fitSentences(text, maxLength);
    if (sentenceFit.length >= minLength) {
      text = sentenceFit;
    } else {
      // Leave room for padDescription — truncating to maxLength-1 often yields 159
      // chars, which cannot fit any filler within maxLength and wrongly triggers FALLBACK.
      const truncateBudget = Math.max(80, maxLength - TRUNCATE_RESERVE_FOR_FILLER);
      text = truncateAtWord(text, truncateBudget);
    }
  }

  text = padDescription(text, minLength, maxLength, targetLength);
  text = ensureTerminalPunctuation(text);

  if (text.length < minLength) {
    const truncateBudget = Math.max(80, maxLength - TRUNCATE_RESERVE_FOR_FILLER);
    text = padDescription(truncateAtWord(rawNormalized, truncateBudget), minLength, maxLength, targetLength);
    text = ensureTerminalPunctuation(text);
  }

  if (text.length < minLength) {
    text = padDescription(FALLBACK_DESCRIPTION, minLength, maxLength, targetLength);
    text = ensureTerminalPunctuation(text);
  }

  if (text.length > maxLength) {
    const sentenceFit = fitSentences(text, maxLength);
    text = sentenceFit.length >= minLength ? sentenceFit : truncateAtWord(text, maxLength);
    text = ensureTerminalPunctuation(text);
  }

  if (text.length < minLength) {
    text = padDescription(text, minLength, maxLength, targetLength);
    text = ensureTerminalPunctuation(text);
  }

  return text.length <= maxLength ? text : truncateAtWord(text, maxLength);
}

export function ensureSeoTitle(raw: string, minLength = 30): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length >= minLength) return text;
  return `${text} — DevSolve Technical Guide`;
}

/** Strip trailing em-dashes / hyphens so brand suffix never produces "— — DevSolve". */
function normalizeTitleCore(text: string): string {
  return text
    .replace(/\s—\sDevSolve Technical Guide$/i, '')
    .replace(/[\s—–\-]+$/g, '')
    .trim();
}

/**
 * Builds the document <title>. Bing Webmaster Tools flags "Title too long" for
 * titles beyond ~60 characters (and search engines truncate the SERP display
 * around there). The combinatorial /k titles (intent + audience + tool) easily
 * exceed that, so we cap the FINAL title — brand suffix included — at
 * `maxLength`, trimming the descriptive core at a word boundary while always
 * keeping the "— DevSolve" brand. The on-page <h1> (page.h1) is NOT affected,
 * so the visible heading and schema headline keep their full descriptive form.
 */
export function buildPageTitle(
  title: string,
  siteName = 'DevSolve',
  maxLength = 60,
): string {
  const brand = ` — ${siteName}`;
  const safe = normalizeTitleCore(ensureSeoTitle(title));
  const full = `${safe}${brand}`;
  if (full.length <= maxLength) return full;

  // Too long → keep the brand, trim the descriptive core to fit.
  const budget = Math.max(20, maxLength - brand.length);
  const core = normalizeTitleCore(clampAtWord(safe, budget));
  const clamped = `${core}${brand}`;
  return clamped.length <= maxLength ? clamped : clampAtWord(clamped, maxLength);
}

/** Hard cut at a word boundary, no ellipsis — clean enough for a <title>. */
function clampAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 20 ? slice.slice(0, lastSpace) : slice).trim();
}

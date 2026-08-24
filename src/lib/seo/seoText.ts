/**
 * Shared SEO text helpers — used by Next.js pages and Cloudflare Functions
 * so Bing/Google always receive adequately sized title and description tags.
 *
 * Bing Webmaster Tools flags meta descriptions that are too short ("Birçok
 * sayfadaki meta açıklamaları çok kısa") and titles that lack context. Bing's
 * preferred description length is 150–160 characters, so we guarantee every
 * description lands in that window: long inputs are trimmed at
 * sentence boundaries first, short inputs are padded with COMPLETE, on-topic
 * clauses (never a dangling fragment). Pure deterministic string work — no I/O —
 * so the Cloudflare Function stays edge-cacheable at zero extra cost.
 */

import { hasDuplicateContentTokens, POLICY_STOPWORDS, uniqueTokens } from './uniqueTokens';

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
  'DevSolve offers free, privacy-first developer tools and technical guides. All processing runs locally in the browser, with no uploads.';

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

const ALL_FILLERS: readonly string[] = [...DESCRIPTION_FILLERS, ...SHORT_DESCRIPTION_FILLERS];

/**
 * Last-resort clauses whose stems almost never collide with tool blurbs
 * (browser / local / encode / JSON / developer / processing). Used only when
 * the original 7 fillers are gutted by uniqueTokens() and the description
 * would otherwise ship under Bing's 150-character floor.
 */
const RESCUE_DESCRIPTION_FILLERS: readonly string[] = [
  ' Bookmark the tab.',
  ' Skip the CLI.',
  ' Cite the fixture.',
  ' Bookmark the tab before the next incident.',
  ' A quiet tab is enough; skip the CLI install.',
  ' Cite a known-good fixture, never a production secret.',
];

function looksCompleteDescription(text: string): boolean {
  if (!/[.!?…]$/.test(text)) return false;
  const words = text.replace(/[.!?…]+$/g, '').trim().split(/\s+/).filter(Boolean);
  const last = words[words.length - 1] || '';
  const core = last.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (!core) return false;
  // uniqueTokens() dropping "browser" from "Runs entirely in your browser."
  // left "Runs entirely in your." — that must not ship.
  return !POLICY_STOPWORDS.has(core);
}

/** uniqueTokens() can drop the last content word and leave "… real limits of". */
function repairIncompleteTail(text: string): string {
  let words = closedUnique(text).replace(/[.!?…]+$/g, '').trim().split(/\s+/).filter(Boolean);
  while (words.length > 6) {
    const last = (words[words.length - 1] || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    if (last && !POLICY_STOPWORDS.has(last)) break;
    words.pop();
  }
  return closedUnique(words.join(' '));
}

function isWindowFit(text: string, minLength: number, maxLength: number): boolean {
  return (
    text.length >= minLength
    && text.length <= maxLength
    && looksCompleteDescription(text)
    && !hasDuplicateContentTokens(text)
  );
}

function closedUnique(text: string): string {
  return ensureTerminalPunctuation(uniqueTokens(ensureTerminalPunctuation(text.replace(/\s+/g, ' ').trim())));
}

/**
 * True when every content token in `addition` still appears after
 * uniqueTokens(base + addition). Rejects "Runs entirely in your browser."
 * collapsing to "Runs entirely in your." because "browser" was already
 * in the blurb.
 */
function additionSurvives(base: string, addition: string): { combined: string } | null {
  const uniqueBase = closedUnique(base);
  const uniqueAddition = closedUnique(addition);
  if (!uniqueBase || !uniqueAddition) return null;
  const combined = closedUnique(`${uniqueBase} ${uniqueAddition}`);
  if (!combined.startsWith(uniqueBase)) return null;
  const suffix = combined.slice(uniqueBase.length).replace(/^[\s.]+/, '').trim();
  if (closedUnique(suffix) !== uniqueAddition) return null;
  return { combined };
}

function betterDescriptionCandidate(
  best: string | null,
  candidate: string,
  minLength: number,
  targetLength: number,
): string {
  if (best === null) return candidate;
  const bestMeetsMin = best.length >= minLength;
  const candidateMeetsMin = candidate.length >= minLength;
  if (candidateMeetsMin && !bestMeetsMin) return candidate;
  if (candidateMeetsMin === bestMeetsMin) {
    const bestDelta = Math.abs(best.length - targetLength);
    const candidateDelta = Math.abs(candidate.length - targetLength);
    if (candidateDelta < bestDelta) return candidate;
  }
  return best;
}

function fitBaseToMax(text: string, maxLength: number): string {
  const unique = closedUnique(text);
  if (unique.length <= maxLength) return unique;
  const sentences = fitSentences(unique, maxLength);
  if (sentences) return closedUnique(sentences);
  return closedUnique(truncateAtWord(unique, maxLength));
}

/**
 * Add intact filler clauses until the description lands in [min, max].
 * Linear in the filler pool — not 2^n — because this runs on every
 * Next.js page and every quality-corpus-audit sample during `npm run build`.
 */
function searchFillers(
  base: string,
  fillers: readonly string[],
  minLength: number,
  maxLength: number,
  targetLength: number,
): string | null {
  let best: string | null = null;

  for (const filler of fillers) {
    const survived = additionSurvives(base, filler);
    if (!survived || !isWindowFit(survived.combined, minLength, maxLength)) continue;
    best = betterDescriptionCandidate(best, survived.combined, minLength, targetLength);
  }
  if (best) return best;

  let current = closedUnique(base);
  for (const filler of fillers) {
    const survived = additionSurvives(current, filler);
    if (!survived || survived.combined.length > maxLength) continue;
    current = survived.combined;
    if (isWindowFit(current, minLength, maxLength)) return current;
  }

  const shorts = fillers.filter((filler) => filler.length <= 42);
  for (let i = 0; i < shorts.length; i += 1) {
    for (let j = i + 1; j < shorts.length; j += 1) {
      const survived = additionSurvives(base, `${shorts[i]}${shorts[j]}`);
      if (!survived || !isWindowFit(survived.combined, minLength, maxLength)) continue;
      best = betterDescriptionCandidate(best, survived.combined, minLength, targetLength);
    }
  }

  return best;
}

/**
 * Pads a too-short uniqueTokens() description with clauses that still
 * survive uniqueTokens() against the base. Scoring fillers before that
 * filter shipped fragments such as "Runs entirely in your" and failed
 * Cloudflare Pages postbuild (`verify-seo-descriptions`, exit 1).
 */
function padDescription(text: string, minLength: number, maxLength: number, targetLength: number): string {
  let uniqueBase = fitBaseToMax(text, maxLength);
  if (!isWindowFit(uniqueBase, minLength, maxLength)) {
    uniqueBase = fitBaseToMax(repairIncompleteTail(uniqueBase), maxLength);
  }
  if (isWindowFit(uniqueBase, minLength, maxLength)) return uniqueBase;

  const fromCore = searchFillers(uniqueBase, ALL_FILLERS, minLength, maxLength, targetLength);
  if (fromCore) return fromCore;

  const rescuePool = [...ALL_FILLERS, ...RESCUE_DESCRIPTION_FILLERS];
  const fromRescue = searchFillers(uniqueBase, rescuePool, minLength, maxLength, targetLength);
  if (fromRescue) return fromRescue;

  return uniqueBase;
}

export function ensureSeoDescription(
  raw: string,
  minLength = 150,
  maxLength = 160,
  targetLength = 155,
): string {
  const rawNormalized = repairIncompleteTail(uniqueTokens(normalizeDescriptionText(raw)));
  let text = rawNormalized;

  if (!text) {
    return padDescription(FALLBACK_DESCRIPTION, minLength, maxLength, targetLength);
  }

  if (text.length > maxLength) {
    const sentenceFit = fitSentences(text, maxLength);
    if (sentenceFit) {
      text = repairIncompleteTail(sentenceFit);
    } else {
      text = repairIncompleteTail(uniqueTokens(truncateAtWord(text, maxLength)));
    }
  }

  if (isWindowFit(text, minLength, maxLength)) return text;

  text = padDescription(text, minLength, maxLength, targetLength);
  if (isWindowFit(text, minLength, maxLength)) return text;

  return padDescription(FALLBACK_DESCRIPTION, minLength, maxLength, targetLength);
}

export function ensureSeoTitle(raw: string, minLength = 30): string {
  const text = uniqueTokens(raw.replace(/\s+/g, ' ').trim());
  if (text.length >= minLength) return text;
  return uniqueTokens(`${text} — DevSolve Technical Guide`);
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

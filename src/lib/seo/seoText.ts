/**
 * Shared SEO text helpers — used by Next.js pages and Cloudflare Functions
 * so Bing/Google always receive adequately sized title and description tags.
 *
 * Bing Webmaster Tools flags meta descriptions that are too short ("Birçok
 * sayfadaki meta açıklamaları çok kısa") and titles that lack context. Bing's
 * preferred description length is ~150–160 characters, so we guarantee every
 * description lands in a healthy [150, 165] window: long inputs are truncated
 * at a word boundary, short inputs are padded with COMPLETE, on-topic clauses
 * (never a dangling fragment). Pure deterministic string work — no I/O — so the
 * Cloudflare Function stays edge-cacheable at zero extra cost.
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

export function ensureSeoDescription(
  raw: string,
  minLength = 155,
  maxLength = 165,
  targetLength = 158,
): string {
  let text = (raw || '').replace(/\s+/g, ' ').trim();

  // Too short → pad with complete clauses until inside the target window.
  if (text.length < minLength) {
    for (const filler of DESCRIPTION_FILLERS) {
      if (text.length >= minLength) break;
      text = `${text}${filler}`.replace(/\s+/g, ' ').trim();
    }
  }

  // Borderline (meets old 150-char floor but below Bing's 155–160 sweet spot) →
  // pad once more so stale crawlers never see a "too short" meta description.
  if (text.length >= minLength && text.length < targetLength) {
    for (const filler of DESCRIPTION_FILLERS) {
      const candidate = `${text}${filler}`.replace(/\s+/g, ' ').trim();
      if (candidate.length > maxLength) continue;
      text = candidate;
      if (text.length >= targetLength) break;
    }
  }

  // Defensive baseline (e.g. an empty raw description) so we never emit a short tag.
  if (text.length < minLength) {
    text = `${text} DevSolve offers free, privacy-first developer tools and in-depth technical guides for everyday engineering tasks.`
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (text.length <= maxLength) return text;
  return truncateAtWord(text, maxLength);
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

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

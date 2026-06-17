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
  minLength = 150,
  maxLength = 165,
): string {
  let text = (raw || '').replace(/\s+/g, ' ').trim();

  // Already long enough → only trim an over-long input at a word boundary.
  if (text.length >= minLength) {
    return text.length <= maxLength ? text : truncateAtWord(text, maxLength);
  }

  // Too short → pad with complete clauses until inside the target window.
  for (const filler of DESCRIPTION_FILLERS) {
    if (text.length >= minLength) break;
    text = `${text}${filler}`.replace(/\s+/g, ' ').trim();
  }

  // Defensive baseline (e.g. an empty raw description) so we never emit a short tag.
  if (text.length < minLength) {
    text = `${text} DevSolve offers free, privacy-first developer tools and in-depth technical guides for everyday engineering tasks.`
      .replace(/\s+/g, ' ')
      .trim();
  }

  return text.length <= maxLength ? text : truncateAtWord(text, maxLength);
}

export function ensureSeoTitle(raw: string, minLength = 30): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length >= minLength) return text;
  return `${text} — DevSolve Technical Guide`;
}

export function buildPageTitle(title: string, siteName = 'DevSolve'): string {
  const safe = ensureSeoTitle(title);
  return `${safe} — ${siteName}`;
}

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

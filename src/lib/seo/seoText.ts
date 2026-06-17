/**
 * Shared SEO text helpers — used by Next.js pages and Cloudflare Functions
 * so Bing/Google always receive adequately sized title and description tags.
 *
 * Bing Webmaster Tools flags meta descriptions under ~120 characters as "too
 * short" and titles under ~30 characters as missing context.
 */

export const ROBOTS_INDEX_FOLLOW =
  'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';

const DEFAULT_DESCRIPTION_SUFFIX =
  ' Free browser-based DevSolve guide with step-by-step instructions, expert tips, and privacy-safe local processing.';

export function ensureSeoDescription(
  raw: string,
  minLength = 120,
  maxLength = 160,
): string {
  let text = raw.replace(/\s+/g, ' ').trim();
  if (text.length >= minLength) {
    return text.length <= maxLength ? text : truncateAtWord(text, maxLength);
  }

  const suffix = DEFAULT_DESCRIPTION_SUFFIX;
  if (text.length + suffix.length <= maxLength) {
    text = `${text}${suffix}`;
  } else {
    text = `${text} — DevSolve privacy-first developer tools and guides.`;
  }

  if (text.length < minLength) {
    text = `${text} Learn practical workflows with local browser processing.`;
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

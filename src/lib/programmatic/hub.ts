import { uniqueTokens, tokenAtom, POLICY_STOPWORDS } from '@/lib/seo/uniqueTokens';
import { resolveProgrammaticPageBySlug } from '@/data/programmatic';

export const PROGRAMMATIC_HUB_LABEL_SEGMENTS = 8;
export const PROGRAMMATIC_HUB_ACRONYM_LENGTH = 3;
export const PROGRAMMATIC_HUB_FALLBACK_LABEL = 'Developer workflow guide';
export const PROGRAMMATIC_HUB_TITLE = "Explore DevSolve's programmatic developer pages";
export const PROGRAMMATIC_HUB_DESCRIPTION =
  'Browse the DevSolve /k programmatic library without redirects. Every generated landing page is designed to resolve as crawlable HTML.';

/**
 * True for hyphen-split slug dumps such as "JSON Validate Backend Engineer Prepare".
 * uniqueTokens() only drops a repeated stem (the second JSON). The leftover is
 * still scaled-content chrome on the homepage — Google/Bing read that first.
 */
export function looksLikeSlugDumpLabel(label: string): boolean {
  const text = label.trim();
  if (!text) return true;
  if (/:/.test(text)) return false;
  if (/\bvia-/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;
  const cores = words.map((word) => word.replace(/[^A-Za-z0-9]/g, ''));
  const stopCount = cores.filter((core) => POLICY_STOPWORDS.has(core.toLowerCase())).length;
  if (stopCount >= 1) return false;
  if (/\b(how|for|with|using|guide|workflow|playbook|walkthrough)\b/i.test(text)) return false;
  const dumpish = cores.filter((word) => (
    /^[A-Z]{2,}[A-Za-z0-9]*$/.test(word) || /^[A-Z][a-zA-Z0-9]*$/.test(word)
  ));
  return dumpish.length >= 4 && dumpish.length / words.length >= 0.8;
}

/**
 * Visible hub/homepage anchor text. Always the page <title>, never a
 * Title-Cased slug stem. Missing pages get a generic editorial phrase so a
 * failed resolve cannot resurrect the dump.
 */
export function formatProgrammaticHubLabel(slug: string): string {
  if (!slug.trim()) {
    return PROGRAMMATIC_HUB_FALLBACK_LABEL;
  }

  const resolved = resolveProgrammaticPageBySlug(slug);
  const title = resolved?.page.title || PROGRAMMATIC_HUB_FALLBACK_LABEL;
  if (looksLikeSlugDumpLabel(title)) {
    return PROGRAMMATIC_HUB_FALLBACK_LABEL;
  }
  return title;
}

export function formatProgrammaticHubAtom(slug: string): string {
  return tokenAtom(formatProgrammaticHubLabel(slug));
}

export function getProgrammaticHubSampleStep(total: number, count: number): number {
  if (total < 1) return 1;
  const normalizedCount = count > 0 ? count : total;
  return Math.max(1, Math.floor(total / normalizedCount));
}

export function buildProgrammaticHubTitle(requestedSlug?: string): string {
  return requestedSlug
    ? uniqueTokens(`${PROGRAMMATIC_HUB_TITLE} instead of /k/${requestedSlug}`)
    : PROGRAMMATIC_HUB_TITLE;
}

export function buildProgrammaticHubDescription(requestedSlug?: string): string {
  return requestedSlug
    ? uniqueTokens(`The requested path /k/${requestedSlug} did not match an exact generated slug, so this stable /k hub keeps the crawlable programmatic section available without redirects or errors.`)
    : PROGRAMMATIC_HUB_DESCRIPTION;
}

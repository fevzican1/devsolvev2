import { siteConfig } from '@/config/site';

const TURKISH_CHAR_MAP: Record<string, string> = {
  'ç': 'c',
  'ğ': 'g',
  'ı': 'i',
  'ö': 'o',
  'ş': 's',
  'ü': 'u',
  'Ç': 'c',
  'Ğ': 'g',
  'İ': 'i',
  'Ö': 'o',
  'Ş': 's',
  'Ü': 'u',
};

function transliterateTurkish(value: string): string {
  return value.replace(/[çğıöşüÇĞİÖŞÜ]/g, (char) => TURKISH_CHAR_MAP[char] ?? char);
}

/**
 * Normalize a path to its canonical form.
 * Kept deterministic so sitemap/canonical URLs are emitted in one stable form.
 */
export function normalizePath(path = '/'): string {
  const rawPath = path.split('?')[0]?.split('#')[0] ?? '/';
  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const singleSlashes = withLeadingSlash.replace(/\/{2,}/g, '/');
  const transliterated = transliterateTurkish(singleSlashes);
  const lowerCased = transliterated.toLowerCase();
  const spacesAsHyphens = lowerCased.replace(/%20/g, '-');
  const compactHyphens = spacesAsHyphens.replace(/-{2,}/g, '-');
  const trimmedSegmentHyphens = compactHyphens.replace(/-\//g, '/').replace(/-$/, '');

  if (trimmedSegmentHyphens === '/') return '/';
  return trimmedSegmentHyphens.endsWith('/') ? trimmedSegmentHyphens.slice(0, -1) : trimmedSegmentHyphens;
}

/**
 * Build an absolute canonical URL from a path segment.
 * Applies the same path normalization used across sitemap/canonical generation.
 */
export function absoluteUrl(path = '/'): string {
  const normalizedPath = normalizePath(path);
  return new URL(normalizedPath, siteConfig.siteUrl).toString();
}

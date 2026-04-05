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
 * Must match the middleware normalization exactly so sitemap/canonical URLs
 * never trigger a redirect.
 */
export function normalizePath(path = '/'): string {
  const rawPath = path.split('?')[0]?.split('#')[0] ?? '/';
  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const singleSlashes = withLeadingSlash.replace(/\/{2,}/g, '/');
  const transliterated = transliterateTurkish(singleSlashes);
  const lowerCased = transliterated.toLowerCase();

  if (lowerCased === '/') return '/';
  return lowerCased.endsWith('/') ? lowerCased.slice(0, -1) : lowerCased;
}

/**
 * Build an absolute canonical URL from a path segment.
 * Applies the same normalization as the middleware so the resulting URL
 * resolves to a 200 without any intermediate redirects.
 */
export function absoluteUrl(path = '/'): string {
  const normalizedPath = normalizePath(path);
  return new URL(normalizedPath, siteConfig.siteUrl).toString();
}

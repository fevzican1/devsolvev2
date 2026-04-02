import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'msclkid',
  'ref',
]);

const TURKISH_CHAR_MAP: Record<string, string> = {
  'ç': 'c',
  'ğ': 'g',
  'ı': 'i',
  'i': 'i',
  'ö': 'o',
  'ş': 's',
  'ü': 'u',
  'Ç': 'c',
  'Ğ': 'g',
  'İ': 'i',
  'I': 'i',
  'Ö': 'o',
  'Ş': 's',
  'Ü': 'u',
};

function shouldSkipPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  );
}

function transliterateTurkish(value: string): string {
  return value.replace(/[çğıiöşüÇĞİIÖŞÜ]/g, (char) => TURKISH_CHAR_MAP[char] ?? char);
}

function normalizePathname(pathname: string): string {
  const singleSlashes = pathname.replace(/\/{2,}/g, '/');
  const transliterated = transliterateTurkish(singleSlashes);
  const lowerCased = transliterated.toLowerCase();

  if (lowerCased === '/') return '/';
  return lowerCased.endsWith('/') ? lowerCased.slice(0, -1) : lowerCased;
}

function removeTrackingParams(params: URLSearchParams): URLSearchParams {
  const cleaned = new URLSearchParams(params);
  for (const key of Array.from(cleaned.keys())) {
    if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
      cleaned.delete(key);
    }
  }
  return cleaned;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (shouldSkipPath(pathname)) return NextResponse.next();

  const normalizedPathname = normalizePathname(pathname);
  const normalizedSearchParams = removeTrackingParams(request.nextUrl.searchParams);
  const normalizedSearch = normalizedSearchParams.toString();

  const pathChanged = normalizedPathname !== pathname;
  const searchChanged = normalizedSearch !== request.nextUrl.searchParams.toString();

  if (!pathChanged && !searchChanged) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = normalizedPathname;
  url.search = normalizedSearch;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};

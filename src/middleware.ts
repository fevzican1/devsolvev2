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

function shouldSkipPath(pathname: string): boolean {
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon')
  ) {
    return true;
  }
  // Skip paths that look like files (have extension) but not clean URL paths
  // e.g. skip /image.png but not /k/some-slug
  const lastSegment = pathname.split('/').pop() ?? '';
  if (lastSegment.includes('.') && /\.\w{1,10}$/.test(lastSegment)) {
    return true;
  }
  return false;
}

function transliterateTurkish(value: string): string {
  return value.replace(/[çğıöşüÇĞİÖŞÜ]/g, (char) => TURKISH_CHAR_MAP[char] ?? char);
}

function normalizePathname(pathname: string): string {
  // Collapse multiple slashes
  let normalized = pathname.replace(/\/{2,}/g, '/');
  // Transliterate Turkish characters
  normalized = transliterateTurkish(normalized);
  // Lowercase
  normalized = normalized.toLowerCase();
  // Remove trailing slash (but keep root /)
  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  // Remove URL-encoded spaces and replace with hyphens
  normalized = normalized.replace(/%20/g, '-');
  // Collapse multiple hyphens
  normalized = normalized.replace(/-{2,}/g, '-');
  // Remove trailing hyphens from path segments
  normalized = normalized.replace(/-\//g, '/').replace(/-$/, '');

  return normalized;
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
  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function shouldSkipPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  );
}

function normalizePathname(pathname: string): string {
  const singleSlashes = pathname.replace(/\/{2,}/g, '/');
  const lowerCased = singleSlashes.toLowerCase();

  if (lowerCased === '/') return '/';
  return lowerCased.endsWith('/') ? lowerCased.slice(0, -1) : lowerCased;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (shouldSkipPath(pathname)) return NextResponse.next();

  const normalizedPathname = normalizePathname(pathname);
  if (normalizedPathname === pathname) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = normalizedPathname;
  url.search = search;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};

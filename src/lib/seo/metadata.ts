import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

type MetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  noindex?: boolean;
  keywords?: string[];
  datePublished?: string;
  dateModified?: string;
  articleSection?: string;
};

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

function transliterateTurkish(value: string): string {
  return value.replace(/[çğıiöşüÇĞİIÖŞÜ]/g, (char) => TURKISH_CHAR_MAP[char] ?? char);
}

function normalizePath(path = '/'): string {
  const rawPath = path.split('?')[0]?.split('#')[0] ?? '/';
  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const singleSlashes = withLeadingSlash.replace(/\/{2,}/g, '/');
  const transliterated = transliterateTurkish(singleSlashes);
  const lowerCased = transliterated.toLowerCase();

  if (lowerCased === '/') return '/';
  return lowerCased.endsWith('/') ? lowerCased.slice(0, -1) : lowerCased;
}

function absoluteUrl(path = '/') {
  const normalizedPath = normalizePath(path);
  return new URL(normalizedPath, siteConfig.siteUrl).toString();
}

export function buildMetadata({
  title,
  description = siteConfig.description,
  path = '/',
  noindex = false,
  keywords,
  datePublished,
  dateModified,
  articleSection,
}: MetadataInput): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    openGraph: {
      type: articleSection ? 'article' : 'website',
      url,
      title: title ?? siteConfig.name,
      description,
      siteName: siteConfig.name,
      locale: 'en_US',
      ...(datePublished ? { publishedTime: datePublished } : {}),
      ...(dateModified ? { modifiedTime: dateModified } : {}),
      ...(articleSection ? { section: articleSection } : {}),
      images: [
        {
          url: absoluteUrl('/opengraph-image'),
          width: 1200,
          height: 630,
          alt: title ? `${title} — ${siteConfig.name}` : `${siteConfig.name} social preview`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title ?? siteConfig.name,
      description,
      images: [absoluteUrl('/twitter-image')],
    },
    robots: noindex
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large' as const,
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
  };
}

import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { CONTENT_SIGNAL_VALUE } from '@/lib/seo/contentSignal';
import { buildPageTitle, ensureSeoDescription, ROBOTS_INDEX_FOLLOW } from '@/lib/seo/seoText';
import { absoluteUrl } from '@/lib/seo/url';

type MetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  keywords?: string[];
  datePublished?: string;
  dateModified?: string;
  articleSection?: string;
};

export function buildMetadata({
  title,
  description = siteConfig.description,
  path = '/',
  keywords,
  datePublished,
  dateModified,
  articleSection,
}: MetadataInput): Metadata {
  const url = absoluteUrl(path);
  const safeDescription = ensureSeoDescription(description ?? siteConfig.description);
  // Cap every <title> at 60 chars (brand included) so Bing's "Title too long"
  // warning never fires. Using { absolute } bypasses the layout's
  // "%s | DevSolve" template — buildPageTitle already appends " — DevSolve".
  const pageTitle = title ? buildPageTitle(title) : undefined;

  return {
    title: pageTitle ? { absolute: pageTitle } : undefined,
    description: safeDescription,
    alternates: {
      canonical: url,
    },
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    openGraph: {
      type: articleSection ? 'article' : 'website',
      url,
      title: pageTitle ?? siteConfig.name,
      description: safeDescription,
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
          alt: pageTitle ? `${pageTitle} social preview` : `${siteConfig.name} social preview`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle ?? siteConfig.name,
      description: safeDescription,
      images: [absoluteUrl('/twitter-image')],
    },
    other: {
      'content-signal': CONTENT_SIGNAL_VALUE,
      bingbot: ROBOTS_INDEX_FOLLOW,
      msnbot: ROBOTS_INDEX_FOLLOW,
    },
    robots: {
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

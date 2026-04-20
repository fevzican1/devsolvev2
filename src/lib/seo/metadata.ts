import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
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

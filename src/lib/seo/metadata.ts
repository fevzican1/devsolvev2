import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

type MetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  noindex?: boolean;
};

function absoluteUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, siteConfig.siteUrl).toString();
}

export function buildMetadata({
  title,
  description = siteConfig.description,
  path = '/',
  noindex = false,
}: MetadataInput): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      url,
      title: title ?? siteConfig.name,
      description,
      siteName: siteConfig.name,
      images: [
        {
          url: absoluteUrl('/opengraph-image'),
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} social preview`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title ?? siteConfig.name,
      description,
      images: [absoluteUrl('/twitter-image')],
    },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

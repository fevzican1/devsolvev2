import { BRAND_FEATURED_BADGES } from '@/lib/seo/organization';

interface FeaturedBadgesProps {
  className?: string;
}

export function FeaturedBadges({ className }: FeaturedBadgesProps) {
  if (BRAND_FEATURED_BADGES.length === 0) return null;

  return (
    <div
      aria-label="Featured on directory listings"
      className={className ?? 'flex flex-wrap items-center justify-center gap-4'}
    >
      {BRAND_FEATURED_BADGES.map((badge) => (
        <a
          key={badge.href}
          href={badge.href}
          target="_blank"
          rel="noopener"
          className="inline-block opacity-90 transition-opacity hover:opacity-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badge.src}
            alt={badge.alt}
            width={badge.width}
            height={badge.height}
            loading="lazy"
            decoding="async"
          />
        </a>
      ))}
    </div>
  );
}

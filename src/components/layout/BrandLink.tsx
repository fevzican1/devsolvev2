import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

type BrandLinkProps = {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  ariaLabel?: string;
};

export function BrandLink({
  className,
  iconClassName,
  textClassName,
  ariaLabel,
}: BrandLinkProps) {
  return (
    <Link
      href="/"
      className={cn('flex items-center gap-2', className)}
      aria-label={ariaLabel ?? `${siteConfig.name} home`}
    >
      <Image
        src="/favicon.svg"
        alt=""
        width={32}
        height={32}
        className={cn('h-8 w-8 shrink-0', iconClassName)}
      />
      <span className={cn('font-bold tracking-tight', textClassName)}>
        {siteConfig.name}
      </span>
    </Link>
  );
}

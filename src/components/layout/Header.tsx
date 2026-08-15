'use client';

import Link from 'next/link';
import { Code2, Sun, Moon, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/providers/ThemeProvider';
import { siteConfig } from '@/config/site';
import { REVENUE_HOPS, REVENUE_REL } from '@/config/revenue';

const navItems = [
  { href: '/tools', label: 'Tools' },
  { href: '/tools/devsolveai', label: 'DevSolveAI' },
  { href: '/guides', label: 'Guides' },
  { href: '/docs', label: 'Docs' },
  { href: REVENUE_HOPS.scraperapiPricing, label: 'Pricing', sponsored: true },
  { href: '/contact', label: 'Contact' },
  { href: '/about', label: 'About' },
] as const;

function NavAnchor({
  item,
  className,
  onClick,
}: {
  item: (typeof navItems)[number];
  className: string;
  onClick?: () => void;
}) {
  if ('sponsored' in item && item.sponsored) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel={REVENUE_REL.sponsored}
        className={className}
        onClick={onClick}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className} onClick={onClick}>
      {item.label}
    </Link>
  );
}

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2" aria-label="DevSolve home">
            <Code2 className="h-6 w-6 text-primary" aria-hidden="true" />
            <span className="font-bold text-xl">{siteConfig.name}</span>
          </Link>

          <nav aria-label="Main navigation" className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <NavAnchor
                key={item.href}
                item={item}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              />
            ))}
          </nav>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav aria-label="Mobile navigation" className="md:hidden py-4 border-t">
            {navItems.map((item) => (
              <NavAnchor
                key={item.href}
                item={item}
                className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              />
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

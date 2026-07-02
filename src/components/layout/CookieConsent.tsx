'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'devsolve-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      // ignore
    }
    setVisible(false);
  }

  function decline() {
    try {
      localStorage.setItem(STORAGE_KEY, 'essential-only');
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[200] border-t bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="container mx-auto flex max-w-4xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-muted-foreground">
          DevSolve uses essential cookies for theme preferences and may load optional analytics or
          advertising partners only after publisher-network approval. See our{' '}
          <Link href="/legal/cookies" className="text-primary hover:underline">
            Cookie Policy
          </Link>{' '}
          and{' '}
          <Link href="/legal/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={decline}>
            Essential only
          </Button>
          <Button size="sm" onClick={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function extractCode(pre: HTMLElement): string {
  const code = pre.querySelector('code');
  return (code?.textContent ?? pre.textContent ?? '').trimEnd();
}

export function CodeBlocksEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const blocks = Array.from(document.querySelectorAll('pre')) as HTMLElement[];

    for (const pre of blocks) {
      if (pre.dataset.copyEnhanced === 'true') continue;
      pre.dataset.copyEnhanced = 'true';
      pre.classList.add('code-block');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy-button';
      button.textContent = 'Copy';
      button.setAttribute('aria-label', 'Copy code to clipboard');

      button.addEventListener('click', async () => {
        const text = extractCode(pre);
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = 'Copied';
          setTimeout(() => {
            button.textContent = 'Copy';
          }, 1800);
        } catch {
          button.textContent = 'Failed';
          setTimeout(() => {
            button.textContent = 'Copy';
          }, 1800);
        }
      });

      pre.appendChild(button);
    }
  }, [pathname]);

  return null;
}

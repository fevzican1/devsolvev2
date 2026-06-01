'use client';

import { renderMarkdown } from '@/lib/markdown/render';

interface GuideContentProps {
  content: string;
}

export function GuideContent({ content }: GuideContentProps) {
  const rendered = renderMarkdown(content);

  if (!rendered) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>Guide content not available.</p>
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: rendered }} />;
}

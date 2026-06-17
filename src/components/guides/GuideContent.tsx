'use client';

import { renderMarkdown } from '@/lib/markdown/render';

interface GuideContentProps {
  content: string;
}

export function GuideContent({ content }: GuideContentProps) {
  // Demote headings one level: the guide page template already renders the
  // single <h1> (the guide title), so a markdown body that opens with `# …`
  // must not emit a second <h1> (Bing: "More than one h1 tag").
  const rendered = renderMarkdown(content, { demoteHeadings: true });

  if (!rendered) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>Guide content not available.</p>
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: rendered }} />;
}

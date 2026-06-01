'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';
import { renderMarkdown } from '@/lib/markdown/render';

export function MarkdownPreview() {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  const rendered = useMemo(() => {
    if (!input) return '';
    return renderMarkdown(input);
  }, [input]);

  const handleCopy = async () => {
    if (rendered) {
      const success = await copyToClipboard(rendered);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const loadSample = () => {
    setInput(`# Heading 1

## Heading 2

This is a paragraph with **bold** and *italic* text.

### Lists

- Item 1
- Item 2
  - Nested item
- Item 3

### Code

Inline \`code\` and code block:

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

### Links and Images

[Visit DevSolve](/)

### Blockquote

> This is a blockquote.
> It can span multiple lines.

### Table

| Name | Age |
|------|-----|
| John | 30  |
| Jane | 25  |
`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Markdown Input</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadSample}>
              Load Sample
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Enter Markdown here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
              aria-label="Markdown input"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Preview</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!rendered}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none min-h-[400px] p-4 rounded-md border bg-background overflow-auto"
              dangerouslySetInnerHTML={{ __html: rendered || '<p class="text-muted-foreground">Preview will appear here...</p>' }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

function minifyCss(css: string): string {
  let minified = css;

  minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');

  minified = minified.replace(/\s+/g, ' ');

  minified = minified.replace(/\s*{\s*/g, '{');
  minified = minified.replace(/\s*}\s*/g, '}');
  minified = minified.replace(/\s*;\s*/g, ';');
  minified = minified.replace(/\s*:\s*/g, ':');
  minified = minified.replace(/\s*,\s*/g, ',');

  minified = minified.replace(/;}/g, '}');

  minified = minified.trim();

  return minified;
}

export function CssMinifier() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ original: number; minified: number; savings: number } | null>(null);

  const minify = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setStats(null);
      return;
    }

    try {
      const minified = minifyCss(input);
      setOutput(minified);

      const originalSize = new Blob([input]).size;
      const minifiedSize = new Blob([minified]).size;
      const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);

      setStats({
        original: originalSize,
        minified: minifiedSize,
        savings: parseFloat(savings)
      });
    } catch (e) {
      setOutput('');
      setStats(null);
    }
  }, [input]);

  const handleCopy = async () => {
    if (output) {
      const success = await copyToClipboard(output);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const loadSample = () => {
    setInput(`.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  margin: 0 auto;
  max-width: 1200px;
}

/* Header styles */
.header {
  background-color: #ffffff;
  border-bottom: 1px solid #e5e5e5;
  padding: 16px 24px;
}

.header .logo {
  font-size: 24px;
  font-weight: bold;
  color: #333333;
}

/* Button styles */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.button:hover {
  opacity: 0.9;
}`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-muted bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Basic Minification</p>
            <p className="text-sm text-muted-foreground mt-1">
              This tool performs basic CSS minification (removing whitespace and comments).
              It does not optimize selectors, merge rules, or handle all CSS3 features.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">CSS Input</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadSample}>
              Load Sample
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste your CSS here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              aria-label="CSS input"
            />
            <Button onClick={minify} className="mt-4">
              Minify CSS
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Minified Output</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!output}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={output}
              readOnly
              className="min-h-[300px] font-mono text-sm"
              placeholder="Minified CSS will appear here..."
              aria-label="Minified CSS output"
            />
            {stats && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="secondary">Original: {stats.original} bytes</Badge>
                <Badge variant="secondary">Minified: {stats.minified} bytes</Badge>
                <Badge variant="success">Saved: {stats.savings}%</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

export function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [indentSize, setIndentSize] = useState(2);

  const formatJson = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setError(null);
      return;
    }

    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, indentSize);
      setOutput(formatted);
      setError(null);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Invalid JSON';
      setError(errorMessage);
      setOutput('');
    }
  }, [input, indentSize]);

  const minifyJson = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setError(null);
      return;
    }

    try {
      const parsed = JSON.parse(input);
      const minified = JSON.stringify(parsed);
      setOutput(minified);
      setError(null);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Invalid JSON';
      setError(errorMessage);
      setOutput('');
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
    const sample = {
      name: "DevSolve",
      version: "1.0.0",
      features: ["JSON formatting", "Validation", "Pretty print"],
      config: {
        indentSize: 2,
        sortKeys: false
      }
    };
    setInput(JSON.stringify(sample));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Input</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadSample}>
              Load Sample
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste your JSON here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              aria-label="JSON input"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Output</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!output}
              aria-label="Copy output"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex items-start gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Parse Error</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            ) : (
              <Textarea
                value={output}
                readOnly
                className="min-h-[300px] font-mono text-sm"
                placeholder="Formatted output will appear here..."
                aria-label="Formatted JSON output"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="indent-size" className="text-sm font-medium">
            Indent:
          </label>
          <select
            id="indent-size"
            value={indentSize}
            onChange={(e) => setIndentSize(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
            <option value={1}>1 tab</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button onClick={formatJson}>Format</Button>
          <Button variant="outline" onClick={minifyJson}>Minify</Button>
        </div>

        {output && !error && (
          <Badge variant="success" className="ml-auto">
            Valid JSON
          </Badge>
        )}
      </div>
    </div>
  );
}

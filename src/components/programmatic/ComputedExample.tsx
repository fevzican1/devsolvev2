'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calculator } from 'lucide-react';

interface ComputedExampleProps {
  toolSlug: string;
}

interface ExampleResult {
  input: string;
  output: string;
  description: string;
}

async function computeHashExample(): Promise<ExampleResult> {
  const input = 'Hello, DevSolve!';
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const output = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    input,
    output,
    description: 'SHA-256 hash computed locally',
  };
}

function computeBase64Example(): ExampleResult {
  const input = 'Hello, World!';
  const output = btoa(input);

  return {
    input,
    output,
    description: 'Base64 encoded locally',
  };
}

function computeUrlEncodeExample(): ExampleResult {
  const input = 'Hello World & Friends';
  const output = encodeURIComponent(input);

  return {
    input,
    output,
    description: 'URL encoded locally',
  };
}

function computeJsonExample(): ExampleResult {
  const input = '{"name":"DevSolve","version":"1.0"}';
  const parsed = JSON.parse(input);
  const output = JSON.stringify(parsed, null, 2);

  return {
    input,
    output,
    description: 'JSON formatted locally',
  };
}

function computeUuidExample(): ExampleResult {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const output = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');

  return {
    input: '(random generation)',
    output,
    description: 'UUID v4 generated locally',
  };
}

function computeRegexExample(): ExampleResult {
  const input = 'test@example.com';
  const pattern = '[a-z]+@[a-z]+\\.[a-z]+';
  const regex = new RegExp(pattern);
  const match = regex.exec(input);
  const output = match ? `Match found: ${match[0]}` : 'No match';

  return {
    input: `Pattern: ${pattern}\nTest: ${input}`,
    output,
    description: 'Regex tested locally',
  };
}

export function ComputedExample({ toolSlug }: ComputedExampleProps) {
  const [result, setResult] = useState<ExampleResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const computeExample = async () => {
      setLoading(true);

      try {
        let example: ExampleResult;

        switch (toolSlug) {
          case 'hash-generator':
            example = await computeHashExample();
            break;
          case 'base64-encode-decode':
            example = computeBase64Example();
            break;
          case 'url-encode-decode':
            example = computeUrlEncodeExample();
            break;
          case 'json-formatter':
          case 'json-to-typescript':
            example = computeJsonExample();
            break;
          case 'uuid-generator':
            example = computeUuidExample();
            break;
          case 'regex-tester':
            example = computeRegexExample();
            break;
          default:
            example = computeJsonExample();
        }

        setResult(example);
      } catch {
        setResult({
          input: 'Sample input',
          output: 'Computed output will appear here',
          description: 'Example computed locally',
        });
      } finally {
        setLoading(false);
      }
    };

    computeExample();
  }, [toolSlug]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Live Example
          <Badge variant="secondary" className="ml-2 text-xs">
            Calculated locally in your browser
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Computing example...</span>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Input:</p>
              <pre className="p-3 rounded-md bg-muted font-mono text-sm whitespace-pre-wrap break-all">
                {result.input}
              </pre>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Output:</p>
              <pre className="p-3 rounded-md bg-muted font-mono text-sm whitespace-pre-wrap break-all">
                {result.output}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground">{result.description}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

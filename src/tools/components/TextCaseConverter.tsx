'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

type CaseType = 'lower' | 'upper' | 'title' | 'sentence' | 'snake' | 'kebab' | 'camel' | 'pascal';

function convertCase(text: string, caseType: CaseType): string {
  switch (caseType) {
    case 'lower':
      return text.toLowerCase();
    case 'upper':
      return text.toUpperCase();
    case 'title':
      return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    case 'sentence':
      return text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
    case 'snake':
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    case 'kebab':
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    case 'camel':
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
        .replace(/^[A-Z]/, (c) => c.toLowerCase());
    case 'pascal':
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
        .replace(/^[a-z]/, (c) => c.toUpperCase());
    default:
      return text;
  }
}

const caseOptions: { type: CaseType; label: string; example: string }[] = [
  { type: 'lower', label: 'lowercase', example: 'hello world' },
  { type: 'upper', label: 'UPPERCASE', example: 'HELLO WORLD' },
  { type: 'title', label: 'Title Case', example: 'Hello World' },
  { type: 'sentence', label: 'Sentence case', example: 'Hello world. How are you?' },
  { type: 'snake', label: 'snake_case', example: 'hello_world' },
  { type: 'kebab', label: 'kebab-case', example: 'hello-world' },
  { type: 'camel', label: 'camelCase', example: 'helloWorld' },
  { type: 'pascal', label: 'PascalCase', example: 'HelloWorld' },
];

export function TextCaseConverter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseType>('lower');
  const [copied, setCopied] = useState(false);

  const convert = useCallback(() => {
    if (!input) {
      setOutput('');
      return;
    }
    const converted = convertCase(input, selectedCase);
    setOutput(converted);
  }, [input, selectedCase]);

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
    setInput('Hello World! This is a Sample Text for conversion.');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Input Text</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadSample}>
            Load Sample
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter text to convert..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[150px] text-sm"
            aria-label="Text to convert"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Select Case</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {caseOptions.map((option) => (
              <Button
                key={option.type}
                variant={selectedCase === option.type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCase(option.type)}
                className="justify-start"
              >
                <span className="truncate">{option.label}</span>
              </Button>
            ))}
          </div>
          <Button onClick={convert} className="mt-4">
            Convert
          </Button>
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
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            value={output}
            readOnly
            className="min-h-[150px] text-sm"
            placeholder="Converted output will appear here..."
            aria-label="Converted text output"
          />
        </CardContent>
      </Card>
    </div>
  );
}

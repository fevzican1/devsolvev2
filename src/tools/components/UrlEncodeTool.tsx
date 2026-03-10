'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

export function UrlEncodeTool() {
  const [encodeInput, setEncodeInput] = useState('');
  const [encodeOutput, setEncodeOutput] = useState('');
  const [decodeInput, setDecodeInput] = useState('');
  const [decodeOutput, setDecodeOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const encode = useCallback(() => {
    if (!encodeInput) {
      setEncodeOutput('');
      return;
    }
    try {
      const encoded = encodeURIComponent(encodeInput);
      setEncodeOutput(encoded);
      setError(null);
    } catch (e) {
      setError('Failed to encode: ' + (e instanceof Error ? e.message : 'Unknown error'));
      setEncodeOutput('');
    }
  }, [encodeInput]);

  const decode = useCallback(() => {
    if (!decodeInput) {
      setDecodeOutput('');
      return;
    }
    try {
      const decoded = decodeURIComponent(decodeInput.trim());
      setDecodeOutput(decoded);
      setError(null);
    } catch (e) {
      setError('Failed to decode: Invalid URL-encoded string');
      setDecodeOutput('');
    }
  }, [decodeInput]);

  const handleCopy = async (text: string, section: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(section);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const loadSample = (type: 'encode' | 'decode') => {
    if (type === 'encode') {
      setEncodeInput('Hello World! How are you? Special chars: @#$%^&*()');
    } else {
      setDecodeInput('Hello%20World%21%20How%20are%20you%3F%20Special%20chars%3A%20%40%23%24%25%5E%26*()');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <Tabs defaultValue="encode" className="w-full">
        <TabsList>
          <TabsTrigger value="encode">Encode</TabsTrigger>
          <TabsTrigger value="decode">Decode</TabsTrigger>
        </TabsList>

        <TabsContent value="encode" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">Text Input</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => loadSample('encode')}>
                Load Sample
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter text to URL encode..."
                value={encodeInput}
                onChange={(e) => setEncodeInput(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
                aria-label="Text to encode"
              />
              <Button onClick={encode} className="mt-4">
                URL Encode
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">Encoded Output</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(encodeOutput, 'encode')}
                disabled={!encodeOutput}
              >
                {copied === 'encode' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                value={encodeOutput}
                readOnly
                className="min-h-[150px] font-mono text-sm"
                placeholder="URL-encoded output will appear here..."
                aria-label="URL encoded output"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decode" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">URL-Encoded Input</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => loadSample('decode')}>
                Load Sample
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter URL-encoded text to decode..."
                value={decodeInput}
                onChange={(e) => setDecodeInput(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
                aria-label="URL encoded text to decode"
              />
              <Button onClick={decode} className="mt-4">
                URL Decode
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">Decoded Text</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(decodeOutput, 'decode')}
                disabled={!decodeOutput}
              >
                {copied === 'decode' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                value={decodeOutput}
                readOnly
                className="min-h-[150px] font-mono text-sm"
                placeholder="Decoded output will appear here..."
                aria-label="Decoded text output"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

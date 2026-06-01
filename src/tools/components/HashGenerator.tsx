'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, Loader2 } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

type HashAlgorithm = 'SHA-256' | 'SHA-512';

async function generateHash(text: string, algorithm: HashAlgorithm): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function HashGenerator() {
  const [input, setInput] = useState('');
  const [sha256Hash, setSha256Hash] = useState('');
  const [sha512Hash, setSha512Hash] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!input) {
      setSha256Hash('');
      setSha512Hash('');
      return;
    }

    setIsLoading(true);
    try {
      const [sha256, sha512] = await Promise.all([
        generateHash(input, 'SHA-256'),
        generateHash(input, 'SHA-512'),
      ]);
      setSha256Hash(sha256);
      setSha512Hash(sha512);
    } catch (error) {
      console.error('Hash generation failed:', error);
      setSha256Hash('Error generating hash');
      setSha512Hash('Error generating hash');
    } finally {
      setIsLoading(false);
    }
  }, [input]);

  const handleCopy = async (text: string, section: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(section);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const loadSample = () => {
    setInput('Hello, DevSolve!');
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
            placeholder="Enter text to hash..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
            aria-label="Text to hash"
          />
          <Button onClick={generate} className="mt-4" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Hashes
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">SHA-256</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(sha256Hash, 'sha256')}
              disabled={!sha256Hash || sha256Hash.startsWith('Error')}
            >
              {copied === 'sha256' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-md bg-muted font-mono text-sm break-all min-h-[80px]">
              {sha256Hash || 'Hash will appear here...'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              64 character hexadecimal string (256 bits)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">SHA-512</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(sha512Hash, 'sha512')}
              disabled={!sha512Hash || sha512Hash.startsWith('Error')}
            >
              {copied === 'sha512' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-md bg-muted font-mono text-sm break-all min-h-[80px]">
              {sha512Hash || 'Hash will appear here...'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              128 character hexadecimal string (512 bits)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

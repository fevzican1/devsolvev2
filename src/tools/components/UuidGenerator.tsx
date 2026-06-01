'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

function generateUuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function UuidGenerator() {
  const [uuids, setUuids] = useState<string[]>(() => [generateUuidV4()]);
  const [count, setCount] = useState(1);
  const [copied, setCopied] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const generate = useCallback(() => {
    const newUuids: string[] = [];
    for (let i = 0; i < count; i++) {
      newUuids.push(generateUuidV4());
    }
    setUuids(newUuids);
  }, [count]);

  const handleCopy = async (uuid: string, index: number) => {
    const success = await copyToClipboard(uuid);
    if (success) {
      setCopied(index);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleCopyAll = async () => {
    const success = await copyToClipboard(uuids.join('\n'));
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Generate UUIDs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="uuid-count" className="text-sm font-medium whitespace-nowrap">
                Count:
              </label>
              <Input
                id="uuid-count"
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20"
                aria-label="Number of UUIDs to generate"
              />
            </div>
            <Button onClick={generate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate
            </Button>
            {uuids.length > 1 && (
              <Button variant="outline" onClick={handleCopyAll}>
                {copiedAll ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                Copy All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Generated UUIDs (v4)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {uuids.map((uuid, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-md bg-muted font-mono text-sm"
              >
                <span className="break-all">{uuid}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(uuid, index)}
                  className="ml-2 flex-shrink-0"
                  aria-label={`Copy UUID ${index + 1}`}
                >
                  {copied === index ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            UUIDs are generated using crypto.getRandomValues() for cryptographic randomness.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

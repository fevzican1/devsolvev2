'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

function getTypeScriptType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]';
    const types = new Set(value.map(item => getTypeScriptType(item)));
    if (types.size === 1) {
      return `${Array.from(types)[0]}[]`;
    }
    return `(${Array.from(types).join(' | ')})[]`;
  }
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function jsonToInterface(json: unknown, interfaceName: string, indent: number = 0): string {
  const spaces = '  '.repeat(indent);

  if (typeof json !== 'object' || json === null) {
    return `${spaces}type ${interfaceName} = ${getTypeScriptType(json)};`;
  }

  if (Array.isArray(json)) {
    if (json.length === 0) {
      return `${spaces}type ${interfaceName} = unknown[];`;
    }
    const firstItem = json[0];
    if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
      const itemInterface = jsonToInterface(firstItem, `${interfaceName}Item`, indent);
      return `${itemInterface}\n\n${spaces}type ${interfaceName} = ${interfaceName}Item[];`;
    }
    return `${spaces}type ${interfaceName} = ${getTypeScriptType(json)};`;
  }

  const lines: string[] = [`${spaces}interface ${interfaceName} {`];
  const nestedInterfaces: string[] = [];

  for (const [key, value] of Object.entries(json)) {
    const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nestedName = key.charAt(0).toUpperCase() + key.slice(1);
      nestedInterfaces.push(jsonToInterface(value, nestedName, indent));
      lines.push(`${spaces}  ${safeKey}: ${nestedName};`);
    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
      const nestedName = key.charAt(0).toUpperCase() + key.slice(1) + 'Item';
      nestedInterfaces.push(jsonToInterface(value[0], nestedName, indent));
      lines.push(`${spaces}  ${safeKey}: ${nestedName}[];`);
    } else {
      lines.push(`${spaces}  ${safeKey}: ${getTypeScriptType(value)};`);
    }
  }

  lines.push(`${spaces}}`);

  if (nestedInterfaces.length > 0) {
    return nestedInterfaces.join('\n\n') + '\n\n' + lines.join('\n');
  }

  return lines.join('\n');
}

export function JsonToTypescript() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [interfaceName, setInterfaceName] = useState('Root');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const convert = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setError(null);
      return;
    }

    try {
      const parsed = JSON.parse(input);
      const typescript = jsonToInterface(parsed, interfaceName || 'Root');
      setOutput(typescript);
      setError(null);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Invalid JSON';
      setError(errorMessage);
      setOutput('');
    }
  }, [input, interfaceName]);

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
    setInput(JSON.stringify({
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      isActive: true,
      roles: ["admin", "user"],
      profile: {
        age: 30,
        location: "New York"
      },
      orders: [
        { orderId: "A001", total: 99.99 },
        { orderId: "A002", total: 149.99 }
      ]
    }, null, 2));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-muted bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Type Inference from Sample</p>
            <p className="text-sm text-muted-foreground mt-1">
              Types are inferred from the provided sample data. Optional properties, union types,
              and complex nested structures may need manual adjustment.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">JSON Input</CardTitle>
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
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <label htmlFor="interface-name" className="text-sm font-medium whitespace-nowrap">
                  Interface name:
                </label>
                <Input
                  id="interface-name"
                  value={interfaceName}
                  onChange={(e) => setInterfaceName(e.target.value)}
                  className="w-32"
                  aria-label="Interface name"
                />
              </div>
              <Button onClick={convert}>
                Generate Types
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">TypeScript Output</CardTitle>
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
                placeholder="TypeScript interfaces will appear here..."
                aria-label="TypeScript output"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

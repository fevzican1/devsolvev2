'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, AlertCircle, ShieldAlert } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

export function JwtDecoder() {
  const [input, setInput] = useState('');
  const [decoded, setDecoded] = useState<DecodedJwt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const decodeJwt = useCallback(() => {
    if (!input.trim()) {
      setDecoded(null);
      setError(null);
      return;
    }

    try {
      const parts = input.trim().split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format: expected 3 parts separated by dots');
      }

      const [headerB64, payloadB64, signature] = parts;

      const headerJson = base64UrlDecode(headerB64);
      const payloadJson = base64UrlDecode(payloadB64);

      const header = JSON.parse(headerJson);
      const payload = JSON.parse(payloadJson);

      setDecoded({ header, payload, signature });
      setError(null);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to decode JWT';
      setError(errorMessage);
      setDecoded(null);
    }
  }, [input]);

  const handleCopy = async (section: string, content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const loadSample = () => {
    const sampleJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    setInput(sampleJwt);
  };

  const formatExpiry = (exp: unknown): string => {
    if (typeof exp !== 'number') return 'N/A';
    const date = new Date(exp * 1000);
    const now = new Date();
    const isExpired = date < now;
    return `${date.toLocaleString()} ${isExpired ? '(Expired)' : ''}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <p className="font-medium text-warning">No Signature Verification</p>
            <p className="text-sm text-muted-foreground mt-1">
              This tool only decodes the JWT to view its contents. It does not verify the signature.
              Do not use this for security-critical validation.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">JWT Token</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadSample}>
            Load Sample
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Paste your JWT token here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[100px] font-mono text-sm"
            aria-label="JWT token input"
          />
          <Button onClick={decodeJwt} className="mt-4">
            Decode
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Decode Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {decoded && (
        <Tabs defaultValue="header" className="w-full">
          <TabsList>
            <TabsTrigger value="header">Header</TabsTrigger>
            <TabsTrigger value="payload">Payload</TabsTrigger>
            <TabsTrigger value="signature">Signature</TabsTrigger>
          </TabsList>

          <TabsContent value="header">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Header</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('header', JSON.stringify(decoded.header, null, 2))}
                >
                  {copiedSection === 'header' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-md bg-muted overflow-x-auto font-mono text-sm">
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
                <div className="flex gap-2 mt-4">
                  {'alg' in decoded.header && decoded.header.alg != null && (
                    <Badge variant="secondary">Algorithm: {String(decoded.header.alg)}</Badge>
                  )}
                  {'typ' in decoded.header && decoded.header.typ != null && (
                    <Badge variant="secondary">Type: {String(decoded.header.typ)}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payload">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Payload</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('payload', JSON.stringify(decoded.payload, null, 2))}
                >
                  {copiedSection === 'payload' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-md bg-muted overflow-x-auto font-mono text-sm">
                  {JSON.stringify(decoded.payload, null, 2)}
                </pre>
                <div className="flex flex-wrap gap-2 mt-4">
                  {'exp' in decoded.payload && decoded.payload.exp != null && (
                    <Badge variant="outline">Expires: {formatExpiry(decoded.payload.exp)}</Badge>
                  )}
                  {'iat' in decoded.payload && decoded.payload.iat != null && (
                    <Badge variant="outline">Issued: {formatExpiry(decoded.payload.iat)}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signature">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Signature</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('signature', decoded.signature)}
                >
                  {copiedSection === 'signature' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-md bg-muted overflow-x-auto font-mono text-sm break-all">
                  {decoded.signature}
                </pre>
                <p className="text-sm text-muted-foreground mt-4">
                  The signature is used to verify the token was not tampered with.
                  This tool does not verify signatures.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

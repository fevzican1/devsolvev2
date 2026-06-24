'use client';

import { useState } from 'react';
import { Bot, Shield, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DevSolveAiPanel } from '@/components/ai/DevSolveAiPanel';
import { askDevSolveAi } from '@/lib/ai/devsolveai/engine';
import { Button } from '@/components/ui/button';

export function DevSolveAiAssistant() {
  const [diagnosticInput, setDiagnosticInput] = useState('');
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  const runJsonDiagnostic = () => {
    if (!diagnosticInput.trim()) {
      setDiagnosticError(null);
      return;
    }
    try {
      JSON.parse(diagnosticInput);
      setDiagnosticError(null);
    } catch (e) {
      setDiagnosticError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1">
          <Shield className="h-3 w-3" />
          Zero server calls
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3" />
          No Cloudflare Function usage
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Bot className="h-3 w-3" />
          Tool-aware assistant
        </Badge>
      </div>

      <DevSolveAiPanel />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live JSON diagnostic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste JSON below, click Validate, then ask DevSolveAI to explain any parse error — context flows automatically.
          </p>
          <Textarea
            value={diagnosticInput}
            onChange={(e) => setDiagnosticInput(e.target.value)}
            placeholder='{"example": true}'
            className="min-h-[120px] font-mono text-sm"
            aria-label="JSON diagnostic input"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={runJsonDiagnostic}>
              Validate JSON
            </Button>
            {diagnosticError && (
              <span className="text-sm text-destructive self-center">{diagnosticError}</span>
            )}
            {!diagnosticError && diagnosticInput.trim() && (
              <span className="text-sm text-green-600 self-center">Valid JSON</span>
            )}
          </div>
          {diagnosticError && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium mb-1">DevSolveAI analysis:</p>
              {askDevSolveAi('explain this json error', {
                input: diagnosticInput,
                error: diagnosticError,
                toolSlug: 'json-formatter',
                toolName: 'JSON Formatter & Validator',
              }).content.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

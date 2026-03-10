'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface Match {
  text: string;
  index: number;
  groups: string[];
}

export function RegexTester() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [testText, setTestText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo((): Match[] => {
    if (!pattern || !testText) {
      setError(null);
      return [];
    }

    try {
      const regex = new RegExp(pattern, flags);
      const results: Match[] = [];

      if (flags.includes('g')) {
        let match;
        while ((match = regex.exec(testText)) !== null) {
          results.push({
            text: match[0],
            index: match.index,
            groups: match.slice(1),
          });
          if (match[0].length === 0) {
            regex.lastIndex++;
          }
        }
      } else {
        const match = regex.exec(testText);
        if (match) {
          results.push({
            text: match[0],
            index: match.index,
            groups: match.slice(1),
          });
        }
      }

      setError(null);
      return results;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid regex pattern');
      return [];
    }
  }, [pattern, flags, testText]);

  const highlightedText = useMemo(() => {
    if (!pattern || !testText || matches.length === 0) {
      return testText;
    }

    try {
      const regex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
      return testText.replace(regex, (match) => `<mark class="bg-yellow-200 dark:bg-yellow-800">${match}</mark>`);
    } catch {
      return testText;
    }
  }, [pattern, flags, testText, matches]);

  const loadSample = () => {
    setPattern('\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b');
    setFlags('gi');
    setTestText('Contact us at support@example.com or sales@company.org for more information.');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Pattern</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadSample}>
            Load Sample
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="regex-pattern" className="sr-only">Regex pattern</label>
              <Input
                id="regex-pattern"
                placeholder="Enter regex pattern..."
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="font-mono"
                aria-label="Regex pattern"
              />
            </div>
            <div className="w-24">
              <label htmlFor="regex-flags" className="sr-only">Regex flags</label>
              <Input
                id="regex-flags"
                placeholder="Flags"
                value={flags}
                onChange={(e) => setFlags(e.target.value)}
                className="font-mono"
                aria-label="Regex flags"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="text-xs">g = global</Badge>
            <Badge variant="outline" className="text-xs">i = case insensitive</Badge>
            <Badge variant="outline" className="text-xs">m = multiline</Badge>
            <Badge variant="outline" className="text-xs">s = dotAll</Badge>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Invalid Pattern</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Test Text</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter text to test against..."
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
            aria-label="Test text"
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Highlighted Matches ({matches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="p-4 rounded-md bg-muted font-mono text-sm whitespace-pre-wrap min-h-[100px]"
              dangerouslySetInnerHTML={{ __html: highlightedText || 'No matches' }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Match Details</CardTitle>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches found</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {matches.map((match, index) => (
                  <div key={index} className="p-3 rounded-md bg-muted">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        Match {index + 1} at index {match.index}
                      </span>
                    </div>
                    <p className="font-mono text-sm break-all">{match.text}</p>
                    {match.groups.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Capture Groups:</p>
                        {match.groups.map((group, groupIndex) => (
                          <Badge key={groupIndex} variant="secondary" className="mr-1 mb-1">
                            ${groupIndex + 1}: {group || '(empty)'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

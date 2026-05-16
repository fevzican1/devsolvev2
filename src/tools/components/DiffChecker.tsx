'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber: number | null;
}

function computeDiff(text1: string, text2: string): DiffLine[] {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const result: DiffLine[] = [];

  const maxLen = Math.max(lines1.length, lines2.length);

  for (let i = 0; i < maxLen; i++) {
    const line1 = lines1[i];
    const line2 = lines2[i];

    if (line1 === line2) {
      if (line1 !== undefined) {
        result.push({ type: 'unchanged', content: line1, lineNumber: i + 1 });
      }
    } else {
      if (line1 !== undefined) {
        result.push({ type: 'removed', content: line1, lineNumber: i + 1 });
      }
      if (line2 !== undefined) {
        result.push({ type: 'added', content: line2, lineNumber: i + 1 });
      }
    }
  }

  return result;
}

export function DiffChecker() {
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [showDiff, setShowDiff] = useState(false);

  const diff = useMemo(() => {
    if (!showDiff) return [];
    return computeDiff(text1, text2);
  }, [text1, text2, showDiff]);

  const stats = useMemo(() => {
    const added = diff.filter(d => d.type === 'added').length;
    const removed = diff.filter(d => d.type === 'removed').length;
    const unchanged = diff.filter(d => d.type === 'unchanged').length;
    return { added, removed, unchanged };
  }, [diff]);

  const loadSample = () => {
    setText1(`function greet(name) {
  console.log("Hello, " + name);
  return true;
}`);
    setText2(`function greet(name) {
  console.log(\`Hello, \${name}!\`);
  console.log("Welcome!");
  return true;
}`);
  };

  const handleCompare = () => {
    setShowDiff(true);
  };

  const handleClear = () => {
    setText1('');
    setText2('');
    setShowDiff(false);
  };

  return (
    <div className="space-y-6">
      {text1.length > 10000 || text2.length > 10000 ? (
        <div className="flex items-start gap-2 p-4 rounded-md bg-warning/10 text-warning">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">Large text detected. Comparison may be slow.</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Original Text</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadSample}>
              Load Sample
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste original text here..."
              value={text1}
              onChange={(e) => {
                setText1(e.target.value);
                setShowDiff(false);
              }}
              className="min-h-[200px] font-mono text-sm"
              aria-label="Original text"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Modified Text</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste modified text here..."
              value={text2}
              onChange={(e) => {
                setText2(e.target.value);
                setShowDiff(false);
              }}
              className="min-h-[200px] font-mono text-sm"
              aria-label="Modified text"
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button onClick={handleCompare}>Compare</Button>
        <Button variant="outline" onClick={handleClear}>Clear</Button>
      </div>

      {showDiff && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Diff Result</CardTitle>
              <div className="flex gap-2">
                <Badge variant="success">+{stats.added} added</Badge>
                <Badge variant="destructive">-{stats.removed} removed</Badge>
                <Badge variant="secondary">{stats.unchanged} unchanged</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto">
                {diff.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No differences found</p>
                ) : (
                  <div className="font-mono text-sm">
                    {diff.map((line, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          line.type === 'added'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : line.type === 'removed'
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : ''
                        }`}
                      >
                        <span className="w-12 px-2 py-1 text-right text-muted-foreground border-r bg-muted/50 select-none">
                          {line.lineNumber}
                        </span>
                        <span className="w-6 px-1 py-1 text-center border-r select-none">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        <span className="flex-1 px-2 py-1 whitespace-pre-wrap break-all">
                          {line.content || ' '}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

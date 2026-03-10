'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT', 'INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP',
  'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION',
  'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'NOT', 'IN',
  'BETWEEN', 'LIKE', 'IS', 'EXISTS', 'ALL', 'ANY', 'PRIMARY', 'KEY',
  'FOREIGN', 'REFERENCES', 'CASCADE', 'DEFAULT', 'CONSTRAINT'
];

function formatSql(sql: string): string {
  let formatted = sql.trim();

  formatted = formatted.replace(/\s+/g, ' ');

  const newlineKeywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON', 'SET', 'VALUES', 'INSERT INTO', 'UPDATE', 'DELETE FROM'];

  newlineKeywords.forEach(keyword => {
    const regex = new RegExp(`\\s*(${keyword})\\s*`, 'gi');
    formatted = formatted.replace(regex, `\n${keyword.toUpperCase()} `);
  });

  formatted = formatted.replace(/,\s*/g, ',\n    ');

  SQL_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
    formatted = formatted.replace(regex, keyword.toUpperCase());
  });

  formatted = formatted.replace(/^\n+/, '');

  const lines = formatted.split('\n');
  const indentedLines = lines.map((line, index) => {
    const trimmed = line.trim();
    if (index === 0) return trimmed;
    if (trimmed.startsWith('AND ') || trimmed.startsWith('OR ')) {
      return '  ' + trimmed;
    }
    if (trimmed.startsWith(',')) {
      return '    ' + trimmed;
    }
    return trimmed;
  });

  return indentedLines.join('\n');
}

export function SqlFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const format = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setError(null);
      return;
    }

    try {
      const formatted = formatSql(input);
      setOutput(formatted);
      setError(null);
    } catch (e) {
      setError('Failed to format SQL');
      setOutput('');
    }
  }, [input]);

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
    setInput('SELECT u.id, u.name, u.email, o.order_id, o.total FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = \'active\' AND o.created_at > \'2024-01-01\' ORDER BY o.created_at DESC LIMIT 100');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-muted bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Basic Formatting</p>
            <p className="text-sm text-muted-foreground mt-1">
              This tool provides basic SQL formatting (keyword capitalization, line breaks).
              It may not handle all SQL dialects or complex queries correctly.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">SQL Input</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadSample}>
              Load Sample
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste your SQL query here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              aria-label="SQL input"
            />
            <Button onClick={format} className="mt-4">
              Format SQL
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Formatted Output</CardTitle>
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
                <p className="text-sm">{error}</p>
              </div>
            ) : (
              <Textarea
                value={output}
                readOnly
                className="min-h-[300px] font-mono text-sm"
                placeholder="Formatted SQL will appear here..."
                aria-label="Formatted SQL output"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

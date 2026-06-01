'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock } from 'lucide-react';

interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

function parseCronExpression(expression: string): CronParts | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

function describeCronPart(value: string, field: string): string {
  if (value === '*') return `every ${field}`;
  if (value.includes('/')) {
    const [, step] = value.split('/');
    return `every ${step} ${field}${parseInt(step) > 1 ? 's' : ''}`;
  }
  if (value.includes('-')) {
    const [start, end] = value.split('-');
    return `${field}s ${start} through ${end}`;
  }
  if (value.includes(',')) {
    return `${field}s ${value}`;
  }
  return `${field} ${value}`;
}

function describeCron(parts: CronParts): string {
  const descriptions: string[] = [];

  if (parts.minute !== '*') {
    descriptions.push(`At minute ${parts.minute}`);
  }
  if (parts.hour !== '*') {
    const hourDesc = parts.hour.includes('/')
      ? describeCronPart(parts.hour, 'hour')
      : `at hour ${parts.hour}`;
    descriptions.push(hourDesc);
  }
  if (parts.dayOfMonth !== '*') {
    descriptions.push(`on day ${parts.dayOfMonth} of the month`);
  }
  if (parts.month !== '*') {
    descriptions.push(`in month ${parts.month}`);
  }
  if (parts.dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNum = parseInt(parts.dayOfWeek);
    const dayName = days[dayNum] || `day ${parts.dayOfWeek}`;
    descriptions.push(`on ${dayName}`);
  }

  if (descriptions.length === 0) {
    return 'Every minute';
  }

  return descriptions.join(', ');
}

function getNextRunTimes(expression: string, count: number = 5): Date[] {
  const parts = parseCronExpression(expression);
  if (!parts) return [];

  const times: Date[] = [];
  const now = new Date();
  let current = new Date(now);
  current.setSeconds(0);
  current.setMilliseconds(0);

  const maxIterations = 1000;
  let iterations = 0;

  while (times.length < count && iterations < maxIterations) {
    iterations++;
    current = new Date(current.getTime() + 60000);

    const minute = current.getMinutes();
    const hour = current.getHours();
    const dayOfMonth = current.getDate();
    const month = current.getMonth() + 1;
    const dayOfWeek = current.getDay();

    if (!matchesCronPart(parts.minute, minute)) continue;
    if (!matchesCronPart(parts.hour, hour)) continue;
    if (!matchesCronPart(parts.dayOfMonth, dayOfMonth)) continue;
    if (!matchesCronPart(parts.month, month)) continue;
    if (!matchesCronPart(parts.dayOfWeek, dayOfWeek)) continue;

    times.push(new Date(current));
  }

  return times;
}

function matchesCronPart(pattern: string, value: number): boolean {
  if (pattern === '*') return true;

  if (pattern.includes('/')) {
    const [base, step] = pattern.split('/');
    const stepNum = parseInt(step);
    if (base === '*') return value % stepNum === 0;
    return value >= parseInt(base) && value % stepNum === 0;
  }

  if (pattern.includes('-')) {
    const [start, end] = pattern.split('-').map(Number);
    return value >= start && value <= end;
  }

  if (pattern.includes(',')) {
    return pattern.split(',').map(Number).includes(value);
  }

  return parseInt(pattern) === value;
}

export function CronHelper() {
  const [expression, setExpression] = useState('0 9 * * 1-5');
  const [error, setError] = useState<string | null>(null);

  const { parts, description, nextRuns } = useMemo(() => {
    const parsed = parseCronExpression(expression);
    if (!parsed) {
      setError('Invalid cron expression. Expected 5 space-separated fields.');
      return { parts: null, description: '', nextRuns: [] };
    }
    setError(null);
    return {
      parts: parsed,
      description: describeCron(parsed),
      nextRuns: getNextRunTimes(expression),
    };
  }, [expression]);

  const loadPreset = (preset: string) => {
    setExpression(preset);
  };

  const presets = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
    { label: 'Weekly on Sunday', value: '0 0 * * 0' },
    { label: 'Monthly', value: '0 0 1 * *' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Cron Expression</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="* * * * *"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            className="font-mono text-lg"
            aria-label="Cron expression"
          />
          <div className="flex flex-wrap gap-2 mt-4">
            {presets.map((preset) => (
              <Button
                key={preset.value}
                variant="outline"
                size="sm"
                onClick={() => loadPreset(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {parts && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Expression Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4 text-center">
                {[
                  { label: 'Minute', value: parts.minute, range: '0-59' },
                  { label: 'Hour', value: parts.hour, range: '0-23' },
                  { label: 'Day (Month)', value: parts.dayOfMonth, range: '1-31' },
                  { label: 'Month', value: parts.month, range: '1-12' },
                  { label: 'Day (Week)', value: parts.dayOfWeek, range: '0-6' },
                ].map((field) => (
                  <div key={field.label} className="space-y-2">
                    <Badge variant="secondary" className="font-mono text-lg px-4 py-2">
                      {field.value}
                    </Badge>
                    <p className="text-sm font-medium">{field.label}</p>
                    <p className="text-xs text-muted-foreground">{field.range}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-md bg-muted">
                <p className="text-sm font-medium">Description:</p>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Next Run Times (Local Time)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Could not calculate next run times</p>
              ) : (
                <div className="space-y-2">
                  {nextRuns.map((time, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-md bg-muted"
                    >
                      <span className="text-sm font-medium">Run {index + 1}</span>
                      <span className="font-mono text-sm">
                        {time.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

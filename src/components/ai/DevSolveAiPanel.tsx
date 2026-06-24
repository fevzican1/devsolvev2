'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Send, Sparkles, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { askDevSolveAi } from '@/lib/ai/devsolveai/engine';
import { DEVSOLVE_AI_NAME, DEVSOLVE_AI_TAGLINE, QUICK_PROMPTS } from '@/lib/ai/devsolveai/knowledge';
import type { DevSolveAiContext, DevSolveAiMessage } from '@/lib/ai/devsolveai/types';
import { cn } from '@/lib/utils';

function renderMarkdownLite(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return parts.map((part, index) => {
    if (part === '\n') return <br key={index} />;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function createMessage(role: DevSolveAiMessage['role'], content: string): DevSolveAiMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

interface DevSolveAiPanelProps {
  context?: DevSolveAiContext;
  compact?: boolean;
  className?: string;
  showHeader?: boolean;
}

export function DevSolveAiPanel({
  context = {},
  compact = false,
  className,
  showHeader = true,
}: DevSolveAiPanelProps) {
  const [messages, setMessages] = useState<DevSolveAiMessage[]>(() => [
    createMessage(
      'assistant',
      `Hi! I'm **${DEVSOLVE_AI_NAME}**. ${DEVSOLVE_AI_TAGLINE}. Ask about tools, paste errors, or pick a quick prompt below.`,
    ),
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mergedContext = useMemo(() => context, [context]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const submitQuery = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || isThinking) return;

      setMessages((prev) => [...prev, createMessage('user', trimmed)]);
      setInput('');
      setIsThinking(true);
      scrollToBottom();

      window.setTimeout(() => {
        const response = askDevSolveAi(trimmed, mergedContext);
        setMessages((prev) => [...prev, createMessage('assistant', response.content)]);
        setIsThinking(false);
        scrollToBottom();
      }, 120);
    },
    [isThinking, mergedContext, scrollToBottom],
  );

  const clearChat = () => {
    setMessages([
      createMessage(
        'assistant',
        `Chat cleared. I'm still **${DEVSOLVE_AI_NAME}** — ready when you are.`,
      ),
    ]);
  };

  return (
    <Card className={cn('border-primary/20', className)}>
      {showHeader && (
        <CardHeader className={compact ? 'pb-3' : undefined}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
                {DEVSOLVE_AI_NAME}
              </CardTitle>
              <CardDescription className="mt-1">{DEVSOLVE_AI_TAGLINE}</CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0 gap-1">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Local only
            </Badge>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn('space-y-4', !showHeader && 'pt-6')}>
        <div
          ref={scrollRef}
          className={cn(
            'space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-3',
            compact ? 'max-h-[280px]' : 'max-h-[420px]',
          )}
          role="log"
          aria-live="polite"
          aria-label="DevSolveAI conversation"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'rounded-lg px-3 py-2 text-sm leading-relaxed',
                message.role === 'user'
                  ? 'ml-8 bg-primary text-primary-foreground'
                  : 'mr-8 bg-background border',
              )}
            >
              {renderMarkdownLite(message.content)}
            </div>
          ))}
          {isThinking && (
            <div className="mr-8 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
              Thinking locally…
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal text-left text-xs"
              onClick={() => submitQuery(prompt)}
              disabled={isThinking}
            >
              {prompt}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitQuery(input);
              }
            }}
            placeholder="Ask DevSolveAI… (Enter to send, Shift+Enter for new line)"
            className="min-h-[72px] resize-none text-sm"
            aria-label="Message DevSolveAI"
            disabled={isThinking}
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="icon"
              onClick={() => submitQuery(input)}
              disabled={!input.trim() || isThinking}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearChat}
              aria-label="Clear conversation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {mergedContext.toolSlug && (
          <p className="text-xs text-muted-foreground">
            Context: <strong>{mergedContext.toolName ?? mergedContext.toolSlug}</strong>
            {mergedContext.error ? ' · parse error detected' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface DevSolveAiToolEmbedProps {
  toolSlug: string;
  toolName: string;
}

export function DevSolveAiToolEmbed({ toolSlug, toolName }: DevSolveAiToolEmbedProps) {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" aria-hidden="true" />
          Need help? Ask DevSolveAI
        </h3>
        <Link
          href="/tools/devsolveai"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Open full assistant
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <DevSolveAiPanel
        compact
        showHeader={false}
        context={{ toolSlug, toolName }}
      />
    </div>
  );
}

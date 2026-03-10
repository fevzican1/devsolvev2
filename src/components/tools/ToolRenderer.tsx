'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const toolComponents: Record<string, React.ComponentType> = {
  'json-formatter': dynamic(() => import('@/tools/components/JsonFormatter').then(m => m.JsonFormatter), { loading: LoadingFallback }),
  'jwt-decoder': dynamic(() => import('@/tools/components/JwtDecoder').then(m => m.JwtDecoder), { loading: LoadingFallback }),
  'base64-encode-decode': dynamic(() => import('@/tools/components/Base64Tool').then(m => m.Base64Tool), { loading: LoadingFallback }),
  'url-encode-decode': dynamic(() => import('@/tools/components/UrlEncodeTool').then(m => m.UrlEncodeTool), { loading: LoadingFallback }),
  'hash-generator': dynamic(() => import('@/tools/components/HashGenerator').then(m => m.HashGenerator), { loading: LoadingFallback }),
  'uuid-generator': dynamic(() => import('@/tools/components/UuidGenerator').then(m => m.UuidGenerator), { loading: LoadingFallback }),
  'regex-tester': dynamic(() => import('@/tools/components/RegexTester').then(m => m.RegexTester), { loading: LoadingFallback }),
  'cron-helper': dynamic(() => import('@/tools/components/CronHelper').then(m => m.CronHelper), { loading: LoadingFallback }),
  'html-entity-encode-decode': dynamic(() => import('@/tools/components/HtmlEntityTool').then(m => m.HtmlEntityTool), { loading: LoadingFallback }),
  'text-case-converter': dynamic(() => import('@/tools/components/TextCaseConverter').then(m => m.TextCaseConverter), { loading: LoadingFallback }),
  'diff-checker': dynamic(() => import('@/tools/components/DiffChecker').then(m => m.DiffChecker), { loading: LoadingFallback }),
  'markdown-preview': dynamic(() => import('@/tools/components/MarkdownPreview').then(m => m.MarkdownPreview), { loading: LoadingFallback }),
  'sql-formatter': dynamic(() => import('@/tools/components/SqlFormatter').then(m => m.SqlFormatter), { loading: LoadingFallback }),
  'css-minifier': dynamic(() => import('@/tools/components/CssMinifier').then(m => m.CssMinifier), { loading: LoadingFallback }),
  'json-to-typescript': dynamic(() => import('@/tools/components/JsonToTypescript').then(m => m.JsonToTypescript), { loading: LoadingFallback }),
};

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

interface ToolRendererProps {
  slug: string;
}

export function ToolRenderer({ slug }: ToolRendererProps) {
  const ToolComponent = toolComponents[slug];

  if (!ToolComponent) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Tool not found or not yet implemented.</p>
      </div>
    );
  }

  return <ToolComponent />;
}

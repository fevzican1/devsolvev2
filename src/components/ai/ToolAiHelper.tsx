'use client';

import { DevSolveAiToolEmbed } from '@/components/ai/DevSolveAiPanel';
import { siteConfig } from '@/config/site';

interface ToolAiHelperProps {
  toolSlug: string;
  toolName: string;
}

export function ToolAiHelper({ toolSlug, toolName }: ToolAiHelperProps) {
  if (!siteConfig.features.devSolveAi || toolSlug === 'devsolveai') {
    return null;
  }

  return <DevSolveAiToolEmbed toolSlug={toolSlug} toolName={toolName} />;
}

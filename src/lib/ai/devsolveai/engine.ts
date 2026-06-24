import { getToolBySlug } from '@/tools/registry';
import {
  explainJsonError,
  explainJwtToken,
  suggestRegexFromNaturalLanguage,
  summarizeDiff,
} from './analyzers';
import {
  DEVSOLVE_AI_NAME,
  DEVSOLVE_AI_TAGLINE,
  getToolKnowledge,
  listAllToolsBrief,
  recommendTools,
} from './knowledge';
import type { DevSolveAiContext, DevSolveAiIntent, DevSolveAiResponse } from './types';

function classifyIntent(query: string, context: DevSolveAiContext): DevSolveAiIntent {
  const q = query.toLowerCase().trim();

  if (/^(hi|hello|hey|merhaba|selam|help|yardım)\b/.test(q) || q === '?') {
    return { type: 'greeting', confidence: 0.95 };
  }

  if (/\b(private|privacy|local|upload|server|güvenli|veri)\b/i.test(q)) {
    return { type: 'privacy', confidence: 0.9 };
  }

  if (/\b(which tool|recommend|suggest tool|what tool|hangi araç|ne kullan)\b/i.test(q)) {
    return { type: 'recommend_tool', confidence: 0.85 };
  }

  if (context.error || /\b(json error|parse error|invalid json|syntax error|unexpected token)\b/i.test(q)) {
    return { type: 'json_error', confidence: 0.9 };
  }

  if (context.toolSlug === 'regex-tester' || /\b(regex|regular expression|pattern for|match)\b/i.test(q)) {
    return { type: 'regex_help', confidence: 0.85 };
  }

  if (context.toolSlug === 'jwt-decoder' || /\b(jwt|token|claims|bearer)\b/i.test(q)) {
    return { type: 'jwt_help', confidence: 0.85 };
  }

  if (context.toolSlug === 'diff-checker' || /\b(diff|difference|compare|summary)\b/i.test(q)) {
    return { type: 'diff_help', confidence: 0.8 };
  }

  if (/\b(base64|url encode|html entity|hash|uuid|cron|markdown|sql|css|typescript)\b/i.test(q)) {
    return { type: 'encoding_help', confidence: 0.75 };
  }

  if (context.toolSlug || /\b(how to|how do|explain|what is|nasıl)\b/i.test(q)) {
    return { type: 'tool_help', confidence: 0.7 };
  }

  return { type: 'unknown', confidence: 0.3 };
}

function buildGreeting(context: DevSolveAiContext): DevSolveAiResponse {
  const toolLine = context.toolName
    ? `I can see you're on **${context.toolName}** — ask me how to use it, paste an error to diagnose, or describe what you're trying to accomplish.`
    : 'Ask me about any DevSolve tool, paste errors for diagnosis, or describe a task and I\'ll suggest the right utility.';

  return {
    content: [
      `Hello! I'm **${DEVSOLVE_AI_NAME}** — ${DEVSOLVE_AI_TAGLINE}.`,
      '',
      toolLine,
      '',
      '**I can help with:**',
      '- Explaining JSON parse errors with fix suggestions',
      '- Suggesting regex patterns from plain English',
      '- Inspecting JWT structure (debug only, no signature verify)',
      '- Summarizing text diffs',
      '- Recommending the right DevSolve tool for your task',
      '',
      'Everything runs locally — no Cloudflare Functions, no external AI APIs.',
    ].join('\n'),
    suggestions: [
      'Explain this JSON error',
      'Suggest a regex for email',
      'Which tool for URL encoding?',
    ],
  };
}

function buildPrivacyResponse(): DevSolveAiResponse {
  return {
    content: [
      '**DevSolve privacy model:**',
      '',
      '- All 15+ developer tools process data **entirely in your browser** using JavaScript.',
      '- **DevSolveAI** (me) also runs locally — your questions and pasted snippets never leave your device.',
      '- No account, no uploads, no server-side storage of your inputs.',
      '- We block AI training crawlers on programmatic pages and set `Content-Signal: ai-train=no`.',
      '',
      'For sensitive tokens or production data, still follow your org\'s redaction policy — local processing reduces risk but does not replace access controls.',
    ].join('\n'),
  };
}

export function askDevSolveAi(query: string, context: DevSolveAiContext = {}): DevSolveAiResponse {
  const trimmed = query.trim();
  if (!trimmed) {
    return { content: 'Type a question or paste an error message, and I\'ll help from here.' };
  }

  const intent = classifyIntent(trimmed, context);

  switch (intent.type) {
    case 'greeting':
      return buildGreeting(context);

    case 'privacy':
      return buildPrivacyResponse();

    case 'json_error': {
      const errorMsg = context.error ?? trimmed;
      const explanation = explainJsonError(errorMsg, context.input);
      if (explanation) {
        return {
          content: explanation,
          relatedTools: recommendTools('json format validate', context.toolSlug),
        };
      }
      break;
    }

    case 'regex_help': {
      const suggestion = suggestRegexFromNaturalLanguage(trimmed);
      if (suggestion) {
        return {
          content: suggestion,
          relatedTools: [{ slug: 'regex-tester', name: 'Regex Tester', reason: 'Test the suggested pattern live' }],
        };
      }
      break;
    }

    case 'jwt_help': {
      const token = context.input?.trim();
      if (token && token.includes('.')) {
        const explanation = explainJwtToken(token);
        if (explanation) {
          return {
            content: explanation,
            relatedTools: [{ slug: 'jwt-decoder', name: 'JWT Decoder', reason: 'Full interactive JWT inspection' }],
          };
        }
      }
      return {
        content: 'Paste a three-part JWT into the input field (or the JWT Decoder tool), then ask me to explain it. Remember: DevSolve never verifies signatures — use server-side validation in production.',
        relatedTools: [{ slug: 'jwt-decoder', name: 'JWT Decoder', reason: 'Decode JWT header and payload' }],
      };
    }

    case 'diff_help': {
      if (context.input && context.output) {
        return { content: summarizeDiff(context.input, context.output) };
      }
      return {
        content: 'Paste your "before" and "after" text into the Diff Checker, then ask me to summarize the changes.',
        relatedTools: [{ slug: 'diff-checker', name: 'Diff Checker', reason: 'Side-by-side text comparison' }],
      };
    }

    case 'recommend_tool': {
      const tools = recommendTools(trimmed, context.toolSlug);
      if (tools.length === 0) {
        return { content: listAllToolsBrief() };
      }
      const lines = ['**Recommended tools:**', ...tools.map((t) => `- **${t.name}** — ${t.reason} → \`/tools/${t.slug}\``)];
      return { content: lines.join('\n'), relatedTools: tools };
    }

    case 'tool_help':
    case 'encoding_help':
    case 'unknown':
    default: {
      const slug = context.toolSlug;
      if (slug) {
        const tool = getToolBySlug(slug);
        if (tool) {
          return {
            content: getToolKnowledge(tool),
            relatedTools: recommendTools(trimmed, slug),
          };
        }
      }

      const tools = recommendTools(trimmed, context.toolSlug);
      if (tools.length > 0) {
        return {
          content: [
            'Based on your question, these tools may help:',
            ...tools.map((t) => `- **${t.name}** — ${t.reason}`),
            '',
            'Or browse the full list:',
            listAllToolsBrief(),
          ].join('\n'),
          relatedTools: tools,
        };
      }

      return {
        content: [
          `I'm not sure how to answer that specifically, but here's what ${DEVSOLVE_AI_NAME} covers:`,
          '',
          listAllToolsBrief(),
          '',
          'Try asking: "explain JSON error", "regex for email", or "which tool for hashing?"',
        ].join('\n'),
        suggestions: ['What tools are available?', 'How does local processing work?'],
      };
    }
  }

  return buildGreeting(context);
}

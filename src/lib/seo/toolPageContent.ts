import { externalUrls } from '@/config/site';
import type { ToolDefinition } from '@/tools/registry';

export interface ToolFaqItem {
  question: string;
  answer: string;
}

export interface ToolPageContent {
  overview: string[];
  howTo: string[];
  faq: ToolFaqItem[];
  faqJsonLd: {
    '@context': string;
    '@type': 'FAQPage';
    mainEntity: Array<{
      '@type': 'Question';
      name: string;
      acceptedAnswer: {
        '@type': 'Answer';
        text: string;
      };
    }>;
  };
}

const categoryUseCase: Record<ToolDefinition['category'], string> = {
  conversion: 'data model generation and type-safe integration',
  encoding: 'safe data transport across HTTP, URLs, and web payloads',
  formatting: 'readability, consistency, and review-ready output',
  security: 'integrity checks and token-level diagnostics',
  text: 'content normalization and cross-version comparison',
  validation: 'input quality checks and pattern reliability',
};

function cleanToolName(name: string): string {
  return name.replace(/\s*\(.*\)\s*/g, '').trim();
}

export function buildToolPageContent(tool: ToolDefinition): ToolPageContent {
  const primaryName = cleanToolName(tool.name);
  const relatedNames = tool.relatedTools.length > 0
    ? tool.relatedTools.map((slug) => slug.replace(/-/g, ' ')).join(', ')
    : 'other validation and formatting tools';
  const limitA = tool.limitations[0] ?? 'Edge-case inputs may need manual checks.';
  const limitB = tool.limitations[1] ?? 'Large payloads can increase browser compute time.';

  const overview = [
    `${primaryName} is designed for ${categoryUseCase[tool.category]}. The interface is optimized for fast, local execution so raw inputs can be inspected, transformed, and validated without sending data to a remote service.`,
    `For production workflows, this page helps verify results before they are copied into code, API requests, or deployment pipelines. It also highlights trade-offs specific to this tool, including: ${limitA} ${limitB}`,
  ];

  const howTo = [
    `Paste or type source content into ${primaryName} and confirm the input shape matches your use case.`,
    `Run the transformation, validation, or analysis action and review output for structure, syntax, and expected behavior.`,
    `Cross-check edge cases using tool limitations and compare output with real project constraints before publishing or shipping.`,
    `If needed, continue with related utilities such as ${relatedNames} to complete the workflow.`,
  ];

  const faq: ToolFaqItem[] = [
    {
      question: `When should ${primaryName} be used during development?`,
      answer: `${primaryName} is most effective during implementation and debugging phases where quick feedback reduces integration mistakes and prevents malformed data from reaching production systems.`,
    },
    {
      question: `Does ${primaryName} send data to a server?`,
      answer: `No. Processing runs in the browser for this tool page, which reduces exposure risk for internal payloads, tokens, and configuration snippets.`,
    },
    {
      question: `How can output quality be verified before release?`,
      answer: `Validate normal cases first, then run boundary inputs and compare results against documented limitations. For broader checks, chain this output with adjacent tools and guides linked on this page.`,
    },
  ];

  return {
    overview,
    howTo,
    faq,
    faqJsonLd: {
      '@context': externalUrls.schemaOrg,
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  };
}

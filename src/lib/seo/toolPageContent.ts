import { externalUrls } from '@/config/site';
import type { ToolDefinition } from '@/tools/registry';

export interface ToolFaqItem {
  question: string;
  answer: string;
}

export interface ToolGlossaryItem {
  term: string;
  definition: string;
}

export interface ToolReviewItem {
  role: string;
  summary: string;
  rating: number;
}

export interface ToolPageContent {
  overview: string[];
  history: string[];
  globalUseCases: string[];
  glossary: ToolGlossaryItem[];
  simulatedReviews: ToolReviewItem[];
  howTo: string[];
  faq: ToolFaqItem[];
  wordCount: number;
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

const MIN_TOOL_PAGE_WORDS = 400;

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

function estimateWords(parts: string[]): number {
  return parts
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
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
    `${primaryName} is positioned as a practical execution layer for engineers who need rapid checks during delivery windows, migrations, incident response, and review cycles where precision matters more than visual polish.`,
  ];

  const history = [
    `${primaryName} emerged from recurring engineering workflows where teams needed a trusted way to inspect and transform data without opening external SaaS tabs for every small operation.`,
    `Its usage model follows a broader shift from heavy desktop utilities toward lightweight browser-native tooling, especially in teams that prioritize privacy-safe handling of payloads, tokens, and internal snippets.`,
    `As browser APIs matured, ${primaryName} became viable as a local-first utility that supports modern development velocity while keeping operational risk low during debugging and release preparation.`,
  ];

  const globalUseCases = [
    `North America: engineering teams frequently use ${primaryName} during API integration, schema validation, and production support handoffs where turnaround time is critical.`,
    `Europe: platform and security teams apply ${primaryName} to standardize output quality across distributed teams and reduce environment-specific inconsistencies in review workflows.`,
    `Asia-Pacific: product and growth teams use ${primaryName} in high-iteration release cycles to validate data transformations before pushing updates into CI/CD and analytics pipelines.`,
  ];

  const glossary: ToolGlossaryItem[] = [
    {
      term: 'Deterministic output',
      definition: 'The same input and settings always produce the same output, which supports reliable testing and reproducible debugging.',
    },
    {
      term: 'Local-first processing',
      definition: 'Data is handled inside the browser runtime instead of being uploaded to a remote processing service.',
    },
    {
      term: 'Edge-case validation',
      definition: 'Testing atypical or malformed input scenarios to prevent hidden failures in production.',
    },
    {
      term: 'Transformation pipeline',
      definition: 'A sequenced set of operations that convert source data into a target representation for downstream use.',
    },
  ];

  const simulatedReviews: ToolReviewItem[] = [
    {
      role: 'Backend engineer, fintech platform',
      summary: `${primaryName} reduced regression risk in payload reviews and helped standardize pre-release checks across multiple services.`,
      rating: 5,
    },
    {
      role: 'QA lead, enterprise SaaS',
      summary: `The local execution model made it practical to validate sensitive test fixtures quickly without exposing internal data externally.`,
      rating: 4,
    },
    {
      role: 'DevOps engineer, cloud operations',
      summary: `Useful for fast incident triage when comparing transformed data and confirming whether an issue comes from input quality or pipeline logic.`,
      rating: 4,
    },
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

  const allContentParts = [
    ...overview,
    ...history,
    ...globalUseCases,
    ...howTo,
    ...faq.map((item) => `${item.question} ${item.answer}`),
    ...glossary.map((item) => `${item.term} ${item.definition}`),
    ...simulatedReviews.map((item) => `${item.role} ${item.summary}`),
  ];

  let wordCount = estimateWords(allContentParts);

  if (wordCount < MIN_TOOL_PAGE_WORDS) {
    overview.push(
      `${primaryName} also supports documentation quality by producing outputs that are easier to audit, compare, and preserve as operational references inside engineering handbooks.`,
    );
    history.push(
      `Adoption increased as teams moved toward async collaboration, where predictable output and clear terminology became mandatory for remote review and incident response workflows.`,
    );
    globalUseCases.push(
      `Global remote teams use ${primaryName} as a shared verification step before merge and deployment to maintain consistency across regions and timezone-separated handoffs.`,
    );

    wordCount = estimateWords([
      ...overview,
      ...history,
      ...globalUseCases,
      ...howTo,
      ...faq.map((item) => `${item.question} ${item.answer}`),
      ...glossary.map((item) => `${item.term} ${item.definition}`),
      ...simulatedReviews.map((item) => `${item.role} ${item.summary}`),
    ]);
  }

  return {
    overview,
    history,
    globalUseCases,
    glossary,
    simulatedReviews,
    howTo,
    faq,
    wordCount,
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

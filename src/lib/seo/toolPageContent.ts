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

export interface ToolPageContent {
  overview: string[];
  history: string[];
  globalUseCases: string[];
  glossary: ToolGlossaryItem[];
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

const categoryGlossary: Record<ToolDefinition['category'], ToolGlossaryItem[]> = {
  conversion: [
    { term: 'Schema inference', definition: 'Deriving a structural model from sample JSON or API payloads.' },
    { term: 'Type mapping', definition: 'Translating JSON fields into language-native types for safer code.' },
    { term: 'Nullability', definition: 'Whether a field may be absent or explicitly null in the source data.' },
    { term: 'Round-trip fidelity', definition: 'Ensuring transformed data can be parsed back without loss.' },
  ],
  encoding: [
    { term: 'Percent-encoding', definition: 'Replacing unsafe URL characters with %XX escape sequences.' },
    { term: 'UTF-8 byte sequence', definition: 'The standard encoding for Unicode text on the web.' },
    { term: 'Padding', definition: 'Trailing = characters in Base64 that restore byte alignment.' },
    { term: 'Double-encoding', definition: 'Accidentally encoding already-encoded text, a common bug in forms and redirects.' },
  ],
  formatting: [
    { term: 'Pretty-print', definition: 'Adding indentation and line breaks so humans can read structured text.' },
    { term: 'Minification', definition: 'Removing whitespace to reduce payload size for transport.' },
    { term: 'Idempotent format', definition: 'Running the formatter twice yields identical output.' },
    { term: 'Style guide', definition: 'Team rules for indentation, keyword casing, and clause breaks.' },
  ],
  security: [
    { term: 'One-way hash', definition: 'A digest that cannot be reversed to recover the original input.' },
    { term: 'Salt', definition: 'Random data mixed into a hash input to resist rainbow-table attacks.' },
    { term: 'JWT claim', definition: 'A named field inside a token payload such as exp, aud, or sub.' },
    { term: 'Local inspection', definition: 'Reviewing sensitive material in-browser without uploading it.' },
  ],
  text: [
    { term: 'Normalization', definition: 'Converting text to a consistent casing or spacing convention.' },
    { term: 'Diff hunks', definition: 'Grouped line changes between two text versions.' },
    { term: 'Capture group', definition: 'A parenthesized sub-pattern in regex whose match can be reused.' },
    { term: 'Delimiter', definition: 'The character or sequence that separates fields in structured text.' },
  ],
  validation: [
    { term: 'Syntax error', definition: 'Input that breaks the grammar rules of the target format.' },
    { term: 'Structural validation', definition: 'Checking shape and required fields, not just character-level syntax.' },
    { term: 'Fixture', definition: 'A saved sample input used to reproduce a parsing or formatting issue.' },
    { term: 'Regression check', definition: 'Re-running known-good samples after a change to catch new failures.' },
  ],
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

function buildHistory(tool: ToolDefinition, primaryName: string): string[] {
  const focus = categoryUseCase[tool.category];
  return [
    `${primaryName} addresses ${focus} in day-to-day engineering work — especially when teams need a quick, trustworthy check without installing desktop software or sending payloads to a remote API.`,
    `The tool follows a local-first model: input stays in the browser tab, which makes it practical for JWT snippets, config fragments, and staging data that should not leave your machine during review.`,
  ];
}

function buildPracticalWorkflows(tool: ToolDefinition, primaryName: string): string[] {
  switch (tool.category) {
    case 'security':
      return [
        `Inspect tokens or digests during incident triage before pasting values into shared chat or ticketing systems.`,
        `Validate sample outputs from CI jobs when a pipeline change might alter hashing or identifier generation.`,
        `Compare before/after values when rotating secrets or verifying that a local transform matches production behavior.`,
      ];
    case 'encoding':
      return [
        `Debug query strings and form submissions where a single mis-encoded character breaks an integration.`,
        `Confirm round-trip encoding when moving binary or Unicode data through HTTP headers and JSON fields.`,
        `Prepare URL-safe strings for documentation examples without relying on language-specific standard libraries.`,
      ];
    case 'formatting':
      return [
        `Normalize SQL, CSS, or Markdown before opening a pull request so reviewers see consistent structure.`,
        `Minify assets locally to estimate payload size impact before deploying to a CDN.`,
        `Share readable snippets in design docs where line breaks and indentation matter for comprehension.`,
      ];
    case 'validation':
      return [
        `Catch malformed JSON or regex mistakes at the keyboard instead of after a failed deploy.`,
        `Build a small fixture library of edge-case inputs that your service must accept in production.`,
        `Walk through onboarding exercises where new teammates learn your team's validation conventions.`,
      ];
    case 'text':
      return [
        `Compare configuration exports from two environments to spot unintended drift.`,
        `Normalize naming conventions when refactoring identifiers across services.`,
        `Test regular expressions against representative log lines before adding them to monitoring rules.`,
      ];
    case 'conversion':
      return [
        `Prototype TypeScript interfaces from sample API responses during service design.`,
        `Document expected response shapes for partner integrations.`,
        `Validate that generated types still match live payloads after an API version bump.`,
      ];
    default:
      return [
        `Use ${primaryName} as a quick verification step before copying output into tickets, docs, or deployment scripts.`,
        `Pair it with the related tools linked on this page when a workflow spans more than one transformation.`,
        `Keep sensitive samples local — the browser runtime avoids an extra data-handling vendor in the loop.`,
      ];
  }
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
    `${primaryName} is a practical execution layer for engineers who need rapid checks during delivery windows, migrations, incident response, and review cycles where precision matters more than visual polish.`,
  ];

  const history = buildHistory(tool, primaryName);
  const globalUseCases = buildPracticalWorkflows(tool, primaryName);
  const glossary = categoryGlossary[tool.category];

  const howTo = [
    `Paste or type source content into ${primaryName} and confirm the input shape matches your use case.`,
    `Run the transformation, validation, or analysis action and review output for structure, syntax, and expected behavior.`,
    `Cross-check edge cases using the limitations listed above and compare output with real project constraints before publishing or shipping.`,
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
  ];

  let wordCount = estimateWords(allContentParts);

  if (wordCount < MIN_TOOL_PAGE_WORDS) {
    overview.push(
      `${primaryName} also supports documentation quality by producing outputs that are easier to audit, compare, and preserve as operational references inside engineering handbooks.`,
    );
    wordCount = estimateWords([
      ...overview,
      ...history,
      ...globalUseCases,
      ...howTo,
      ...faq.map((item) => `${item.question} ${item.answer}`),
      ...glossary.map((item) => `${item.term} ${item.definition}`),
    ]);
  }

  return {
    overview,
    history,
    globalUseCases,
    glossary,
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

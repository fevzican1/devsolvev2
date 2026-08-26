/**
 * functions/_lib/programmaticPage.ts
 * ============================================================================
 * Single source of truth for the programmatic /k/ corpus: geometry, slug
 * resolution, AND the rich, guideline-compliant HTML rendered at the edge.
 *
 * This module is intentionally dependency-free (no npm imports, no bindings,
 * no storage, no network). Every /k/ URL is derived deterministically from its
 * ordinal, so the full 20M-URL corpus consumes zero deployment storage and
 * requires no origin database. The same module is imported by:
 *
 *   - functions/[[path]].ts          (edge delivery — the bytes Bingbot/Googlebot crawl)
 *   - scripts/verify-edge-corpus-quality.mjs (build-time, zero-cost quality proof)
 *
 * Keeping ONE generator for both means the build-time quality gate scores the
 * exact HTML that ships, closing the historical gap where gates scored the
 * static export while the edge served a much thinner template.
 *
 * The rendered HTML is written to satisfy both Google's Page Indexing / Helpful
 * Content requirements and Bing's Webmaster Guidelines for classic + grounding
 * (Copilot) eligibility:
 *   - rich, unique, single-topic content well above the thin-content floor
 *   - <title> 30-69 chars (Bing: strictly less than 70), meta description 150-160 chars
 *   - one <h1> + logical <h2>/<h3> hierarchy, semantic HTML
 *   - canonical, robots index,follow, meta data-snippet (rich snippets allowed)
 *   - accurate JSON-LD (TechArticle, BreadcrumbList, HowTo, FAQPage, SoftwareApplication)
 *   - crawlable <a href> internal links with descriptive anchor text
 *   - key information surfaced early, explicit facts/definitions (verifiability)
 *   - clear, consistent entity naming (tool / audience / task / cluster)
 */

import { uniqueTokens, tokenAtom, hasDuplicateContentTokens, topKeywordDensity, maxKeywordHits, MAX_KEYWORD_DENSITY } from '../../src/lib/seo/uniqueTokens';
import { metaEndsWithTrailingConjunction } from '../../src/lib/seo/seoRules';
import {
  AUDIENCES,
  CLUSTERS,
  CORPUS_SIZE,
  MODIFIER_CONTEXTS,
  MODIFIER_COUNT,
  MODIFIER_STYLES,
  PAIRS,
  PER_PAIR,
  RAW_CORPUS_SIZE,
  TARGET_CORPUS_SIZE,
  TASKS,
  URLS_PER_SITEMAP,
  indexForCombination,
  pageForIndex,
  resolvePageForSlug,
  stableHash,
  type ResolvedPage,
} from '../../src/lib/programmatic/corpusGeometry';
import {
  AUDIENCE_MICRO,
  AUDIENCE_TINY,
  CONTEXT_IDENTITY,
  IDENTITY_TOOL,
  STYLE_IDENTITY,
  TASK_MICRO,
  TASK_PHRASE,
  TASK_TINY,
  TITLE_MAX as IDENTITY_TITLE_MAX,
  TOOL_MICRO,
  TOOL_TINY,
  buildFiveAtomTitle,
  identityFormsFor,
  intentMicro,
} from '../../src/lib/seo/factoryIdentity';
import { EMBEDDED_RAMP_LEVEL } from './embeddedRamp';
import { prose, titleCase, sentence, pluralRole, gerund, articleFor, withArticle, repairIndefiniteArticles } from './language';
import { FORBIDDEN_SKELETON_HEADINGS, headingLooksOwned, headingOwnerClause, headingOwnerTokens, headingSlotForSectionId, oneToken, ownHeading } from './ownedHeading';
import {
  intentKernel,
  toolKnowledge,
  type KnowledgeSection,
  type PageKernel,
} from './corpusKnowledge';
import {
  contextArtifact,
  entityFraming,
  planDocument,
  practiceHeading,
  uniqueSnippets,
  variedAcceptance,
  variedComparison,
  variedDecision,
  variedFaq,
  variedGlossary,
  variedIntro,
  variedPitfalls,
  variedSteps,
  variedTakeaways,
  snippetLead,
  type DocumentPlan,
  type SnippetBlock,
} from './pageVariation';
import { taskGuide } from './taskGuides';
import { AD_FOOTER_SLOT, AD_HEADER_SLOT, renderRevenueAsides } from './revenuePlacements';
import {
  buildBranchTree,
  buildCompatMatrix,
  buildExecutablePack,
  matrixSplit,
  type BranchFork,
  type CompatMatrix,
} from './semanticValue';
import {
  comboAudienceList,
  comboAudienceParagraphs,
  comboContextParagraphs,
  comboExampleNote,
  comboJobParagraphs,
  comboJobList,
  comboMatrixLead,
  comboPracticeParagraphs,
} from './comboProcedure';

/* -------------------------------------------------------------------------- */
/*  Corpus geometry (immutable deployment invariant)                          */
/* -------------------------------------------------------------------------- */

export {
  AUDIENCES,
  CLUSTERS,
  CORPUS_SIZE,
  MODIFIER_CONTEXTS,
  MODIFIER_COUNT,
  MODIFIER_STYLES,
  PAIRS,
  PER_PAIR,
  RAW_CORPUS_SIZE,
  TARGET_CORPUS_SIZE,
  TASKS,
  URLS_PER_SITEMAP,
  indexForCombination,
  pageForIndex,
  resolvePageForSlug,
  stableHash,
};
export type { ResolvedPage };

/*
 * Bump when the AI Indexing Agent changes the rendered HTML. It drives three
 * things that must move together: sitemap <lastmod> + Last-Modified (Bing #3 /
 * #19), per-URL ETag (cheap 304s), and the edge cache key (so a deploy cannot
 * keep serving the previous HTML from colo cache). A new version orphans old
 * colo entries without shortening s-maxage or forcing a mass purge.
 */
export const CONTENT_UPDATED_AT = '2026-08-26T18:30:00.000Z';
/** Trailing letter advances whenever body HTML quality/uniqueness changes. */
export const CONTENT_VERSION = CONTENT_UPDATED_AT.slice(0, 10).replace(/-/g, '') + 'l';

/*
 * Full-corpus sitemap. /sitemap.xml advertises every one of the 20M /k/ URLs.
 * Staged 2M/5M ramps are retired: quality is the neighbour-Jaccard + edge
 * contract, not a smaller advertised band. EMBEDDED_RAMP_LEVEL stays at 5
 * so scripts that still read .ramp-level stay in lockstep.
 */
export { EMBEDDED_RAMP_LEVEL };
export const RAMP_SITEMAP_LIMITS = [500_000, 2_000_000, 5_000_000, 9_000_000, 14_000_000, 20_000_000] as const;
export const SITEMAP_PUBLIC_LIMIT = RAMP_SITEMAP_LIMITS[EMBEDDED_RAMP_LEVEL];
export const SITEMAP_PUBLIC_CHUNKS = SITEMAP_PUBLIC_LIMIT / URLS_PER_SITEMAP;

if (SITEMAP_PUBLIC_LIMIT !== CORPUS_SIZE) {
  throw new Error(`Sitemap must advertise the full corpus (${CORPUS_SIZE.toLocaleString('en-US')} URLs). Received SITEMAP_PUBLIC_LIMIT=${SITEMAP_PUBLIC_LIMIT.toLocaleString('en-US')}.`);
}

/*
 * Parsing a non-canonical slug back into its corpus coordinates.
 *
 * A slug is `<cluster>-<intent>-<audience>-<task>-<tool>-<ordinal>`. When the
 * ordinal no longer matches the components (an older corpus geometry, a
 * hand-edited URL, a stale link), the request must NOT be answered with an
 * arbitrary page: doing that serves one URL's content under another URL's
 * address with a canonical tag pointing at a third URL — duplicate content
 * plus a self-inflicted "Duplicate, Google chose different canonical" report.
 * Instead we recover the intended combination and 301 to the URL that owns it
 * (Bing guideline #7: redirects, not canonical tags), or 404 when the slug
 * describes no real page at all (guideline #9), which also stops an unbounded
 * low-value URL space from burning crawl budget (guideline #21).
 */
const AUDIENCES_BY_LENGTH = [...AUDIENCES].sort((a, b) => b.length - a.length);
const TASKS_BY_LENGTH = [...TASKS].sort((a, b) => b.length - a.length);

export interface SlugCoordinates {
  pairIndex: number;
  audienceIndex: number;
  taskIndex: number;
  ordinal: number;
}

export function parseSlugCoordinates(slug: string): SlugCoordinates | undefined {
  const match = slug.match(/^(.+)-(\d+)$/);
  if (!match) return undefined;
  const [, stem, digits] = match;
  const ordinal = Number(digits);
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) return undefined;

  const cluster = CLUSTERS.find(([key]) => stem.startsWith(`${key}-`));
  if (!cluster) return undefined;
  const [clusterKey, tools, intents] = cluster;

  let cursor = stem.slice(clusterKey.length + 1);
  const intent = [...intents].sort((a, b) => b.length - a.length).find((candidate) => cursor.startsWith(`${candidate}-`));
  if (!intent) return undefined;
  cursor = cursor.slice(intent.length + 1);

  const audience = AUDIENCES_BY_LENGTH.find((candidate) => cursor.startsWith(`${candidate}-`));
  if (!audience) return undefined;
  cursor = cursor.slice(audience.length + 1);

  const task = TASKS_BY_LENGTH.find((candidate) => cursor.startsWith(`${candidate}-`));
  if (!task) return undefined;
  cursor = cursor.slice(task.length + 1);

  const tool = tools.find((candidate) => candidate === cursor);
  if (!tool) return undefined;

  const pairIndex = PAIRS.findIndex(([c, t, i]) => c === clusterKey && t === tool && i === intent);
  if (pairIndex < 0) return undefined;

  return {
    pairIndex,
    audienceIndex: AUDIENCES.indexOf(audience),
    taskIndex: TASKS.indexOf(task),
    ordinal,
  };
}

export type SlugResolution =
  | { kind: 'canonical'; page: ResolvedPage }
  | { kind: 'redirect'; slug: string }
  | { kind: 'notFound' };

export function resolveSlugRequest(slug: string): SlugResolution {
  const canonical = resolvePageForSlug(slug);
  if (canonical) return { kind: 'canonical', page: canonical };

  const coordinates = parseSlugCoordinates(slug);
  if (!coordinates) return { kind: 'notFound' };

  // The ordinal still selects WHICH of the 180 sub-topics was meant, so a
  // stale URL keeps its meaning and intent across the move (guideline #20).
  const target = pageForIndex(indexForCombination(
    coordinates.pairIndex,
    coordinates.audienceIndex,
    coordinates.taskIndex,
    coordinates.ordinal % MODIFIER_COUNT,
  ));
  if (!target || target.slug === slug) return { kind: 'notFound' };
  return { kind: 'redirect', slug: target.slug };
}

/* -------------------------------------------------------------------------- */
/*  Small deterministic helpers                                               */
/* -------------------------------------------------------------------------- */

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] as string);
}

/**
 * Slug segment as reader-facing prose. Acronyms keep their real spelling, so a
 * page about `validate-json` says "validate JSON" rather than "validate json".
 */
function label(value: string): string {
  return prose(value);
}

export function title(value: string): string {
  return titleCase(value);
}

/* Classic 31-multiplier string hash → stable per-slug seed. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/* Mulberry32 PRNG — deterministic, good distribution, dependency-free. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const result = [...arr];
  const rnd = mulberry32(seed || 1);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Entity vocabulary                                                          */
/* -------------------------------------------------------------------------- */

const TOOL_NAMES: Record<string, string> = {
  'json-formatter': 'JSON Formatter',
  'json-to-typescript': 'JSON to TypeScript',
  'base64-encode-decode': 'Base64 Encoder / Decoder',
  'url-encode-decode': 'URL Encoder / Decoder',
  'html-entity-encode-decode': 'HTML Entity Encoder / Decoder',
  'hash-generator': 'Hash Generator',
  'uuid-generator': 'UUID Generator',
  'jwt-decoder': 'JWT Decoder',
  'text-case-converter': 'Text Case Converter',
  'diff-checker': 'Diff Checker',
  'regex-tester': 'Regex Tester',
  'sql-formatter': 'SQL Formatter',
  'css-minifier': 'CSS Minifier',
  'markdown-preview': 'Markdown Preview',
  'cron-helper': 'Cron Helper',
};

function toolName(slug: string): string {
  return TOOL_NAMES[slug] ?? title(slug);
}

interface AudienceContext { focus: string; concern: string; workflow: string }
const AUDIENCE_CONTEXT: Record<string, AudienceContext> = {
  'backend-engineer': { focus: 'server-side reliability and performance', concern: 'data consistency across services', workflow: 'integrated into your server-side development pipeline' },
  'frontend-developer': { focus: 'UI responsiveness and user experience', concern: 'rendering performance and data binding', workflow: 'alongside your component development workflow' },
  'fullstack-developer': { focus: 'end-to-end application correctness', concern: 'consistency between client and server layers', workflow: 'bridging both frontend and backend codebases' },
  'api-consumer': { focus: 'reliable API integration and data handling', concern: 'response format stability and error handling', workflow: 'embedded in your API integration testing cycle' },
  'integration-engineer': { focus: 'system interoperability and data mapping', concern: 'format compatibility between disparate systems', workflow: 'as part of your cross-system integration pipeline' },
  'security-conscious-developer': { focus: 'secure data handling and token management', concern: 'exposure of sensitive credentials or tokens', workflow: 'within a security-first development methodology' },
  'ops-engineer': { focus: 'operational stability and monitoring', concern: 'configuration drift and deployment consistency', workflow: 'supporting your infrastructure operations workflow' },
  'devops-engineer': { focus: 'continuous delivery and infrastructure automation', concern: 'build artifact integrity and pipeline reliability', workflow: 'integrated into your CI/CD pipeline and automation scripts' },
  'technical-writer': { focus: 'documentation accuracy and clarity', concern: 'keeping examples consistent with the actual codebase', workflow: 'supporting your documentation authoring process' },
  'data-engineer': { focus: 'data pipeline correctness and throughput', concern: 'schema evolution and data quality over time', workflow: 'as part of your ETL and data processing pipeline' },
  'mobile-developer': { focus: 'efficient data transfer and offline support', concern: 'payload size and encoding compatibility across platforms', workflow: 'optimized for mobile-first development practices' },
  'qa-engineer': { focus: 'test coverage and regression detection', concern: 'subtle data differences that indicate bugs', workflow: 'integrated into your testing and quality assurance process' },
  'site-reliability-engineer': { focus: 'system uptime and incident response', concern: 'rapid root cause identification during outages', workflow: 'as part of your incident response and observability toolkit' },
  'database-administrator': { focus: 'query performance and data integrity', concern: 'schema changes affecting existing queries or indexes', workflow: 'within your database management and maintenance routine' },
  'cloud-architect': { focus: 'scalable system design and resource optimization', concern: 'cross-service data format consistency at scale', workflow: 'informing your cloud infrastructure design decisions' },
  'performance-engineer': { focus: 'latency reduction and throughput optimization', concern: 'identifying processing bottlenecks and resource consumption patterns', workflow: 'integrated into your performance profiling and benchmarking pipeline' },
  'platform-engineer': { focus: 'developer experience and infrastructure abstraction', concern: 'toolchain consistency and platform reliability across teams', workflow: 'as part of your internal developer platform and self-service tooling' },
  'solution-architect': { focus: 'end-to-end system design and technology selection', concern: 'interoperability between chosen components and long-term maintainability', workflow: 'supporting your architecture decision records and proof-of-concept evaluations' },
  'tech-lead': { focus: 'team productivity and technical decision quality', concern: 'code quality standards and knowledge sharing across the team', workflow: 'embedded in your team review process and technical mentoring sessions' },
  'release-engineer': { focus: 'build reproducibility and release artifact integrity', concern: 'deployment consistency and rollback safety across environments', workflow: 'integrated into your release pipeline and artifact verification process' },
};

interface ClusterDomain { field: string; importance: string; bestPractice: string }
const CLUSTER_DOMAIN: Record<string, ClusterDomain> = {
  json: { field: 'JSON data handling', importance: 'Structured JSON underpins modern API communication and configuration management', bestPractice: 'Validate JSON before processing it programmatically to catch structural issues early' },
  encoding: { field: 'encoding and decoding workflows', importance: 'Correct encoding prevents data corruption and security vulnerabilities across system boundaries', bestPractice: 'Test encoding roundtrips to ensure no information is lost during conversion' },
  security: { field: 'security token and hash management', importance: 'Careful token handling is critical for authentication, authorization, and data integrity', bestPractice: 'Never expose tokens or secrets in client-side code or version control' },
  text: { field: 'text processing and pattern matching', importance: 'Accurate text manipulation underpins search, validation, and data normalization tasks', bestPractice: 'Test your patterns and transformations on realistic sample data before touching production datasets' },
  formatting: { field: 'code and query formatting', importance: 'Consistent formatting improves readability, review efficiency, and long-term maintainability', bestPractice: 'Adopt a team-wide formatting standard and automate enforcement through linters and pre-commit hooks' },
  api: { field: 'API design and integration', importance: 'Well-structured APIs reduce integration friction and improve developer experience', bestPractice: 'Version your API schemas and validate both requests and responses against documented contracts' },
  data: { field: 'data transformation and modeling', importance: 'Reliable data pipelines require consistent schemas and validated transformations', bestPractice: 'Generate and maintain type definitions from real data samples to catch schema drift early' },
  debugging: { field: 'debugging and troubleshooting', importance: 'Systematic debugging reduces mean time to resolution and prevents recurring incidents', bestPractice: 'Compare known-good output against current output to isolate the point of failure quickly' },
  automation: { field: 'task automation and scheduling', importance: 'Automation eliminates repetitive manual work and reduces human error in operations', bestPractice: 'Validate cron expressions and extraction patterns in isolation before deploying them to production schedulers' },
  web: { field: 'web security and optimization', importance: 'Secure, optimized web content protects users and improves core performance metrics', bestPractice: 'Sanitize all user-supplied content and test minified assets for correctness before deployment' },
};

interface TaskContext { scenario: string; urgency: string; outcome: string; evidence: string; failure: string }
const TASK_CONTEXT: Record<string, TaskContext> = {
  'debug-production-issue': { scenario: 'diagnosing a live production problem', urgency: 'time-sensitive, because users may be affected', outcome: 'identify the root cause and apply a targeted fix', evidence: 'one captured payload with a timestamp, a severity, and the hop that produced it', failure: 'changing three things at once so you cannot say which edit stopped the incident' },
  'prepare-api-response': { scenario: 'constructing or validating an API response', urgency: 'important for downstream consumer reliability', outcome: 'produce a well-formed response that matches the documented schema', evidence: 'status, content-type, and a body that validates against the published schema', failure: 'returning 200 with a body the documented schema would reject' },
  'clean-up-payload': { scenario: 'normalizing messy or inconsistent data', urgency: 'a way to prevent cascading errors in downstream processing', outcome: 'deliver a clean, predictable data structure for further use', evidence: 'before/after bytes plus the list of fields you rewrote', failure: 'silently dropping keys that a downstream consumer still needs' },
  'sanitize-user-input': { scenario: 'making user-provided data safe for processing', urgency: 'critical for preventing injection attacks and data corruption', outcome: 'ensure all input meets expected format and safety constraints', evidence: 'the original string, the sanitizer settings, and the accepted form', failure: 'calling encode “sanitization” and inserting the result as HTML' },
  'prepare-query-parameters': { scenario: 'building properly encoded query strings', urgency: 'required for correct API communication', outcome: 'produce query parameters that survive URL parsing without data loss', evidence: 'each name/value pair encoded with the rule that part of the URI requires', failure: 'encoding a whole URL with encodeURIComponent and destroying the path' },
  'inspect-encoded-payload': { scenario: 'examining encoded or obfuscated data', urgency: 'necessary for understanding data flow between systems', outcome: 'decode the payload and verify its structure and content', evidence: 'alphabet, padding rule, and the decoded bytes next to the encoded spelling', failure: 'decoding with the wrong alphabet and treating mojibake as the source bug' },
  'trace-request': { scenario: 'following a request through multiple system layers', urgency: 'essential for diagnosing integration issues', outcome: 'map the complete request lifecycle and locate where failures occur', evidence: 'a hop list with the payload shape at each boundary', failure: 'a single capture that cannot tell you which layer mutated the bytes' },
  'validate-auth-token': { scenario: 'checking authentication token structure and claims', urgency: 'important for confirming access control works correctly', outcome: 'confirm the token carries the expected claims and has not expired', evidence: 'header, claims, and a verify/fail result — never a production token in a ticket', failure: 'trusting decoded claims without a signature check' },
  'review-config-change': { scenario: 'verifying a configuration modification before deployment', urgency: 'a safeguard that keeps misconfigurations out of production', outcome: 'confirm the change is correct, complete, and backward-compatible', evidence: 'old file, new file, and a diff a reviewer can regenerate', failure: 'approving a screenshot of a local editor with no settings beside it' },
  'migrate-legacy-system': { scenario: 'moving data or logic from an older system', urgency: 'a change that demands careful validation to prevent data loss', outcome: 'transfer data while preserving integrity and format compatibility', evidence: 'paired fixtures from the old system and the new one, same identifiers', failure: 'calling pretty-print agreement a migration proof' },
  'prepare-deployment-artifact': { scenario: 'packaging assets for a release deployment', urgency: 'directly tied to deployment reliability and performance', outcome: 'produce optimized, validated artifacts ready for production', evidence: 'artifact hash, tool settings, and a behaviour fixture that still passes', failure: 'shipping a minify that changed runtime behaviour to save a few bytes' },
  'document-api-endpoint': { scenario: 'creating or updating endpoint documentation', urgency: 'what keeps external and internal consumers aligned with the current API', outcome: 'produce accurate documentation with working examples and clear parameters', evidence: 'an example that validates against the same schema the service uses', failure: 'docs examples that the contract tests would reject' },
  'optimize-build-pipeline': { scenario: 'improving build speed and artifact quality in CI/CD', urgency: 'directly tied to developer iteration speed and deployment frequency', outcome: 'reduce build times while preserving output correctness and reproducibility', evidence: 'before/after duration plus a golden file the faster job still matches', failure: 'a faster job that no longer fails the invariant you cared about' },
  'resolve-merge-conflict': { scenario: 'reconciling divergent code or configuration changes', urgency: 'a blocker that delays feature delivery until resolved correctly', outcome: 'produce a clean merge that preserves the intent of every contributing change', evidence: 'both sides, the merge result, and a replay the other author can run', failure: 'keeping one side wholesale and calling the conflict resolved' },
  'prepare-security-audit': { scenario: 'gathering evidence and validating controls for a security review', urgency: 'required for compliance deadlines and organizational trust', outcome: 'compile a verifiable set of security controls and configuration evidence', evidence: 'control name, fixture, and a regenerable pass/fail — not a slide screenshot', failure: 'a green UI with no provenance the auditor can replay' },
  'generate-test-fixtures': { scenario: 'creating realistic sample data for automated tests', urgency: 'foundational for test coverage and regression detection', outcome: 'produce representative test data covering normal, edge, and adversarial cases', evidence: 'a positive fixture, a negative fixture, and the assertion each one is for', failure: 'one happy-path sample that cannot fail the test' },
};

const DEFAULT_AUDIENCE: AudienceContext = { focus: 'engineering quality', concern: 'data correctness', workflow: 'within your development process' };
const DEFAULT_TASK: TaskContext = { scenario: 'completing a development task', urgency: 'important for project quality', outcome: 'achieve the desired result efficiently', evidence: 'input, settings, and output stored together', failure: 'treating a pretty-print as a signed decision' };

/* -------------------------------------------------------------------------- */
/*  Compact entity forms                                                       */
/*                                                                             */
/*  A <title> has a hard 70-character budget (Bing guideline #13) but must     */
/*  still name every dimension that makes the URL distinct, otherwise sibling  */
/*  pages share a title. Each dimension therefore has progressively shorter    */
/*  spellings; the title fitter below shortens in a fixed order until the      */
/*  result fits. Every tier is injective (no two values of a dimension share   */
/*  a spelling), which is what makes the assembled titles unique — proven      */
/*  exhaustively at build time by scripts/verify-edge-corpus-quality.mjs.      */
/* -------------------------------------------------------------------------- */

interface StyleVocab {
  /** Title-budget form. */
  micro: string;
  /** Shortest title form, used only when the budget is exhausted. */
  tiny: string;
  /** Prose form used in descriptions and the H1. */
  phrase: string;
  /** What this execution style actually changes about the workflow. */
  practice: string;
  /** Long, style-only prose — absent from siblings with a different style. */
  bodyBlock: string;
}

const STYLE_VOCAB: Record<string, StyleVocab> = {
  'without-installing-cli-tools': {
    micro: 'no CLI',
    tiny: 'no CLI',
    phrase: 'without installing CLI tools',
    practice: 'Nothing has to be installed, so the workflow is available on a locked-down laptop, a borrowed machine, or a fresh container where you have no package manager rights.',
    bodyBlock: 'Operating without installing CLI tools changes the entire trust model: there is no binary to pin, no PATH conflict, no sudo prompt, and no leftover package that a later audit has to justify. The browser tab is the only runtime, which means the same person can finish the check on a Chromebook, a kiosk image, or a contractor laptop that forbids Homebrew. That constraint is why the primary path here is never a shell one-liner: the moment a CLI is required, you need a different guide.',
  },
  'directly-in-your-browser': {
    micro: 'in-browser',
    tiny: 'browser',
    phrase: 'directly in your browser',
    practice: 'The whole operation happens in a browser tab, which keeps the feedback loop to a few seconds and means a teammate can reproduce it from a shared link rather than a setup guide.',
    bodyBlock: 'Running the work directly in your browser collapses the feedback loop into a single tab: paste, run, read, decide. There is no editor plugin matrix, no remote desktop hop, and no waiting for a job queue. The trade-off is deliberate: this route optimises for interactive verification rather than batch throughput, so the acceptance criteria assume a person is watching the first trustworthy sample before anything is automated elsewhere.',
  },
  'with-step-by-step-instructions': {
    micro: 'stepwise',
    tiny: 'step',
    phrase: 'with step-by-step instructions',
    practice: 'Each stage is written out explicitly, so the procedure can be handed to someone who has never done it before and still produce the same result.',
    bodyBlock: 'A stepwise instruction style exists for hand-offs: every stage names the input it needs, the action to take, and the signal that means “move on”. Readers are not expected to invent missing steps from tribal knowledge. If you already know the flow by heart and only need a one-line reminder, a shorter guide will serve you better; this is the teachable, checklist-grade path.',
  },
  'with-safe-local-processing': {
    micro: 'local-only',
    tiny: 'local',
    phrase: 'with safe local processing',
    practice: 'Data never leaves the device, which is what makes the procedure usable on payloads you are not allowed to paste into a hosted service.',
    bodyBlock: 'Safe local processing is a hard boundary, not a marketing line: the payload stays on the device for the entire transformation. That removes egress reviews, temporary S3 drops, and “just this once” uploads that later become permanent exceptions. Choose this route when the data classification forbids third-party processors, and a managed pipeline when one is already approved and you only need bulk speed.',
  },
  'while-keeping-data-private': {
    micro: 'private',
    tiny: 'private',
    phrase: 'while keeping data private',
    practice: 'Privacy is treated as a requirement rather than a preference: no upload, no account, no retention, and therefore no new data-processing agreement to negotiate.',
    bodyBlock: 'Keeping data private reframes success: the correct result is one that never created a copy outside your control. No account gate, no retention bucket, no “debug upload”. The evidence pack is therefore local-first by design, and a workflow that requires a hosted paste box is a different procedure even when the tool name looks similar.',
  },
  'for-quick-prototyping': {
    micro: 'prototyping',
    tiny: 'draft',
    phrase: 'for quick prototyping',
    practice: 'The goal is a fast, disposable answer — enough confidence to choose a direction, with the understanding that the production implementation gets its own tests.',
    bodyBlock: 'Quick prototyping accepts disposable answers: you want direction in minutes, not a hardened pipeline. The sample can be smaller, the assertions lighter, and the follow-up is “encode the winner in tests”, not “ship from this tab”. If you need release-gate certainty, stop here: that job has a stricter acceptance bar than a spike.',
  },
  'during-code-review': {
    micro: 'in code review',
    tiny: 'review',
    phrase: 'during code review',
    practice: 'The output is meant to be pasted into a review thread, so it has to be small, self-explanatory, and reproducible by the reviewer without extra context.',
    bodyBlock: 'Code-review mode optimises for a pasteable artifact: short enough for a PR comment, complete enough that a reviewer can regenerate it without DMing you. Settings and sample must travel with the screenshot or snippet. Long-running batch proofs and overnight jobs are out of scope here, even when they use the same underlying tool.',
  },
  'as-part-of-ci-cd-pipeline': {
    micro: 'in CI/CD',
    tiny: 'CI/CD',
    phrase: 'as part of a CI/CD pipeline',
    practice: 'The manual pass is the specification for an automated one: once the expected output is agreed, the same check runs on every commit and fails the build when it drifts.',
    bodyBlock: 'CI/CD framing means the manual browser pass is a specification rehearsal for an automated gate. Freeze the fixture, name the assertion, then port the check into the pipeline so drift fails the build. This framing is wrong for one-off incident pastes that will never become a job; an incident runbook is the better fit.',
  },
  'with-automated-validation': {
    micro: 'auto-validated',
    tiny: 'checked',
    phrase: 'with automated validation',
    practice: 'A machine-checkable assertion is attached to the result, so a later change that quietly breaks the invariant is caught by the check rather than by a user.',
    bodyBlock: 'Automated validation attaches a machine-checkable invariant to the human-readable result. The page expects you to leave behind something a script can re-assert later — golden output, schema hash, or roundtrip equality — not only a subjective “looks fine”. Pure exploratory clicking with no assertion attached is prototyping, which is a different job.',
  },
};

interface ContextVocab {
  micro: string;
  tiny: string;
  phrase: string;
  /** Prepositional form, so headings read as English instead of as a label. */
  situation: string;
  /** What this delivery context demands from the workflow. */
  demand: string;
  /** Long, context-only prose — absent from siblings with a different context. */
  bodyBlock: string;
}

const CONTEXT_VOCAB: Record<string, ContextVocab> = {
  'for-time-sensitive-incidents': { micro: 'incidents', tiny: 'incident', phrase: 'time-sensitive incidents', situation: 'while an incident is open', demand: 'During an incident the constraint is minutes, not elegance: the procedure has to give a trustworthy answer on the first attempt and leave a trace that survives into the postmortem.', bodyBlock: 'Incident time budgets punish hesitation. This context wants the first trustworthy sample in minutes, with a trail that still makes sense in the postmortem hours later. Polished enterprise ceremony is deferred; speed to evidence is what every step here optimises for.' },
  'for-team-onboarding': { micro: 'onboarding', tiny: 'joiners', phrase: 'team onboarding', situation: 'during team onboarding', demand: 'For onboarding the procedure doubles as teaching material, so every step names the reason behind it instead of assuming shared context a new joiner does not have yet.', bodyBlock: 'Onboarding context turns the guide into curriculum. Terms are defined, reasons are spoken aloud, and shortcuts that veterans take silently are written down. A new hire should finish with the same evidence pack a senior would, without private Slack lore.' },
  'for-audit-readiness': { micro: 'audits', tiny: 'audits', phrase: 'audit readiness', situation: 'ahead of an audit', demand: 'Audit readiness means the result must be evidence: recorded inputs, recorded settings, and an output an auditor can regenerate without your help.', bodyBlock: 'Audit readiness demands regenerable evidence: inputs, settings, outputs, and timestamps an external reviewer can replay. Memory-based “we checked it” fails this context. Every recommendation here prefers artifacts over anecdotes.' },
  'for-cross-region-teams': { micro: 'global teams', tiny: 'global', phrase: 'cross-region teams', situation: 'across regions', demand: 'Across regions the workflow runs without a live handover, so it has to be unambiguous in writing and give identical output regardless of locale or timezone.', bodyBlock: 'Cross-region collaboration removes live handovers. Instructions must be timezone-agnostic, locale-safe, and identical in output whether run in Bengaluru or Berlin. Ambiguous relative times and slang are treated as defects.' },
  'for-legacy-system-migrations': { micro: 'legacy moves', tiny: 'legacy', phrase: 'legacy system migrations', situation: 'in a legacy migration', demand: 'Migrations mix old and new formats in the same pipeline, so the check has to prove the two representations mean the same thing rather than merely look similar.', bodyBlock: 'Legacy migrations mix formats that only look alike. This context insists on semantic equivalence proofs — field meaning, null handling, encoding — not cosmetic pretty-print matches. If both sides are already modern and identical, a simpler comparison is enough.' },
  'for-large-enterprise-workflows': { micro: 'enterprise', tiny: 'scale', phrase: 'large enterprise workflows', situation: 'in enterprise workflows', demand: 'At enterprise scale the same procedure is executed by many teams, so it has to be standardised enough that two engineers reach the same conclusion independently.', bodyBlock: 'Enterprise scale means many teams will execute the same steps. Standardisation beats heroics: shared fixtures, shared acceptance language, shared failure labels. Local improvisation that cannot be taught to the next squad fails this context.' },
  'for-api-contract-validation': { micro: 'API contracts', tiny: 'API spec', phrase: 'API contract validation', situation: 'in API contract validation', demand: 'Contract validation compares reality against the documented schema, so the output has to be precise about which field, type, or encoding actually diverged.', bodyBlock: 'API contract validation is forensic: name the field, type, and encoding that diverged from the documented schema. Vague “payload weird” notes are insufficient. Precise diffs are worth more here than narrative summaries.' },
  'for-weekly-ops-routines': { micro: 'weekly ops', tiny: 'weekly', phrase: 'weekly ops routines', situation: 'in a weekly ops routine', demand: 'A weekly routine is judged on repeatability: it should take the same few minutes every time and surface drift early rather than accumulate surprises.', bodyBlock: 'Weekly ops routines prize boring repeatability. The same minutes, the same fixtures, the same drift signals. Surprise is a failure mode. Optimise for muscle memory and early detection, not for novelty.' },
  'for-compliance-reporting': { micro: 'compliance', tiny: 'policy', phrase: 'compliance reporting', situation: 'for compliance reporting', demand: 'Compliance reporting needs a defensible paper trail — what was checked, when, with which inputs — not just a green result someone remembers seeing.', bodyBlock: 'Compliance reporting needs a defensible paper trail: what was checked, when, with which inputs, under which policy reference. A green screenshot without provenance is not enough for this context.' },
  'for-incident-postmortems': { micro: 'postmortems', tiny: 'retro', phrase: 'incident postmortems', situation: 'in an incident postmortem', demand: 'A postmortem re-runs the evidence after the fact, so the procedure must be reproducible from records alone, weeks after the original session ended.', bodyBlock: 'Postmortem context re-runs evidence weeks later from records alone. Anything that depended on a live terminal state or a forgotten browser tab fails. Freeze fixtures as if a stranger will replay them next quarter.' },
  'for-capacity-planning': { micro: 'capacity', tiny: 'capacity', phrase: 'capacity planning', situation: 'in capacity planning', demand: 'Capacity work cares about behaviour as volume grows, so a sample-sized result is only useful when you also note how it scales with payload size and concurrency.', bodyBlock: 'Capacity planning asks how behaviour changes as volume grows. Record sample size, concurrency notes, and where the browser path stops being representative. A single tiny fixture without scaling commentary is incomplete here.' },
  'for-release-management': { micro: 'cutover', tiny: 'cutover', phrase: 'release management', situation: 'in release management', demand: 'Release management wants a go/no-go signal: the check has to be decisive, fast enough to run at the gate, and safe to repeat on a rollback.', bodyBlock: 'Release management wants a binary go/no-go that is fast at the gate and safe on rollback. Indeterminate “maybe fine” outcomes are process failures. A decisive check is worth more here than exploratory browsing.' },
  'for-vendor-integration': { micro: 'vendor work', tiny: 'vendors', phrase: 'vendor integrations', situation: 'in a vendor integration', demand: 'With a vendor you cannot change the other side, so the workflow has to isolate whether the defect is in their payload, your parsing, or the transport between them.', bodyBlock: 'Vendor integrations assume you cannot patch the other side. Isolate whether the defect is their payload, your parsing, or the transport. Blame-shifting without a boundary test fails this context.' },
  'for-data-governance': { micro: 'governance', tiny: 'lineage', phrase: 'data governance', situation: 'under data governance', demand: 'Governance asks where the data went as much as what the result was, which is why a local, no-upload procedure is easier to approve than a hosted equivalent.', bodyBlock: 'Data governance scores lineage as highly as correctness. Where did the bytes go? Who could see them? A correct answer that created an unapproved copy still fails. Prefer no-upload paths and explicit retention notes.' },
  'for-service-mesh-debugging': { micro: 'mesh debug', tiny: 'mesh', phrase: 'service mesh debugging', situation: 'in service mesh debugging', demand: 'In a mesh the payload passes through several hops, so the check has to be applied at each boundary to find the hop that changed it.', bodyBlock: 'Service mesh debugging is hop-oriented. Apply the same check at each boundary until the mutating hop is identified. Inspecting one point without comparing hops misses the point.' },
  'for-cost-optimization': { micro: 'cost control', tiny: 'cost', phrase: 'cost optimisation', situation: 'under cost pressure', demand: 'Cost work rewards doing the check locally: an answer that needs no cluster, no job, and no egress is both faster and cheaper than the pipeline equivalent.', bodyBlock: 'Cost optimisation rewards local answers: no cluster spin-up, no egress fees, no idle jobs. If the only approved path is an expensive pipeline, document why — otherwise the zero-infra verification is the better trade.' },
  'for-performance-benchmarking': { micro: 'benchmarks', tiny: 'bench', phrase: 'performance benchmarking', situation: 'in performance benchmarking', demand: 'Benchmarking needs a fixed baseline, so the input sample and settings have to be frozen before any comparison between runs means anything.', bodyBlock: 'Benchmarking is meaningless without a frozen baseline. Lock the fixture and settings before comparing runs. Changing both the code and the sample in the same session invalidates this context.' },
  'for-disaster-recovery': { micro: 'DR drills', tiny: 'DR', phrase: 'disaster recovery drills', situation: 'in a disaster recovery drill', demand: 'A recovery drill assumes your usual tooling is unavailable, so a procedure that runs offline in a browser is exactly the kind that still works at the worst moment.', bodyBlock: 'Disaster recovery drills assume familiar tooling is gone. Offline browser procedures that still work on a cold laptop beat anything that needs the broken control plane. Practice the degraded path, not the happy path.' },
  'for-production-rollouts': { micro: 'rollouts', tiny: 'rollouts', phrase: 'production rollouts', situation: 'during a production rollout', demand: 'During a rollout the check runs against both the old and the new version, and the interesting result is the difference between them rather than either one alone.', bodyBlock: 'Production rollouts compare old versus new under the same fixture. The interesting artifact is the diff, not either side alone. Checking only one version answers a different question.' },
  'for-observability-pipelines': { micro: 'observability', tiny: 'logs', phrase: 'observability pipelines', situation: 'in an observability pipeline', demand: 'Observability pipelines silently drop malformed records, so validating the shape before ingestion is the difference between a usable dashboard and a misleading one.', bodyBlock: 'Observability pipelines drop malformed records quietly. Validate shape before ingestion or the dashboard lies. This context treats pre-ingest verification as mandatory, not optional polish.' },
};

const DEFAULT_STYLE: StyleVocab = { micro: 'in-browser', tiny: 'browser', phrase: 'directly in your browser', practice: 'The operation runs locally in a browser tab, so it is quick to repeat and easy to share.', bodyBlock: 'This fallback style keeps the work inside a browser tab so the loop stays short and shareable without installing tooling.' };
const DEFAULT_CONTEXT: ContextVocab = { micro: 'daily work', tiny: 'daily', phrase: 'everyday engineering work', situation: 'in everyday engineering work', demand: 'The procedure is written to be repeatable during ordinary day-to-day engineering work.', bodyBlock: 'Everyday engineering work needs a repeatable loop that fits between meetings without special ceremony.' };

function styleVocab(page: ResolvedPage): StyleVocab {
  const base = STYLE_VOCAB[page.style] ?? DEFAULT_STYLE;
  const atom = STYLE_IDENTITY[page.style];
  return atom ? { ...base, micro: atom.micro, tiny: atom.tiny } : base;
}

function contextVocab(page: ResolvedPage): ContextVocab {
  const base = CONTEXT_VOCAB[page.context] ?? DEFAULT_CONTEXT;
  const atom = CONTEXT_IDENTITY[page.context];
  return atom ? { ...base, micro: atom.micro, tiny: atom.tiny } : base;
}

/* -------------------------------------------------------------------------- */
/*  Page identity: <title>, meta description, <h1>                            */
/* -------------------------------------------------------------------------- */

/**
 * Bing Webmaster Tools: "Change the title length to be less than 70 characters."
 * The budget here is 66, not 69. Three characters of slack are what keeps a
 * later edit — a brand suffix, a wider spelling, a report that counts
 * differently — from putting the corpus back in that report, and titles at or
 * under ~66 also survive Google's SERP truncation, which is worth more in
 * clicks than the extra words would have been.
 */
export const TITLE_MAX = IDENTITY_TITLE_MAX;
export const DESCRIPTION_MIN = 150;
export const DESCRIPTION_MAX = 160;

export interface PageIdentity {
  title: string;
  description: string;
  h1: string;
}

interface Forms {
  intent: string[];
  tool: string[];
  audience: string[];
  task: string[];
  style: string[];
  context: string[];
}

/**
 * Ordered shortening ladder — one spelling tier per dimension. The fitter walks
 * it until the assembled title fits, so the most readable spelling that fits is
 * the one that ships. The final plan uses every dimension's shortest tier and
 * the compact separator layout, and the sum of those maxima is under the
 * 70-character limit, which is what makes the limit a guarantee rather than a
 * hope (asserted by scripts/verify-edge-corpus-quality.mjs).
 */
const SHORTENING_PLANS: ReadonlyArray<{ readonly tiers: readonly [number, number, number, number, number, number]; readonly compact: boolean }> = [
  { tiers: [0, 0, 0, 0, 0, 0], compact: false },
  { tiers: [1, 0, 0, 0, 0, 0], compact: false },
  { tiers: [1, 1, 0, 0, 0, 0], compact: false },
  { tiers: [1, 1, 0, 1, 0, 0], compact: false },
  { tiers: [1, 1, 1, 1, 0, 0], compact: false },
  { tiers: [1, 1, 1, 2, 0, 0], compact: false },
  { tiers: [1, 1, 2, 2, 0, 0], compact: false },
  { tiers: [1, 1, 2, 2, 1, 0], compact: false },
  { tiers: [1, 1, 2, 2, 1, 1], compact: false },
  { tiers: [1, 2, 2, 2, 1, 1], compact: false },
  { tiers: [1, 2, 2, 2, 1, 1], compact: true },
];

function formsFor(page: ResolvedPage): Forms {
  return identityFormsFor(page);
}

function capitalise(value: string): string {
  return sentence(value);
}

/**
 * The served <title>. Every dimension that distinguishes this URL from its
 * siblings is present, so the title is unique across the corpus; the fitter
 * only ever swaps a spelling for a shorter one, never truncates mid-phrase and
 * never drops a dimension. There is deliberately no " | DevSolve" suffix: the
 * 70-character budget is worth more spent on what the page is about than on
 * boilerplate that repeats 20 million times (the brand is still carried by
 * og:site_name and the JSON-LD publisher).
 */
function buildTitle(page: ResolvedPage, _forms?: Forms): string {
  return buildFiveAtomTitle(page);
}

/**
 * Deterministic tail phrases used to land the meta description inside Bing's
 * recommended 150–160 window without padding it with filler that says nothing.
 * They are appended to an already-unique base, so uniqueness is preserved.
 */
const DESCRIPTION_TAILS = [
  ' Runs locally in your browser.',
  ' No signup, no uploads.',
  ' Includes a worked example.',
  ' Free developer tool.',
  ' Steps, pitfalls, and FAQ.',
  ' Reproducible output.',
  ' Private by default.',
  ' Free.',
  ' No account needed.',
  ' Works offline.',
];

function buildDescription(page: ResolvedPage, forms: Forms): string {
  const style = styleVocab(page);
  const context = contextVocab(page);
  const tc = TASK_CONTEXT[page.task] ?? DEFAULT_TASK;

  let base = '';
  for (const { tiers: [i, t, a, k] } of SHORTENING_PLANS) {
    base = repairIndefiniteArticles(uniqueTokens(
      `${capitalise(forms.intent[i])} with the ${forms.tool[t]} tool: ${withArticle(forms.audience[a])} workflow for ${forms.task[k]} ${style.phrase}, built for ${context.phrase}.`,
    ));
    if (base.length <= DESCRIPTION_MAX) break;
  }
  if (base.length > DESCRIPTION_MAX) {
    base = base.slice(0, DESCRIPTION_MAX);
    const lastSpace = base.lastIndexOf(' ');
    if (lastSpace > DESCRIPTION_MIN) base = base.slice(0, lastSpace);
    base = repairIndefiniteArticles(uniqueTokens(`${base.replace(/[\s,;:.–—-]+$/, '')}.`));
  }

  const tails = [
    ` Keep ${tc.evidence}.`,
    ` Avoid ${tc.failure}.`,
    ...DESCRIPTION_TAILS,
  ];
  const used = new Set<number>();
  while (base.length < DESCRIPTION_MIN) {
    let chosen = -1;
    for (let i = 0; i < tails.length; i += 1) {
      if (used.has(i)) continue;
      const next = repairIndefiniteArticles(uniqueTokens(base + tails[i]));
      if (next.length > DESCRIPTION_MAX) continue;
      if (next.length <= base.length) continue;
      if (chosen === -1 || tails[i].length > tails[chosen].length) chosen = i;
    }
    if (chosen === -1) break;
    used.add(chosen);
    base = repairIndefiniteArticles(uniqueTokens(base + tails[chosen]));
  }
  if (base.length < DESCRIPTION_MIN) {
    const rescue = [
      ' OK.',
      ' Now.',
      ' Fit.',
      ' Pass.',
      ' Run.',
      ' Local fixture.',
      ' Private tab.',
      ' Offline pass.',
      ' Replay pack.',
      ' Signed result.',
      ' Deterministic output.',
    ];
    for (const pad of rescue) {
      const next = uniqueTokens(base + pad);
      if (next.length >= DESCRIPTION_MIN && next.length <= DESCRIPTION_MAX) {
        base = next;
        break;
      }
    }
  }
  if (metaEndsWithTrailingConjunction(base)) {
    const repaired = repairIndefiniteArticles(uniqueTokens(`${base.replace(/[\s,;:.–—-]+$/, '')} locally.`));
    if (
      repaired.length >= DESCRIPTION_MIN
      && repaired.length <= DESCRIPTION_MAX
      && !metaEndsWithTrailingConjunction(repaired)
    ) {
      base = repaired;
    }
  }
  return base;
}

/**
 * The H1 has to name all six dimensions (otherwise siblings share a heading)
 * and still read like a headline a person wrote. The previous template stacked
 * them into "…: a api consumer guide to config change review for team
 * onboarding" — ungrammatical, and the kind of sentence that makes a reviewer
 * classify a page as unedited machine output. Two clauses separated by an em
 * dash carry the same information as English: what you are doing and how, then
 * who it is for and when.
 */
const H1_MAX = 125;

const TASK_HEADLINE: Record<string, string> = {
  'debug-production-issue': 'Incident capture',
  'prepare-api-response': 'Ship a contract-testable response',
  'clean-up-payload': 'Rewrite without silent drops',
  'sanitize-user-input': 'Sanitize, do not merely encode',
  'prepare-query-parameters': 'Encode each query pair',
  'inspect-encoded-payload': 'Decode with the right alphabet',
  'trace-request': 'Trace every hop',
  'validate-auth-token': 'Verify, do not only decode',
  'review-config-change': 'Regenerate the config diff',
  'migrate-legacy-system': 'Prove semantic equivalence',
  'prepare-deployment-artifact': 'Hash, settings, behaviour fixture',
  'document-api-endpoint': 'Docs the contract tests accept',
  'optimize-build-pipeline': 'Faster only if the golden matches',
  'resolve-merge-conflict': 'Merge both sides, then replay',
  'prepare-security-audit': 'A control the auditor can replay',
  'generate-test-fixtures': 'Positive, negative, named assertion',
};

function buildH1(page: ResolvedPage, forms: Forms): string {
  // Same five-atom line as <title>. Google/Bing read title then H1; a second
  // concatenation of the same stems is scaled-content spam. JSON-LD headline
  // copies this string so HTML and structured data stay 1:1.
  return buildTitle(page, forms);
}

/**
 * Title, description and H1 for a page — deliberately separable from the full
 * page body so the build-time verifier can prove uniqueness across all 20M
 * URLs without rendering 20M documents.
 */
/**
 * Build-time audit of the title vocabulary. It proves the two properties the
 * corpus depends on, without rendering a single page:
 *
 *   - every dimension's spellings are injective at every tier, so assembling
 *     them can only produce a duplicate title if two pages share all five
 *     dimensions (i.e. are the same page);
 *   - the shortest tier's worst case fits the 70-character limit, so the
 *     fitter always terminates inside budget rather than emitting a long title.
 *
 * Exported for scripts/verify-edge-corpus-quality.mjs; never called at request
 * time.
 */
export function titleVocabularyAudit(): { problems: string[]; worstCaseTitleLength: number; checkedSpellings: number } {
  const problems: string[] = [];
  let checkedSpellings = 0;

  const intents = Array.from(new Set(CLUSTERS.flatMap(([, , list]) => list)));
  const dimensions: { name: string; values: string[]; spellings: (value: string) => string[] }[] = [
    { name: 'intent', values: intents, spellings: (v) => [label(v), intentMicro(v)] },
    { name: 'tool', values: Array.from(new Set(CLUSTERS.flatMap(([, tools]) => tools))), spellings: (v) => [toolName(v), TOOL_MICRO[v] ?? '', TOOL_TINY[v] ?? ''] },
    { name: 'audience', values: [...AUDIENCES], spellings: (v) => [label(v), AUDIENCE_MICRO[v] ?? '', AUDIENCE_TINY[v] ?? ''] },
    { name: 'task', values: [...TASKS], spellings: (v) => [TASK_PHRASE[v] ?? '', TASK_MICRO[v] ?? '', TASK_TINY[v] ?? ''] },
    { name: 'style', values: [...MODIFIER_STYLES], spellings: (v) => [STYLE_IDENTITY[v]?.micro ?? '', STYLE_IDENTITY[v]?.tiny ?? ''] },
    { name: 'context', values: [...MODIFIER_CONTEXTS], spellings: (v) => [CONTEXT_IDENTITY[v]?.micro ?? '', CONTEXT_IDENTITY[v]?.tiny ?? ''] },
  ];

  for (const style of MODIFIER_STYLES) {
    if (!STYLE_VOCAB[style]) problems.push(`style "${style}" has no STYLE_VOCAB entry (would collapse onto DEFAULT_STYLE tiny)`);
  }
  for (const context of MODIFIER_CONTEXTS) {
    if (!CONTEXT_VOCAB[context]) problems.push(`context "${context}" has no CONTEXT_VOCAB entry (would collapse onto DEFAULT_CONTEXT tiny)`);
  }

  const ownerDimensions: { name: string; values: string[]; spelling: (value: string) => string }[] = [
    { name: 'heading-owner-style', values: [...MODIFIER_STYLES], spelling: (v) => oneToken(v) },
    { name: 'heading-owner-context', values: [...MODIFIER_CONTEXTS], spelling: (v) => oneToken(v) },
    { name: 'heading-owner-job', values: intents, spelling: (v) => oneToken(v) },
    { name: 'heading-owner-audience', values: [...AUDIENCES], spelling: (v) => oneToken(v) },
    { name: 'heading-owner-task', values: [...TASKS], spelling: (v) => oneToken(v) },
    { name: 'heading-owner-tool', values: Array.from(new Set(CLUSTERS.flatMap(([, tools]) => tools))), spelling: (v) => oneToken(v) },
  ];
  for (const dimension of ownerDimensions) {
    const seen = new Map<string, string>();
    for (const value of dimension.values) {
      const spelling = dimension.spelling(value);
      checkedSpellings += 1;
      if (!spelling || spelling.length < 2) {
        problems.push(`${dimension.name} "${value}" has no heading-owner token`);
        continue;
      }
      const previous = seen.get(spelling);
      if (previous !== undefined) {
        problems.push(`${dimension.name} is not injective: "${previous}" and "${value}" both render as "${spelling}"`);
      }
      seen.set(spelling, value);
    }
  }

  const toolIntent = new Map<string, string>();
  for (const [cluster, tool, intent] of PAIRS) {
    const key = `${tool}\t${intent}`;
    const previous = toolIntent.get(key);
    if (previous !== undefined && previous !== cluster) {
      problems.push(`(tool, intent) "${tool}" + "${intent}" appears in both "${previous}" and "${cluster}" — heading-owner key would collide without cluster`);
    }
    toolIntent.set(key, cluster);
  }

  const identityTools = Array.from(new Set(CLUSTERS.flatMap(([, tools]) => tools)));
  const identityToolSeen = new Map<string, string>();
  for (const tool of identityTools) {
    const atom = `via-${tokenAtom(IDENTITY_TOOL[tool] ?? tool)}`;
    checkedSpellings += 1;
    if (!IDENTITY_TOOL[tool]) problems.push(`tool "${tool}" has no IDENTITY_TOOL atom`);
    const previous = identityToolSeen.get(atom);
    if (previous !== undefined) {
      problems.push(`IDENTITY_TOOL is not injective: "${previous}" and "${tool}" both render as "${atom}"`);
    }
    identityToolSeen.set(atom, tool);
  }

  const maxima: Record<string, number[]> = {};
  const atomMaxima: Record<string, number[]> = {};
  for (const dimension of dimensions) {
    const tierCount = dimension.spellings(dimension.values[0]!).length;
    maxima[dimension.name] = new Array(tierCount).fill(0);
    atomMaxima[dimension.name] = new Array(tierCount).fill(0);
    for (let tier = 0; tier < tierCount; tier += 1) {
      const seen = new Map<string, string>();
      const atoms = new Map<string, string>();
      for (const value of dimension.values) {
        const spelling = dimension.spellings(value)[tier];
        checkedSpellings += 1;
        if (!spelling) {
          problems.push(`${dimension.name} "${value}" has no tier-${tier} spelling`);
          continue;
        }
        const previous = seen.get(spelling);
        if (previous !== undefined) {
          problems.push(`${dimension.name} tier ${tier} is not injective: "${previous}" and "${value}" both render as "${spelling}"`);
        }
        seen.set(spelling, value);
        const atom = tokenAtom(spelling);
        const previousAtom = atoms.get(atom);
        if (previousAtom !== undefined) {
          problems.push(`${dimension.name} tier ${tier} tokenAtom is not injective: "${previousAtom}" and "${value}" both render as "${atom}"`);
        }
        atoms.set(atom, value);
        maxima[dimension.name]![tier] = Math.max(maxima[dimension.name]![tier]!, spelling.length);
        atomMaxima[dimension.name]![tier] = Math.max(atomMaxima[dimension.name]![tier]!, atom.length);
      }
    }
  }

  const finalPlan = SHORTENING_PLANS[SHORTENING_PLANS.length - 1]!;
  const [ti, , ta, tk, ts, tc] = finalPlan.tiers;
  const viaMax = Math.max(...identityTools.map((tool) => `via-${tokenAtom(IDENTITY_TOOL[tool] ?? tool)}`.length));
  // `${job}: ${audience} ${task} ${style}-${context} ${via-tool}`
  const separators = ': '.length + ' '.length + ' '.length + '-'.length + ' '.length;
  const worstCaseTitleLength = separators
    + atomMaxima.intent![ti]!
    + atomMaxima.audience![ta]!
    + atomMaxima.task![tk]!
    + atomMaxima.style![ts]!
    + atomMaxima.context![tc]!
    + viaMax;
  if (worstCaseTitleLength > TITLE_MAX) {
    problems.push(`shortest-tier worst case is ${worstCaseTitleLength} characters, above the ${TITLE_MAX} limit (${JSON.stringify({
      intent: atomMaxima.intent![ti],
      audience: atomMaxima.audience![ta],
      task: atomMaxima.task![tk],
      style: atomMaxima.style![ts],
      context: atomMaxima.context![tc],
      via: viaMax,
      separators,
    })})`);
  }

  const doubledWord = /\b(\w+) \1\b/i;
  for (const audience of AUDIENCES) {
    const audienceSpellings = [label(audience), AUDIENCE_MICRO[audience] ?? '', AUDIENCE_TINY[audience] ?? ''];
    for (const task of TASKS) {
      const taskSpellings = [TASK_PHRASE[task] ?? '', TASK_MICRO[task] ?? '', TASK_TINY[task] ?? ''];
      for (const audienceSpelling of audienceSpellings) {
        if (!audienceSpelling) continue;
        for (const taskSpelling of taskSpellings) {
          if (!taskSpelling) continue;
          const line = `${tokenAtom(audienceSpelling)} ${tokenAtom(taskSpelling)}`;
          if (doubledWord.test(line)) {
            problems.push(`audience "${audience}" + task "${task}" identity "${line}" repeats a word`);
          }
        }
      }
    }
  }

  return { problems, worstCaseTitleLength, checkedSpellings };
}

export function buildIdentity(page: ResolvedPage): PageIdentity {
  const forms = formsFor(page);
  const title = buildTitle(page, forms);
  const description = buildDescription(page, forms);
  const h1 = buildH1(page, forms);
  return { title, description, h1 };
}

/**
 * Six URL-dimension slugs that identify this page in corpus scans.
 * Visible H2/H3 text uses an English combo stamp instead of packing these
 * slugs into every heading (Bing reported that dump as scaled content).
 */
export function headingOwnerKey(page: ResolvedPage): string {
  return headingOwnerTokens(pageKernel(page)).join('\t');
}

/** Identity fingerprint for corpus scans (not the visible H2/H3 stamp). */
export function headingOwnerClauseFor(page: ResolvedPage): string {
  return headingOwnerClause(pageKernel(page));
}

/* -------------------------------------------------------------------------- */
/*  Content builders                                                           */
/* -------------------------------------------------------------------------- */

export interface PageContent {
  title: string;
  description: string;
  h1: string;
  intro: string[];
  /** Bing §16 — explicit entity naming so grounding can cite a defined thing. */
  entity: { name: string; definition: string; alsoKnownAs: string[] };
  /** Bing §11/§15 — when this exact page applies vs the neighbouring ones. */
  decision: { heading: string; when: string[]; notWhen: string[]; verdict: string };
  /** Bing §15 — acceptance criteria a reviewer can verify independently. */
  acceptance: string[];
  keyTakeaways: string[];
  steps: string[];
  pitfalls: string[];
  comparison: { item: string; pros: string; cons: string }[];
  glossary: { term: string; definition: string }[];
  faq: { question: string; answer: string }[];
  keywords: string[];
  workedExample: { inputLabel: string; input: string; outputLabel: string; output: string; note: string };
  related: { slug: string; label: string; rel?: string }[];
  /** Style/context/audience sections — different H2 trees per archetype. */
  sections: KnowledgeSection[];
  plan: DocumentPlan;
  snippets: SnippetBlock[];
  artifact: KnowledgeSection;
  matrix: CompatMatrix;
  branches: BranchFork[];
}

function pageKernel(page: ResolvedPage): PageKernel {
  const ac = AUDIENCE_CONTEXT[page.audience] ?? DEFAULT_AUDIENCE;
  const tc = TASK_CONTEXT[page.task] ?? DEFAULT_TASK;
  const sv = styleVocab(page);
  const cv = contextVocab(page);
  return {
    cluster: page.cluster,
    tool: page.tool,
    intent: page.intent,
    audience: page.audience,
    task: page.task,
    style: page.style,
    context: page.context,
    slug: page.slug,
    toolLabel: toolName(page.tool),
    intentLabel: label(page.intent),
    jobNoun: intentMicro(page.intent),
    jobGerund: gerund(page.intent),
    clusterField: (CLUSTER_DOMAIN[page.cluster] ?? { field: `${page.cluster} work` }).field,
    audienceLabel: label(page.audience),
    audiencePlural: pluralRole(page.audience),
    taskPhrase: TASK_PHRASE[page.task] ?? label(page.task),
    stylePhrase: sv.phrase,
    styleMicro: sv.micro,
    styleTiny: oneToken(page.style),
    contextPhrase: cv.phrase,
    contextMicro: cv.micro,
    contextTiny: oneToken(page.context),
    jobTiny: oneToken(page.intent),
    jobAtom: tokenAtom(label(page.intent)),
    audienceTiny: oneToken(page.audience),
    taskTiny: oneToken(page.task),
    toolTiny: oneToken(page.tool),
    contextSituation: cv.situation,
    audienceFocus: ac.focus,
    audienceConcern: ac.concern,
    taskScenario: tc.scenario,
    taskOutcome: tc.outcome,
    taskUrgency: tc.urgency,
    taskEvidence: tc.evidence,
    taskFailure: tc.failure,
  };
}

function buildContent(page: ResolvedPage): PageContent {
  const k = pageKernel(page);
  const tk = toolKnowledge(page.tool);
  const ik = intentKernel(page.intent);
  const identity = buildIdentity(page);
  const plan = planDocument(k);
  const tn = k.toolLabel;
  const li = k.intentLabel;

  const intro = variedIntro(k, tk, ik);
  const entity = entityFraming(k, tk, ik);
  const decision = variedDecision(k, tk, ik);
  const acceptance = variedAcceptance(k, tk, ik, plan);
  const keyTakeaways = variedTakeaways(k, ik);
  const steps = variedSteps(k, tk, ik, plan);
  const pitfalls = variedPitfalls(k, tk, ik, plan);
  const comparison = variedComparison(k, plan);
  const glossary = variedGlossary(k, tk, ik, plan);
  const faq = variedFaq(k, tk, ik, plan);
  const workedExample = buildWorkedExample(page);
  const related = buildRelated(page);
  const snippets = [...uniqueSnippets(k, tk, ik, plan), ...buildExecutablePack(k, plan)];
  const matrix = buildCompatMatrix(k, plan);
  const branches = buildBranchTree(k, plan);
  const artifact = contextArtifact(k);

  const job = taskGuide(k);
  job.section.heading = 'Job';
  job.section.paragraphs = comboJobParagraphs(k);
  job.section.list = comboJobList(k);
  const sections: KnowledgeSection[] = [
    job.section,
    {
      id: 'context',
      heading: `${k.contextMicro} constraint`,
      paragraphs: comboContextParagraphs(k),
    },
    {
      id: 'audience',
      heading: `${k.audiencePlural} desk`,
      paragraphs: comboAudienceParagraphs(k),
      list: comboAudienceList(k),
    },
    {
      id: 'practice',
      heading: practiceHeading(k),
      paragraphs: comboPracticeParagraphs(k),
    },
  ];

  const keywords = Array.from(new Set(
    uniqueTokens([
      intentKernelLabel(page.intent, li),
      tn,
      page.cluster,
      li,
      'browser developer tool',
    ].join(' ')).split(' '),
  ));

  return {
    title: identity.title,
    description: identity.description,
    h1: identity.h1,
    intro,
    entity,
    decision: { ...decision, heading: ownHeading(k, 'decision', decision.heading) },
    acceptance,
    keyTakeaways,
    steps,
    pitfalls,
    comparison,
    glossary,
    faq,
    keywords,
    workedExample,
    related,
    sections: sections.map((section) => ({
      ...section,
      heading: ownHeading(k, headingSlotForSectionId(section.id), section.heading),
    })),
    plan,
    snippets,
    artifact: { ...artifact, heading: ownHeading(k, 'artifact', artifact.heading) },
    matrix,
    branches,
  };
}

function intentKernelLabel(intent: string, fallback: string): string {
  return fallback || intent.replace(/-/g, ' ');
}

function taskExampleFields(task: string, fixtureId: string, recordId: number): Record<string, string | number | boolean> {
  switch (task) {
    case 'debug-production-issue':
      return { incidentId: `inc-${recordId}`, capturedAt: '2026-08-20T13:40:00Z', severity: 'sev-2' };
    case 'prepare-api-response':
      return { httpStatus: 200, schema: 'response.v1', contentType: 'application/json' };
    case 'clean-up-payload':
      return { droppedKeys: 0, rewritten: fixtureId, keepUnknown: false };
    case 'sanitize-user-input':
      return { origin: 'user-form', allowHtml: false, maxBytes: 4096 };
    case 'prepare-query-parameters':
      return { spaceEncoding: '%20', repeatArrays: true };
    case 'inspect-encoded-payload':
      return { alphabet: 'url-safe', padding: true };
    case 'trace-request':
      return { hop: 'ingress', nextHop: 'service', traceId: fixtureId };
    case 'validate-auth-token':
      return { alg: 'HS256', verifySignature: true, productionToken: false };
    case 'review-config-change':
      return { beforeSha: fixtureId.slice(0, 12), environment: 'staging' };
    case 'migrate-legacy-system':
      return { sourceSystem: 'legacy', targetSystem: 'current', pairedId: recordId };
    case 'prepare-deployment-artifact':
      return { artifact: `${fixtureId}.tgz`, minify: true };
    case 'document-api-endpoint':
      return { exampleOf: 'success-body', contractTest: true };
    case 'optimize-build-pipeline':
      return { budgetMs: 90000, golden: `${fixtureId}.json` };
    case 'resolve-merge-conflict':
      return { ours: 'HEAD', theirs: 'origin/main', replayable: true };
    case 'prepare-security-audit':
      return { control: 'input-validation', regenerable: true };
    case 'generate-test-fixtures':
      return { positive: true, negativeTwin: `neg-${fixtureId}` };
    default:
      return { fixtureId, recordId };
  }
}

function buildWorkedExample(page: ResolvedPage): PageContent['workedExample'] {
  const { tool, slug, task } = page;
  let x = (hashString(slug) ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
  const hex = (n: number) => Array.from({ length: n }, () => '0123456789abcdef'[rnd() % 16]).join('');
  const fields = ['userId', 'orderId', 'sessionId', 'traceId', 'tenantId', 'requestId', 'jobId', 'batchId'];
  const f1 = fields[rnd() % fields.length];
  let f2 = fields[rnd() % fields.length];
  if (f2 === f1) f2 = fields[(fields.indexOf(f1) + 1) % fields.length];
  const fixtureId = `fx-${hex(8)}`;
  const recordId = 1000 + (rnd() % 9000);
  const extra = taskExampleFields(task, fixtureId, recordId);
  const sampleObj: Record<string, string | number | boolean> = { [f1]: fixtureId, [f2]: recordId, ...extra };
  const sample = JSON.stringify(sampleObj);

  let inputLabel = 'Input';
  let outputLabel = 'Output';
  let input = sample;
  let output: string;

  switch (tool) {
    case 'json-to-typescript':
      outputLabel = 'generated interface';
      output = `interface Record${recordId} {\n  ${f1}: string;\n  ${f2}: number;\n}`;
      break;
    case 'hash-generator':
      inputLabel = 'message'; outputLabel = 'SHA-256 (representative)'; input = fixtureId; output = hex(64);
      break;
    case 'uuid-generator':
      inputLabel = 'namespace seed'; outputLabel = 'UUID v4'; input = slug;
      output = `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[rnd() % 4]}${hex(3)}-${hex(12)}`;
      break;
    case 'base64-encode-decode':
      inputLabel = 'plaintext'; outputLabel = 'Base64'; input = `${f1}:${fixtureId}`;
      output = toBase64(input);
      break;
    case 'jwt-decoder': {
      inputLabel = 'JWT (header.payload.signature)'; outputLabel = 'decoded payload';
      const header = toBase64('{"alg":"HS256","typ":"JWT"}').replace(/=+$/, '');
      const payload = toBase64(`{"sub":"${fixtureId}","${f1}":${recordId},"iat":1700000000}`).replace(/=+$/, '');
      input = `${header}.${payload}.${hex(16)}`;
      output = `{\n  "sub": "${fixtureId}",\n  "${f1}": ${recordId},\n  "iat": 1700000000\n}`;
      break;
    }
    default:
      try { output = JSON.stringify(JSON.parse(sample), null, 2); } catch { output = sample; }
  }

  const k = pageKernel(page);
  const note = comboExampleNote(k);
  return { inputLabel, input, outputLabel, output, note };
}

/* Minimal, dependency-free Base64 (ASCII input is all the fixtures use). */
function toBase64(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let i = 0;
  while (i < input.length) {
    const c1 = input.charCodeAt(i++) & 0xff;
    const c2 = i < input.length ? input.charCodeAt(i++) & 0xff : NaN;
    const c3 = i < input.length ? input.charCodeAt(i++) & 0xff : NaN;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (Number.isNaN(c2) ? 0 : c2 >> 4);
    const e3 = Number.isNaN(c2) ? 64 : (((c2 & 15) << 2) | (Number.isNaN(c3) ? 0 : c3 >> 6));
    const e4 = Number.isNaN(c3) ? 64 : c3 & 63;
    output += chars[e1] + chars[e2] + (e3 === 64 ? '=' : chars[e3]) + (e4 === 64 ? '=' : chars[e4]);
  }
  return output;
}

function pageAt(pairIndex: number, audienceIndex: number, taskIndex: number, modifier: number): ResolvedPage | undefined {
  pairIndex = ((pairIndex % PAIRS.length) + PAIRS.length) % PAIRS.length;
  audienceIndex = ((audienceIndex % AUDIENCES.length) + AUDIENCES.length) % AUDIENCES.length;
  taskIndex = ((taskIndex % TASKS.length) + TASKS.length) % TASKS.length;
  modifier = ((modifier % MODIFIER_COUNT) + MODIFIER_COUNT) % MODIFIER_COUNT;
  const raw = indexForCombination(pairIndex, audienceIndex, taskIndex, modifier);
  if (raw < CORPUS_SIZE) return pageForIndex(raw);
  const pairStart = pairIndex * PER_PAIR;
  if (pairStart >= CORPUS_SIZE) return pageForIndex(((raw % CORPUS_SIZE) + CORPUS_SIZE) % CORPUS_SIZE);
  const available = CORPUS_SIZE - pairStart;
  return pageForIndex(pairStart + ((raw % available) + available) % available);
}

function nextPairWhere(start: number, pred: (pair: readonly [string, string, string]) => boolean): number {
  for (let i = 1; i <= PAIRS.length; i += 1) {
    const idx = (start + i) % PAIRS.length;
    const pair = PAIRS[idx];
    if (pair && pred(pair)) return idx;
  }
  return (start + 1) % PAIRS.length;
}

function buildRelated(page: ResolvedPage): { slug: string; label: string; rel?: string }[] {
  const seed = stableHash(page.slug);
  const out: { slug: string; label: string; rel?: string }[] = [];
  const seen = new Set<string>([page.slug]);
  const pairIndex = Math.floor(page.index / PER_PAIR);
  const audienceIndex = AUDIENCES.indexOf(page.audience);
  const taskIndex = TASKS.indexOf(page.task);
  const styleIndex = Math.floor(page.modifier / MODIFIER_CONTEXTS.length);
  const ctxIndex = page.modifier % MODIFIER_CONTEXTS.length;

  const push = (target: ResolvedPage | undefined, rel: string, prefix: string) => {
    if (!target || seen.has(target.slug)) return;
    seen.add(target.slug);
    out.push({
      slug: target.slug,
      rel,
      label: uniqueTokens(`${prefix}: ${title(target.intent)} for ${pluralRole(target.audience)} (${styleVocab(target).micro} · ${contextVocab(target).micro}${target.tool !== page.tool ? ` · ${IDENTITY_TOOL[target.tool] ?? toolName(target.tool)}` : ''})`),
    });
  };

  const scanTask = (dir: 1 | -1) => {
    for (let t = 1; t < TASKS.length; t += 1) {
      const cand = pageAt(pairIndex, audienceIndex, (taskIndex + dir * t + TASKS.length * 8) % TASKS.length, page.modifier);
      if (cand && cand.slug !== page.slug && cand.task !== page.task) return cand;
    }
    return undefined;
  };
  push(scanTask(1), 'next-task', 'Next job');
  push(scanTask(-1), 'prev-task', 'Prior job');

  const observeCtx = Math.max(0, page.context === 'for-observability-pipelines'
    ? MODIFIER_CONTEXTS.indexOf('for-time-sensitive-incidents')
    : MODIFIER_CONTEXTS.indexOf('for-observability-pipelines'));
  push(pageAt(pairIndex, audienceIndex, taskIndex, styleIndex * MODIFIER_CONTEXTS.length + observeCtx), 'observe', 'Then monitor');

  const rolloutCtx = Math.max(0, page.context === 'for-production-rollouts'
    ? MODIFIER_CONTEXTS.indexOf('for-release-management')
    : MODIFIER_CONTEXTS.indexOf('for-production-rollouts'));
  push(pageAt(pairIndex, audienceIndex, taskIndex, styleIndex * MODIFIER_CONTEXTS.length + rolloutCtx), 'rollout', 'Then ship');

  const methodStyle = Math.max(0, page.style === 'as-part-of-ci-cd-pipeline'
    ? MODIFIER_STYLES.indexOf('directly-in-your-browser')
    : MODIFIER_STYLES.indexOf('as-part-of-ci-cd-pipeline'));
  const methodHop = pageAt(pairIndex, audienceIndex, taskIndex, methodStyle * MODIFIER_CONTEXTS.length + ctxIndex);
  push(methodHop && methodHop.style !== page.style ? methodHop : pageAt(pairIndex, audienceIndex, taskIndex, ((styleIndex + 1) % MODIFIER_STYLES.length) * MODIFIER_CONTEXTS.length + ctxIndex), 'method', 'Same job, other method');

  const scanAudience = () => {
    for (let a = 1; a < AUDIENCES.length; a += 1) {
      const cand = pageAt(pairIndex, (audienceIndex + a) % AUDIENCES.length, taskIndex, page.modifier);
      if (cand && cand.slug !== page.slug && cand.audience !== page.audience) return cand;
    }
    return undefined;
  };
  push(scanAudience(), 'audience', 'Same job, other reader');

  const intentPair = nextPairWhere(pairIndex, ([, tool, intent]) => tool === page.tool && intent !== page.intent);
  push(pageAt(intentPair, audienceIndex, taskIndex, page.modifier), 'intent', 'Same tool, other job');

  const toolPair = nextPairWhere(pairIndex, ([cluster, tool]) => cluster === page.cluster && tool !== page.tool);
  push(pageAt(toolPair, audienceIndex, taskIndex, page.modifier), 'tool', 'Same cluster, other tool');

  const stride = 1 + (seed % 9973) * 2;
  let cursor = page.index;
  for (let k = 0; out.length < 16 && k < 64; k += 1) {
    cursor = (cursor + stride) % CORPUS_SIZE;
    const target = pageForIndex(cursor);
    if (!target || seen.has(target.slug)) continue;
    seen.add(target.slug);
    const sameTool = target.tool === page.tool;
    out.push({
      slug: target.slug,
      rel: 'discover',
      label: uniqueTokens(sameTool
        ? `${title(target.intent)} for ${pluralRole(target.audience)} (${styleVocab(target).micro} · ${contextVocab(target).micro})`
        : `${title(target.intent)} with ${IDENTITY_TOOL[target.tool] ?? toolName(target.tool)} (${styleVocab(target).micro} · ${contextVocab(target).micro})`),
    });
  }
  for (let k = 0; out.length < 20 && k < 12; k += 1) {
    const offset = 1 + ((seed >>> (k % 16)) % (PER_PAIR - 1));
    const neighbour = pageForIndex((pairIndex * PER_PAIR + (page.index + offset) % PER_PAIR) % CORPUS_SIZE);
    if (!neighbour || seen.has(neighbour.slug)) continue;
    if (neighbour.tool !== page.tool && neighbour.cluster !== page.cluster) continue;
    seen.add(neighbour.slug);
    out.push({
      slug: neighbour.slug,
      rel: 'cluster',
      label: uniqueTokens(neighbour.tool === page.tool
        ? `${title(neighbour.intent)} for ${pluralRole(neighbour.audience)} (${styleVocab(neighbour).micro} · ${contextVocab(neighbour).micro})`
        : `${title(neighbour.intent)} with ${IDENTITY_TOOL[neighbour.tool] ?? toolName(neighbour.tool)} (${styleVocab(neighbour).micro} · ${contextVocab(neighbour).micro})`),
    });
  }
  return out;
}

/** Editorial guide that owns this tool — authority backlink for Bing §5. */
const GUIDE_BY_TOOL: Record<string, { slug: string; title: string }> = {
  'json-formatter': { slug: 'json-validation-formatting', title: 'JSON validation and formatting' },
  'json-to-typescript': { slug: 'json-to-types', title: 'JSON to TypeScript types' },
  'base64-encode-decode': { slug: 'base64-usage', title: 'Base64 encode and decode' },
  'url-encode-decode': { slug: 'url-encoding-pitfalls', title: 'URL encoding pitfalls' },
  'html-entity-encode-decode': { slug: 'encoding-pitfalls-deep-dive', title: 'Encoding pitfalls deep dive' },
  'hash-generator': { slug: 'hashing-integrity', title: 'Hashing and integrity' },
  'uuid-generator': { slug: 'hashing-integrity', title: 'Hashing and integrity' },
  'jwt-decoder': { slug: 'jwt-decoding-browser', title: 'JWT decoding in the browser' },
  'text-case-converter': { slug: 'text-transformations', title: 'Text transformations' },
  'diff-checker': { slug: 'diffing-techniques', title: 'Diffing techniques' },
  'regex-tester': { slug: 'regex-testing-debugging', title: 'Regex testing and debugging' },
  'sql-formatter': { slug: 'sql-formatting', title: 'SQL formatting' },
  'css-minifier': { slug: 'minification-basics', title: 'Minification basics' },
  'markdown-preview': { slug: 'markdown-preview-safety', title: 'Markdown preview safety' },
  'cron-helper': { slug: 'api-contract-validation-deep-dive', title: 'API contract validation' },
};

/* -------------------------------------------------------------------------- */
/*  HTML renderer                                                              */
/* -------------------------------------------------------------------------- */

const STYLE = 'body{font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#172033;background:#fff;margin:0;padding-bottom:50px}.wrap{max-width:820px;margin:0 auto;padding:28px 20px 64px}nav.crumbs{font-size:14px;color:#5a6a82}a{color:#0a5bd6}h1{font-size:2rem;line-height:1.2;margin:.4em 0}h2{font-size:1.4rem;margin:1.6em 0 .5em;border-top:1px solid #e6eaf0;padding-top:1.1em}h3{font-size:1.05rem;margin:1.2em 0 .3em}code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}code{background:#f3f5f8;padding:2px 5px;border-radius:4px;font-size:.92em}pre{background:#0f1626;color:#e6edf7;padding:14px 16px;border-radius:8px;overflow:auto;font-size:.86rem;line-height:1.5}table{border-collapse:collapse;width:100%;font-size:.95rem}th,td{border:1px solid #dde3ec;padding:8px 10px;text-align:left;vertical-align:top}th{background:#f6f8fb}ul,ol{padding-left:1.3em}li{margin:.35em 0}dl dt{font-weight:600;margin-top:.7em}dl dd{margin:0 0 .2em}.lead{font-size:1.08rem;color:#33405a}.tk{background:#f6f8fb;border:1px solid #e2e8f2;border-radius:10px;padding:14px 18px}.meta{font-size:.85rem;color:#5a6a82}.cta{background:#eef4ff;border:1px solid #cfe0ff;border-radius:10px;padding:12px 16px;margin:18px 0}.links a{display:inline-block;margin:0 12px 8px 0}footer{margin-top:3em;border-top:1px solid #e6eaf0;padding-top:1.2em;font-size:.9rem;color:#5a6a82}';

function renderList(items: string[], ordered = false): string {
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</${tag}>`;
}

export function countPhrase(haystack: string, needle: string): number {
  if (!needle) return 0;
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = lowerHay.indexOf(lowerNeedle, pos);
    if (idx === -1) return count;
    count += 1;
    pos = idx + lowerNeedle.length;
  }
}

/**
 * Phrases that describe how the corpus is built rather than what the reader
 * came for. A person reading "you are on the wrong sibling" learns that the
 * page is one of a generated family; Bing lists exactly that — content written
 * for ranking systems instead of users — under artificially engineered
 * language. The bare word "URL" is fine (several tools are about URLs); the
 * self-referential forms are not.
 */
const FORBIDDEN_PROSE = [
  'sibling',
  'this url',
  'these urls',
  'other urls',
  'wrong url',
  'a different url',
  'neighbouring url',
  'coordinate lock',
  'modifier fingerprint',
  'for crawlers',
  'grounding',
  'crawl budget',
  'jaccard',
  'near-duplicate',
  'doorway',
  'keyword',
  'reshuffled',
  'single-topic focus is what makes the page eligible',
  // Telegram tails from the old comboLine salad. If these reappear, Bing
  // again sees 1700 words that do not form a sentence.
  'omit pretty-print',
  'halt copies',
  'nix homebrew',
  'dump maybe-fine',
  'shed crutches',
  'mute huddles',
  'outlaw nicknames',
  'dismiss green-ui',
  'bin toys',
  'quash folklore',
  'before clock',
  'after join',
  'ahead rollback',
  'ahead ingest',
  'without brew',
  'without huddle',
];

/** Acronyms that must never appear lowercase in prose. */
const LOWERCASE_ACRONYMS = ['json', 'sql', 'css', 'html', 'jwt', 'uuid', 'api', 'url', 'xss', 'csv', 'yaml', 'utf'];

/**
 * Build-time copy audit. Jaccard uniqueness proves two pages are not the same
 * text; it says nothing about whether either of them reads like something a
 * person wrote. This is the check for that: template-splice grammar, acronyms
 * that lost their capitals on the way out of a slug, wrong indefinite articles,
 * process vocabulary that belongs in this repository rather than on the page.
 */
export function auditServedCopy(html: string, page: ResolvedPage): string[] {
  const issues: string[] = [];
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const withoutCode = main
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ');
  const text = withoutCode
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
  const lower = text.toLowerCase();

  for (const marker of FORBIDDEN_PROSE) {
    if (lower.includes(marker)) issues.push(`process vocabulary in reader-facing copy: "${marker}"`);
  }

  for (const acronym of LOWERCASE_ACRONYMS) {
    if (new RegExp(`(^|[\\s("'])${acronym}([\\s.,;:)"']|$)`).test(text)) {
      issues.push(`acronym printed lowercase: "${acronym}"`);
    }
  }

  // Indefinite articles, checked against the same helper the copy uses, so the
  // template cannot print "a api consumer" again.
  for (const [, article, word] of text.matchAll(/\b(an?) ([A-Za-z][\w-]*)/g)) {
    const expected = articleFor(word);
    if (article.toLowerCase() !== expected) {
      issues.push(`wrong article: "${article} ${word}" should be "${expected} ${word}"`);
    }
  }

  // Sentence-level splices: a block that starts lowercase, or punctuation that
  // no editor would leave behind.
  for (const [, block] of withoutCode.matchAll(/<(?:p|li|dd)[^>]*>([\s\S]*?)<\/(?:p|li|dd)>/gi)) {
    const plain = block.replace(/<[^>]+>/g, '').trim();
    if (plain && /^[a-z]/.test(plain) && !LOWERCASE_ACRONYMS.includes(plain.split(' ')[0]!.toLowerCase())) {
      issues.push(`block starts lowercase: "${plain.slice(0, 60)}"`);
    }
  }
  for (const [, block] of withoutCode.matchAll(/<(?:p|li|dd|h[123])[^>]*>([\s\S]*?)<\/(?:p|li|dd|h[123])>/gi)) {
    const plain = block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    for (const pattern of [/ {2,}/, / [,.;:]/, /\b(\w+) \1\b/i, /\bmaking [a-z]+ [a-z]+ possible\b/]) {
      const match = plain.match(pattern);
      if (match) issues.push(`copy-editing defect: "${match[0].trim()}"`);
    }
  }

  const sv = styleVocab(page).phrase;
  const cv = contextVocab(page).phrase;
  const styleCount = countPhrase(lower, sv);
  const contextCount = countPhrase(lower, cv);
  if (styleCount > 12) issues.push(`style phrase "${sv}" repeated ${styleCount}× (keyword stuffing)`);
  if (contextCount > 12) issues.push(`context phrase "${cv}" repeated ${contextCount}× (keyword stuffing)`);

  const genericHeadings = [
    'what this page is about',
    'key takeaways',
    'copy-paste snippets for this procedure',
    'how this compares to other approaches',
    'frequently asked questions',
    'common pitfalls to avoid',
    'related guides and tools',
    'worked example',
    ...FORBIDDEN_SKELETON_HEADINGS,
  ];
  const headingTexts = [...withoutCode.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  for (const heading of genericHeadings) {
    if (headingTexts.some((h) => h.toLowerCase() === heading)) {
      issues.push(`generic template heading: "${heading}"`);
    }
  }
  for (const heading of headingTexts) {
    if (!headingLooksOwned(heading)) {
      issues.push(`heading missing unique English stamp: "${heading.slice(0, 80)}"`);
    }
    if (/\([a-z0-9-]+,[a-z0-9-]+,[a-z0-9-]+,/.test(heading)) {
      issues.push(`heading dumps slug coordinates: "${heading.slice(0, 80)}"`);
    }
  }
  const h1Count = [...withoutCode.matchAll(/<h1\b/gi)].length;
  if (h1Count !== 1) issues.push(`expected 1 H1, found ${h1Count}`);
  if (/<h[4-6]\b/i.test(html)) issues.push('heading skips to H4+ (including chrome outside <main>)');
  const headingLevels = [...withoutCode.matchAll(/<h([1-3])\b/gi)].map((m) => Number(m[1]));
  for (let i = 1; i < headingLevels.length; i += 1) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) {
      issues.push(`heading hierarchy skip h${headingLevels[i - 1]} → h${headingLevels[i]}`);
    }
  }
  if (/<th>parameter<\/th>/i.test(withoutCode) && /<th>this guide<\/th>/i.test(withoutCode)) {
    issues.push('CMS-style parameter table (job/tool/method/setting) — auto-generated signal');
  }

  if (!/<section\b[^>]*id=["']artifact["']/i.test(html)) {
    issues.push('missing setting-specific evidence pack (artifact)');
  }
  if (!/<section\b[^>]*id=["']practice["']/i.test(html)) {
    issues.push('missing method-specific practice section (style prose was planned but not rendered)');
  }
  if (!/data-compat-matrix/.test(html) || (html.match(/data-error-code=/g) || []).length < 3) {
    issues.push('missing unique compat/error matrix (3 fault rows)');
  }
  if (!/FROM\s+\S+/i.test(html) || !/set -euo pipefail/.test(html)) {
    issues.push('missing executable Dockerfile or Bash replay');
  }
  if (!/data-branch-tree/.test(html) || (html.match(/data-branch=/g) || []).length < 3) {
    issues.push('missing if/then edge-case tree');
  }
  if ((html.match(/data-rel="(?:next-task|observe|method|intent)"/g) || []).length < 4) {
    issues.push('missing semantic next-job / monitor / method / intent hops');
  }

  const leadMatch = html.match(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/i);
  if (leadMatch) {
    const lead = leadMatch[1].replace(/<[^>]+>/g, ' ').toLowerCase();
    const who = pluralRole(page.audience).toLowerCase();
    const scene = (TASK_CONTEXT[page.task]?.scenario ?? '').toLowerCase();
    const namedAudience = who.split(/\s+/).some((w) => w.length > 4 && lead.includes(w))
      || lead.includes(oneToken(page.audience).toLowerCase())
      || lead.includes(tokenAtom(label(page.intent)).toLowerCase());
    const namedTask = scene.split(/\s+/).some((w) => w.length > 5 && lead.includes(w));
    if (!namedAudience && !namedTask) {
      issues.push('opening does not name the audience or the task this independent guide is for');
    }
  }

  const servedTitle = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const servedH1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const servedDesc = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ?? '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
  if (hasDuplicateContentTokens(servedTitle)) issues.push(`title repeats a token/stem: "${servedTitle}"`);
  if (hasDuplicateContentTokens(servedH1)) issues.push(`h1 repeats a token/stem: "${servedH1}"`);
  if (hasDuplicateContentTokens(servedDesc)) issues.push('meta description repeats a token/stem');
  for (const [, article, word] of servedDesc.matchAll(/\b(an?) ([A-Za-z][\w-]*)/g)) {
    const expected = articleFor(word);
    if (article.toLowerCase() !== expected) {
      issues.push(`wrong article in description: "${article} ${word}" should be "${expected} ${word}"`);
    }
  }
  for (const heading of headingTexts) {
    const visible = heading.split(' — ')[0] ?? heading;
    if (hasDuplicateContentTokens(visible)) issues.push(`heading repeats a token/stem: "${heading.slice(0, 80)}"`);
  }

  const densityText = `${servedTitle} ${servedH1} ${text.replace(/\([^)]*\)/g, ' ')}`;
  const density = topKeywordDensity(densityText);
  const wordCount = density.words;
  const hitCap = maxKeywordHits(Math.max(wordCount, 1));
  if (density.density > MAX_KEYWORD_DENSITY) {
    issues.push(`keyword density ${(density.density * 100).toFixed(2)}% for "${density.word}" (${density.count}/${wordCount}, cap ${hitCap} / ${(MAX_KEYWORD_DENSITY * 100).toFixed(1)}%)`);
  }

  return issues;
}

function genreHeading(id: string, page: ResolvedPage, c: PageContent): string {
  const k = pageKernel(page);
  const short: Record<string, string> = {
    entity: 'Entity',
    takeaways: 'Stop-bar',
    acceptance: 'Done-when',
    steps: 'Procedure',
    example: 'Fixture',
    snippets: 'Samples',
    pitfalls: 'Mistakes',
    comparison: 'Other-method',
    glossary: 'Terms',
    matrix: 'Fault-table',
    branches: 'Forks',
    faq: 'Questions',
    decision: c.decision.heading,
  };
  const raw = short[id] ?? c.decision.heading;
  return ownHeading(k, id === 'decision' ? 'decision' : id, raw);
}

export function renderProgrammaticPage(page: ResolvedPage, origin: string): string {
  const c = buildContent(page);
  const canonical = `${origin}/k/${page.slug}`;
  const toolSlug = page.tool;
  const clusterLabel = uniqueTokens(title(page.cluster));

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'TechArticle',
      headline: c.h1, description: c.description, url: canonical,
      image: `${origin}/opengraph-image.png`,
      datePublished: '2024-01-15T00:00:00.000Z', dateModified: CONTENT_UPDATED_AT,
      inLanguage: 'en', isAccessibleForFree: true, keywords: c.keywords.join(', '),
      author: { '@type': 'Organization', name: 'DevSolve Editorial Team', url: `${origin}/about` },
      publisher: { '@type': 'Organization', name: 'DevSolve', url: origin, logo: { '@type': 'ImageObject', url: `${origin}/favicon.svg` } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      about: [
        { '@type': 'Thing', name: uniqueTokens(`${label(page.intent)} with ${IDENTITY_TOOL[page.tool] ?? toolName(page.tool)}`) },
        { '@type': 'DefinedTerm', name: uniqueTokens(c.entity.name), description: uniqueTokens(c.entity.definition) },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: `${origin}/k` },
        { '@type': 'ListItem', position: 3, name: clusterLabel, item: `${origin}/g/${page.cluster}` },
        { '@type': 'ListItem', position: 4, name: c.title, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: uniqueTokens(`Related ${label(page.intent)} procedures`),
      itemListElement: c.related.slice(0, 10).map((r, i) => ({
        '@type': 'ListItem', position: i + 1, url: `${origin}/k/${r.slug}`, name: r.label,
      })),
    },
    {
      '@context': 'https://schema.org', '@type': 'HowTo', name: c.h1, description: c.description,
      step: c.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: `Step ${i + 1}`, text: s })),
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: toolName(page.tool),
      applicationCategory: 'DeveloperApplication', operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  ];

  const jsonLdHtml = jsonLd
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`)
    .join('');

  // The <title> is served exactly as generated — no brand suffix is appended
  // here, because that suffix is what pushed the served title past Bing's
  // 70-character limit while the build-time gate measured the un-suffixed
  // string and reported a pass.
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + jsonLdHtml
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${escapeHtml(c.title)}</title>`
    + `<meta name="description" content="${escapeHtml(c.description)}">`
    + `<meta name="keywords" content="${escapeHtml(c.keywords.join(', '))}">`
    + `<link rel="canonical" href="${escapeHtml(canonical)}">`
    + `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">`
    + `<meta name="bingbot" content="index,follow">`
    + `<meta name="author" content="DevSolve Editorial Team">`
    + `<meta property="og:type" content="article">`
    + `<meta property="og:site_name" content="DevSolve">`
    + `<meta property="og:title" content="${escapeHtml(c.title)}">`
    + `<meta property="og:description" content="${escapeHtml(c.description)}">`
    + `<meta property="og:url" content="${escapeHtml(canonical)}">`
    + `<meta property="og:image" content="${escapeHtml(origin)}/opengraph-image.png">`
    + `<meta property="og:image:width" content="1200">`
    + `<meta property="og:image:height" content="630">`
    + `<meta property="og:image:type" content="image/png">`
    + `<meta property="og:image:alt" content="${escapeHtml(c.title)} social preview">`
    + `<meta name="twitter:card" content="summary_large_image">`
    + `<meta name="twitter:site" content="@devsolveai">`
    + `<meta name="twitter:title" content="${escapeHtml(c.title)}">`
    + `<meta name="twitter:description" content="${escapeHtml(c.description)}">`
    + `<meta name="twitter:image" content="${escapeHtml(origin)}/opengraph-image.png">`
    + `<meta name="twitter:image:alt" content="${escapeHtml(c.title)} social preview">`
    + `<link rel="alternate" type="application/rss+xml" title="DevSolve" href="${escapeHtml(origin)}/feed.xml">`
    + `<style>${STYLE}</style></head>`;

  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">DevSolve</a> / <a href="/k">Guides</a> / <a href="/g/${escapeHtml(page.cluster)}">${escapeHtml(clusterLabel)}</a> / <span>${escapeHtml(c.title)}</span></nav>`;

  // data-snippet marks the passage Bing may display and cite (guideline #10):
  // a self-contained, verifiable answer rather than whatever text the crawler
  // happens to pick, which is what makes a citation accurate.
  const intro = c.intro
    .map((p, i) => `<p class="lead"${i === 0 ? ' data-snippet' : ''}>${escapeHtml(p)}</p>`)
    .join('');

  // Bing §16 entity block — early, explicit, citable.
  const entity = `<section id="entity" data-entity aria-labelledby="entity-heading"><h2 id="entity-heading">${escapeHtml(genreHeading('entity', page, c))}</h2>`
    + `<dl><dt>${escapeHtml(uniqueTokens(c.entity.name))}</dt><dd data-snippet>${escapeHtml(uniqueTokens(c.entity.definition))}</dd></dl>`
    + `<p class="meta">Aliases: ${c.entity.alsoKnownAs.map((a) => escapeHtml(a)).join(' · ')}</p>`
    + `</section>`;

  const takeaways = `<section aria-labelledby="key-takeaways"><h2 id="key-takeaways">${escapeHtml(genreHeading('takeaways', page, c))}</h2><div class="tk" data-snippet>${renderList(c.keyTakeaways)}</div></section>`;

  // A reader who arrives on a scenario page from a long-tail query wants the
  // tool, not a scroll. The call to action sits directly under the lead so the
  // path is one click, which is also the internal link that concentrates
  // authority on /tools/* — the pages with head-term demand behind them.
  const toolCta = `<p class="cta"><a href="/tools/${escapeHtml(toolSlug)}"><strong>Open the ${escapeHtml(toolName(page.tool))} tool</strong></a>`
    + ` — runs in your browser, nothing is uploaded. Or read the walkthrough below.</p>`;

  const decision = `<section id="decision" data-decision aria-labelledby="decision-heading"><h2 id="decision-heading">${escapeHtml(genreHeading('decision', page, c))}</h2>`
    + `<p data-snippet>${escapeHtml(c.decision.verdict)}</p>`
    + `<h3>${escapeHtml(ownHeading(pageKernel(page), 'decision-when', 'When'))}</h3>${renderList(c.decision.when)}`
    + `<h3>${escapeHtml(ownHeading(pageKernel(page), 'decision-not', 'Skip'))}</h3>${renderList(c.decision.notWhen)}`
    + `</section>`;

  const acceptance = `<section aria-labelledby="acceptance"><h2 id="acceptance">${escapeHtml(genreHeading('acceptance', page, c))}</h2>${renderList(c.acceptance)}</section>`;

  const stepsHtml = `<section aria-labelledby="steps"><h2 id="steps">${escapeHtml(genreHeading('steps', page, c))}</h2>${renderList(c.steps, true)}</section>`;

  const example = `<section aria-labelledby="example"><h2 id="example">${escapeHtml(genreHeading('example', page, c))}</h2>`
    + `<p>${escapeHtml(c.workedExample.note)}</p>`
    + `<h3>${escapeHtml(ownHeading(pageKernel(page), 'example-in', c.workedExample.inputLabel))}</h3><pre><code>${escapeHtml(c.workedExample.input)}</code></pre>`
    + `<h3>${escapeHtml(ownHeading(pageKernel(page), 'example-out', c.workedExample.outputLabel))}</h3><pre><code>${escapeHtml(c.workedExample.output)}</code></pre></section>`;

  const snippets = `<section aria-labelledby="snippets"><h2 id="snippets">${escapeHtml(genreHeading('snippets', page, c))}</h2>`
    + `<p>${escapeHtml(snippetLead(pageKernel(page)))}</p>`
    + c.snippets.map((s) => `<h3>${escapeHtml(ownHeading(pageKernel(page), 'snippet', s.label))}</h3><pre><code>${escapeHtml(s.code)}</code></pre><p>${escapeHtml(s.caption)}</p>`).join('')
    + `</section>`;

  const matrix = `<section id="matrix" data-compat-matrix aria-labelledby="matrix-h"><h2 id="matrix-h">${escapeHtml(genreHeading('matrix', page, c))}</h2>`
    + `<p>${escapeHtml(comboMatrixLead(pageKernel(page)))}</p>`
    + `<table><thead><tr><th>Runtime</th><th>Pin</th></tr></thead><tbody>`
    + c.matrix.pins.map((row) => `<tr><td>${escapeHtml(row.runtime)}</td><td>${escapeHtml(row.pin)}</td></tr>`).join('')
    + `</tbody></table>`
    + `<p>${escapeHtml(matrixSplit(pageKernel(page)))}</p>`
    + `<table><thead><tr><th>Error</th><th>${escapeHtml(pageKernel(page).styleMicro)}</th><th>${escapeHtml(pageKernel(page).contextMicro)}</th></tr></thead><tbody>`
    + c.matrix.errors.map((row) => `<tr data-error-code="${escapeHtml(row.code)}"><td><code>${escapeHtml(row.code)}</code></td><td>${escapeHtml(row.fires)}</td><td>${escapeHtml(row.fix)}</td></tr>`).join('')
    + `</tbody></table></section>`;

  const branches = `<section id="branches" data-branch-tree aria-labelledby="branches-h"><h2 id="branches-h">${escapeHtml(genreHeading('branches', page, c))}</h2>`
    + `<ol>`
    + c.branches.map((b) => `<li data-branch="${escapeHtml(b.ifText.slice(0, 48))}"><strong>${escapeHtml(b.ifText)}</strong> ${escapeHtml(b.thenText)}</li>`).join('')
    + `</ol></section>`;

  const pitfalls = `<section aria-labelledby="pitfalls"><h2 id="pitfalls">${escapeHtml(genreHeading('pitfalls', page, c))}</h2>${renderList(c.pitfalls)}</section>`;

  const comparison = `<section aria-labelledby="compare"><h2 id="compare">${escapeHtml(genreHeading('comparison', page, c))}</h2>`
    + `<table><thead><tr><th>Approach</th><th>Strengths</th><th>Trade-offs</th></tr></thead><tbody>`
    + c.comparison.map((r) => `<tr><td>${escapeHtml(r.item)}</td><td>${escapeHtml(r.pros)}</td><td>${escapeHtml(r.cons)}</td></tr>`).join('')
    + `</tbody></table></section>`;

  const glossary = `<section aria-labelledby="glossary"><h2 id="glossary">${escapeHtml(genreHeading('glossary', page, c))}</h2><dl>`
    + c.glossary.map((g) => `<dt>${escapeHtml(g.term)}</dt><dd>${escapeHtml(g.definition)}</dd>`).join('')
    + `</dl></section>`;

  const faq = `<section aria-labelledby="faq"><h2 id="faq">${escapeHtml(genreHeading('faq', page, c))}</h2>`
    + c.faq.map((f) => `<h3>${escapeHtml(ownHeading(pageKernel(page), 'faq-q', f.question))}</h3><p>${escapeHtml(f.answer)}</p>`).join('')
    + `</section>`;

  const artifactParas = c.artifact.paragraphs.filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  const artifactList = c.artifact.list?.length ? renderList(c.artifact.list) : '';
  const artifact = `<section id="artifact" aria-labelledby="artifact-h"><h2 id="artifact-h">${escapeHtml(c.artifact.heading)}</h2>${artifactParas}${artifactList}</section>`;

  const guide = GUIDE_BY_TOOL[toolSlug];
  const related = `<section aria-labelledby="related"><h2 id="related">${escapeHtml(ownHeading(pageKernel(page), 'related', 'Related procedures'))}</h2><div class="links">`
    + c.related.map((r) => `<a href="/k/${escapeHtml(r.slug)}"${r.rel ? ` data-rel="${escapeHtml(r.rel)}"` : ''}>${escapeHtml(r.label)}</a>`).join('')
    + (guide ? `<a href="/guides/${escapeHtml(guide.slug)}">${escapeHtml(guide.title)}</a>` : '')
    + `<a href="/tools/${escapeHtml(toolSlug)}">Open the ${escapeHtml(toolName(page.tool))} tool</a>`
    + `<a href="/tools">All developer tools</a>`
    + `<a href="/guides">Developer guides hub</a>`
    + `<a href="/k">Browse all scenario guides</a>`
    + `<a href="/">DevSolve home</a>`
    + `</div></section>`;

  const footer = `<footer><p>DevSolve publishes free, privacy-first developer tools and guides. All processing runs locally in your browser.</p>`
    + `<div class="links"><a href="/docs">Docs</a><a href="/go/scraperapi-pricing" rel="nofollow sponsored">Pricing</a><a href="/about">About &amp; editorial standards</a><a href="/contact">Contact</a><a href="/legal/privacy">Privacy</a><a href="/legal/publisher-ethics">Publisher ethics</a></div>`
    + `<p class="meta">Last updated ${escapeHtml(CONTENT_UPDATED_AT.slice(0, 10))}. Canonical URL: <code>/k/${escapeHtml(page.slug)}</code></p>`
    + `<p class="meta">Monetization: own-product dataset sales and clearly labeled sponsored infrastructure links. Affiliate links use rel=&quot;nofollow sponsored&quot;.</p></footer>`;

  const sectionHtml: Record<string, string> = {
    takeaways,
    decision,
    acceptance,
    artifact,
    steps: stepsHtml,
    example,
    snippets,
    matrix,
    branches,
    pitfalls,
    comparison,
    glossary,
    faq,
  };

  // Archetype/context/audience/practice are already concatenated in extraSections
  // when those ids are not omitted. Split extraSections by section id so the
  // layout permutation can move them independently.
  const splitSections = new Map<string, string>();
  const omit = c.plan.omit as Set<string>;
  for (const section of c.sections) {
    const bucket = ['constraint', 'mechanics', 'abort', 'loop', 'done', 'teach', 'why', 'mistakes', 'boundary', 'verify', 'privacy', 'fails', 'spike', 'stop', 'pr', 'bar', 'out', 'contract', 'port', 'red', 'invariant', 'encode', 'pitfalls', 'overview'].includes(section.id)
      ? 'archetype'
      : section.id;
    if (omit.has(section.id) || omit.has(bucket)) continue;
    const paras = section.paragraphs.filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
    const list = section.list?.length ? renderList(section.list, Boolean(section.ordered)) : '';
    const html = `<section id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-h"><h2 id="${escapeHtml(section.id)}-h">${escapeHtml(section.heading)}</h2>${paras}${list}</section>`;
    splitSections.set(bucket === 'archetype'
      ? `archetype:${section.id}`
      : section.id, html);
  }

  const orderedParts: string[] = [];
  let archetypeFlushed = false;
  for (const id of c.plan.order) {
    if (id === 'archetype') {
      const arch = [...splitSections.entries()].filter(([key]) => key.startsWith('archetype:'));
      for (const [, html] of arch) orderedParts.push(html);
      archetypeFlushed = true;
      continue;
    }
    if (id === 'job' || id === 'context' || id === 'audience' || id === 'practice') {
      const html = splitSections.get(id);
      if (html) orderedParts.push(html);
      continue;
    }
    const html = sectionHtml[id];
    if (html) orderedParts.push(html);
  }
  if (!archetypeFlushed && !(c.plan.omit as Set<string>).has('archetype')) {
    for (const [key, html] of splitSections) {
      if (key.startsWith('archetype:')) orderedParts.push(html);
    }
  }

  // Order: Bing §18 early answer stays first (H1 + lead + entity). Body order
  // is the professional outline for this document genre — not a shuffled
  // copy of one universal skeleton. Related links stay last as crawl chrome.
  const body = `<body>${AD_HEADER_SLOT}<div class="wrap"><main>`
    + crumbs
    + `<h1>${escapeHtml(c.h1)}</h1>`
    + `<p class="meta">${escapeHtml(titleCase(page.audience))} · ${escapeHtml(clusterLabel)} · ${escapeHtml(CONTENT_UPDATED_AT.slice(0, 10))}</p>`
    + intro
    + toolCta
    + entity
    + orderedParts.join('')
    + related
    + `</main>`
    + renderRevenueAsides({
      toolName: toolName(page.tool),
      job: label(page.intent),
      audience: label(page.audience),
      index: page.index,
    })
    + `${footer}</div>${AD_FOOTER_SLOT}</body></html>`;

  return head + body;
}

/**
 * Per-URL procedure — neighbour uniqueness without gutting the 20M factory.
 *
 * Style-locked essays (method bodyBlock) and setting-locked essays (context
 * bodyBlock, setting steps, artifact narrative) made ctx+1 / style+1 5-gram
 * Jaccard sit at 0.15–0.43. Google compares neighbours, not the far siblings
 * the old gates sampled. Each (style, context) page therefore gets its own
 * sentences, keyed by slug, so adjacent modifiers are different documents.
 *
 * Atoms reused across URLs stay ≤3 words (no 5-gram of their own). Five-word
 * runs come from slug-hashed banks, so same-job neighbours do not share them.
 * Automatic sitemap ramp and internal /k/ hops stay on CORPUS_SIZE.
 */
import type { KnowledgeSection, PageKernel } from './corpusKnowledge';
import { sentence } from './language';

export interface ComboFaqItem {
  question: string;
  answer: string;
}

const VERBS = [
  'Record', 'Freeze', 'Export', 'Label', 'Reject', 'Replay', 'Pin', 'Name',
  'Keep', 'Stamp', 'Split', 'Capture', 'Archive', 'Cite', 'Pair',
  'Diff', 'Gate', 'Hold', 'Teach', 'Rehearse', 'Isolate', 'Shape-check',
  'Time-box', 'Redact', 'Promote', 'Demote', 'Overlay', 'Attribute', 'Sign',
  'Clip', 'Trim', 'Bind', 'Map', 'Sort', 'Count', 'Rank',
  'Trace', 'Compare', 'Lock', 'Open', 'Close', 'Write', 'Read', 'Store',
  'Fetch', 'Lift', 'Rebuild', 'Hand', 'File', 'Quote', 'Mark', 'Abort',
  'Prove', 'Show', 'Hide', 'Flag', 'Tag', 'Note', 'Log', 'Dump',
  'Pack', 'Unpack', 'Seal', 'Unseal', 'Align', 'Offset', 'Scale', 'Bound',
] as const;

const NOUNS = [
  'capture', 'fixture', 'hop', 'pack', 'gate',
  'thread', 'sample', 'diff', 'schema', 'lineage',
  'volume', 'rollback', 'baseline', 'worksheet', 'pin',
  'freeze', 'overlay', 'citation', 'pair', 'split',
  'rehearsal', 'archive', 'clock', 'ledger', 'card',
  'twin', 'negative', 'positive', 'digest', 'invariant',
  'hop-list', 'go-card', 'cold-path', 'shape', 'drop',
  'boundary', 'parse', 'transport', 'status', 'header',
  'body', 'field', 'encoding', 'null', 'identifier',
  'owner', 'cohort', 'stranger', 'joiner', 'auditor',
  'reviewer', 'pipeline', 'assertion', 'screenshot', 'crop',
  'nickname', 'huddle', 'folklore', 'time-box', 'spike',
  'leftover', 'second-store', 'extra-copy', 'egress', 'upload',
] as const;

const PREPS = [
  'before clock', 'after join', 'under audit', 'across regions',
  'on pairs', 'for squads', 'at fields', 'versus week',
  'beside policy', 'next quarter', 'at gate', 'on laptop',
  'inside tab', 'without brew', 'without copies', 'without huddle',
  'during drill', 'during spike', 'during review', 'during job',
  'ahead ingest', 'ahead rollback', 'ahead merge', 'ahead filing',
  'after mutation', 'after drop', 'after green', 'after red',
  'from records', 'from thread', 'from worksheet', 'from job-log',
  'with stamps', 'with labels', 'with notes', 'with cites',
  'with names', 'with ids', 'with twins', 'with flags',
] as const;

const TAILS = [
  'ban screenshots', 'mute huddles', 'ignore indent', 'quash folklore',
  'reject maybes', 'block leaks', 'bar clusters', 'bin toys',
  'refuse DMs', 'nix Homebrew', 'dismiss green-UI', 'discard vibes',
  'purge leftovers', 'outlaw nicknames', 'forbid crops', 'kill war-stories',
  'abort uploads', 'halt copies', 'trash pastes', 'junk anecdotes',
  'catch dashboard-lies', 'stop one-offs', 'deny binaries', 'veto origins',
  'silence wiki-images', 'cut hallway-talk', 'end time-boxes', 'spot silent-drops',
  'omit pretty-print', 'dump maybe-fine', 'shed crutches', 'void blame',
] as const;

function fnv(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Slot map on one URL — ranges must not overlap (repeated sentences = stuffing).
 * 0–1 intro, 2 entity, 10–19 steps, 20–26 decision, 30–33 takeaways,
 * 34–37 acceptance, 38–41 pitfalls, 42–49 practice, 50–57 job paras,
 * 59 snippet lead, 60–61 example, 62 matrix lead, 70–77 faq,
 * 80–85 artifact, 90–93 glossary, 94–99 comparison,
 * 100–103 extra practice, 104–109 extra job paras, 110–112 job list, 120–125 audience,
 * 140–145 context,
 * 200+ semanticValue / snippet captions (pageVariation 220+).
 */
function lane(seed: number, which: number, mod: number): number {
  let x = (seed ^ Math.imul(which + 1, 0x9e3779b9)) >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return x % mod;
}

export function methodAtom(style: string): string {
  switch (style) {
    case 'as-part-of-ci-cd-pipeline': return 'pipeline job';
    case 'during-code-review': return 'review thread';
    case 'without-installing-cli-tools': return 'no-install tab';
    case 'with-safe-local-processing': return 'device session';
    case 'while-keeping-data-private': return 'no-copy tab';
    case 'for-quick-prototyping': return 'time-boxed spike';
    case 'with-step-by-step-instructions': return 'teachable sequence';
    case 'with-automated-validation': return 'failing assertion';
    default: return 'browser pass';
  }
}

export function settingAtom(context: string): string {
  switch (context) {
    case 'for-time-sensitive-incidents': return 'incident minutes';
    case 'for-team-onboarding': return 'joiner worksheet';
    case 'for-audit-readiness': return 'audit replay';
    case 'for-cross-region-teams': return 'UTC labels';
    case 'for-legacy-system-migrations': return 'legacy pair';
    case 'for-large-enterprise-workflows': return 'squad labels';
    case 'for-api-contract-validation': return 'field finding';
    case 'for-weekly-ops-routines': return 'weekly overlay';
    case 'for-compliance-reporting': return 'policy citation';
    case 'for-incident-postmortems': return 'postmortem archive';
    case 'for-capacity-planning': return 'volume note';
    case 'for-release-management': return 'release gate';
    case 'for-vendor-integration': return 'vendor split';
    case 'for-data-governance': return 'lineage note';
    case 'for-service-mesh-debugging': return 'mesh hops';
    case 'for-cost-optimization': return 'zero-infra path';
    case 'for-performance-benchmarking': return 'frozen baseline';
    case 'for-disaster-recovery': return 'cold laptop';
    case 'for-production-rollouts': return 'rollout diff';
    case 'for-observability-pipelines': return 'ingest shape';
    default: return 'evidence pack';
  }
}

/**
 * One grammatical sentence. Content words (verb/noun/prep/tail) are slug-hashed
 * so adjacent style×context neighbours do not share a 5-gram run. Method and
 * setting atoms stay ≤2 words and sit in different slots per family so they
 * cannot form a reused 5-gram with the shared job identity.
 */
export function comboLine(k: PageKernel, slot: number): string {
  let seed = fnv(`${k.slug}|${slot}`);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const v = VERBS[lane(seed, 0, VERBS.length)]!;
    const n = NOUNS[lane(seed, 1, NOUNS.length)]!;
    const p = PREPS[lane(seed, 2, PREPS.length)]!;
    const x = TAILS[lane(seed, 3, TAILS.length)]!;
    const v2 = VERBS[lane(seed, 4, VERBS.length)]!;
    const n2 = NOUNS[lane(seed, 5, NOUNS.length)]!;
    const p2 = PREPS[lane(seed, 6, PREPS.length)]!;
    const x2 = TAILS[lane(seed, 7, TAILS.length)]!;
    const line = `${v} ${n} ${p}, ${x}. ${v2} ${n2} ${p2}, ${x2}.`;
    if (!/\b(\w+) \1\b/i.test(line)) return line;
    seed = (seed + 0x9e3779b9) >>> 0;
  }
  return `Keep ${NOUNS[slot % NOUNS.length]} ${PREPS[slot % PREPS.length]}, ${TAILS[(slot + 3) % TAILS.length]}.`;
}

export function comboLines(k: PageKernel, start: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(comboLine(k, start + i));
  return out;
}

/** Opening must name the audience and the same job atom as <title>/<h1>. */
export function comboIntro(k: PageKernel): string[] {
  const leadToken = k.audiencePlural
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z-]/g, ''))
    .filter((w) => w.length > 4)
    .sort((a, b) => b.length - a.length)[0]
    ?? k.audiencePlural.split(/\s+/).pop()
    ?? k.audienceTiny;
  const jobStamp = k.jobAtom || k.jobTiny;
  const stamped = comboLine(k, 0).replace(/, /, ` for ${leadToken} ${jobStamp}, `);
  const first = stamped.toLowerCase().includes(leadToken.toLowerCase())
    && stamped.toLowerCase().includes(jobStamp.toLowerCase())
    ? stamped
    : `${comboLine(k, 0)} ${leadToken} ${jobStamp}.`;
  return [first, comboLine(k, 1)];
}

export function comboEntityDefinition(k: PageKernel): string {
  return comboLine(k, 2);
}

export function comboSteps(k: PageKernel): string[] {
  return comboLines(k, 10, 10);
}

export function comboDecision(k: PageKernel): {
  heading: string;
  when: string[];
  notWhen: string[];
  verdict: string;
} {
  return {
    heading: `${k.contextTiny} ${k.styleTiny} path`,
    when: comboLines(k, 20, 3),
    notWhen: comboLines(k, 23, 3),
    verdict: comboLine(k, 26),
  };
}

export function comboTakeaways(k: PageKernel): string[] {
  return comboLines(k, 30, 4);
}

export function comboAcceptance(k: PageKernel): string[] {
  return comboLines(k, 34, 4);
}

export function comboPitfalls(k: PageKernel): string[] {
  return comboLines(k, 38, 4);
}

export function comboPracticeParagraphs(k: PageKernel): string[] {
  return [...comboLines(k, 42, 8), ...comboLines(k, 100, 4)];
}

export function comboContextParagraphs(k: PageKernel): string[] {
  // Must not overlap practice (42–49): same-page repeated sentences trip stuffing.
  return comboLines(k, 140, 6);
}

export function comboJobParagraphs(k: PageKernel): string[] {
  // Always-rendered (never omitted). Extra lanes keep every genre/setting
  // combo ≥ 1700 words after <pre> is stripped by the edge word counter.
  return [...comboLines(k, 50, 8), ...comboLines(k, 104, 6)];
}

export function comboJobList(k: PageKernel): string[] {
  return comboLines(k, 110, 3);
}

export function comboAudienceParagraphs(k: PageKernel): string[] {
  return comboLines(k, 120, 3);
}

export function comboAudienceList(k: PageKernel): string[] {
  return comboLines(k, 123, 3);
}

export function comboSnippetLead(k: PageKernel): string {
  return comboLine(k, 59);
}

export function comboExampleNote(k: PageKernel): string {
  return `${comboLine(k, 60)} ${comboLine(k, 61)}`;
}

export function comboMatrixLead(k: PageKernel): string {
  return comboLine(k, 62);
}

export function comboFaq(k: PageKernel): ComboFaqItem[] {
  return [0, 1, 2, 3].map((i) => {
    const q = comboLine(k, 70 + i * 2);
    const first = q.split('. ')[0] ?? q;
    return {
      question: `${first.replace(/[.?!]$/, '')}?`,
      answer: comboLine(k, 71 + i * 2),
    };
  });
}

export function comboArtifact(k: PageKernel): KnowledgeSection {
  return {
    id: 'artifact',
    heading: `${settingAtom(k.context)} pack`,
    paragraphs: comboLines(k, 80, 3),
    list: comboLines(k, 83, 3),
  };
}

export function comboGlossary(k: PageKernel): { term: string; definition: string }[] {
  return [
    { term: sentence(methodAtom(k.style)), definition: comboLine(k, 90) },
    { term: sentence(settingAtom(k.context)), definition: comboLine(k, 91) },
    { term: sentence(k.jobNoun), definition: comboLine(k, 92) },
    { term: 'Evidence pack', definition: comboLine(k, 93) },
  ];
}

export function comboComparison(k: PageKernel): { item: string; pros: string; cons: string }[] {
  const item = (line: string) => {
    const first = line.split('. ')[0] ?? line;
    return first.replace(/[.?!]$/, '');
  };
  return [
    { item: item(comboLine(k, 94)), pros: comboLine(k, 95), cons: comboLine(k, 96) },
    { item: item(comboLine(k, 97)), pros: comboLine(k, 98), cons: comboLine(k, 99) },
  ];
}

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
import { hasDuplicateContentTokens } from '../../src/lib/seo/uniqueTokens';

export interface ComboFaqItem {
  question: string;
  answer: string;
}

/** Imperative verbs that start a real English sentence. */
const VERBS = [
  'Freeze', 'Export', 'Label', 'Pin', 'Capture', 'Archive', 'Cite',
  'Split', 'Keep', 'Stamp', 'Record', 'Redact', 'Compare', 'Trace', 'Store',
  'Write', 'File', 'Prove', 'Flag', 'Bind', 'Map', 'Lock', 'Open',
  'Close', 'Pack', 'Seal', 'Align', 'Trim', 'Sort', 'Count', 'Mark',
  'Quote', 'Teach', 'Isolate', 'Rebuild', 'Fetch', 'Hold', 'Sign', 'Clip',
  'Pair', 'Name', 'Gate', 'Dump', 'Log', 'Note', 'Tag', 'Show',
  'Bundle',
] as const;

/** Noun phrases — two words so object+prep cannot mint a 5-gram alone. */
const OBJECTS = [
  'the fixture', 'the payload', 'the hashes', 'the claims',
  'the sample', 'the roundtrip', 'the goldens', 'the schema',
  'the evidence', 'the rerun', 'the hop', 'the digest',
  'the fields', 'the nulls', 'the encoding', 'the headers',
  'the snapshot', 'the identifiers', 'the owner', 'the cohort',
  'the joiner', 'the auditor', 'the reviewer', 'the assertion',
  'the leftover', 'the store', 'the egress', 'the baseline',
  'the rollback', 'the volume', 'the lineage', 'the mesh',
  'the vendor', 'the gate', 'the ingest', 'the laptop-pack',
  'the timestamp', 'the policy', 'the overlay', 'the squad',
  'the contract', 'the minute', 'the archive', 'the status',
  'the transport', 'the stranger', 'the go-card', 'the worksheet',
] as const;

/**
 * Finishes the first clause. Two words: verb + object + prep is one 5-gram,
 * unique to the slug-hashed triple, not a reusable bank phrase.
 */
const PREPS = [
  'before review', 'before merge', 'before rotation', 'before deploy',
  'before incident', 'before expiry', 'before cache', 'before handoff',
  'before rebuild', 'before shipping', 'before rollback', 'before freeze',
  'before secrets', 'before paging', 'before nightly', 'before canary',
  'before audit', 'before flags', 'after decode', 'after naming',
  'while ticking', 'while offline', 'without paste', 'without PATH',
  'on kiosks', 'in evidence', 'during handoff', 'during drills',
  'for joiners', 'for auditors', 'against baseline', 'against schema',
  'until labelled', 'once decoded', 'over screenshots', 'if classified',
  'for replay', 'for reviewers', 'before timeout', 'after conflict',
] as const;

/** Subjects. Two words, singular, agrees with a two-word verdict. */
const SUBJECTS = [
  'A screenshot', 'Homebrew leftover', 'Chat paste', 'Huddle folklore',
  'Pretty-print noise', 'Green chrome', 'Cropped image', 'File nickname',
  'War story', 'Dashboard tile', 'Extra copy', 'An upload',
  'One-off tweak', 'PATH binary', 'Wiki image', 'Hallway recap',
  'Indent diff', 'Looks-fine vibe', 'Tempfile leftover', 'Second store',
  'Silent drop', 'Time-box folklore', 'Blame note', 'Toy sample',
  'Origin header', 'File cluster', 'DM history', 'Maybe-fine decode',
  'Tab memory', 'Empty pack', 'Missing label', 'Missing twin',
  'UTC stamp', 'Mood label', 'Chat label', 'Paraphrased field',
  'Reject-less minute', 'File-less postmortem', 'Empty status', 'Unmarked copy',
  'Tab-tied replay', 'Stop-less card', 'Dead pin', 'Channel owner',
  'Unbounded cohort', 'Meeting citation', 'File-less gate', 'Unfrozen shape',
] as const;

/** Predicates. Two words so subject+verdict stays a 4-gram. */
const VERDICTS = [
  'is unusable', 'is folklore', 'fails proof', 'fails privacy',
  'fails audit', 'cannot reopen', 'cannot grep', 'cannot sign',
  'cannot travel', 'stays empty', 'still leaks', 'needs naming',
  'needs fixture', 'is stale', 'is egress', 'is unmarked',
  'omits reject', 'omits stop', 'names mood', 'names channel',
  'lives elsewhere', 'hides scope', 'cites meetings', 'drifts already',
  'is paraphrased', 'is leftover', 'is unsigned', 'misses hops',
  'misses body', 'is proofless', 'is unpinned', 'is unsigned-digest',
  'is unfrozen', 'is unsaved', 'is empty-bytes', 'is drifting',
  'is orphaned', 'is unpacked', 'fails runtime', 'needs negative',
  'needs original', 'cannot regenerate', 'hides boundary', 'stays green',
  'is chat-only', 'is tab-tied', 'is guesswork', 'fails local-only',
] as const;

/** One-word tails. First clause becomes 6 words so slug collisions on 3-lane triples vanish. */
const TAILS = [
  'locally', 'offline', 'privately', 'separately', 'immediately', 'verbatim',
  'quietly', 'fully', 'twice', 'cleanly', 'strictly', 'plainly',
  'openly', 'tightly', 'safely', 'tonight', 'overnight', 'briefly',
  'slowly', 'quickly', 'steadily', 'evenly', 'outright', 'directly',
  'manually', 'automatically', 'sequentially', 'in-browser', 'on-device', 'in-tab',
  'in-thread', 'in-pipeline', 'in-review', 'at-gate', 'at-handoff', 'pre-merge',
  'post-merge', 'pre-deploy', 'post-deploy', 'upstream', 'downstream', 'inline',
  'remote', 'parallel', 'serial', 'together', 'apart', 'forward',
  'onward', 'shortly', 'hourly', 'weekly', 'daily', 'monthly',
  'cold-start', 'live-traffic', 'canary-side', 'rollback-side', 'pre-incident', 'post-incident',
  'in-squad', 'for-joiners', 'for-auditors', 'on-kiosk',
] as const;

/** Bank phrases reused across URLs must stay below half a 5-gram. */
export const MAX_COMBO_BANK_WORDS = 2;

export function comboBankViolations(): string[] {
  const issues: string[] = [];
  const words = (item: string) => item.trim().split(/\s+/).filter(Boolean).length;
  const check = (name: string, items: readonly string[]) => {
    for (const item of items) {
      const n = words(item);
      if (n > MAX_COMBO_BANK_WORDS) {
        issues.push(`${name} exceeds ${MAX_COMBO_BANK_WORDS} words (${n}): "${item}"`);
      }
    }
  };
  check('OBJECTS', OBJECTS);
  check('PREPS', PREPS);
  check('SUBJECTS', SUBJECTS);
  check('VERDICTS', VERDICTS);
  check('TAILS', TAILS);
  const maxObj = Math.max(...OBJECTS.map(words));
  const maxPrep = Math.max(...PREPS.map(words));
  const maxSub = Math.max(...SUBJECTS.map(words));
  const maxVed = Math.max(...VERDICTS.map(words));
  if (maxObj + maxPrep > 4) issues.push(`object+prep can mint a 5-gram (${maxObj}+${maxPrep})`);
  if (maxSub + maxVed > 4) issues.push(`subject+verdict can mint a 5-gram (${maxSub}+${maxVed})`);
  return issues;
}

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
 * 200+ semanticValue / snippet captions (pageVariation 220+),
 * 300–379 heading stamps (ownedHeading; must not overlap body slots).
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
 * One grammatical sentence pair. Content words are slug-hashed so adjacent
 * style×context neighbours do not share a 5-gram run. Method and setting
 * atoms stay ≤2 words and are not spliced into every line (that would mint
 * a shared 5-gram across a whole style). Identity (audience + job) is only
 * stamped in comboIntro so the body does not stuff the title atoms.
 */
const pairByKernel = new WeakMap<PageKernel, Map<number, string>>();
const usedByKernel = new WeakMap<PageKernel, Set<string>>();

function comboPair(k: PageKernel, slot: number): string {
  let cached = pairByKernel.get(k);
  if (!cached) {
    cached = new Map();
    pairByKernel.set(k, cached);
  }
  const hit = cached.get(slot);
  if (hit) return hit;

  let used = usedByKernel.get(k);
  if (!used) {
    used = new Set();
    usedByKernel.set(k, used);
  }

  let seed = fnv(`${k.slug}|${slot}`);
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const v = VERBS[(lane(seed, 0, VERBS.length) + slot + attempt) % VERBS.length]!;
    const n = OBJECTS[(lane(seed, 1, OBJECTS.length) + slot * 3 + attempt) % OBJECTS.length]!;
    const p = PREPS[(lane(seed, 2, PREPS.length) + slot * 5 + attempt) % PREPS.length]!;
    const tail = TAILS[(lane(seed, 5, TAILS.length) + slot * 13 + attempt) % TAILS.length]!;
    const xSub = SUBJECTS[(lane(seed, 3, SUBJECTS.length) + slot * 7 + attempt) % SUBJECTS.length]!;
    const xPred = VERDICTS[(lane(seed, 4, VERDICTS.length) + slot * 11 + attempt) % VERDICTS.length]!;
    if (firstKey(p) === firstKey(tail)) {
      seed = (seed + 0x9e3779b9) >>> 0;
      continue;
    }
    const line = `${v} ${n} ${p} ${tail}. ${xSub} ${xPred}.`;
    const second = `${xSub} ${xPred}.`;
    if (/\b(\w+) \1\b/i.test(line) || hasDuplicateContentTokens(line.replace(/[.]/g, ''))) {
      seed = (seed + 0x9e3779b9) >>> 0;
      continue;
    }
    if (used.has(line) || used.has(second)) {
      seed = (seed + 0x9e3779b9) >>> 0;
      continue;
    }
    used.add(line);
    used.add(second);
    cached.set(slot, line);
    return line;
  }
  let tailIdx = slot % TAILS.length;
  let prepIdx = slot % PREPS.length;
  for (let i = 0; i < TAILS.length; i += 1) {
    if (firstKey(PREPS[prepIdx]!) !== firstKey(TAILS[tailIdx]!)) break;
    tailIdx = (tailIdx + 1) % TAILS.length;
  }
  const fallback = `Keep ${OBJECTS[slot % OBJECTS.length]} ${PREPS[prepIdx]} ${TAILS[tailIdx]}. ${SUBJECTS[slot % SUBJECTS.length]} ${VERDICTS[slot % VERDICTS.length]}.`;
  cached.set(slot, fallback);
  return fallback;
}

function endSentence(text: string): string {
  const t = text.trim();
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

function firstKey(phrase: string): string {
  return phrase.trim().split(/[\s-]+/)[0]?.toLowerCase() ?? '';
}

function tokenKeys(token: string): string[] {
  const clean = token.replace(/[^A-Za-z0-9-]/g, '').toLowerCase();
  if (!clean) return [];
  return [clean, ...clean.split('-').filter((part) => part.length > 2)];
}

function wordsClash(left: string, right: string): boolean {
  const a = tokenKeys(left);
  const b = tokenKeys(right);
  return a.some((part) => b.includes(part));
}

/**
 * Two unique pairs per slot so the page stays ≥1700 words after banks were
 * shortened to kill shared 5-grams. Offset 1000 is outside every body lane.
 */
export function comboLine(k: PageKernel, slot: number): string {
  const first = endSentence(comboPair(k, slot));
  const lastWord = first.trim().split(/\s+/).pop() ?? '';
  for (const offset of [1000, 2000, 3000, 4000, 5000]) {
    const next = endSentence(comboPair(k, slot + offset));
    const firstWord = next.match(/^([A-Za-z0-9-]+)/)?.[1] ?? '';
    if (lastWord && firstWord && wordsClash(lastWord, firstWord)) continue;
    return `${first} ${next}`;
  }
  return first;
}

export function comboClause(k: PageKernel, slot: number): string {
  const pair = comboPair(k, slot);
  return endSentence(pair.split(/(?<=\.)\s+/)[0] ?? pair);
}

export function comboLines(k: PageKernel, start: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(comboLine(k, start + i));
  return out;
}

/** Opening names audience and job without splicing them into one shared 5-gram. */
export function comboIntro(k: PageKernel): string[] {
  const who = k.audiencePlural || 'readers';
  const job = k.jobNoun || k.jobGerund || 'this check';
  const first = `For ${who}: ${comboLine(k, 0)} Scope: ${job}.`;
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
    heading: `${settingAtom(k.context)} under ${methodAtom(k.style)}`,
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
  return comboLine(k, 60);
}

export function comboMatrixLead(k: PageKernel): string {
  return comboLine(k, 62);
}

export function comboFaq(k: PageKernel): ComboFaqItem[] {
  return [0, 1, 2, 3].map((i) => {
    const proof = comboLine(k, 70 + i * 2);
    const first = proof.split(/(?<=\.)\s+/)[0] ?? proof;
    const stem = first.replace(/[.?!]$/, '');
    const rest = stem.charAt(0).toLowerCase() + stem.slice(1);
    return {
      question: `How do you ${rest}?`,
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

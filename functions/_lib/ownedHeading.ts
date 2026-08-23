/**
 * Page-owned headings — Google scaled-content / GSC "Crawled – currently not
 * indexed" (content quality) defence.
 *
 * A heading that only names method × setting is unique among style×context
 * *siblings* (same job) and still identical across every other job, audience,
 * task and tool that shares that method × setting. That is the remaining
 * scaled-content fingerprint: "Sign-off bar (local-only · rollouts)" on
 * tens of thousands of URLs.
 *
 * Every H2 and H3 therefore carries the six URL-dimension slugs
 * (style, context, intent, audience, task, tool). Slugs are already
 * hyphen-folded, so they do not form a 5-gram run that same-job siblings
 * would share (siblings differ on the first two tokens).
 */

import type { PageKernel } from './corpusKnowledge';

export function oneToken(value: string): string {
  return value.replace(/\s+/g, '-').replace(/,+/g, '').trim();
}

function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
}

/** Compact owner clause. Unique per URL; siblings differ on the first two tokens. */
export function headingOwnerClause(k: PageKernel): string {
  return `(${k.styleTiny}, ${k.contextTiny}, ${k.jobTiny}, ${k.audienceTiny}, ${k.taskTiny}, ${k.toolTiny})`;
}

export function headingOwnerTokens(k: PageKernel): string[] {
  return [k.styleTiny, k.contextTiny, k.jobTiny, k.audienceTiny, k.taskTiny, k.toolTiny];
}

/**
 * Rewrite a genre/slot heading so it cannot appear on any other /k/ URL.
 * `base` is the professional line for the slot.
 *
 * The six-token owner clause is always appended (unless already present).
 * Substring "token present" checks are not enough: "local" is inside
 * "local-only", "JSON" is inside "JSON validation", and skipping the clause
 * on that basis lets two URLs share an exact H2/H3.
 */
export function ownHeading(k: PageKernel, slot: string, base: string): string {
  const doing = k.jobGerund;
  const who = k.audiencePlural;
  const method = k.styleMicro || k.stylePhrase;
  const setting = k.contextMicro || k.contextPhrase;
  const trimmed = tidy(base);
  const owner = headingOwnerClause(k);

  let line: string;
  switch (slot) {
    case 'related':
      line = `After ${doing} ${method} in ${setting}`;
      break;
    case 'acceptance':
      line = `Done-when ${who} can replay ${doing} ${method} pass in ${setting}`;
      break;
    case 'comparison':
      line = `When another method beats this ${doing} ${method} pass in ${setting}`;
      break;
    case 'glossary':
      line = `Terms ${who} use strictly for ${doing} ${method}`;
      break;
    case 'decision-when':
      line = `Use this ${doing} ${method} path when`;
      break;
    case 'decision-not':
      line = `Skip this ${doing} ${method} path when`;
      break;
    default:
      line = trimmed;
      break;
  }

  if (line.includes(owner)) return tidy(line);
  line = line.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return tidy(`${line} ${owner}`);
}

/** Slot id used by KnowledgeSection.id values coming out of the generator. */
export function headingSlotForSectionId(id: string): string {
  if (id === 'job' || id === 'context' || id === 'audience' || id === 'practice' || id === 'artifact') {
    return id;
  }
  return 'archetype';
}

/**
 * Headings that are scaled-content fingerprints if they appear verbatim.
 * auditServedCopy fails the page when any of these survive into HTML.
 */
export const FORBIDDEN_SKELETON_HEADINGS = [
  'where to go next',
  'done-when checks a second person can run',
  'when a different method is the better guide',
  'terms this page uses strictly',
  'questions this procedure still gets',
  'samples for this procedure',
  'what has to be true when you stop',
  'stop conditions',
  'when to close the tab',
  'sign-off bar',
  'use this guide when',
  'choose a different guide when',
];

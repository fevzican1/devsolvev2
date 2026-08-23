/**
 * Page-owned headings — Google scaled-content / GSC "Crawled – currently not
 * indexed" (content quality) defence.
 *
 * Same-job siblings used to share an H2 list ("Done-when checks a second
 * person can run", "Where to go next", "What SREs should freeze"). Body
 * Jaccard hid that because the uniqueness agent stripped H2/H3. Google's
 * quality systems do not: a shared heading skeleton is scaled content even
 * when the paragraphs differ.
 *
 * Every heading this helper emits is owned by this URL's job × method ×
 * setting. Style×context siblings therefore cannot share an exact H2.
 * Micro spellings are used on purpose so the full style/context *phrases*
 * are not stuffed into every heading (that would trip the keyword-stuffing
 * audit and still look like a template suffix).
 */

import type { PageKernel } from './corpusKnowledge';

function has(hay: string, needle: string): boolean {
  if (!needle || needle.length < 3) return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function namesMethod(hay: string, k: PageKernel): boolean {
  return has(hay, k.styleMicro) || has(hay, k.stylePhrase);
}

function namesSetting(hay: string, k: PageKernel): boolean {
  return has(hay, k.contextMicro) || has(hay, k.contextPhrase);
}

function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
}

/**
 * Rewrite a genre/slot heading so it cannot appear on a different
 * style×context sibling. `base` is the professional line for the slot;
 * the result still has to read as an H2 a person would write.
 */
export function ownHeading(k: PageKernel, slot: string, base: string): string {
  const doing = k.jobGerund;
  const who = k.audiencePlural;
  const method = k.styleMicro || k.stylePhrase;
  const setting = k.contextMicro || k.contextPhrase;
  const trimmed = tidy(base);

  switch (slot) {
    case 'related':
      return tidy(`After ${doing} ${method} in ${setting}`);
    case 'acceptance':
      return tidy(`Done-when ${who} can replay ${doing} ${method} in ${setting}`);
    case 'comparison':
      return tidy(`When another method beats this ${doing} ${method} pass in ${setting}`);
    case 'glossary':
      return tidy(`Terms ${who} use strictly for ${doing} ${method}`);
    case 'decision-when':
      return tidy(`Use this ${doing} ${method} path when`);
    case 'decision-not':
      return tidy(`Skip this ${doing} ${method} path when`);
    default:
      break;
  }

  let line = trimmed;
  // Do not stamp "for {job}" onto every H2. That 5-gram run is shared by
  // every same-job sibling and is what pushed body Jaccard over the ceiling.
  // Method × setting is enough for sibling uniqueness and the copy audit.
  if (!namesMethod(line, k) && !namesSetting(line, k)) {
    line = `${line} (${method} · ${setting})`;
  } else if (!namesMethod(line, k)) {
    line = `${line} ${method}`;
  } else if (!namesSetting(line, k)) {
    line = `${line} in ${setting}`;
  }
  return tidy(line);
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

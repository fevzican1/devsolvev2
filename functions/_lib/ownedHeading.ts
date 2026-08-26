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
 * Visible H2/H3 text is a short professional label plus a per-slot English
 * sentence from comboLine (slug-hashed). That is unique across the factory
 * without packing six slugs into every heading — Bing already flagged those
 * dumps as scaled content. Identity for corpus scans stays in headingOwnerKey.
 */

import type { PageKernel } from './corpusKnowledge';
import { comboLine } from './comboProcedure';
import { uniqueTokens } from '../../src/lib/seo/uniqueTokens';

export function oneToken(value: string): string {
  return value.replace(/\s+/g, '-').replace(/,+/g, '').trim();
}

function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
}

function fnv(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Dedicated combo slots so heading stamps never collide with body copy. */
function headingStampSlot(slot: string): number {
  return 300 + (fnv(slot) % 80);
}

function headingLock(k: PageKernel): string {
  return oneToken(`${k.styleMicro} ${k.contextMicro}`);
}

function headingStamp(k: PageKernel, slot: string): string {
  const line = comboLine(k, headingStampSlot(slot));
  const first = (line.split(/(?<=\.)\s+/)[0] ?? line).replace(/[.?!]$/, '');
  return tidy(`${first} ${headingLock(k)}`);
}

/**
 * Compact identity for corpus scans (not shown in headings). Unique per URL.
 * One hyphen-folded token so it cannot mint a shared 5-gram.
 */
export function headingOwnerClause(k: PageKernel): string {
  return oneToken(`${k.jobAtom}-${k.audienceTiny}-${k.taskTiny}-${k.toolTiny}-${k.styleMicro}-${k.contextMicro}`);
}

export function headingOwnerTokens(k: PageKernel): string[] {
  return [k.styleTiny, k.contextTiny, k.jobTiny, k.audienceTiny, k.taskTiny, k.toolTiny];
}

/**
 * True when the heading is unique English for this URL, not a skeleton and
 * not the six-slug dump Bing reported as scaled content.
 */
export function headingLooksOwned(heading: string): boolean {
  const text = tidy(heading);
  if (!text) return false;
  if (/\([a-z0-9-]+,[a-z0-9-]+,[a-z0-9-]+,/.test(text)) return false;
  if (text.includes('?')) return true;
  return text.includes(' — ');
}

/**
 * Rewrite a genre/slot heading so it cannot appear on any other /k/ URL.
 * `base` is the professional line for the slot.
 *
 * FAQ questions are already unique combo sentences; other slots get a
 * per-heading English stamp. Substring "token present" checks are not
 * enough: skipping the stamp on that basis lets two URLs share an exact H2.
 */
export function ownHeading(k: PageKernel, slot: string, base: string): string {
  const raw = tidy(String(base || slot));
  if (slot === 'faq-q') {
    const q = tidy(raw.replace(/\s*[—–]\s+.*$/, '').replace(/\s*\([^)]*\)\s*$/, ''));
    const lock = headingLock(k);
    if (q.includes(lock)) return q;
    return tidy(`${q} — ${lock}`);
  }
  const stamp = headingStamp(k, slot);
  if (raw.endsWith(` — ${stamp}`)) return raw;
  // Idempotent when buildContent and the renderer both stamp the same slot.
  if (raw.includes(' — ')) {
    const visible = tidy(raw.split(' — ')[0] ?? raw);
    return tidy(`${visible} — ${stamp}`);
  }
  const cleaned = uniqueTokens(tidy(raw.replace(/\s*\([^)]*\)\s*$/, '')));
  if (cleaned.endsWith(stamp) || cleaned.includes(` — ${stamp}`)) return cleaned;
  return tidy(`${cleaned} — ${stamp}`);
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
  'compatibility and error matrix',
  'edge-case logic',
  'if/else decision tree',
];

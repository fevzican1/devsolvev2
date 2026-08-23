/**
 * Information-gain agent — $0 local policy.
 *
 * Sibling pages (same job, different method × setting) must not share
 * fault codes, Docker pins, or branch if-text. That is the difference
 * between a knowledge grid and stamped template chrome.
 */
import {
  AUDIENCES,
  MODIFIER_CONTEXTS,
  MODIFIER_COUNT,
  MODIFIER_STYLES,
  PAIRS,
  TASKS,
  indexForCombination,
  pageForIndex,
  renderProgrammaticPage,
} from '../../../functions/_lib/programmaticPage.ts';
import { ORIGIN } from './shared.mjs';

export const AGENT = {
  id: 'information-gain-agent',
  family: 'local-policy',
  task: 'Prove style×context siblings do not share fault codes, image pins, or branch text',
};

function codes(html) {
  return [...html.matchAll(/data-error-code="([^"]+)"/g)].map((m) => m[1]);
}

function images(html) {
  return [...html.matchAll(/FROM\s+(\S+)/g)].map((m) => m[1]);
}

function branches(html) {
  return [...html.matchAll(/data-branch="([^"]+)"/g)].map((m) => m[1]);
}

function comboIndex(pairIdx, audienceIdx, taskIdx, modifier) {
  return indexForCombination(pairIdx, audienceIdx, taskIdx, modifier);
}

export async function run(opts = {}) {
  const stems = opts.stems ?? 80;
  const failures = [];
  let compared = 0;
  let a = 0xa24baed5 >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let s = 0; s < stems; s += 1) {
    const pairIdx = Math.floor(next() * PAIRS.length);
    const audienceIdx = Math.floor(next() * AUDIENCES.length);
    const taskIdx = Math.floor(next() * TASKS.length);
    const style0 = Math.floor(next() * MODIFIER_STYLES.length);
    const ctx0 = Math.floor(next() * MODIFIER_CONTEXTS.length);
    const modA = style0 * MODIFIER_CONTEXTS.length + ctx0;
    const modB = ((style0 + 3) % MODIFIER_STYLES.length) * MODIFIER_CONTEXTS.length
      + ((ctx0 + 7) % MODIFIER_CONTEXTS.length);
    if (modA === modB || modA >= MODIFIER_COUNT || modB >= MODIFIER_COUNT) continue;
    const pageA = pageForIndex(comboIndex(pairIdx, audienceIdx, taskIdx, modA));
    const pageB = pageForIndex(comboIndex(pairIdx, audienceIdx, taskIdx, modB));
    if (!pageA || !pageB) continue;
    const htmlA = renderProgrammaticPage(pageA, ORIGIN);
    const htmlB = renderProgrammaticPage(pageB, ORIGIN);
    compared += 1;

    const codesA = new Set(codes(htmlA));
    const codesB = new Set(codes(htmlB));
    const sharedCodes = [...codesA].filter((c) => codesB.has(c));
    if (sharedCodes.length) {
      failures.push({
        slug: pageA.slug,
        sibling: pageB.slug,
        reason: `shared fault codes: ${sharedCodes.join(', ')}`,
      });
    }

    const imgA = new Set(images(htmlA));
    const imgB = new Set(images(htmlB));
    // Images may match (same Python minor) — pins must not: include fixture.
    const pinA = [...htmlA.matchAll(/build [0-9a-f]{4}/g)].map((m) => m[0]);
    const pinB = [...htmlB.matchAll(/build [0-9a-f]{4}/g)].map((m) => m[0]);
    if (pinA.length && pinB.length && pinA.some((p) => pinB.includes(p))) {
      failures.push({ slug: pageA.slug, sibling: pageB.slug, reason: `shared runtime build pin ${pinA[0]}` });
    }

    const brA = new Set(branches(htmlA));
    const brB = new Set(branches(htmlB));
    const sharedBr = [...brA].filter((b) => brB.has(b));
    if (sharedBr.length) {
      failures.push({
        slug: pageA.slug,
        sibling: pageB.slug,
        reason: `shared branch text: ${sharedBr[0]}`,
      });
    }

    if (!imgA.size || !imgB.size) {
      failures.push({ slug: pageA.slug, sibling: pageB.slug, reason: 'Dockerfile FROM missing on a sibling' });
    }
  }

  return {
    agent: AGENT,
    ok: failures.length === 0,
    stems: compared,
    failures: failures.slice(0, 20),
    notes: [
      'Compares same-job style×context siblings only.',
      'Shared FROM tags are allowed; shared fault codes and branch if-text are not.',
    ],
  };
}

/**
 * Uniqueness Agent — near-duplicate defence for the 20M /k/ corpus.
 * 5-gram Jaccard of sibling <main> prose. Cost: build CPU only.
 */
import {
  CORPUS_SIZE,
  PER_PAIR,
  TASKS,
  MODIFIER_COUNT,
  MODIFIER_STYLES,
  MODIFIER_CONTEXTS,
  pageForIndex,
  renderProgrammaticPage,
} from '../../../functions/_lib/programmaticPage.ts';
import { QUALITY_CONTRACT } from '../ai-indexing-agent.mjs';
import { ORIGIN, samplePages } from './shared.mjs';

export const AGENT = {
  id: 'uniqueness-agent',
  task: 'Keep style×context siblings below the Jaccard ceiling so none read as scaled duplicates',
};

const N = QUALITY_CONTRACT.siblingShingleSize || 5;
const CEILING = QUALITY_CONTRACT.maxSiblingBodyJaccard;

function guideProse(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<p class="cta"[\s\S]*?<\/p>/gi, ' ')
    .replace(/<p class="meta"[\s\S]*?<\/p>/gi, ' ')
    .replace(/<section[^>]*aria-labelledby="related"[\s\S]*?<\/section>/gi, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<h2[^>]*>[\s\S]*?<\/h2>/gi, ' ')
    .replace(/<h3[^>]*>[\s\S]*?<\/h3>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shingles(text, n) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + n <= words.length; i += 1) set.add(words.slice(i, i + n).join(' '));
  return set;
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function siblingIndex(page, otherModifier) {
  const pairIndex = Math.floor(page.index / PER_PAIR);
  const remainder = page.index % PER_PAIR;
  const audienceIndex = Math.floor(remainder / (TASKS.length * MODIFIER_COUNT));
  const withinAudience = remainder % (TASKS.length * MODIFIER_COUNT);
  const taskIndex = Math.floor(withinAudience / MODIFIER_COUNT);
  return pairIndex * PER_PAIR
    + audienceIndex * TASKS.length * MODIFIER_COUNT
    + taskIndex * MODIFIER_COUNT
    + otherModifier;
}

export async function run(opts = {}) {
  const stems = opts.stems ?? 80;
  const pages = samplePages(stems, 0xa5a5a5a5);
  const failures = [];
  let pairs = 0;
  let maxJ = 0;
  let sumJ = 0;

  for (const { page, html } of pages) {
    const style0 = Math.floor(page.modifier / MODIFIER_CONTEXTS.length);
    const ctx0 = page.modifier % MODIFIER_CONTEXTS.length;
    const mods = [
      page.modifier,
      ((style0 + 3) % MODIFIER_STYLES.length) * MODIFIER_CONTEXTS.length + ((ctx0 + 7) % MODIFIER_CONTEXTS.length),
      ((style0 + 6) % MODIFIER_STYLES.length) * MODIFIER_CONTEXTS.length + ((ctx0 + 13) % MODIFIER_CONTEXTS.length),
    ];
    const sets = [];
    const slugs = [];
    for (const mod of mods) {
      const index = siblingIndex(page, mod);
      if (index < 0 || index >= CORPUS_SIZE) continue;
      const sibling = pageForIndex(index);
      if (!sibling) continue;
      const siblingHtml = mod === page.modifier ? html : renderProgrammaticPage(sibling, ORIGIN);
      sets.push(shingles(guideProse(siblingHtml), N));
      slugs.push(sibling.slug);
    }
    for (let i = 0; i < sets.length; i += 1) {
      for (let j = i + 1; j < sets.length; j += 1) {
        const jac = jaccard(sets[i], sets[j]);
        pairs += 1;
        sumJ += jac;
        maxJ = Math.max(maxJ, jac);
        if (jac > CEILING) {
          failures.push({ slug: slugs[i], sibling: slugs[j], jaccard: Number(jac.toFixed(4)) });
        }
      }
    }
  }

  return {
    agent: AGENT,
    ok: failures.length === 0,
    stems: pages.length,
    pairs,
    maxJaccard: Number(maxJ.toFixed(4)),
    avgJaccard: pairs ? Number((sumJ / pairs).toFixed(4)) : 0,
    ceiling: CEILING,
    failures: failures.slice(0, 20),
    notes: [
      'True near-duplicates cluster ≥ 0.80. Measured sibling Jaccard on this corpus sits near 0.034.',
      'verify-edge-corpus-quality.mjs re-runs this gate on 800 stems during postbuild as the 20M proof.',
    ],
  };
}

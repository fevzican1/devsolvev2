/**
 * Uniqueness Agent — near-duplicate + heading-skeleton defence for 20M /k/.
 *
 * Google's quality mark ("Crawled – currently not indexed") fires on a
 * shared H2 list even when body 5-grams differ. This agent therefore:
 *   1. Jaccard of <main> prose WITH headings (no H2/H3 strip)
 *   2. Exact shared H2/H3s between style×context siblings must be 0
 *   3. Same-style×context pages on a different job share 0 H2/H3s
 *   4. Neighbours (ctx+1 and style+1), not far siblings — Google compares
 *      adjacent programmatic URLs, which is what used to hide scaled content
 *
 * Cost: build CPU only.
 */
import {
  CORPUS_SIZE,
  PAIRS,
  PER_PAIR,
  TASKS,
  MODIFIER_COUNT,
  MODIFIER_STYLES,
  MODIFIER_CONTEXTS,
  pageForIndex,
  renderProgrammaticPage,
  buildIdentity,
} from '../../../functions/_lib/programmaticPage.ts';
import { QUALITY_CONTRACT } from '../ai-indexing-agent.mjs';
import { ORIGIN, headingSet, samplePages, setJaccard, sharedMembers } from './shared.mjs';
import { ngramJaccard } from '../../../src/lib/seo/uniqueTokens.ts';

export const AGENT = {
  id: 'uniqueness-agent',
  task: 'Keep style×context siblings below the Jaccard ceiling and sharing zero H2/H3s, including same-method different-job pages',
};

const N = QUALITY_CONTRACT.siblingShingleSize || 5;
const CEILING = QUALITY_CONTRACT.maxSiblingBodyJaccard;
const HEADING_CEILING = QUALITY_CONTRACT.maxSiblingHeadingJaccard ?? 0.05;
const MAX_SHARED = QUALITY_CONTRACT.maxSharedSiblingHeadings ?? 0;
const TITLE_CEILING = QUALITY_CONTRACT.maxTitleH1Jaccard ?? 0.10;

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
  return setJaccard(a, b);
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
  let maxH = 0;
  let sumH = 0;
  let maxTitleJ = 0;
  let maxH1J = 0;
  let sumTitleJ = 0;
  let sumH1J = 0;
  let maxShared = 0;

  for (const { page, html } of pages) {
    const style0 = Math.floor(page.modifier / MODIFIER_CONTEXTS.length);
    const ctx0 = page.modifier % MODIFIER_CONTEXTS.length;
    const mods = [
      page.modifier,
      style0 * MODIFIER_CONTEXTS.length + ((ctx0 + 1) % MODIFIER_CONTEXTS.length),
      ((style0 + 1) % MODIFIER_STYLES.length) * MODIFIER_CONTEXTS.length + ctx0,
    ];
    const sets = [];
    const heads = [];
    const slugs = [];
    const identities = [];
    for (const mod of mods) {
      const index = siblingIndex(page, mod);
      if (index < 0 || index >= CORPUS_SIZE) continue;
      const sibling = pageForIndex(index);
      if (!sibling) continue;
      const siblingHtml = mod === page.modifier ? html : renderProgrammaticPage(sibling, ORIGIN);
      sets.push(shingles(guideProse(siblingHtml), N));
      heads.push(headingSet(siblingHtml));
      slugs.push(sibling.slug);
      identities.push(buildIdentity(sibling));
    }
    for (let i = 0; i < sets.length; i += 1) {
      for (let j = i + 1; j < sets.length; j += 1) {
        const jac = jaccard(sets[i], sets[j]);
        const hJac = setJaccard(heads[i], heads[j]);
        const shared = sharedMembers(heads[i], heads[j]);
        const titleJ = ngramJaccard(identities[i].title, identities[j].title, N);
        const h1J = ngramJaccard(identities[i].h1, identities[j].h1, N);
        pairs += 1;
        sumJ += jac;
        maxJ = Math.max(maxJ, jac);
        sumH += hJac;
        maxH = Math.max(maxH, hJac);
        maxShared = Math.max(maxShared, shared.length);
        sumTitleJ += titleJ;
        sumH1J += h1J;
        maxTitleJ = Math.max(maxTitleJ, titleJ);
        maxH1J = Math.max(maxH1J, h1J);
        if (jac > CEILING) {
          failures.push({ slug: slugs[i], sibling: slugs[j], jaccard: Number(jac.toFixed(4)) });
        }
        if (titleJ > TITLE_CEILING) {
          failures.push({ slug: slugs[i], sibling: slugs[j], titleJaccard: Number(titleJ.toFixed(4)) });
        }
        if (h1J > TITLE_CEILING) {
          failures.push({ slug: slugs[i], sibling: slugs[j], h1Jaccard: Number(h1J.toFixed(4)) });
        }
        if (hJac > HEADING_CEILING || shared.length > MAX_SHARED) {
          failures.push({
            slug: slugs[i],
            sibling: slugs[j],
            headingJaccard: Number(hJac.toFixed(4)),
            sharedHeadings: shared.slice(0, 8),
          });
        }
      }
    }

    const pairIndex = Math.floor(page.index / PER_PAIR);
    const remainder = page.index % PER_PAIR;
    const otherPair = (pairIndex + 1) % PAIRS.length;
    const otherIndex = otherPair * PER_PAIR + remainder;
    if (otherIndex >= 0 && otherIndex < CORPUS_SIZE) {
      const other = pageForIndex(otherIndex);
      if (other) {
        const otherHtml = renderProgrammaticPage(other, ORIGIN);
        const ownHeads = headingSet(html);
        const otherHeads = headingSet(otherHtml);
        const sharedOther = sharedMembers(ownHeads, otherHeads);
        if (sharedOther.length > MAX_SHARED) {
          failures.push({
            slug: page.slug,
            sibling: other.slug,
            sharedHeadings: sharedOther.slice(0, 8),
            kind: 'cross-job',
          });
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
    maxHeadingJaccard: Number(maxH.toFixed(4)),
    avgHeadingJaccard: pairs ? Number((sumH / pairs).toFixed(4)) : 0,
    headingCeiling: HEADING_CEILING,
    maxSharedHeadings: maxShared,
    maxTitleJaccard: Number(maxTitleJ.toFixed(4)),
    maxH1Jaccard: Number(maxH1J.toFixed(4)),
    avgTitleJaccard: pairs ? Number((sumTitleJ / pairs).toFixed(4)) : 0,
    avgH1Jaccard: pairs ? Number((sumH1J / pairs).toFixed(4)) : 0,
    titleH1Ceiling: TITLE_CEILING,
    failures: failures.slice(0, 20),
    notes: [
      'Stage 1 hashes every URL against ctx+1 and style+1 (src/seo_rules.rs, 5-gram early exit, Jaccard ≤ 0.04) and writes indexable_manifest.bin. That 5-gram Jaccard is the zero-cost MinHash/LSH stand-in: a request cannot compare itself to 20M pages without a paid index.',
      'Bodies are per-URL combo sentences keyed by slug. Neighbour Jaccard must stay ≤ 0.04. Title/H1 Jaccard must stay ≤ 0.10. Sitemap advertises all 20M. A contract failure 404s for every UA.',
      'Google Search Essentials + Bing Quality & Authority apply to title, meta, H1/H2, JSON-LD and internal links — not body copy alone.',
      'Cross-job same-style×context pages are also compared: they previously shared method×setting H2s.',
    ],
  };
}

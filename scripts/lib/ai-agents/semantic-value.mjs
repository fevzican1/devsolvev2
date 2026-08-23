/**
 * Semantic-value agent — $0 local policy.
 *
 * Google's "independent search intent" bar is not Jaccard. This agent
 * checks that every sampled /k/ page ships information-gain artefacts:
 * executable replay, unique fault table, if/then forks, semantic hops.
 */
import { QUALITY_CONTRACT } from '../ai-indexing-agent.mjs';
import { scorePage } from '../ai-quality-scoring.mjs';
import { pageForIndex } from '../../../functions/_lib/programmaticPage.ts';
import { extract, samplePages } from './shared.mjs';

export const AGENT = {
  id: 'semantic-value-agent',
  family: 'local-policy',
  task: 'Prove each /k/ URL offers executable, tabulated, branched value — not only unique prose',
};

function codes(html) {
  return [...html.matchAll(/data-error-code="([^"]+)"/g)].map((m) => m[1]);
}

function hops(html) {
  return [...html.matchAll(/data-rel="([^"]+)"/g)].map((m) => m[1]);
}

export async function run(opts = {}) {
  const count = opts.sample ?? 80;
  const pages = samplePages(count, 0x7f4a7c13);
  const failures = [];
  let minScore = 100;

  for (const { page, html } of pages) {
    const url = `https://devsolvev2.com/k/${page.slug}`;
    const scored = scorePage(html, { expectedCanonical: url });
    minScore = Math.min(minScore, scored.score);

    if (!scored.signals?.hasCompatMatrix) {
      failures.push({ slug: page.slug, reason: 'compat/error matrix missing' });
    }
    if (!scored.signals?.hasExecutablePack) {
      failures.push({ slug: page.slug, reason: 'Dockerfile/Bash pack missing' });
    }
    if (!scored.signals?.hasBranchTree) {
      failures.push({ slug: page.slug, reason: 'if/then tree missing' });
    }
    if (!scored.signals?.hasSemanticHops) {
      failures.push({ slug: page.slug, reason: 'semantic hops missing' });
    }

    const faultCodes = codes(html);
    if (faultCodes.length < QUALITY_CONTRACT.minErrorRows) {
      failures.push({ slug: page.slug, reason: `only ${faultCodes.length} fault codes` });
    }
    if (new Set(faultCodes).size !== faultCodes.length) {
      failures.push({ slug: page.slug, reason: 'duplicate fault codes on one page' });
    }
    if (!faultCodes.every((c) => /-[0-9a-f]{4}$/i.test(c))) {
      failures.push({ slug: page.slug, reason: 'fault codes are not URL-owned hex suffixes' });
    }

    if (!/FROM\s+python:/i.test(html)) {
      failures.push({ slug: page.slug, reason: 'Dockerfile does not pin a python image' });
    }
    if (!html.includes(`DEVSOLVE_FIXTURE=fx-`) && !html.includes('DEVSOLVE_FIXTURE: fx-')) {
      failures.push({ slug: page.slug, reason: 'executable pack is not bound to this fixture' });
    }

    const rels = new Set(hops(html));
    for (const need of ['next-task', 'observe', 'method', 'intent']) {
      if (!rels.has(need)) failures.push({ slug: page.slug, reason: `missing data-rel=${need}` });
    }

    const nextHref = extract(html, /href="\/k\/([^"]+)"[^>]*data-rel="next-task"/i)
      || extract(html, /data-rel="next-task"[^>]*href="\/k\/([^"]+)"/i);
    if (nextHref) {
      const suffix = Number((nextHref.match(/-(\d+)$/) || [])[1]);
      const next = Number.isFinite(suffix) ? pageForIndex(suffix) : undefined;
      if (!next) failures.push({ slug: page.slug, reason: `next-task ${nextHref} is not a real /k/ page` });
      else if (next.task === page.task) failures.push({ slug: page.slug, reason: 'next-task hop stays on the same task' });
      else if (next.tool !== page.tool) failures.push({ slug: page.slug, reason: 'next-task hop left the tool' });
    }
  }

  return {
    agent: AGENT,
    ok: failures.length === 0,
    scanned: pages.length,
    minScore: pages.length ? minScore : 0,
    failures: failures.slice(0, 20),
    notes: [
      'No hosted LLM. Information gain is proven on the served HTML contract.',
      'Fault codes carry a per-URL hex suffix so siblings cannot share a row.',
    ],
  };
}

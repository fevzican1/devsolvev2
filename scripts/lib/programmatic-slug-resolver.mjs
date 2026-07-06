/**
 * Programmatic Slug Resolver (shared, source-literal extraction)
 * ================================================================
 *
 * Re-implements the /k/* index<->slug math from `functions/k/[[slug]].ts`
 * by parsing the array literals straight out of that source file — the same
 * dependency-free technique `scripts/slug-parity-check.mjs` uses — so this
 * module never has to import the Cloudflare Pages Function (whose file name
 * `[[slug]].ts` and Worker-only types make it awkward to load directly under
 * Node/tsx) yet stays byte-identical to how the Function actually resolves a
 * request.
 *
 * `resolves(slug)` tells you whether `functions/k/[[slug]].ts` would serve
 * `slug` directly with 200 OK (canonical-first hit, no redirect). If it
 * returns false, `legacyRedirectTarget(slug)` tells you the exact canonical
 * slug the Function would 301 to (or `undefined` if the slug does not even
 * match the legacy shape and would 404).
 *
 * Any *internal* link that points at a slug where `resolves()` is false is a
 * crawl-budget-wasting 301 hop for Googlebot/Bingbot — see
 * `scripts/internal-link-redirect-audit.mjs`, which is the consumer this
 * module was built for.
 */

import { readFileSync } from 'node:fs';

/** Slice the array literal that follows `const <name>` up to its matching `]`. */
function extractArrayBlock(src, name) {
  const re = new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\[`);
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // position of the opening '['
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/** All single-quoted string literals inside a block, in source order. */
function quotedStrings(block) {
  return [...block.matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

function extractFlatArray(src, name) {
  const block = extractArrayBlock(src, name);
  if (!block) return null;
  return quotedStrings(block);
}

function extractClusters(src) {
  const block = extractArrayBlock(src, 'clusters');
  if (!block) return null;
  const clusters = [];
  const clusterRe = /key:\s*'([^']+)'[\s\S]*?tools:\s*\[([\s\S]*?)\][\s\S]*?intents:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = clusterRe.exec(block)) !== null) {
    clusters.push({
      key: m[1],
      tools: quotedStrings(`[${m[2]}]`),
      intents: quotedStrings(`[${m[3]}]`),
    });
  }
  return clusters;
}

/**
 * Build a resolver bound to a specific `functions/k/[[slug]].ts` file.
 * Returns `null` if the source's combinatorial arrays could not be parsed
 * (caller should treat that as a hard failure — the guard has gone blind).
 */
export function buildProgrammaticSlugResolver(functionFile) {
  const src = readFileSync(functionFile, 'utf8');
  const clusters = extractClusters(src);
  const audiences = extractFlatArray(src, 'audiences');
  const tasks = extractFlatArray(src, 'tasks');
  const exec = extractFlatArray(src, 'modifierExecutionStyles');
  const delivery = extractFlatArray(src, 'modifierDeliveryContexts');

  if (!clusters?.length || !audiences?.length || !tasks?.length || !exec?.length || !delivery?.length) {
    return null;
  }

  const toolIntentPairs = [];
  for (const c of clusters) {
    for (const tool of c.tools) {
      for (const intent of c.intents) {
        toolIntentPairs.push({ clusterKey: c.key, tool, intent });
      }
    }
  }
  const modifiers = exec.flatMap((s) => delivery.map((ctx) => `${s}-${ctx}`));

  const AUD = audiences.length;
  const TSK = tasks.length;
  const MOD = modifiers.length;
  const PER_PAIR = AUD * TSK * MOD;
  const TOTAL = toolIntentPairs.length * PER_PAIR;

  const buildSlug = (clusterKey, intent, audience, task, tool, index) =>
    [clusterKey, intent, audience, task, tool]
      .join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + `-${index}`;

  function slugForIndex(index) {
    if (index < 0 || index >= TOTAL) return undefined;
    const pairIndex = Math.floor(index / PER_PAIR);
    const remainder = index % PER_PAIR;
    const audienceIndex = Math.floor(remainder / (TSK * MOD));
    const remainder2 = remainder % (TSK * MOD);
    const taskIndex = Math.floor(remainder2 / MOD);
    const pair = toolIntentPairs[pairIndex];
    const audience = audiences[audienceIndex];
    const task = tasks[taskIndex];
    if (!pair || !audience || !task) return undefined;
    return buildSlug(pair.clusterKey, pair.intent, audience, task, pair.tool, index);
  }

  /** True when the Function serves `slug` directly with 200 OK (no redirect). */
  function resolves(slug) {
    const m = slug.match(/-(\d+)$/);
    if (!m) return false;
    const index = Number.parseInt(m[1], 10);
    return slugForIndex(index) === slug;
  }

  const sortedIntents = Array.from(new Set(clusters.flatMap((c) => c.intents))).sort((a, b) => b.length - a.length);
  const sortedAudiences = [...audiences].sort((a, b) => b.length - a.length);
  const sortedTasks = [...tasks].sort((a, b) => b.length - a.length);

  /**
   * Mirrors `tryResolveLegacyProgrammaticSlug()`: parses a
   * cluster-intent-audience-task-tool stem out of a shape-valid slug and
   * rebuilds the canonical target the Function 301s to (always modifier
   * slot 0). Returns `undefined` if the slug does not even match the legacy
   * shape (i.e. it would 404, not 301).
   */
  function legacyRedirectTarget(slug) {
    const m = slug.match(/^(.*)-([0-9]+)$/);
    if (!m) return undefined;
    const stem = m[1];
    const cluster = clusters.find((c) => stem.startsWith(`${c.key}-`));
    if (!cluster) return undefined;
    let cursor = stem.slice(cluster.key.length + 1);
    const intent = sortedIntents.find((c) => cursor.startsWith(`${c}-`));
    if (!intent) return undefined;
    cursor = cursor.slice(intent.length + 1);
    const audience = sortedAudiences.find((c) => cursor.startsWith(`${c}-`));
    if (!audience) return undefined;
    cursor = cursor.slice(audience.length + 1);
    const task = sortedTasks.find((c) => cursor.startsWith(`${c}-`));
    if (!task) return undefined;
    cursor = cursor.slice(task.length + 1);
    const tool = cluster.tools.find((c) => c === cursor);
    if (!tool) return undefined;
    const pairIndex = toolIntentPairs.findIndex(
      (p) => p.clusterKey === cluster.key && p.intent === intent && p.tool === tool,
    );
    if (pairIndex < 0) return undefined;
    const audienceIndex = audiences.indexOf(audience);
    const taskIndex = tasks.indexOf(task);
    const remappedIndex = pairIndex * PER_PAIR + audienceIndex * TSK * MOD + taskIndex * MOD + 0;
    return slugForIndex(remappedIndex);
  }

  return {
    TOTAL,
    PER_PAIR,
    counts: { pairs: toolIntentPairs.length, audiences: AUD, tasks: TSK, modifiers: MOD },
    slugForIndex,
    resolves,
    legacyRedirectTarget,
  };
}

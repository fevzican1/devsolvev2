/**
 * Shared plain-text window for Stage-1 Jaccard. Must match
 * scripts/verify-edge-corpus-quality.mjs extractMainText so offline audit
 * and the uniqueness agent score the same bytes.
 */
export function extractMainText(html) {
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
    .trim()
    .toLowerCase();
}

export function extractHeadingSet(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const set = new Set();
  for (const match of main.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)) {
    const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (text) set.add(text);
  }
  return set;
}

export function extractJsonLdText(html) {
  const parts = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    parts.push(match[1]);
  }
  return parts.join('\n');
}

export function fingerprint(value) {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return h1 * 2097152 + (h2 >>> 11);
}

export const MODIFIER_SPAN = 180;
export const STYLE_COUNT = 9;
export const CONTEXT_COUNT = 20;

export function stemCount(corpusSize) {
  return Math.ceil(corpusSize / MODIFIER_SPAN);
}

export function shardStemRange(shard, shards, corpusSize) {
  const stems = stemCount(corpusSize);
  const startStem = Math.floor((shard * stems) / shards);
  const endStem = Math.floor(((shard + 1) * stems) / shards);
  return {
    startStem,
    endStem,
    startIndex: startStem * MODIFIER_SPAN,
    endIndex: Math.min(endStem * MODIFIER_SPAN, corpusSize),
  };
}

export function neighbourModifiers(modifier) {
  const style = Math.floor(modifier / CONTEXT_COUNT);
  const ctx = modifier % CONTEXT_COUNT;
  return [
    style * CONTEXT_COUNT + ((ctx + 1) % CONTEXT_COUNT),
    ((style + 1) % STYLE_COUNT) * CONTEXT_COUNT + ctx,
  ];
}

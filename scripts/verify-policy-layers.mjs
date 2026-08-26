#!/usr/bin/env node
/**
 * Proof that Google/Bing hard constraints hold on Title, H1, meta, JSON-LD,
 * hub labels and neighbour Jaccard — not body copy alone.
 */
import {
  pageForIndex,
  buildIdentity,
  renderProgrammaticPage,
  resolvePageForSlug,
  CORPUS_SIZE,
  MODIFIER_CONTEXTS,
  MODIFIER_STYLES,
  MODIFIER_COUNT,
  PAIRS,
  PER_PAIR,
  TASKS,
  AUDIENCES,
} from '../functions/_lib/programmaticPage.ts';
import { edgeQualityGate } from '../functions/_lib/qualityGate.ts';
import { scorePage } from './lib/ai-quality-scoring.mjs';
import {
  uniqueTokens,
  hasDuplicateContentTokens,
  ngramJaccard,
  MAX_KEYWORD_DENSITY,
  MAX_TITLE_H1_JACCARD,
  MIN_INDEXABLE_WORDS,
} from '../src/lib/seo/uniqueTokens.ts';
import { formatProgrammaticHubLabel, looksLikeSlugDumpLabel } from '../src/lib/programmatic/hub.ts';
import { fiveAtomTitleForSlug, isFiveAtomIdentityTitle } from '../src/lib/seo/factoryIdentity.ts';
import { QUALITY_CONTRACT } from './lib/ai-indexing-agent.mjs';
import { getOrRefreshHubLinks } from '../src/lib/indexing/hubDiscovery.ts';
import { staticProgrammaticSlugs } from '../src/lib/programmatic/staticPaths.ts';

const ORIGIN = 'https://devsolvev2.com';
const SAMPLE = Number(process.env.POLICY_SAMPLE ?? 48);

function comboIndex(pairIdx, audienceIdx, taskIdx, modifier) {
  return pairIdx * PER_PAIR + audienceIdx * TASKS.length * MODIFIER_COUNT + taskIdx * MODIFIER_COUNT + modifier;
}

const cases = [
  ['Json validate json backend engineer prepare', 'JSON validate backend engineer prepare'],
  ['validate JSON validation', 'validate JSON'],
  ['JSON validation JSON formatter', 'JSON validation formatter'],
];

if (looksLikeSlugDumpLabel('JSON Validate Backend Engineer Prepare') !== true) {
  console.error('FAIL looksLikeSlugDumpLabel must catch the homepage dump');
  process.exit(1);
}
if (looksLikeSlugDumpLabel('Safely Decoding Tokens in the Browser (No Verification)') !== false) {
  console.error('FAIL looksLikeSlugDumpLabel false-positive on a real guide title');
  process.exit(1);
}

const dumpSlug = staticProgrammaticSlugs.find((slug) => /validate-json-backend-engineer-prepare/.test(slug))
  || staticProgrammaticSlugs[0];
if (dumpSlug) {
  const cleaned = formatProgrammaticHubLabel(dumpSlug);
  if (looksLikeSlugDumpLabel(cleaned) || /JSON Validate Backend Engineer Prepare/i.test(cleaned)) {
    console.error(`FAIL homepage hub label still dumped: "${cleaned}" for ${dumpSlug}`);
    process.exit(1);
  }
}

const homeHub = await getOrRefreshHubLinks({ hubPath: '/', siteUrl: ORIGIN, count: 10 });
for (const link of homeHub.links) {
  if (looksLikeSlugDumpLabel(link.title) || /JSON Validate Backend Engineer Prepare/i.test(link.title)) {
    console.error(`FAIL homepage Guides & Tools still dumped: "${link.title}" (${link.href})`);
    process.exit(1);
  }
  if (link.href.startsWith('/k/') && !isFiveAtomIdentityTitle(link.title)) {
    console.error(`FAIL homepage /k/ anchor is not a 5-atom identity title: "${link.title}" (${link.href})`);
    process.exit(1);
  }
}
for (const slug of staticProgrammaticSlugs.slice(0, 120)) {
  const label = formatProgrammaticHubLabel(slug);
  const identity = fiveAtomTitleForSlug(slug);
  if (looksLikeSlugDumpLabel(label) || /JSON Validate Backend Engineer Prepare/i.test(label)) {
    console.error(`FAIL static hub label dumped: "${label}" for ${slug}`);
    process.exit(1);
  }
  if (!isFiveAtomIdentityTitle(label)) {
    console.error(`FAIL static hub label is not 5-atom: "${label}" for ${slug}`);
    process.exit(1);
  }
  if (identity && label !== identity) {
    console.error(`FAIL hub label drifted from factory identity: hub="${label}" identity="${identity}" for ${slug}`);
    process.exit(1);
  }
}

const unit = [];
for (const [dirty, _expect] of cases) {
  const clean = uniqueTokens(dirty);
  const ok = !hasDuplicateContentTokens(clean) && !/\bjson\b.*\bjson\b/i.test(clean);
  unit.push({ dirty, clean, ok });
  if (!ok) {
    console.error(`FAIL unit uniqueTokens("${dirty}") → "${clean}"`);
    process.exit(1);
  }
}

let identityFails = 0;
let gateFails = 0;
let openingFails = 0;
let titleJ = 0;
let h1J = 0;
let minWords = Infinity;
let hubFails = 0;
const examples = [];

const OPENING_REGRESSION = [
  'security-rotate-unique-identifiers-release-engineer-resolve-merge-conflict-jwt-decoder-5413911',
  'data-aggregate-data-records-devops-engineer-generate-test-fixtures-hash-generator-13674188',
];
const TITLE_COLLISION_REGRESSION = [
  'api-validate-api-response-technical-writer-prepare-api-response-json-formatter-9757743',
  'api-validate-api-response-technical-writer-document-api-endpoint-json-formatter-9759543',
];
for (const slug of TITLE_COLLISION_REGRESSION) {
  const page = resolvePageForSlug(slug);
  if (!page) {
    identityFails += 1;
    examples.push({ slug, issues: ['title-collision slug did not resolve'] });
    continue;
  }
  const id = buildIdentity(page);
  if (id.title.trim().split(/\s+/).length !== 5 || id.title !== id.h1) {
    identityFails += 1;
    examples.push({ slug, issues: [`collapsed 5-atom title: "${id.title}"`] });
  }
}
{
  const collisionA = resolvePageForSlug(TITLE_COLLISION_REGRESSION[0]);
  const collisionB = resolvePageForSlug(TITLE_COLLISION_REGRESSION[1]);
  if (collisionA && collisionB && buildIdentity(collisionA).title === buildIdentity(collisionB).title) {
    identityFails += 1;
    examples.push({
      slug: TITLE_COLLISION_REGRESSION[0],
      issues: [`title still collides with ${TITLE_COLLISION_REGRESSION[1]}: "${buildIdentity(collisionA).title}"`],
    });
  }
}
for (const slug of OPENING_REGRESSION) {
  const page = resolvePageForSlug(slug);
  if (!page) {
    openingFails += 1;
    examples.push({ slug, issues: ['slug did not resolve'] });
    continue;
  }
  const html = renderProgrammaticPage(page, ORIGIN);
  const scored = scorePage(html, { expectedCanonical: `${ORIGIN}/k/${page.slug}` });
  if (!scored.signals?.hasIndependentOpening) {
    openingFails += 1;
    if (examples.length < 8) {
      examples.push({
        slug,
        title: buildIdentity(page).title,
        lead: html.match(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/i)?.[1],
        opening: scored.signals?.hasIndependentOpening,
      });
    }
  }
}

for (let i = 0; i < SAMPLE; i += 1) {
  const index = Math.floor((i * 1_000_003) % CORPUS_SIZE);
  const page = pageForIndex(index);
  const id = buildIdentity(page);
  if (hasDuplicateContentTokens(id.title) || uniqueTokens(id.title) !== id.title) identityFails += 1;
  if (hasDuplicateContentTokens(id.h1) || uniqueTokens(id.h1) !== id.h1) identityFails += 1;
  if (hasDuplicateContentTokens(id.description)) identityFails += 1;
  const hub = formatProgrammaticHubLabel(page.slug);
  if (looksLikeSlugDumpLabel(hub) || /JSON Validate Backend Engineer Prepare/i.test(hub)) hubFails += 1;
  if (!isFiveAtomIdentityTitle(hub) || hub !== id.title) hubFails += 1;
  if (looksLikeSlugDumpLabel(id.title) || looksLikeSlugDumpLabel(id.h1)) identityFails += 1;
  if (!isFiveAtomIdentityTitle(id.title) || id.title !== id.h1) identityFails += 1;

  const html = renderProgrammaticPage(page, ORIGIN);
  const gate = edgeQualityGate(html, page);
  if (!gate.ok) {
    gateFails += 1;
    if (examples.length < 8) examples.push({ slug: page.slug, issues: gate.issues, title: id.title, h1: id.h1 });
  }
  const scored = scorePage(html, { expectedCanonical: `${ORIGIN}/k/${page.slug}` });
  if (!scored.signals?.hasIndependentOpening) {
    openingFails += 1;
    if (examples.length < 8) examples.push({ slug: page.slug, title: id.title, opening: false });
  }

  const pairIdx = Math.floor(page.index / PER_PAIR);
  const remainder = page.index % PER_PAIR;
  const audienceIndex = Math.floor(remainder / (TASKS.length * MODIFIER_COUNT));
  const withinAudience = remainder % (TASKS.length * MODIFIER_COUNT);
  const taskIndex = Math.floor(withinAudience / MODIFIER_COUNT);
  const style0 = Math.floor(page.modifier / MODIFIER_CONTEXTS.length);
  const ctx0 = page.modifier % MODIFIER_CONTEXTS.length;
  const neighbourMods = [
    style0 * MODIFIER_CONTEXTS.length + ((ctx0 + 1) % MODIFIER_CONTEXTS.length),
    ((style0 + 1) % MODIFIER_STYLES.length) * MODIFIER_CONTEXTS.length + ctx0,
  ];
  for (const mod of neighbourMods) {
    const nIndex = comboIndex(pairIdx, audienceIndex, taskIndex, mod);
    if (nIndex < 0 || nIndex >= CORPUS_SIZE) continue;
    const sibling = pageForIndex(nIndex);
    if (!sibling) continue;
    const other = buildIdentity(sibling);
    titleJ = Math.max(titleJ, ngramJaccard(id.title, other.title, 5));
    h1J = Math.max(h1J, ngramJaccard(id.h1, other.h1, 5));
  }

  const words = (html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .match(/[A-Za-z][A-Za-z'-]*/g) || [];
  minWords = Math.min(minWords, words.length);

  if (i === 0) {
    examples.unshift({
      slug: page.slug,
      title: id.title,
      h1: id.h1,
      description: id.description,
      hub,
      titleTokens: id.title.split(/\s+/).length,
    });
  }
}

const report = {
  policy: QUALITY_CONTRACT.googleBingPolicy,
  unit,
  sample: SAMPLE,
  identityFails,
  gateFails,
  openingFails,
  hubFails,
  maxTitleJaccard: Number(titleJ.toFixed(4)),
  maxH1Jaccard: Number(h1J.toFixed(4)),
  titleH1Ceiling: MAX_TITLE_H1_JACCARD,
  minWords,
  minWordsRequired: MIN_INDEXABLE_WORDS,
  maxKeywordDensity: MAX_KEYWORD_DENSITY,
  examples,
};

console.log(JSON.stringify(report, null, 2));

if (
  identityFails
  || gateFails
  || openingFails
  || hubFails
  || titleJ > MAX_TITLE_H1_JACCARD
  || h1J > MAX_TITLE_H1_JACCARD
  || minWords < MIN_INDEXABLE_WORDS
) {
  console.error('FAIL — Google/Bing policy layers are not clean');
  process.exit(1);
}

console.log('PASS — uniqueTokens, JSON-LD match, independent opening, 1700+ words, title/H1 Jaccard, hub labels');

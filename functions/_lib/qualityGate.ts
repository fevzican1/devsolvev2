/**
 * Edge quality gate — Google Search Essentials / Bing Webmaster as code.
 *
 * Official, hard-coded constraints (not recommendations). They apply to every
 * layer Google and Bing read first: <title>, <h1>, <h2>, meta description,
 * JSON-LD, and internal-link anchors. Fail → 404 for every user-agent
 * (cloaking is forbidden). The 20M factory must clear this gate, not be
 * deleted down to a smaller band.
 *
 * Neighbour uniqueness (body 5-gram Jaccard ≤ 0.04, title/H1 Jaccard ≤ 0.10)
 * is proven offline by src/seo_rules.rs over all 20M neighbours and recorded
 * in indexable_manifest.bin. The edge cannot MinHash a request against 20M
 * other pages; it enforces the per-document contract and 404s quarantined
 * seeds. Same HTML for every user-agent (cloaking is forbidden).
 */
import {
  TITLE_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  auditServedCopy,
  type ResolvedPage,
} from './programmaticPage';
import { comboBankViolations } from './comboProcedure';
import {
  hasDuplicateContentTokens,
  MIN_INDEXABLE_WORDS,
  uniqueTokens,
} from '../../src/lib/seo/uniqueTokens';
import { metaEndsWithTrailingConjunction } from '../../src/lib/seo/seoRules';
import { validateEeat } from '../../src/lib/seo/eeatRules';

const TITLE_MIN = 30;
const MIN_WORDS = MIN_INDEXABLE_WORDS;
const MIN_H2 = 4;
const MIN_JSON_LD = 3;
const MIN_INTERNAL_LINKS = 14;

export interface QualityGateResult {
  ok: boolean;
  issues: string[];
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(html: string): number {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const text = main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');
  return (text.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
}

function parseJsonLd(html: string): { blocks: Record<string, unknown>[]; invalid: number } {
  const blocks: Record<string, unknown>[] = [];
  let invalid = 0;
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]!.replace(/\\u003c/g, '<'));
      if (parsed && typeof parsed === 'object') blocks.push(parsed as Record<string, unknown>);
      else invalid += 1;
    } catch {
      invalid += 1;
    }
  }
  return { blocks, invalid };
}

function jsonLdByType(blocks: Record<string, unknown>[], type: string): Record<string, unknown> | undefined {
  return blocks.find((block) => block['@type'] === type);
}

/**
 * Structural + copy contract. Same result for Googlebot, Bingbot, and humans.
 */
export function edgeQualityGate(html: string, page: ResolvedPage): QualityGateResult {
  const issues: string[] = [];

  if (/noindex/i.test(html)) issues.push('noindex');
  if (/noarchive/i.test(html)) issues.push('noarchive');
  if (/nosnippet/i.test(html) && !/max-snippet/i.test(html)) issues.push('nosnippet');

  const title = decodeAttr(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    issues.push(`title ${title.length} chars (need ${TITLE_MIN}–${TITLE_MAX})`);
  }
  if (hasDuplicateContentTokens(title) || uniqueTokens(title) !== title) {
    issues.push(`title fails uniqueTokens(): "${title}"`);
  }

  const description = decodeAttr(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ?? '');
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    issues.push(`description ${description.length} chars (need ${DESCRIPTION_MIN}–${DESCRIPTION_MAX})`);
  }
  if (hasDuplicateContentTokens(description)) {
    issues.push('description fails uniqueTokens()');
  }
  if (metaEndsWithTrailingConjunction(description)) {
    issues.push('Meta ends with trailing conjunction');
  }

  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1] ?? '';
  if (!canonical.endsWith(`/k/${page.slug}`)) issues.push('canonical is not self');

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count !== 1) issues.push(`h1 count ${h1Count}`);
  const h1 = decodeAttr((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '').replace(/<[^>]+>/g, ' '));
  if (hasDuplicateContentTokens(h1) || uniqueTokens(h1) !== h1) {
    issues.push(`h1 fails uniqueTokens(): "${h1}"`);
  }
  if (h1 !== title) {
    issues.push('H1 does not match Title exactly');
  }

  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  if (h2 < MIN_H2) issues.push(`h2 count ${h2}`);

  const { blocks, invalid } = parseJsonLd(html);
  if (blocks.length < MIN_JSON_LD) issues.push(`json-ld blocks ${blocks.length}`);
  if (invalid) issues.push(`invalid json-ld (${invalid})`);

  const article = jsonLdByType(blocks, 'TechArticle');
  const howTo = jsonLdByType(blocks, 'HowTo');
  const crumbs = jsonLdByType(blocks, 'BreadcrumbList');
  const itemList = jsonLdByType(blocks, 'ItemList');
  if (!article) issues.push('json-ld missing TechArticle');
  if (article && article.headline !== h1) issues.push('json-ld TechArticle.headline != h1');
  if (article && article.description !== description) issues.push('json-ld TechArticle.description != meta description');
  if (howTo && howTo.name !== h1) issues.push('json-ld HowTo.name != h1');
  if (howTo && howTo.description !== description) issues.push('json-ld HowTo.description != meta description');

  const crumbItems = Array.isArray(crumbs?.itemListElement) ? crumbs.itemListElement as Array<Record<string, unknown>> : [];
  const lastCrumb = crumbItems[crumbItems.length - 1];
  if (lastCrumb && lastCrumb.name !== title) {
    issues.push('json-ld BreadcrumbList name != title');
  }
  for (const item of crumbItems) {
    if (typeof item.name === 'string' && hasDuplicateContentTokens(item.name)) {
      issues.push(`json-ld breadcrumb repeats a token: "${item.name}"`);
    }
  }

  const listItems = Array.isArray(itemList?.itemListElement) ? itemList.itemListElement as Array<Record<string, unknown>> : [];
  const related = html.match(/<section[^>]*aria-labelledby="related"[\s\S]*?<\/section>/i)?.[0] ?? '';
  const relatedNames = [...related.matchAll(/<a href="\/k\/[^"]+"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => decodeAttr(match[1]!.replace(/<[^>]+>/g, ' ')));
  for (const name of relatedNames) {
    if (hasDuplicateContentTokens(name)) issues.push(`internal /k/ anchor repeats a token: "${name}"`);
  }
  for (let i = 0; i < listItems.length; i += 1) {
    const name = listItems[i]?.name;
    if (typeof name !== 'string') continue;
    if (hasDuplicateContentTokens(name)) issues.push(`json-ld ItemList name repeats a token: "${name}"`);
    if (relatedNames[i] && relatedNames[i] !== name) {
      issues.push(`json-ld ItemList name != related anchor at ${i + 1}`);
    }
  }

  const words = countWords(html);
  if (words < MIN_WORDS) issues.push(`thin content (${words} words)`);

  const kLinks = (html.match(/href="\/k\/[a-z0-9-]+"/g) || []).length;
  if (kLinks < MIN_INTERNAL_LINKS) issues.push(`internal /k/ links ${kLinks}`);

  if (!/data-snippet/i.test(html)) issues.push('missing data-snippet');
  if (!/data-entity/i.test(html)) issues.push('missing entity');
  if (!/application\/ld\+json/i.test(html)) issues.push('missing json-ld');
  if ((html.match(/data-error-code=/g) || []).length < 3) issues.push('compat matrix < 3 rows');
  if ((html.match(/data-rel="(?:next-task|observe|method|intent)"/g) || []).length < 4) {
    issues.push('missing semantic hops');
  }

  issues.push(...comboBankViolations());
  issues.push(...auditServedCopy(html, page));
  // E-E-A-T / trust contract — same validator the offline 20M audit runs, so
  // served bytes can never drift from the manifest's audit basis.
  issues.push(...validateEeat(html).issues);

  return { ok: issues.length === 0, issues };
}

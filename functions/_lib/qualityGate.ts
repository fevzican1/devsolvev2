/**
 * Edge quality gate — Google Search Essentials / Bing Webmaster as code.
 *
 * No LLM, no extra Worker, no D1/KV. The page is the dimension tuple rendered
 * by programmaticPage.ts. This module scores the EXACT HTML the Function is
 * about to serve. Fail → 404 for every user-agent (cloaking is forbidden).
 *
 * Neighbour uniqueness (5-gram Jaccard ≤ 0.04) is proven at build time; a
 * request cannot MinHash itself against 20M other pages without a paid index.
 * The edge gate therefore enforces the per-document contract that Google/Bing
 * would use to throw the URL into "Crawled – currently not indexed".
 */
import {
  TITLE_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  auditServedCopy,
  type ResolvedPage,
} from './programmaticPage';

const TITLE_MIN = 30;
const MIN_WORDS = 1000;
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

  const description = decodeAttr(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ?? '');
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    issues.push(`description ${description.length} chars (need ${DESCRIPTION_MIN}–${DESCRIPTION_MAX})`);
  }

  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1] ?? '';
  if (!canonical.endsWith(`/k/${page.slug}`)) issues.push('canonical is not self');

  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1 !== 1) issues.push(`h1 count ${h1}`);

  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  if (h2 < MIN_H2) issues.push(`h2 count ${h2}`);

  const jsonLd = (html.match(/type=["']application\/ld\+json["']/gi) || []).length;
  if (jsonLd < MIN_JSON_LD) issues.push(`json-ld blocks ${jsonLd}`);

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

  issues.push(...auditServedCopy(html, page));

  return { ok: issues.length === 0, issues };
}

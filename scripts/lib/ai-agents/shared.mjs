/**
 * Shared, zero-cost helpers for the free AI indexing agents.
 * No LLM API, no Cloudflare Function, no paid service.
 */
import {
  CORPUS_SIZE,
  pageForIndex,
  renderProgrammaticPage,
} from '../../../functions/_lib/programmaticPage.ts';

export const ORIGIN = 'https://devsolvev2.com';

export function samplePages(count, seed = 0x9e3779b9) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pages = [];
  const seen = new Set();
  while (pages.length < count && seen.size < CORPUS_SIZE) {
    const index = Math.floor(next() * CORPUS_SIZE);
    if (seen.has(index)) continue;
    seen.add(index);
    const page = pageForIndex(index);
    if (!page) continue;
    pages.push({ page, html: renderProgrammaticPage(page, ORIGIN), index });
  }
  return pages;
}

export function extract(html, re) {
  return re.exec(html)?.[1] ?? '';
}

export function mainText(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(html) {
  return mainText(html).split(/\s+/).filter(Boolean).length;
}

export function extractHeadings(html, tag = 'h2') {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  for (const match of html.matchAll(re)) {
    out.push(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return out;
}

export function headingSet(html) {
  return new Set(extractHeadings(html, 'h2').map((h) => h.toLowerCase()).filter(Boolean));
}

export function setJaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function sharedMembers(a, b) {
  const out = [];
  for (const x of a) if (b.has(x)) out.push(x);
  return out;
}

/**
 * Language Agent — Bing abuse "artificially engineered language" /
 * Google scaled-content. Cost: build CPU only.
 */
import { auditServedCopy } from '../../../functions/_lib/programmaticPage.ts';
import { samplePages } from './shared.mjs';

export const AGENT = {
  id: 'language-agent',
  task: 'Prove served copy reads as edited English, not template splices or process jargon',
};

export async function run(opts = {}) {
  const count = opts.sample ?? 80;
  const pages = samplePages(count, 0x7f4a7c15);
  const failures = [];

  for (const { page, html } of pages) {
    const issues = auditServedCopy(html, page);
    if (issues.length) failures.push({ slug: page.slug, issues });
  }

  return {
    agent: AGENT,
    ok: failures.length === 0,
    scanned: pages.length,
    failures: failures.slice(0, 20),
    notes: [
      'Forbids process vocabulary (sibling, crawl budget, Jaccard), lowercase acronyms, and template splices.',
    ],
  };
}

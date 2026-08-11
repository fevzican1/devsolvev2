#!/usr/bin/env node
/**
 * Scans exported HTML in out/ for meta descriptions shorter than Bing's
 * recommended minimum (~150 chars). Exit 1 if any indexable page fails.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeEntities } from './lib/ai-quality-scoring.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outDir = join(projectRoot, 'out');
const reportsDir = join(outDir, 'reports');
const MIN_LENGTH = 150;

function listHtmlFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) listHtmlFiles(file, acc);
    else if (/\.html$/i.test(name)) acc.push(file);
  }
  return acc;
}

function extractMetaDescription(html) {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
    ?? html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  // Shared decoder so this scan, the gatekeeper's audit and its repair step all
  // measure the same string — a hex entity like &#x27; must not count as six.
  return match?.[1] === undefined ? null : decodeEntities(match[1]);
}

function isNoindex(html) {
  return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)
    || /"index"\s*:\s*false/i.test(html);
}

if (!existsSync(outDir)) {
  console.error('scan-out-meta-descriptions: out/ missing — run npm run build first');
  process.exit(1);
}

const failures = [];
const skipped = [];
const passed = [];

for (const file of listHtmlFiles(outDir)) {
  const html = readFileSync(file, 'utf8');
  const description = extractMetaDescription(html);
  const rel = relative(outDir, file).replace(/\\/g, '/');

  if (!description) {
    if (!isNoindex(html)) failures.push({ rel, len: 0, description: '(missing)' });
    else skipped.push({ rel, reason: 'noindex, no description' });
    continue;
  }

  if (description.length < MIN_LENGTH) {
    if (isNoindex(html)) {
      skipped.push({ rel, reason: `noindex, len=${description.length}` });
    } else {
      failures.push({ rel, len: description.length, description });
    }
    continue;
  }

  passed.push({ rel, len: description.length });
}

if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

const report = `Meta Description Scan (${new Date().toISOString()})
Minimum length: ${MIN_LENGTH}
Passed: ${passed.length}
Skipped (noindex): ${skipped.length}
Failed: ${failures.length}

${failures.length ? `FAILURES:\n${failures.map((f) => `  ${f.rel} (${f.len} chars): ${f.description}`).join('\n')}\n` : 'No failures.\n'}
${skipped.length ? `SKIPPED:\n${skipped.map((s) => `  ${s.rel}: ${s.reason}`).join('\n')}\n` : ''}`;

writeFileSync(join(reportsDir, 'meta-descriptions.txt'), report);

if (failures.length) {
  console.error(`Meta description scan FAILED: ${failures.length} page(s) under ${MIN_LENGTH} chars`);
  for (const f of failures) console.error(`  ${f.rel}: ${f.len} chars`);
  process.exit(1);
}

console.log(`Meta description scan OK: ${passed.length} indexable HTML file(s) >= ${MIN_LENGTH} chars`);

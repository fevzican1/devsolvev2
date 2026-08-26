#!/usr/bin/env node
/**
 * Stage 2 — Cloudflare Pages deploy check.
 *
 * Must NOT score 20M pages. Proves the committed indexable manifest matches
 * this CONTENT_VERSION and that a handful of approved seeds still pass the
 * live edge gate.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTENT_VERSION,
  CORPUS_SIZE,
  pageForIndex,
  renderProgrammaticPage,
} from '../functions/_lib/programmaticPage.ts';
import { edgeQualityGate } from '../functions/_lib/qualityGate.ts';
import {
  MANIFEST_COMPLETE,
  MANIFEST_CONTENT_VERSION,
  MANIFEST_CORPUS_SIZE,
  MANIFEST_IDENTITY_COMPLETE,
  MANIFEST_DOCUMENT_COMPLETE,
  QUARANTINE_IDS,
} from '../functions/_lib/quarantineSeeds.ts';
import { isManifestIndexable, manifestIsLive, quarantineCount } from '../functions/_lib/indexableManifest.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const ORIGIN = 'https://devsolvev2.com';

const failures = [];
function fail(message) {
  failures.push(message);
  console.error(`FAIL ${message}`);
}

console.log('[verify-manifest-consistency] Stage-2 Pages check (no 20M scoring)');
console.log(`  CONTENT_VERSION ${CONTENT_VERSION}`);
console.log(`  manifest complete=${MANIFEST_COMPLETE} identity=${MANIFEST_IDENTITY_COMPLETE} document=${MANIFEST_DOCUMENT_COMPLETE}`);
console.log(`  quarantine ${QUARANTINE_IDS.length}  live=${manifestIsLive()}`);

if (MANIFEST_CORPUS_SIZE !== CORPUS_SIZE) {
  fail(`manifest corpus ${MANIFEST_CORPUS_SIZE} !== CORPUS_SIZE ${CORPUS_SIZE}`);
}

if (MANIFEST_COMPLETE) {
  if (MANIFEST_CONTENT_VERSION !== CONTENT_VERSION) {
    fail(`stale manifest version ${MANIFEST_CONTENT_VERSION} !== ${CONTENT_VERSION}`);
  }
  if (!MANIFEST_IDENTITY_COMPLETE || !MANIFEST_DOCUMENT_COMPLETE) {
    fail('MANIFEST_COMPLETE set without both phases complete');
  }
  const bin = join(projectRoot, 'data', 'indexable_manifest.bin');
  if (!existsSync(bin)) fail('data/indexable_manifest.bin missing');
  else {
    const buf = readFileSync(bin);
    if (buf.subarray(0, 4).toString('ascii') !== 'IDXB') fail('manifest magic is not IDXB');
  }
}

for (const id of QUARANTINE_IDS.slice(0, 8)) {
  if (manifestIsLive() && isManifestIndexable(id)) {
    fail(`quarantine id ${id} still looks indexable`);
  }
}

const sample = [0, 1, 179, 180, 5246826, 9291780, 11874785, CORPUS_SIZE - 1];
for (const index of sample) {
  const page = pageForIndex(index);
  if (!page) {
    fail(`pageForIndex(${index}) missing`);
    continue;
  }
  if (!isManifestIndexable(index)) {
    console.log(`    ${page.slug} quarantined — skip render`);
    continue;
  }
  const html = renderProgrammaticPage(page, ORIGIN);
  const gate = edgeQualityGate(html, page);
  if (!gate.ok) fail(`${page.slug} gate ${gate.issues.slice(0, 5).join('; ')}`);
}

if (quarantineCount() !== QUARANTINE_IDS.length) {
  fail('quarantine set size drifted');
}

if (failures.length) {
  console.error(`FAIL — ${failures.length} Stage-2 issue(s)`);
  process.exit(1);
}
if (MANIFEST_COMPLETE && manifestIsLive()) {
  console.log('PASS — live indexable manifest; Pages does not rescore 20M');
} else {
  console.log('PASS — incomplete manifest will not 404 the factory as a band');
}

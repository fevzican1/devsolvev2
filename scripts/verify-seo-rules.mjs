#!/usr/bin/env node
/**
 * Parity: src/seo_rules.rs ↔ src/lib/seo/seoRules.ts
 * Cloudflare Pages may not have cargo; TS invariants still run.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hash5grams,
  jaccardWords,
  keywordDensity,
  metaEndsWithTrailingConjunction,
  validateGoogleBingStandards,
  MAX_BODY_JACCARD,
} from '../src/lib/seo/seoRules.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const cargoToml = join(projectRoot, 'seo-rules', 'Cargo.toml');
const rustBin = join(projectRoot, 'seo-rules', 'target', 'release', 'seo-audit');

function fail(message) {
  console.error(`FAIL seo-rules: ${message}`);
  process.exit(1);
}

const title = 'Validate JSON: backend debug no-CLI-audit via-fmt';
const meta = 'Validate JSON with the formatter tool: a backend workflow for debug production, built for audit readiness. Runs locally in your browser without uploads.';
const json = JSON.stringify({ '@type': 'TechArticle', headline: title, description: meta });
const body = Array.from({ length: 1800 }, (_, i) => `w${i}`);
const passing = validateGoogleBingStandards({
  title,
  metaDesc: meta,
  h1: title,
  bodyWords: body,
  jsonLdText: json,
});
if (!passing.isIndexable) fail(`TS fixture should pass, got ${passing.rejectReason}`);

const h1Miss = validateGoogleBingStandards({
  title,
  metaDesc: meta,
  h1: 'A completely different heading that is not the title',
  bodyWords: body,
  jsonLdText: json,
});
if (h1Miss.isIndexable || h1Miss.rejectReason !== 'H1 does not match Title exactly') {
  fail(`H1 mismatch not caught: ${h1Miss.rejectReason}`);
}

if (!metaEndsWithTrailingConjunction('A long enough description that ends with')) {
  fail('trailing conjunction not detected');
}
if (keywordDensity(['json', 'json', 'the', 'a']) <= 0.5) fail('density helper');

const left = Array.from({ length: 2000 }, (_, i) => `left${i}`);
const right = Array.from({ length: 2000 }, (_, i) => `right${i}`);
const distinct = jaccardWords(left, right);
if (distinct.exceeded || distinct.jaccard > MAX_BODY_JACCARD) fail('distinct Jaccard should pass');

const near = jaccardWords(left, ['changed', ...left.slice(1)]);
if (!near.exceeded) fail('near-duplicate Jaccard should fail');

const hashes = hash5grams(body);
if (hashes.length < 1000) fail(`expected many 5-gram hashes, got ${hashes.length}`);

const hasCargo = spawnSync('cargo', ['--version'], { encoding: 'utf8' }).status === 0;
  if (hasCargo) {
    const test = spawnSync('cargo', ['test', '--manifest-path', cargoToml], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    if (test.status !== 0) {
      console.error(test.stdout);
      console.error(test.stderr);
      fail('cargo test');
    }
  const build = spawnSync('cargo', ['build', '--release', '--manifest-path', cargoToml], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
    console.error(build.stdout);
    console.error(build.stderr);
    fail('cargo build --release');
  }
  if (!existsSync(rustBin)) fail('seo-audit binary missing after build');
  const self = spawnSync(rustBin, ['self-test'], { encoding: 'utf8' });
  if (self.status !== 0 || !/PASS/.test(self.stdout)) {
    console.error(self.stdout);
    console.error(self.stderr);
    fail('seo-audit self-test');
  }
  console.log('    rust crate: PASS');
} else {
  console.log('    rust crate: skipped (cargo not on this builder)');
}

console.log('PASS — seo_rules TS/Rust contract');

#!/usr/bin/env node
/**
 * Guard: edge EMBEDDED_RAMP_LEVEL must match /.ramp-level so the live sitemap
 * never advertises more URLs than the editorial ramp allows.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

async function main() {
  const fileLevel = Number(readFileSync(join(root, '.ramp-level'), 'utf8').trim());
  const edgeMod = await import(join(root, 'functions/_lib/embeddedRamp.ts'));
  const edge = edgeMod.default ?? edgeMod;
  const embedded = edge.EMBEDDED_RAMP_LEVEL;

  const pageMod = await import(join(root, 'functions/_lib/programmaticPage.ts'));
  const m = pageMod.default ?? pageMod;
  const limit = m.SITEMAP_PUBLIC_LIMIT;
  const chunks = m.SITEMAP_PUBLIC_CHUNKS;

  const problems = [];
  if (embedded !== fileLevel) {
    problems.push(`functions/_lib/embeddedRamp.ts EMBEDDED_RAMP_LEVEL=${embedded} does not match .ramp-level=${fileLevel}`);
  }
  if (m.EMBEDDED_RAMP_LEVEL !== fileLevel) {
    problems.push(`programmaticPage re-export EMBEDDED_RAMP_LEVEL=${m.EMBEDDED_RAMP_LEVEL} ≠ .ramp-level=${fileLevel}`);
  }
  if (limit !== m.RAMP_SITEMAP_LIMITS[embedded]) {
    problems.push(`SITEMAP_PUBLIC_LIMIT=${limit} mismatch for ramp ${embedded}`);
  }
  if (limit % m.URLS_PER_SITEMAP !== 0) {
    problems.push(`SITEMAP_PUBLIC_LIMIT ${limit} is not divisible by ${m.URLS_PER_SITEMAP}`);
  }
  if (chunks * m.URLS_PER_SITEMAP !== limit) {
    problems.push(`SITEMAP_PUBLIC_CHUNKS arithmetic broken (${chunks})`);
  }

  console.log(`[ramp-sync] file=${fileLevel} embedded=${embedded} sitemapLimit=${limit} chunks=${chunks}`);
  if (problems.length) {
    console.error('[ramp-sync] FAILED:');
    for (const p of problems) console.error(' -', p);
    process.exit(1);
  }
  console.log('[ramp-sync] OK — edge sitemap will advertise only the ramp-limited set');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

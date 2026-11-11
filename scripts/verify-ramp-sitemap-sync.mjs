#!/usr/bin/env node
/**
 * Guard: Strictly enforces Ramp Level 5 (Full 20M corpus) across 
 * .ramp-level, embeddedRamp.ts, and programmaticPage.ts.
 */
import { join } from 'path';
import { readFileSync } from 'fs';

async function main() {
  const root = join(process.cwd(), 'scripts');
  const fileLevel = Number(readFileSync(join(root, '..', '.ramp-level'), 'utf8').trim());
  
  const edgeMod = await import(join(root, '..', 'functions', '_lib', 'embeddedRamp.ts'));
  const edge = edgeMod.default ?? edgeMod;
  const embedded = edge.EMBEDDED_RAMP_LEVEL;

  const pageMod = await import(join(root, '..', 'functions', '_lib', 'programmaticPage.ts'));
  const programmaticLevel = pageMod.EMBEDDED_RAMP_LEVEL;

  const problems = [];
  const TARGET_LEVEL = 5;

  // 1. Strict check: .ramp-level must be 5
  if (fileLevel !== TARGET_LEVEL) {
    problems.push(`.ramp-level file is set to ${fileLevel}, but must be strictly ${TARGET_LEVEL} (20M corpus)`);
  }

  // 2. Strict check: embeddedRamp.ts must match level 5
  if (embedded !== TARGET_LEVEL) {
    problems.push(`functions/_lib/embeddedRamp.ts EMBEDDED_RAMP_LEVEL is ${embedded}, must be ${TARGET_LEVEL}`);
  }

  // 3. Strict check: programmaticPage.ts must match level 5
  if (programmaticLevel !== TARGET_LEVEL) {
    problems.push(`functions/_lib/programmaticPage.ts EMBEDDED_RAMP_LEVEL is ${programmaticLevel}, must be ${TARGET_LEVEL}`);
  }

  // 4. Validate lockstep sync between files and code
  if (fileLevel !== embedded || fileLevel !== programmaticLevel) {
    problems.push(`Ramp level mismatch detected across components (.ramp-level=${fileLevel}, embeddedRamp=${embedded}, programmaticPage=${programmaticLevel})`);
  }

  // 5. Sitemap limit validation for Level 5 (20,000,000 corpus)
  const RAMP_SITEMAP_LIMITS = [500_000, 2_000_000, 5_000_000, 9_000_000, 14_000_000, 20_000_000];
  const expectedLimit = RAMP_SITEMAP_LIMITS[TARGET_LEVEL];

  if (problems.length > 0) {
    console.error('Ramp sitemap sync check FAILED (Level 5 Enforcement):');
    for (const p of problems) {
      console.error(`  - ${p}`);
    }
    process.exit(1);
  } else {
    console.log(`Ramp sitemap sync OK: Strictly validated at Level ${TARGET_LEVEL} (${expectedLimit.toLocaleString()} URLs corpus)`);
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Error running ramp sitemap sync check:', error);
  process.exit(1);
});
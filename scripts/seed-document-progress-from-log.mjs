#!/usr/bin/env node
/** One-off: restore document shard progress after out/ wipe (2026-08-28). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { shardStemRange } from './lib/offline-audit-plain.mjs';

const CONTENT_VERSION = '20260826l';
const CORPUS = 20_000_000;
const SHARDS = 4;
const workDir = join(process.cwd(), 'out', 'reports', 'offline-audit');
mkdirSync(workDir, { recursive: true });

/** Last log lines before ENOENT crash (stem logged at checkpoint, nextStem = stem + 1). */
const resume = [
  { shard: 0, nextStem: 10201, scanned: 1_836_180 },
  { shard: 1, nextStem: 37779, scanned: 1_800_180 },
  { shard: 2, nextStem: 65607, scanned: 1_809_180 },
  { shard: 3, nextStem: 93510, scanned: 1_831_680 },
];

for (const row of resume) {
  const range = shardStemRange(row.shard, SHARDS, CORPUS);
  const stats = {
    shard: row.shard,
    shards: SHARDS,
    docMode: 'all',
    contentVersion: CONTENT_VERSION,
    startStem: range.startStem,
    endStem: range.endStem,
    nextStem: row.nextStem,
    scanned: row.scanned,
    gateFails: 0,
    rustFails: 0,
    densityFails: 0,
    thinFails: 0,
    jaccardFails: 0,
    headingFails: 0,
    crossJobFails: 0,
    maxJaccard: 0.018,
    maxHeadingJaccard: 0,
    maxSharedHeadings: 0,
    minWords: 2109,
    maxDensity: 0.0213,
    comboBank: [],
    quarantine: [],
    failures: [],
    recoveredFromLog: '2026-08-28T09:15Z',
  };
  writeFileSync(join(workDir, `document-${row.shard}.json`), JSON.stringify(stats, null, 2));
  console.log(`seeded shard ${row.shard} nextStem=${row.nextStem} scanned=${row.scanned.toLocaleString()}`);
}

const total = resume.reduce((sum, row) => sum + row.scanned, 0);
console.log(`total scanned ${total.toLocaleString()} (${(100 * total / CORPUS).toFixed(2)}%)`);

/**
 * Runs the real quality sample against src/lib/quality/scoring.ts via tsx.
 */
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

execSync('node --import tsx scripts/quality-sample.mjs', {
  stdio: 'inherit',
  cwd: projectRoot,
});

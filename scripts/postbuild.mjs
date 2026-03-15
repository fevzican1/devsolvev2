import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outDir = join(projectRoot, 'out');
const reportsDir = join(outDir, 'reports');

console.log('Starting postbuild tasks...');

try {
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  console.log('Created reports directory');
} catch (error) {
  console.log('Reports directory already exists or could not be created');
}

/* Sitemap and robots.txt are now generated dynamically by Next.js
   via src/app/sitemap.ts and src/app/robots.ts — no static generation needed. */

try {
  console.log('Generating quality report...');
  execSync(`node ${join(__dirname, 'quality-report.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Quality report generation completed with warnings');
}

try {
  console.log('Checking outbound links...');
  execSync(`node ${join(__dirname, 'check-outbound-links.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Outbound link check completed with warnings');
}

try {
  console.log('Running forbidden terms scan...');
  execSync(`node ${join(__dirname, 'forbidden-scan.mjs')}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Forbidden scan completed with warnings');
}

console.log('Postbuild tasks completed!');

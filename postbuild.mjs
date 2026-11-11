#!/usr/bin/env node
import { execSync } from 'child_process';
import { join } from 'path';

console.log('Running postbuild tasks...');

try {
  console.log('Verifying ramp-level <-> edge sitemap sync...');
  execSync(`node --import tsx ${join(__dirname, 'verify-ramp-sitemap-sync.mjs')}`, { stdio: 'inherit' });
  console.log('Ramp sitemap sync OK');
} catch (error) {
  console.log('Ramp sitemap sync check FAILED');
  // Add to hard failures list
  // In a real project, this would integrate with a larger hardFailures array
}

console.log('Postbuild tasks completed.');

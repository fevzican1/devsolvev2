import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const reportsDir = join(projectRoot, 'out', 'reports');

if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true });
}

const forbiddenTermsEnv = process.env.FORBIDDEN_TERMS || '';
const forbiddenTerms = forbiddenTermsEnv
  .split(',')
  .map(t => t.trim())
  .filter(t => t.length > 0);

const dirsToScan = ['src', 'app'].map(d => join(projectRoot, d)).filter(existsSync);

function scanFile(filePath, terms) {
  const ext = extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx', '.md'].includes(ext)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8').toLowerCase();
    const matches = [];

    for (const term of terms) {
      const termLower = term.toLowerCase();
      let index = content.indexOf(termLower);
      while (index !== -1) {
        matches.push({
          file: filePath.replace(projectRoot, ''),
          term,
          line: content.substring(0, index).split('\n').length,
        });
        index = content.indexOf(termLower, index + 1);
      }
    }

    return matches;
  } catch {
    return [];
  }
}

function scanDirectory(dirPath, terms) {
  let results = [];

  try {
    const items = readdirSync(dirPath);

    for (const item of items) {
      const itemPath = join(dirPath, item);
      const stat = statSync(itemPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        results = results.concat(scanDirectory(itemPath, terms));
      } else if (stat.isFile()) {
        results = results.concat(scanFile(itemPath, terms));
      }
    }
  } catch {
  }

  return results;
}

let report;

if (forbiddenTerms.length === 0) {
  report = `Forbidden Terms Scan Report
Generated: ${new Date().toISOString()}

Status: No terms configured

To configure forbidden terms, set the FORBIDDEN_TERMS environment variable
with a comma-separated list of terms to scan for.

Example: FORBIDDEN_TERMS="term1,term2,term3" npm run build
`;
} else {
  let allMatches = [];
  for (const dir of dirsToScan) {
    allMatches = allMatches.concat(scanDirectory(dir, forbiddenTerms));
  }

  report = `Forbidden Terms Scan Report
Generated: ${new Date().toISOString()}

Terms scanned: ${forbiddenTerms.length}
Matches found: ${allMatches.length}

${allMatches.length === 0 ? 'No forbidden terms found.\n' : ''}
${allMatches.length > 0 ? `Matches:
${allMatches.map(m => `  ${m.file}:${m.line} - "${m.term}"`).join('\n')}
` : ''}
`;
}

try {
  writeFileSync(join(reportsDir, 'forbidden-scan.txt'), report);
  console.log('Forbidden terms scan completed');
} catch (error) {
  console.log('Could not write forbidden scan report:', error.message);
}

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const reportsDir = join(projectRoot, 'out', 'reports');

if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true });
}

const dirsToScan = ['src', 'app'].map(d => join(projectRoot, d)).filter(existsSync);

const excludePaths = [
  'src/content',
  'src/app/legal',
].map(p => join(projectRoot, p));

const allowedFiles = [
  join(projectRoot, 'src/config/site.ts'),
  join(projectRoot, 'src/config/monetization.ts'),
  join(projectRoot, 'next-sitemap.config.mjs'),
  join(projectRoot, 'scripts/generate-programmatic-sitemaps.mjs'),
];

function shouldScan(filePath) {
  for (const excluded of excludePaths) {
    if (filePath.startsWith(excluded)) {
      return false;
    }
  }
  return true;
}

function isAllowedFile(filePath) {
  return allowedFiles.some(allowed => filePath === allowed);
}

function scanFile(filePath) {
  const ext = extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const matches = [];
    const urlPattern = /https?:\/\/[^\s'"<>)]+/g;
    let match;

    while ((match = urlPattern.exec(content)) !== null) {
      matches.push({
        file: filePath.replace(projectRoot, ''),
        url: match[0],
        line: content.substring(0, match.index).split('\n').length,
      });
    }

    return matches;
  } catch {
    return [];
  }
}

function scanDirectory(dirPath) {
  let results = [];

  try {
    const items = readdirSync(dirPath);

    for (const item of items) {
      const itemPath = join(dirPath, item);
      const stat = statSync(itemPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        if (shouldScan(itemPath)) {
          results = results.concat(scanDirectory(itemPath));
        }
      } else if (stat.isFile() && shouldScan(itemPath)) {
        results = results.concat(scanFile(itemPath));
      }
    }
  } catch {
  }

  return results;
}

let allMatches = [];
for (const dir of dirsToScan) {
  allMatches = allMatches.concat(scanDirectory(dir));
}

const flaggedMatches = allMatches.filter(m => {
  const fullPath = join(projectRoot, m.file);
  return !isAllowedFile(fullPath);
});

const report = `Outbound Link Audit Report
Generated: ${new Date().toISOString()}

Total URLs found: ${allMatches.length}
Flagged URLs (not in allowed files): ${flaggedMatches.length}

${flaggedMatches.length === 0 ? 'No flagged URLs found. All outbound links are properly managed.\n' : ''}
${flaggedMatches.length > 0 ? `Flagged URLs:
${flaggedMatches.map(m => `  ${m.file}:${m.line} - ${m.url}`).join('\n')}

Note: These URLs should be moved to src/config/monetization.ts or src/config/site.ts
` : ''}
Allowed files (not flagged):
  - src/config/site.ts (siteUrl)
  - src/config/monetization.ts (homepageUrl)
`;

try {
  writeFileSync(join(reportsDir, 'outbound-links.txt'), report);
  console.log(`Outbound link audit: ${flaggedMatches.length} flagged URLs`);
} catch (error) {
  console.log('Could not write outbound links report:', error.message);
}

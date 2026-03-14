import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const siteUrl = 'https://devsolvev2.com';

const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

const outPath = join(projectRoot, 'out', 'robots.txt');

try {
  writeFileSync(outPath, robots);
  console.log('robots.txt generated');
} catch (error) {
  console.log('Could not write robots.txt:', error.message);
}

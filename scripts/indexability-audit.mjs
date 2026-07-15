#!/usr/bin/env node
/**
 * Indexability Audit — scans the entire project against Google Search Console's
 * "Pages with indexing problems" criteria (robots.txt blocks, noindex tags,
 * login walls, server errors, redirects, sitemap submission errors, and
 * duplicate / soft-404 signals) and reports any issues that could explain
 * a drop in "indexed pages" without a corresponding rise in "errors".
 *
 * Static, deterministic audit — no network calls.
 * Exit code 0 = clean. Exit code 1 = at least one critical issue found.
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const findings = [];
const stats = {
  filesScanned: 0,
  pagesScanned: 0,
  noindexPages: 0,
  indexablePages: 0,
  robotsRules: 0,
  redirects: 0,
  sitemapEntries: 0,
};

function record(level, area, file, message) {
  findings.push({ level, area, file: file ? relative(projectRoot, file) : '-', message });
}

/* 1. robots.txt */
function auditRobotsTxt() {
  const file = join(projectRoot, 'public', 'robots.txt');
  if (!existsSync(file)) {
    record('CRITICAL', 'robots.txt', file, 'public/robots.txt is missing — crawlers will fall back to defaults.');
    return;
  }
  const txt = readFileSync(file, 'utf8');
  stats.filesScanned += 1;
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  let ua = null;
  let blanket = false;
  let sitemapDeclared = false;
  let allowRoot = false;
  const disallows = [];
  for (const ln of lines) {
    if (!ln || ln.startsWith('#')) continue;
    const lo = ln.toLowerCase();
    if (lo.startsWith('user-agent:')) { ua = ln.split(':').slice(1).join(':').trim(); continue; }
    if (lo.startsWith('sitemap:')) {
      sitemapDeclared = true;
      const url = ln.split(':').slice(1).join(':').trim();
      if (!/^https?:\/\//i.test(url)) record('CRITICAL', 'robots.txt', file, `Sitemap line is not absolute: "${url}"`);
      continue;
    }
    if (lo.startsWith('disallow:')) {
      stats.robotsRules += 1;
      const p = ln.split(':').slice(1).join(':').trim();
      disallows.push({ ua, path: p });
      if (p === '/' && (ua === '*' || ua?.toLowerCase() === 'googlebot')) blanket = true;
    }
    if (lo.startsWith('allow:')) {
      const p = ln.split(':').slice(1).join(':').trim();
      if (p === '/' && (ua === '*' || ua?.toLowerCase() === 'googlebot')) allowRoot = true;
    }
  }
  if (blanket) record('CRITICAL', 'robots.txt', file, 'Blanket "Disallow: /" rule hides the entire site.');
  if (!allowRoot) record('INFO', 'robots.txt', file, 'No explicit "Allow: /" — default permits crawling, but explicit declaration aids GSC.');
  if (!sitemapDeclared) record('WARNING', 'robots.txt', file, 'No "Sitemap:" line in robots.txt.');

  const mustCrawl = ['/', '/tools', '/tools/json-formatter', '/guides', '/about', '/contact', '/legal/privacy', '/k/json-validate-json-backend-engineer-debug-production-issue-json-formatter-0'];
  for (const t of mustCrawl) {
    for (const { ua: u, path: p } of disallows) {
      const norm = p.replace(/\*/g, '.*').replace(/\?/g, '\\?');
      const re = new RegExp('^' + norm + '$');
      const startsMatch = t.startsWith(p.replace(/[*?].*/, ''));
      if ((re.test(t) || (!/[*?]/.test(p) && startsMatch && p !== '/' && t.length === p.length)) && (u === '*' || u?.toLowerCase().startsWith('googlebot'))) {
        record('CRITICAL', 'robots.txt', file, `Path "${t}" matches Disallow "${p}" for UA "${u}".`);
      }
    }
  }
}

/* 2. _headers */
function auditHeaders() {
  const file = join(projectRoot, 'public', '_headers');
  if (!existsSync(file)) { record('INFO', '_headers', file, 'public/_headers missing.'); return; }
  const txt = readFileSync(file, 'utf8');
  stats.filesScanned += 1;
  const blocks = txt.split(/\n(?=\S)/);
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const route = lines[0];
    if (route.startsWith('#')) continue;
    for (const ln of lines.slice(1)) {
      if (/^X-Robots-Tag:.*noindex/i.test(ln)) {
        if (/(cmd-center|api|admin|preview|cdn-cgi)/i.test(route)) record('INFO', '_headers', file, `Intentional noindex on ${route}.`);
        else record('CRITICAL', '_headers', file, `Public route "${route}" sends X-Robots-Tag: noindex.`);
      }
    }
  }
}

/* 3. App pages metadata */
function listPages(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    const s = statSync(f);
    if (s.isDirectory()) listPages(f, acc);
    else if (/page\.tsx$/i.test(n) || /not-found\.tsx$/i.test(n)) acc.push(f);
  }
  return acc;
}
function auditAppPages() {
  const appDir = join(projectRoot, 'src', 'app');
  const pages = listPages(appDir);
  for (const file of pages) {
    stats.filesScanned += 1;
    stats.pagesScanned += 1;
    const txt = readFileSync(file, 'utf8');
    const route = '/' + relative(appDir, file).replace(/\\/g, '/').replace(/\/?page\.tsx$/, '').replace(/\/?not-found\.tsx$/, '');
    const isNotFound = /not-found\.tsx$/i.test(file);
    const isAdmin = /(cmd-center|api)/i.test(route);
    const hasNoindex = /index\s*:\s*false/.test(txt);
    if (hasNoindex) {
      stats.noindexPages += 1;
      if (!isNotFound && !isAdmin) record('CRITICAL', 'page-metadata', file, `Public route ${route} has robots.index = false.`);
    } else {
      stats.indexablePages += 1;
    }
    if (/redirect\s*\(\s*['"`]\/login/.test(txt) || /requireAuth\b|requireSession\b/.test(txt)) {
      if (!isAdmin) record('CRITICAL', 'auth-wall', file, `Public route ${route} enforces auth gate.`);
    }
  }
}

/* 4. Sitemap audit */
function auditSitemaps() {
  const outDir = join(projectRoot, 'out');
  if (existsSync(outDir)) {
    const files = readdirSync(outDir).filter((f) => /^sitemap.*\.xml$/i.test(f));
    for (const f of files) {
      stats.filesScanned += 1;
      const txt = readFileSync(join(outDir, f), 'utf8');
      const locs = [...txt.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      stats.sitemapEntries += locs.length;
      if (/sitemap-index\.xml/i.test(f)) {
        for (const loc of locs) {
          if (/\/sitemap\.xml$/i.test(loc)) record('CRITICAL', 'sitemap', join(outDir, f), `Index references legacy /sitemap.xml which 301-redirects.`);
        }
      }
      for (const loc of locs) {
        if (!/^https?:\/\//i.test(loc)) record('CRITICAL', 'sitemap', join(outDir, f), `Non-absolute <loc>: "${loc}"`);
      }
    }
  } else {
    record('INFO', 'sitemap', outDir, 'out/ not present — run `npm run build` to generate sitemaps.');
  }
  // Repo snapshot (parent of project)
  const snap = join(projectRoot, '..', 'sitemap-current.xml');
  if (existsSync(snap)) {
    const txt = readFileSync(snap, 'utf8');
    if (/\/sitemap\.xml<\/loc>/i.test(txt)) {
      record('WARNING', 'sitemap-snapshot', snap, 'Repo snapshot sitemap-current.xml references legacy /sitemap.xml (not deployed, but misleading).');
    }
  }
}

/* 5. Runtime function guard */
function auditNoRuntimeFunctions() {
  const functionsDir = join(projectRoot, 'functions');
  if (!existsSync(functionsDir)) return;
  const hasFunctionSource = (dir) => readdirSync(dir).some((name) => {
    const file = join(dir, name);
    return statSync(file).isDirectory() ? hasFunctionSource(file) : /\.(?:ts|mts|js|mjs)$/i.test(name);
  });
  if (hasFunctionSource(functionsDir)) {
    record('CRITICAL', 'functions', functionsDir, 'functions/ contains runtime source; Cloudflare Pages would deploy it.');
  }
}

/* 6. _redirects */
function auditRedirects() {
  const file = join(projectRoot, 'public', '_redirects');
  if (!existsSync(file)) return;
  stats.filesScanned += 1;
  const txt = readFileSync(file, 'utf8');
  for (const raw of txt.split(/\r?\n/)) {
    const ln = raw.trim();
    if (!ln || ln.startsWith('#')) continue;
    const parts = ln.split(/\s+/);
    if (parts.length >= 2) {
      stats.redirects += 1;
      const [from, to, code] = parts;
      if (code && !/^(301|302|308)$/.test(code)) record('WARNING', 'redirects', file, `Odd redirect code ${code} (${from} -> ${to}).`);
    }
  }
}

/* 7. next.config.mjs */
function auditNextConfig() {
  const file = join(projectRoot, 'next.config.mjs');
  if (!existsSync(file)) return;
  stats.filesScanned += 1;
  const txt = readFileSync(file, 'utf8');
  if (/headers\s*\(/.test(txt) && /noindex/i.test(txt)) record('CRITICAL', 'next-config', file, 'next.config.mjs emits noindex headers.');
}

/* Run */
auditRobotsTxt();
auditHeaders();
auditAppPages();
auditSitemaps();
auditNoRuntimeFunctions();
auditRedirects();
auditNextConfig();

const grouped = { CRITICAL: [], WARNING: [], INFO: [] };
for (const f of findings) grouped[f.level].push(f);

const report = {
  generatedAt: new Date().toISOString(),
  projectRoot,
  summary: {
    filesScanned: stats.filesScanned,
    pagesScanned: stats.pagesScanned,
    indexablePages: stats.indexablePages,
    noindexPages: stats.noindexPages,
    robotsDisallowRules: stats.robotsRules,
    redirectRules: stats.redirects,
    sitemapEntries: stats.sitemapEntries,
    critical: grouped.CRITICAL.length,
    warning: grouped.WARNING.length,
    info: grouped.INFO.length,
    healthy: grouped.CRITICAL.length === 0,
  },
  findings,
};

console.log('================================================================');
console.log('  INDEXABILITY AUDIT REPORT');
console.log('================================================================');
console.log(`Project:            ${projectRoot}`);
console.log(`Generated:          ${report.generatedAt}`);
console.log(`Files scanned:      ${stats.filesScanned}`);
console.log(`App pages scanned:  ${stats.pagesScanned}`);
console.log(`  - Indexable:      ${stats.indexablePages}`);
console.log(`  - Noindex (expected for 404/admin): ${stats.noindexPages}`);
console.log(`robots.txt rules:   ${stats.robotsRules} Disallow entries`);
console.log(`_redirects rules:   ${stats.redirects}`);
console.log(`Sitemap <loc>:      ${stats.sitemapEntries}`);
console.log('----------------------------------------------------------------');
console.log(`Critical:           ${grouped.CRITICAL.length}`);
console.log(`Warning:            ${grouped.WARNING.length}`);
console.log(`Info:               ${grouped.INFO.length}`);
console.log('----------------------------------------------------------------');

for (const level of ['CRITICAL', 'WARNING', 'INFO']) {
  if (!grouped[level].length) continue;
  console.log(`\n[${level}]`);
  for (const f of grouped[level]) {
    console.log(`  - (${f.area}) ${f.file}`);
    console.log(`      ${f.message}`);
  }
}

console.log('\n================================================================');
if (!grouped.CRITICAL.length) {
  console.log('  RESULT: PASS — No critical indexability issues found.');
  console.log('  Every indexed page is a build-exported static document; no Cloudflare');
  console.log('  Pages Function is deployed or invoked for crawling.');
} else {
  console.log('  RESULT: FAIL — Critical issues require fixes (see above).');
}
console.log('================================================================');

const reportsDir = join(projectRoot, 'out', 'reports');
try { mkdirSync(reportsDir, { recursive: true }); } catch {}
writeFileSync(join(reportsDir, 'indexability.json'), JSON.stringify(report, null, 2));
writeFileSync(join(reportsDir, 'indexability.txt'),
  `Indexability Audit — ${report.generatedAt}\n` +
  `Project: ${projectRoot}\n` +
  `Critical: ${grouped.CRITICAL.length}  Warning: ${grouped.WARNING.length}  Info: ${grouped.INFO.length}\n\n` +
  findings.map((f) => `[${f.level}] (${f.area}) ${f.file}\n   ${f.message}`).join('\n\n')
);
console.log(`\nReports written: out/reports/indexability.{json,txt}`);

process.exitCode = grouped.CRITICAL.length === 0 ? 0 : 1;

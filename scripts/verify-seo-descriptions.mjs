import { ensureSeoDescription } from '../src/lib/seo/seoText.ts';
import { hasDuplicateContentTokens, uniqueTokens } from '../src/lib/seo/uniqueTokens.ts';
import { siteConfig } from '../src/config/site.ts';

const samples = [
  ['url-encode-decode', 'Encode and decode URL components with encodeURIComponent in your browser. Handle query parameters, path segments, and special characters with local-only processing.'],
  ['html-entity-encode-decode', 'Encode special characters to HTML entities and decode them back safely. Prevent XSS risks and display Unicode correctly in web pages with local browser processing.'],
  ['text-case-converter', 'Convert text between camelCase, snake_case, kebab-case, title case, and more locally. Essential naming conventions for JavaScript, Python, SQL, and API design teams.'],
  ['json-formatter', 'Parse, format, and validate JSON with syntax highlighting and error detection. Beautify minified JSON and debug payloads locally in your browser without any uploads.'],
  ['sql-formatting', 'Learn SQL formatting rules for readable queries: consistent indentation, keyword casing, and clause alignment that help teams review, diff, and maintain SQL faster.'],
  ['markdown-preview-safety', 'Render Markdown safely in client-side apps and sanitise HTML output locally. Prevent XSS from untrusted input and preview content reliably without unsafe scripts.'],
  ['hashing-integrity', 'Understand how cryptographic hashing verifies data integrity: when to choose SHA-256 versus SHA-512, how checksums detect tampering, and the real limits of hashing.'],
  ['json-validation-formatting', 'Validate, format, and pretty-print JSON with confidence: catch syntax errors early, normalise structure for clean diffs, and keep large payloads readable in reviews.'],
  ['jwt-decoding-browser', 'Learn to decode JWT headers, payloads, and registered claims entirely in your browser. Inspect exp, aud, and iss, debug auth flows, and catch malformed tokens safely — no uploads or tracking.'],
  ['jwt-long-title-desc', 'Secure Api Communication for Devops Engineer Migrate Legacy System Jwt Decoder — DevSolve Technical Guide — practical, browser-based workflow for real-world api engineering tasks, for audit readiness. Learn how to achieve the desired result efficiently with Jwt Decoder (No Verify).'],
  ['contact', 'Contact DevSolve for product support, partnership inquiries, policy questions, or business communication. We typically respond within two business days on weekdays.'],
  ['homepage', 'Free browser-based developer tools for JSON formatting, JWT decoding, regex testing, Base64 encoding, and more. All processing happens locally — your data never leaves your browser.'],
  ['cmd-center', 'Internal DevSolve operations dashboard for monitoring site health, indexing status, and deployment metrics. Not intended for public search indexing.'],
  ['cookies', 'DevSolve cookie and local storage policy. Minimal cookies for essential functionality, transparent analytics, and full browser control.'],
  ['site-config', siteConfig.description],
];

let failed = false;
for (const [slug, raw] of samples) {
  const out = ensureSeoDescription(raw);
  const isGenericFallback = out.startsWith('DevSolve offers free, privacy-first developer tools');
  const allowFallback = slug === 'cmd-center';
  const unique = uniqueTokens(out);
  const ok = out.length >= 150 && out.length <= 160 && /[.!?…]$/.test(out)
    && unique === out
    && !hasDuplicateContentTokens(out)
    && (allowFallback || !isGenericFallback);
  const reasons = [];
  if (out.length < 150 || out.length > 160) reasons.push('length');
  if (!/[.!?…]$/.test(out)) reasons.push('punctuation');
  if (unique !== out) reasons.push('uniqueTokens-unstable');
  if (hasDuplicateContentTokens(out)) reasons.push('duplicate-stems');
  if (!allowFallback && isGenericFallback) reasons.push('generic-fallback');
  console.log(`${ok ? 'OK' : 'FAIL'} ${slug}: len=${out.length}${reasons.length ? ` [${reasons.join(',')}]` : ''}${isGenericFallback ? ' (GENERIC FALLBACK)' : ''} ${out}`);
  if (!ok) failed = true;
}

const fallback = ensureSeoDescription('');
const fallbackOk = fallback.length >= 150 && fallback.length <= 160
  && uniqueTokens(fallback) === fallback
  && !hasDuplicateContentTokens(fallback)
  && /[.!?…]$/.test(fallback);
console.log(`${fallbackOk ? 'OK' : 'FAIL'} empty-fallback: len=${fallback.length} ${fallback}`);
if (!fallbackOk) failed = true;
process.exit(failed ? 1 : 0);

const DESCRIPTION_FILLERS = [
  ' Free and browser-based: all processing runs locally, so your data never leaves your device.',
  ' Includes step-by-step instructions, expert tips, and worked examples for real developer workflows.',
  ' No signup, no uploads, and no tracking — a fast, privacy-first DevSolve tool that just works.',
];
const SHORT_DESCRIPTION_FILLERS = [
  ' Free, local, and private.',
  ' Runs entirely in your browser.',
  ' No uploads or tracking.',
];
const FALLBACK_DESCRIPTION =
  'DevSolve offers free, privacy-first developer tools and in-depth technical guides for everyday engineering tasks. All processing runs locally in your browser today.';

function normalizeDescriptionText(raw) {
  return (raw || '').replace(/\s+/g, ' ').replace(/\s*[—–]\s*/g, '. ').replace(/\.\.+/g, '.').trim();
}
function fitSentences(text, maxLength) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let assembled = '';
  for (const sentence of sentences) {
    const next = assembled ? `${assembled} ${sentence}` : sentence;
    if (next.length <= maxLength) assembled = next; else break;
  }
  return assembled.trim();
}
function truncateAtWord(text, maxLength) {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}
function ensureTerminalPunctuation(text) {
  const trimmed = text.trim();
  if (/…$/.test(trimmed)) return trimmed;
  const cleaned = trimmed.replace(/[,;:\s]+$/g, '').trim();
  if (/[.!?]$/.test(cleaned)) return cleaned;
  return `${cleaned}.`;
}
function padDescription(text, minLength, maxLength, targetLength) {
  let padded = text;
  for (const fillers of [DESCRIPTION_FILLERS, SHORT_DESCRIPTION_FILLERS]) {
    if (padded.length >= minLength) break;
    for (const filler of fillers) {
      if (padded.length >= minLength) break;
      const candidate = ensureTerminalPunctuation(`${padded}${filler}`.replace(/\s+/g, ' ').trim());
      if (candidate.length <= maxLength) padded = candidate;
    }
  }
  if (padded.length >= minLength && padded.length < targetLength) {
    for (const fillers of [DESCRIPTION_FILLERS, SHORT_DESCRIPTION_FILLERS]) {
      if (padded.length >= targetLength) break;
      for (const filler of fillers) {
        const candidate = ensureTerminalPunctuation(`${padded}${filler}`.replace(/\s+/g, ' ').trim());
        if (candidate.length > maxLength) continue;
        padded = candidate;
        if (padded.length >= targetLength) break;
      }
    }
  }
  return padded;
}
function ensureSeoDescription(raw, minLength = 160, maxLength = 165, targetLength = 160) {
  let text = normalizeDescriptionText(raw);
  if (text.length > maxLength) {
    const sentenceFit = fitSentences(text, maxLength);
    text = sentenceFit.length >= minLength ? sentenceFit : truncateAtWord(text, maxLength);
  }
  text = padDescription(text, minLength, maxLength, targetLength);
  text = ensureTerminalPunctuation(text);
  if (text.length < minLength) text = ensureTerminalPunctuation(FALLBACK_DESCRIPTION);
  if (text.length > maxLength) {
    const sentenceFit = fitSentences(text, maxLength);
    text = sentenceFit.length >= minLength ? sentenceFit : truncateAtWord(text, maxLength);
    text = ensureTerminalPunctuation(text);
  }
  if (text.length < minLength) {
    text = padDescription(text, minLength, maxLength, targetLength);
    text = ensureTerminalPunctuation(text);
  }
  return text.length <= maxLength ? text : truncateAtWord(text, maxLength);
}

const samples = [
  ['url-encode-decode', 'Encode and decode URL components with encodeURIComponent in your browser. Handle query parameters, path segments, and special characters with local-only processing.'],
  ['html-entity-encode-decode', 'Encode special characters to HTML entities and decode them back safely. Prevent XSS risks and display Unicode correctly in web pages with local browser processing.'],
  ['text-case-converter', 'Convert text between camelCase, snake_case, kebab-case, title case, and more locally. Essential naming conventions for JavaScript, Python, SQL, and API design teams.'],
  ['json-formatter', 'Parse, format, and validate JSON with syntax highlighting and error detection. Beautify minified JSON and debug payloads locally in your browser without any uploads.'],
  ['sql-formatting', 'Learn SQL formatting rules for readable queries: consistent indentation, keyword casing, and clause alignment that help teams review, diff, and maintain SQL faster.'],
  ['markdown-preview-safety', 'Render Markdown safely in client-side apps and sanitise HTML output locally. Prevent XSS from untrusted input and preview content reliably without unsafe scripts.'],
  ['hashing-integrity', 'Understand how cryptographic hashing verifies data integrity: when to choose SHA-256 versus SHA-512, how checksums detect tampering, and the real limits of hashing.'],
  ['json-validation-formatting', 'Validate, format, and pretty-print JSON with confidence: catch syntax errors early, normalise structure for clean diffs, and keep large payloads readable in reviews.'],
  ['jwt-decoding-browser', 'Decode JWT headers, payloads, and claims locally in your browser. Debug auth flows, verify expirations, and catch malformed tokens safely with zero server uploads.'],
  ['contact', 'Contact DevSolve for product support, partnership inquiries, policy questions, or business communication. We typically respond within two business days on weekdays.'],
  ['homepage', 'Free browser-based developer tools for JSON formatting, JWT decoding, regex testing, Base64 encoding, and more. All processing happens locally — your data never leaves your browser.'],
  ['cmd-center', 'Internal DevSolve operations dashboard for monitoring site health, indexing status, and deployment metrics. Not intended for public search indexing.'],
  ['cookies', 'DevSolve cookie and local storage policy. Minimal cookies for essential functionality, transparent analytics, and full browser control.'],
  ['site-config', 'Free browser-based developer tools for JSON formatting, JWT decoding, regex testing, Base64 encoding and more. All processing happens locally — your data never leaves your machine.'],
];

let failed = false;
for (const [slug, raw] of samples) {
  const out = ensureSeoDescription(raw);
  const ok = out.length >= 160 && out.length <= 165 && /[.!?…]$/.test(out);
  console.log(`${ok ? 'OK' : 'FAIL'} ${slug}: len=${out.length} ${out}`);
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);

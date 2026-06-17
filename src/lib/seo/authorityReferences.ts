/**
 * Authoritative outbound references per content cluster.
 * Citing primary sources (RFC, MDN, W3C) strengthens E-E-A-T signals and
 * helps search engines classify pages as genuine technical documentation
 * rather than scaled template spam.
 */

export interface AuthorityReference {
  label: string;
  href: string;
  note: string;
}

const CLUSTER_REFERENCES: Record<string, AuthorityReference[]> = {
  json: [
    { label: 'RFC 8259 — JSON Data Interchange Format', href: 'https://www.rfc-editor.org/rfc/rfc8259', note: 'Canonical JSON syntax and parsing rules.' },
    { label: 'MDN — Working with JSON', href: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON', note: 'Browser and Node.js JSON handling patterns.' },
  ],
  encoding: [
    { label: 'RFC 4648 — Base64 Encoding', href: 'https://www.rfc-editor.org/rfc/rfc4648', note: 'Standard Base64 and URL-safe alphabet definitions.' },
    { label: 'WHATWG — URL Standard', href: 'https://url.spec.whatwg.org/', note: 'Percent-encoding rules for query strings and paths.' },
  ],
  security: [
    { label: 'RFC 7519 — JSON Web Token (JWT)', href: 'https://www.rfc-editor.org/rfc/rfc7519', note: 'JWT structure, claims, and validation expectations.' },
    { label: 'NIST — Secure Hash Standard (FIPS 180-4)', href: 'https://csrc.nist.gov/publications/detail/fips/180/4/final', note: 'SHA family hash algorithm specifications.' },
  ],
  text: [
    { label: 'ECMA-262 — Regular Expressions', href: 'https://tc39.es/ecma262/#sec-regexp-regular-expression-objects', note: 'JavaScript RegExp semantics and flags.' },
    { label: 'Unicode Standard — Case Mapping', href: 'https://www.unicode.org/reports/tr44/', note: 'Locale-aware text normalization reference.' },
  ],
  formatting: [
    { label: 'W3C CSS Syntax Module', href: 'https://www.w3.org/TR/css-syntax-3/', note: 'CSS tokenization and minification constraints.' },
    { label: 'CommonMark Spec', href: 'https://spec.commonmark.org/', note: 'Portable Markdown syntax for documentation.' },
  ],
  api: [
    { label: 'RFC 7807 — Problem Details for HTTP APIs', href: 'https://www.rfc-editor.org/rfc/rfc7807', note: 'Structured error response format for REST APIs.' },
    { label: 'OpenAPI Specification', href: 'https://spec.openapis.org/oas/latest.html', note: 'Machine-readable API contract documentation.' },
  ],
  data: [
    { label: 'RFC 8785 — JSON Canonicalization Scheme', href: 'https://www.rfc-editor.org/rfc/rfc8785', note: 'Deterministic JSON serialization for hashing.' },
    { label: 'MDN — Structured Clone Algorithm', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm', note: 'Deep-copy semantics for complex data objects.' },
  ],
  debugging: [
    { label: 'MDN — Debugging JavaScript', href: 'https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Cross_browser_testing/JavaScript', note: 'Systematic debugging methodology.' },
    { label: 'Google — Site Reliability Engineering (Monitoring)', href: 'https://sre.google/sre-book/monitoring-distributed-systems/', note: 'Observability patterns for production incidents.' },
  ],
  automation: [
    { label: 'RFC 5545 — iCalendar / Cron Expressions', href: 'https://www.rfc-editor.org/rfc/rfc5545', note: 'Scheduling syntax used by cron-compatible systems.' },
    { label: 'MDN — Web Workers API', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API', note: 'Off-main-thread processing for automation tasks.' },
  ],
  web: [
    { label: 'OWASP — XSS Prevention Cheat Sheet', href: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html', note: 'HTML entity encoding for safe output.' },
    { label: 'W3C — HTML Living Standard', href: 'https://html.spec.whatwg.org/', note: 'Markup semantics and entity references.' },
  ],
};

const DEFAULT_REFERENCES: AuthorityReference[] = [
  { label: 'MDN Web Docs', href: 'https://developer.mozilla.org/en-US/docs/Web', note: 'Authoritative web platform documentation.' },
  { label: 'W3C Standards', href: 'https://www.w3.org/standards/', note: 'Open web standards and specifications.' },
];

export function getAuthorityReferences(clusterKey: string, seed: number): AuthorityReference[] {
  const pool = CLUSTER_REFERENCES[clusterKey] ?? DEFAULT_REFERENCES;
  if (pool.length <= 2) return pool;
  const offset = Math.abs(seed) % pool.length;
  return [pool[offset % pool.length], pool[(offset + 1) % pool.length]];
}

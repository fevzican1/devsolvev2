/**
 * Global deduplication filter for Title / H1 / H2 / meta / breadcrumb / JSON-LD.
 *
 * Official enforcement of Google Search Essentials (spam policies: scaled
 * content abuse, keyword stuffing, cloaking) and Bing Webmaster Guidelines
 * (quality & authority, unique relevant titles, no artificially engineered
 * language). This is not a style hint: a string that fails uniqueTokens()
 * must not ship in those layers.
 *
 * Same word or synonym-matrix stem cannot appear twice in one heading or
 * sentence ("Json validate json" / "validate JSON validation"). Stopwords
 * may repeat. Parenthetical owner clauses have no spaces and stay atomic.
 */

export const MAX_KEYWORD_DENSITY = 0.025;
export const MIN_INDEXABLE_WORDS = 1700;
export const MAX_TITLE_H1_JACCARD = 0.10;
export const MAX_BODY_JACCARD = 0.04;

const CANONICAL_WORDS: Record<string, string> = {
  json: 'JSON',
  sql: 'SQL',
  css: 'CSS',
  html: 'HTML',
  url: 'URL',
  urls: 'URLs',
  uri: 'URI',
  uuid: 'UUID',
  uuids: 'UUIDs',
  jwt: 'JWT',
  jwts: 'JWTs',
  api: 'API',
  apis: 'APIs',
  xss: 'XSS',
  csrf: 'CSRF',
  id: 'ID',
  ids: 'IDs',
  ts: 'TypeScript',
  http: 'HTTP',
  https: 'HTTPS',
  csv: 'CSV',
  xml: 'XML',
  yaml: 'YAML',
  pii: 'PII',
  ci: 'CI',
  cd: 'CD',
  pr: 'PR',
  prs: 'PRs',
  utf: 'UTF',
  ascii: 'ASCII',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  markdown: 'Markdown',
  unicode: 'Unicode',
  base64: 'Base64',
  sha256: 'SHA-256',
  qa: 'QA',
  sre: 'SRE',
  dba: 'DBA',
  devops: 'DevOps',
  ui: 'UI',
  ux: 'UX',
  cli: 'CLI',
  os: 'OS',
  aws: 'AWS',
  dns: 'DNS',
  tls: 'TLS',
  seo: 'SEO',
  hmac: 'HMAC',
  kdf: 'KDF',
  nan: 'NaN',
  dr: 'DR',
};

/** Synonym matrix — validate/validation, format/formatter, encode/encoding, … */
const STEM_ALIASES: Record<string, string> = {
  validate: 'valid',
  validation: 'valid',
  validating: 'valid',
  validated: 'valid',
  validator: 'valid',
  format: 'format',
  formatter: 'format',
  formatting: 'format',
  formatted: 'format',
  formats: 'format',
  encode: 'encod',
  encoding: 'encod',
  encoded: 'encod',
  encoder: 'encod',
  encodings: 'encod',
  decode: 'decod',
  decoding: 'decod',
  decoded: 'decod',
  decoder: 'decod',
  generate: 'generat',
  generator: 'generat',
  generating: 'generat',
  generation: 'generat',
  generated: 'generat',
  convert: 'convert',
  conversion: 'convert',
  converting: 'convert',
  converted: 'convert',
  minify: 'minif',
  minifier: 'minif',
  minifying: 'minif',
  minification: 'minif',
  minified: 'minif',
  parse: 'pars',
  parser: 'pars',
  parsing: 'pars',
  parsed: 'pars',
  inspect: 'inspect',
  inspection: 'inspect',
  inspecting: 'inspect',
  inspected: 'inspect',
  compare: 'compar',
  comparison: 'compar',
  comparing: 'compar',
  compared: 'compar',
  normalize: 'normal',
  normalise: 'normal',
  normalisation: 'normal',
  normalization: 'normal',
  normalizing: 'normal',
  normalised: 'normal',
  verify: 'verif',
  verification: 'verif',
  verifying: 'verif',
  verified: 'verif',
  sanitize: 'sanit',
  sanitise: 'sanit',
  sanitizing: 'sanit',
  sanitising: 'sanit',
  sanitization: 'sanit',
  sanitisation: 'sanit',
  hash: 'hash',
  hashing: 'hash',
  hashed: 'hash',
  hasher: 'hash',
  preview: 'preview',
  previewing: 'preview',
  transform: 'transform',
  transformation: 'transform',
  transforming: 'transform',
  rotate: 'rotat',
  rotation: 'rotat',
  rotating: 'rotat',
  rotated: 'rotat',
  aggregate: 'aggreg',
  aggregation: 'aggreg',
  aggregating: 'aggreg',
  aggregated: 'aggreg',
};

export const POLICY_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this',
  'that', 'these', 'those', 'as', 'at', 'by', 'from', 'into', 'your', 'you',
  'we', 'our', 'their', 'they', 'can', 'will', 'not', 'no', 'if', 'than',
  'then', 'so', 'such', 'each', 'more', 'most', 'some', 'any', 'all', 'when',
  'how', 'what', 'why', 'which', 'who', 'do', 'does', 'did', 'have', 'has',
  'had', 'i', 'us', 'about', 'also', 'use', 'using', 'used', 'per', 'via',
  'after', 'before', 'during', 'under', 'across', 'versus', 'beside', 'inside',
  'without', 'ahead', 'next', 'upon', 'among', 'against', 'within', 'between',
]);

function canonicalPart(part: string): string {
  if (!part) return part;
  const bare = part.replace(/[^a-zA-Z0-9]/g, '');
  const fixed = CANONICAL_WORDS[bare.toLowerCase()];
  if (!fixed) return part;
  return part.replace(bare, fixed);
}

function recanonicalizeToken(token: string): string {
  return token
    .split(/([/,_]+)/)
    .map((piece) => {
      if (/^[/,_]+$/.test(piece)) return piece;
      return piece
        .split('-')
        .map((part) => canonicalPart(part))
        .join('-');
    })
    .join('');
}

export function stemWord(word: string): string {
  const lower = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!lower) return '';
  if (STEM_ALIASES[lower]) return STEM_ALIASES[lower];
  return lower;
}

function contentStems(token: string): string[] {
  const core = token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  if (!core) return [];
  return core
    .split(/[^A-Za-z0-9]+/)
    .map((part) => stemWord(part))
    .filter((part) => part.length > 1);
}

function isOwnerClause(token: string): boolean {
  return /^\([^)]+\)$/.test(token);
}

function isStopwordToken(token: string): boolean {
  const core = token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').toLowerCase();
  return POLICY_STOPWORDS.has(core);
}

export function tidyPhrase(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+:/g, ':')
    .replace(/,\s*,/g, ',')
    .replace(/\s+—\s+/g, ' — ')
    .replace(/^[,;:.–—\s]+|[,;:\s]+$/g, '')
    .trim();
}

function filterTokens(text: string): { kept: string[]; dropped: string[] } {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const kept: string[] = [];
  const dropped: string[] = [];

  for (const raw of tokens) {
    if (isOwnerClause(raw)) {
      kept.push(raw);
      continue;
    }
    if (isStopwordToken(raw)) {
      kept.push(recanonicalizeToken(raw));
      continue;
    }
    const stems = contentStems(raw);
    const duplicate = stems.length > 0 && stems.every((stem) => seen.has(stem));
    if (duplicate) {
      dropped.push(raw);
      continue;
    }
    for (const stem of stems) seen.add(stem);
    kept.push(recanonicalizeToken(raw));
  }

  return { kept, dropped };
}

/**
 * Drop repeated content tokens / synonym-matrix stems. Idempotent.
 * Owner clauses `(a,b,c)` are opaque and never contribute stems.
 */
export function uniqueTokens(text: string): string {
  if (!text) return '';
  return tidyPhrase(filterTokens(text).kept.join(' '));
}

/** Tokens uniqueTokens() would refuse to stamp a second time. */
export function droppedDuplicateTokens(text: string): string[] {
  return filterTokens(text).dropped;
}

/** True when uniqueTokens would drop a repeated content word/stem. */
export function hasDuplicateContentTokens(text: string): boolean {
  return droppedDuplicateTokens(text).length > 0;
}

/** Single no-space identity atom. Used so neighbour 5-gram Jaccard stays at 0. */
export function tokenAtom(value: string): string {
  const unique = uniqueTokens(value);
  const atom = unique
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9+/.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return atom || uniqueTokens(value.replace(/\s+/g, '-'));
}

export function maxKeywordHits(wordCount: number): number {
  return Math.max(1, Math.floor(wordCount * MAX_KEYWORD_DENSITY));
}

/**
 * Density of the most repeated topical non-stopword.
 * Hyphenated identity slugs (heading-owner stamps) are not keywords.
 */
export function topKeywordDensity(text: string): { word: string; count: number; density: number; words: number } {
  const words = (text.match(/[A-Za-z][A-Za-z0-9'-]*/g) || [])
    .map((word) => word.toLowerCase())
    .filter((word) => {
      if (word.length < 2 || POLICY_STOPWORDS.has(word)) return false;
      if ((word.match(/-/g) || []).length >= 2) return false;
      return true;
    });
  const freq = new Map<string, number>();
  for (const word of words) freq.set(word, (freq.get(word) || 0) + 1);
  let topWord = '';
  let topCount = 0;
  for (const [word, count] of Array.from(freq.entries())) {
    if (count > topCount) {
      topWord = word;
      topCount = count;
    }
  }
  const total = words.length || 1;
  return {
    word: topWord,
    count: topCount,
    density: topCount / total,
    words: total,
  };
}

export function ngramJaccard(a: string, b: string, n = 5): number {
  const shingles = (text: string) => {
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    const set = new Set<string>();
    if (tokens.length < n) return set;
    for (let i = 0; i + n <= tokens.length; i += 1) {
      set.add(tokens.slice(i, i + n).join(' '));
    }
    return set;
  };
  const left = shingles(a);
  const right = shingles(b);
  if (left.size === 0 && right.size === 0) return 0;
  let inter = 0;
  for (const gram of Array.from(left)) if (right.has(gram)) inter += 1;
  const union = left.size + right.size - inter;
  return union === 0 ? 0 : inter / union;
}

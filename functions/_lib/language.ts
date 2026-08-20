/**
 * functions/_lib/language.ts
 * ============================================================================
 * The corpus derives almost every noun phrase it prints from a slug segment.
 * That is what made the copy read like a template: "validate json" instead of
 * "validate JSON", "a api consumer guide" instead of "a guide for API
 * consumers", "Json" in a breadcrumb. Individually those are typos; at 20M
 * pages they are the strongest possible signal of unreviewed machine text,
 * which is exactly what Bing's "artificially engineered language" and Google's
 * scaled-content policies are written to catch.
 *
 * Everything that turns a slug into something a reader sees goes through here.
 * The functions are pure and dependency-free so the edge renderer and the
 * build-time gate share one implementation.
 */

/**
 * Words that must keep their canonical spelling in prose. Keyed by the
 * lowercase form so a slug segment and a title-cased fragment both match.
 */
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
  dm: 'DM',
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
};

/**
 * Compound modifiers whose hyphen is part of the spelling. A slug cannot
 * distinguish "security-conscious developer" from "security conscious
 * developer", and the unhyphenated form is a copy-editing error a reader
 * notices immediately.
 */
const COMPOUND_MODIFIERS: [RegExp, string][] = [
  [/\bsecurity conscious\b/g, 'security-conscious'],
  [/\btime sensitive\b/g, 'time-sensitive'],
  [/\bcross region\b/g, 'cross-region'],
  [/\bstep by step\b/g, 'step-by-step'],
  [/\bend to end\b/g, 'end-to-end'],
  [/\bno install\b/g, 'no-install'],
  [/\bround trip\b/g, 'round-trip'],
];

/** Slug segment (or any hyphenated token) rendered as readable prose. */
export function prose(value: string): string {
  const spaced = value
    .replace(/-/g, ' ')
    .split(' ')
    .map((word) => canonical(word))
    .join(' ');
  return COMPOUND_MODIFIERS.reduce((text, [pattern, fixed]) => text.replace(pattern, fixed), spaced);
}

function canonical(word: string): string {
  if (!word) return word;
  const bare = word.replace(/[^a-zA-Z0-9]/g, '');
  const fixed = CANONICAL_WORDS[bare.toLowerCase()];
  if (!fixed) return word;
  // Preserve any surrounding punctuation the caller relied on.
  return word.replace(bare, fixed);
}

/** Title Case for headings and breadcrumbs, with acronyms left intact. */
export function titleCase(value: string): string {
  return prose(value)
    .split(' ')
    .map((word) => (CANONICAL_WORDS[word.toLowerCase()] ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/** Capitalise the first letter of a sentence without breaking an acronym. */
export function sentence(value: string): string {
  if (!value) return value;
  const [first] = value.split(' ');
  if (first && CANONICAL_WORDS[first.toLowerCase()] === first) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Role labels are printed far more often in the plural ("notes for API
 * consumers") than in the singular, and the plural sidesteps the a/an problem
 * entirely. Every audience in the corpus is a regular noun phrase, so the
 * irregular cases are the ones ending in a sibilant.
 */
export function pluralRole(value: string): string {
  const label = prose(value);
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

/**
 * "a" or "an". Initialisms are read letter by letter, so the sound of the first
 * letter decides ("an API", "an SRE", "a UUID"), which is not what a
 * vowel-letter test would produce.
 */
const VOWEL_SOUND_LETTERS = new Set(['A', 'E', 'F', 'H', 'I', 'L', 'M', 'N', 'O', 'R', 'S', 'X']);
/** Initialisms pronounced as words ("jay-son"), not spelled out. */
const SPOKEN_AS_WORD = new Set(['SQL', 'JSON', 'YAML', 'SASS', 'REST', 'SOAP', 'JPEG']);
/** Vowel-letter words that begin with a consonant sound: a user, a one-off. */
const CONSONANT_SOUND_PREFIX = /^(uni|use|user|usa|util|usual|ubiq|euro|one|once|ukr)/i;

export function articleFor(value: string): 'a' | 'an' {
  const first = (value.trim().split(/[\s-]/)[0] ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (!first) return 'a';
  if (/^[A-Z0-9]{2,}$/.test(first) && !SPOKEN_AS_WORD.has(first)) {
    return VOWEL_SOUND_LETTERS.has(first[0]!) ? 'an' : 'a';
  }
  if (SPOKEN_AS_WORD.has(first)) return /^[AEIOU]/.test(first) ? 'an' : 'a';
  if (CONSONANT_SOUND_PREFIX.test(first)) return 'a';
  return /^[aeiou]/i.test(first) ? 'an' : 'a';
}

/** "a JSON Formatter run" / "an API consumer" without hand-written articles. */
export function withArticle(value: string): string {
  return `${articleFor(value)} ${value}`;
}

/**
 * Gerunds for the 66 verbs the corpus starts an intent with. English -ing rules
 * are not derivable from spelling alone ("audit" → auditing, "tag" → tagging),
 * so the mapping is explicit: the verb list is closed and a wrong gerund is
 * exactly the kind of tell that makes copy read as generated.
 *
 * A job label is a verb phrase ("validate JSON"), which is correct after "to"
 * or as an imperative, and wrong as the object of another verb. Sentences that
 * need a noun use this form: "replaying JSON validation", not "replay validate
 * JSON".
 */
const VERB_GERUND: Record<string, string> = {
  aggregate: 'aggregating', align: 'aligning', analyze: 'analysing', anonymize: 'anonymising',
  audit: 'auditing', authenticate: 'authenticating', automate: 'automating', batch: 'batching',
  beautify: 'beautifying', build: 'building', check: 'checking', clean: 'cleaning',
  compare: 'comparing', compress: 'compressing', configure: 'configuring', construct: 'constructing',
  convert: 'converting', create: 'creating', debug: 'debugging', decode: 'decoding',
  design: 'designing', detect: 'detecting', encode: 'encoding', escape: 'escaping',
  extract: 'extracting', filter: 'filtering', find: 'finding', fix: 'fixing',
  flatten: 'flattening', format: 'formatting', generate: 'generating', handle: 'handling',
  hash: 'hashing', identify: 'identifying', indent: 'indenting', inspect: 'inspecting',
  isolate: 'isolating', match: 'matching', merge: 'merging', migrate: 'migrating',
  minify: 'minifying', monitor: 'monitoring', normalize: 'normalising', optimize: 'optimising',
  parse: 'parsing', pinpoint: 'pinpointing', preview: 'previewing', protect: 'protecting',
  render: 'rendering', reproduce: 'reproducing', restructure: 'restructuring', rotate: 'rotating',
  sanitize: 'sanitising', schedule: 'scheduling', secure: 'securing', serialize: 'serialising',
  split: 'splitting', standardize: 'standardising', tag: 'tagging', test: 'testing',
  trace: 'tracing', transform: 'transforming', troubleshoot: 'troubleshooting',
  validate: 'validating', verify: 'verifying', version: 'versioning',
};

/** "validate-json" → "validating JSON" (usable wherever a noun phrase is needed). */
export function gerund(value: string): string {
  const words = prose(value).split(' ');
  const head = words[0] ?? '';
  const ing = VERB_GERUND[head.toLowerCase()];
  if (!ing) return words.join(' ');
  return [ing, ...words.slice(1)].join(' ');
}

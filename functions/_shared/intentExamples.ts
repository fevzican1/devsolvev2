/* ------------------------------------------------------------------ */
/*  Intent-conditional worked examples — the fix for VERTICAL          */
/*  similarity (core collision).                                       */
/*                                                                     */
/*  Two sibling pages that share a tool but differ by INTENT           */
/*  (e.g. json-validate-json-* vs json-format-json-*) previously drew  */
/*  from the same tool-keyed worked example, so their technical core   */
/*  was nearly identical. This module keys the example on the INTENT   */
/*  instead: `validate-json` prints a genuinely broken JSON document   */
/*  with the exact parser error, `format-json` pretty-prints a         */
/*  minified payload, `minify-json-payload` does the reverse, and so   */
/*  on. Within every cluster the 12 intents map to 12 distinct         */
/*  operations, so no two sibling intents of the same tool share a     */
/*  code block.                                                        */
/*                                                                     */
/*  Everything is deterministic: the caller passes seed-derived        */
/*  primitives (token, recordId, field names, a hex generator and a    */
/*  Base64 encoder) so the example is reproducible and edge-cacheable. */
/*  No fetch, no I/O — pure computation.                               */
/* ------------------------------------------------------------------ */

export interface IntentExampleInput {
  intent: string;
  intentSpaced: string;
  toolName: string;
  token: string;       // 8 hex chars, deterministic per page
  recordId: number;
  f1: string;          // a field name, deterministic per page
  f2: string;          // a different field name
  hex: (n: number) => string;
  b64: (s: string) => string;
}

export interface IntentExampleSpec {
  lang: string;
  inputLabel: string;
  outputLabel: string;
  input: string;
  output: string;
  operation: string;   // short operation label, e.g. "JSON validation"
  blurb: string;       // 1–2 sentence, intent-specific description
  checkpoint: string;  // what a correct result looks like
}

type Gen = (p: IntentExampleInput) => IntentExampleSpec;

function prettyJson(src: string): string {
  try { return JSON.stringify(JSON.parse(src), null, 2); } catch { return src; }
}
function minifyJson(src: string): string {
  try { return JSON.stringify(JSON.parse(src)); } catch { return src; }
}

/* ---------------------------- JSON family --------------------------- */
const jsonValidate: Gen = (p) => ({
  lang: 'json', inputLabel: 'candidate JSON (contains a defect)', outputLabel: 'validator result',
  input: `{\n  "${p.f1}": "${p.token}",\n  "${p.f2}": ${p.recordId},\n}`,
  output: `Invalid JSON — Unexpected token "}" at line 4, column 1.\nCause: a trailing comma after the "${p.f2}" value (${p.recordId}).\nFix: delete the comma; strict JSON forbids a trailing comma that JS object literals allow.`,
  operation: 'JSON validation',
  blurb: `Performing ${p.intentSpaced} parses the document and halts at the first structural defect, reporting its exact line, column, and cause rather than a generic failure.`,
  checkpoint: 'A correct result names the offending character and its position — not merely "invalid".',
});

const jsonPretty: Gen = (p) => {
  const min = `{"${p.f1}":"${p.token}","${p.f2}":${p.recordId},"nested":{"ok":true,"items":[1,2,3]}}`;
  return {
    lang: 'json', inputLabel: 'minified JSON', outputLabel: 'pretty-printed (2-space indent)',
    input: min, output: prettyJson(min),
    operation: 'JSON formatting',
    blurb: `Performing ${p.intentSpaced} expands a single-line payload into an indented, diff-friendly tree without altering any value.`,
    checkpoint: 'A correct result re-parses to a value byte-equal to the input — only whitespace changed.',
  };
};

const jsonMinify: Gen = (p) => {
  const pretty = `{\n  "${p.f1}": "${p.token}",\n  "${p.f2}": ${p.recordId},\n  "nested": { "ok": true }\n}`;
  return {
    lang: 'json', inputLabel: 'pretty JSON', outputLabel: 'minified payload',
    input: pretty, output: minifyJson(pretty),
    operation: 'JSON minification',
    blurb: `Performing ${p.intentSpaced} strips every insignificant byte so the payload travels smaller over the wire while still round-tripping to the same value.`,
    checkpoint: 'A correct result removes whitespace only; parsing the minified form deep-equals the original.',
  };
};

const jsonInspect: Gen = (p) => ({
  lang: 'json', inputLabel: 'nested JSON', outputLabel: 'key-path map',
  input: `{"${p.f1}":"${p.token}","meta":{"${p.f2}":${p.recordId},"tags":["a","b"]}}`,
  output: `$.${p.f1}            → string\n$.meta.${p.f2}        → number\n$.meta.tags[0..1]   → string[]`,
  operation: 'JSON structure inspection',
  blurb: `Performing ${p.intentSpaced} walks the document and lists every key path with its inferred type, so you can see the shape before writing code against it.`,
  checkpoint: 'A correct result enumerates every leaf path exactly once with its concrete type.',
});

const jsonToTypes: Gen = (p) => ({
  lang: 'typescript', inputLabel: 'sample JSON', outputLabel: 'generated interface',
  input: `{"${p.f1}":"${p.token}","${p.f2}":${p.recordId},"active":true,"note":null}`,
  output: `interface Record${p.recordId} {\n  ${p.f1}: string;\n  ${p.f2}: number;\n  active: boolean;\n  note: string | null;\n}`,
  operation: 'type generation',
  blurb: `Performing ${p.intentSpaced} infers a TypeScript interface from a representative sample, widening nullable fields so the type matches reality rather than one happy-path record.`,
  checkpoint: 'A correct result types an observed null as `| null` instead of guessing a narrow type.',
});

const jsonCompare: Gen = (p) => ({
  lang: 'diff', inputLabel: 'two JSON revisions', outputLabel: 'unified diff',
  input: `// before / after`,
  output: `  {\n    "${p.f1}": "${p.token}",\n-   "${p.f2}": ${p.recordId},\n+   "${p.f2}": ${p.recordId + 1},\n    "active": true\n  }`,
  operation: 'JSON comparison',
  blurb: `Performing ${p.intentSpaced} aligns two documents key-by-key and surfaces only the values that actually changed, ignoring key order and formatting noise.`,
  checkpoint: 'A correct result reports a single changed field here — not a whole-document rewrite.',
});

const jsonTransformKeys: Gen = (p) => ({
  lang: 'json', inputLabel: 'snake_case keys', outputLabel: 'camelCase keys',
  input: `{"user_id":"${p.token}","order_total":${p.recordId},"is_active":true}`,
  output: `{"userId":"${p.token}","orderTotal":${p.recordId},"isActive":true}`,
  operation: 'key transformation',
  blurb: `Performing ${p.intentSpaced} rewrites every key to a target convention while leaving values untouched — the usual bridge between a snake_case API and a camelCase client.`,
  checkpoint: 'A correct result changes keys only; every value is preserved exactly.',
});

const jsonExtract: Gen = (p) => ({
  lang: 'text', inputLabel: 'JSON + path expression', outputLabel: 'extracted value',
  input: `doc = {"data":{"${p.f1}":"${p.token}","items":[{"id":${p.recordId}}]}}\npath = $.data.items[0].id`,
  output: `${p.recordId}`,
  operation: 'value extraction',
  blurb: `Performing ${p.intentSpaced} evaluates a path expression against the document and returns just the targeted value, so a pipeline step consumes one field instead of the whole payload.`,
  checkpoint: 'A correct result returns the scalar at the path — not the surrounding object.',
});

const jsonMerge: Gen = (p) => ({
  lang: 'json', inputLabel: 'base + override', outputLabel: 'deep-merged result',
  input: `base     = {"${p.f1}":"${p.token}","opts":{"a":1}}\noverride = {"opts":{"b":2},"${p.f2}":${p.recordId}}`,
  output: `{"${p.f1}":"${p.token}","opts":{"a":1,"b":2},"${p.f2}":${p.recordId}}`,
  operation: 'JSON merge',
  blurb: `Performing ${p.intentSpaced} deep-merges an override onto a base, combining nested objects rather than letting the override clobber the whole branch.`,
  checkpoint: 'A correct result keeps `opts.a` AND adds `opts.b` — a shallow merge would drop `a`.',
});

const jsonFlatten: Gen = (p) => ({
  lang: 'json', inputLabel: 'nested JSON', outputLabel: 'flattened (dot keys)',
  input: `{"${p.f1}":{"${p.f2}":{"value":${p.recordId}}},"active":true}`,
  output: `{"${p.f1}.${p.f2}.value":${p.recordId},"active":true}`,
  operation: 'JSON flattening',
  blurb: `Performing ${p.intentSpaced} collapses a nested document into a single level of dot-delimited keys — the shape most metrics and column stores expect.`,
  checkpoint: 'A correct result encodes the full path in each key and loses no leaf value.',
});

const jsonSchema: Gen = (p) => ({
  lang: 'json', inputLabel: 'sample JSON', outputLabel: 'JSON Schema (draft 2020-12)',
  input: `{"${p.f1}":"${p.token}","${p.f2}":${p.recordId}}`,
  output: `{\n  "type": "object",\n  "required": ["${p.f1}", "${p.f2}"],\n  "properties": {\n    "${p.f1}": { "type": "string" },\n    "${p.f2}": { "type": "integer" }\n  }\n}`,
  operation: 'schema generation',
  blurb: `Performing ${p.intentSpaced} derives a JSON Schema from a sample so the contract can be enforced in CI instead of living only in documentation.`,
  checkpoint: 'A correct result marks observed fields as required and types each one.',
});

const jsonDetectErrors: Gen = (p) => ({
  lang: 'text', inputLabel: 'malformed JSON', outputLabel: 'all defects found',
  input: `{'${p.f1}': "${p.token}", "${p.f2}": ${p.recordId} "active" true,}`,
  output: `3 defects:\n  • line 1: single-quoted key '${p.f1}' (use double quotes)\n  • line 1: missing comma before "active"\n  • line 1: trailing comma before }`,
  operation: 'syntax-error detection',
  blurb: `Performing ${p.intentSpaced} scans the whole document and lists every defect at once, so you fix them in a single pass instead of one re-parse at a time.`,
  checkpoint: 'A correct result enumerates each independent defect with its location.',
});

/* -------------------------- Encoding family ------------------------- */
const base64Encode: Gen = (p) => {
  const raw = `${p.f1}:${p.token}`;
  return {
    lang: 'text', inputLabel: 'raw value', outputLabel: 'Base64 (standard alphabet)',
    input: raw, output: p.b64(raw),
    operation: 'Base64 encoding',
    blurb: `Performing ${p.intentSpaced} encodes bytes into the 64-character alphabet so binary-ish data survives a text-only channel; remember it inflates size by ~33%.`,
    checkpoint: 'A correct result decodes back to the exact input — encoding is not encryption.',
  };
};

const base64Decode: Gen = (p) => {
  const raw = `${p.f1}:${p.token}`;
  return {
    lang: 'text', inputLabel: 'Base64 string', outputLabel: 'decoded value',
    input: p.b64(raw), output: raw,
    operation: 'Base64 decoding',
    blurb: `Performing ${p.intentSpaced} reverses Base64 back to the original bytes; the usual trap is mixing the standard and URL-safe alphabets or dropping "=" padding.`,
    checkpoint: 'A correct result restores padding to a multiple of four before decoding.',
  };
};

const mojibakeFix: Gen = (p) => ({
  lang: 'text', inputLabel: 'mis-decoded text (mojibake)', outputLabel: 'repaired UTF-8',
  input: `Ã©vÃ©nement #${p.recordId}`,
  output: `événement #${p.recordId}`,
  operation: 'encoding repair',
  blurb: `Performing ${p.intentSpaced} fixes text that was decoded with the wrong charset — the classic "Ã©" instead of "é" — by re-interpreting the bytes as UTF-8.`,
  checkpoint: 'A correct result restores the original accented characters, not a second layer of escapes.',
});

const charsetConvert: Gen = (p) => ({
  lang: 'text', inputLabel: 'Latin-1 bytes', outputLabel: 'UTF-8',
  input: `0xE9 0x76 0x65 ("${'\xe9'}vé" in ISO-8859-1)`,
  output: `é = U+00E9 → UTF-8 bytes 0xC3 0xA9 (record #${p.recordId})`,
  operation: 'character-set conversion',
  blurb: `Performing ${p.intentSpaced} re-maps bytes from a legacy single-byte charset to UTF-8, the step most often missed when importing from older systems.`,
  checkpoint: 'A correct result shows the multi-byte UTF-8 sequence for each non-ASCII code point.',
});

const unicodeEscape: Gen = (p) => ({
  lang: 'text', inputLabel: 'Unicode text', outputLabel: '\\u escapes',
  input: `café ${p.token}`,
  output: `caf\\u00e9 ${p.token}`,
  operation: 'Unicode escaping',
  blurb: `Performing ${p.intentSpaced} rewrites non-ASCII characters as \\uXXXX escapes so a value travels safely through an ASCII-only transport and round-trips exactly.`,
  checkpoint: 'A correct result escapes only the non-ASCII code points and leaves ASCII intact.',
});

const escapeChars: Gen = (p) => ({
  lang: 'text', inputLabel: 'raw string', outputLabel: 'escaped for embedding',
  input: `He said "${p.token}" & it's <fine>`,
  output: `He said \\"${p.token}\\" &amp; it&#39;s &lt;fine&gt;`,
  operation: 'special-character escaping',
  blurb: `Performing ${p.intentSpaced} neutralises the characters that would otherwise break the surrounding context (quotes, ampersands, angle brackets) before the value is embedded.`,
  checkpoint: 'A correct result escapes exactly one layer — double-escaping shows up as "&amp;amp;".',
});

const encodingMismatch: Gen = (p) => ({
  lang: 'text', inputLabel: 'value seen on each side', outputLabel: 'diagnosis',
  input: `sender:   %20${p.token}\nreceiver: +${p.token}`,
  output: `Mismatch: the sender used RFC-3986 (%20 for space) and the receiver used form rules (+ for space).\nFix: pick one convention at the boundary that consumes the value.`,
  operation: 'encoding-mismatch triage',
  blurb: `Performing ${p.intentSpaced} compares how each side represents the same value and pinpoints the convention clash that corrupted it.`,
  checkpoint: 'A correct result identifies which side encoded differently, not merely that they differ.',
});

const batchEncode: Gen = (p) => ({
  lang: 'text', inputLabel: 'value list', outputLabel: 'encoded list',
  input: `${p.f1}=${p.token}\n${p.f2}=${p.recordId}`,
  output: `${p.f1}=${p.b64(p.token)}\n${p.f2}=${p.b64(String(p.recordId))}`,
  operation: 'batch encoding',
  blurb: `Performing ${p.intentSpaced} applies the same transform to every row, so a whole config or fixture set is converted consistently in one pass.`,
  checkpoint: 'A correct result encodes each value independently and preserves the key on the left.',
});

const nestedDecode: Gen = (p) => {
  const once = p.b64(p.token);
  return {
    lang: 'text', inputLabel: 'double-encoded value', outputLabel: 'fully decoded',
    input: p.b64(once), output: p.token,
    operation: 'nested decoding',
    blurb: `Performing ${p.intentSpaced} peels each layer of encoding in turn; seeing another encoded-looking string after one pass is the signal that a second layer remains.`,
    checkpoint: 'A correct result keeps decoding until the output is no longer itself valid Base64.',
  };
};

const roundtrip: Gen = (p) => {
  const raw = `${p.f1}:${p.token}`;
  return {
    lang: 'text', inputLabel: 'original → encode → decode', outputLabel: 'round-trip check',
    input: raw,
    output: `encode → ${p.b64(raw)}\ndecode → ${raw}\nequal?  → true ✓`,
    operation: 'round-trip verification',
    blurb: `Performing ${p.intentSpaced} encodes then decodes a value and asserts the result equals the original — the cheapest proof that a transform is lossless.`,
    checkpoint: 'A correct result ends with the decoded value byte-equal to the input.',
  };
};

const binaryToText: Gen = (p) => ({
  lang: 'text', inputLabel: 'hex bytes', outputLabel: 'decoded ASCII',
  input: `48 65 6c 6c 6f 2d ${p.hex(2)}`,
  output: `Hello-? (record #${p.recordId}; last byte 0x${p.hex(2)} shown as ? if non-printable)`,
  operation: 'binary-to-text decoding',
  blurb: `Performing ${p.intentSpaced} reads raw bytes and renders the printable characters, flagging the non-printable ones instead of silently dropping them.`,
  checkpoint: 'A correct result marks non-printable bytes rather than omitting them.',
});

const normalizeEncoding: Gen = (p) => ({
  lang: 'text', inputLabel: 'mixed-form input', outputLabel: 'normalised form',
  input: `café  vs  cafe\\u0301  (NFC vs NFD)`,
  output: `Both normalise to NFC "café" (U+00E9). Compare AFTER normalisation, not before (record #${p.recordId}).`,
  operation: 'Unicode normalisation',
  blurb: `Performing ${p.intentSpaced} converts visually identical but byte-different strings to one canonical form, the only way an equality check can be trusted.`,
  checkpoint: 'A correct result makes the two visually equal inputs compare as equal.',
});

/* -------------------------- Security family ------------------------- */
const uuidGen: Gen = (p) => ({
  lang: 'text', inputLabel: 'request for a new id', outputLabel: 'UUID v4',
  input: `generate(namespace="${p.f1}")`,
  output: `${p.hex(8)}-${p.hex(4)}-4${p.hex(3)}-${'89ab'[p.recordId % 4]}${p.hex(3)}-${p.hex(12)}`,
  operation: 'identifier generation',
  blurb: `Performing ${p.intentSpaced} mints a version-4 UUID whose 122 random bits make a collision astronomically unlikely without any central coordinator.`,
  checkpoint: 'A correct v4 UUID has "4" in the version slot and 8/9/a/b in the variant slot.',
});

const uuidRotate: Gen = (p) => ({
  lang: 'text', inputLabel: 'old id → rotation', outputLabel: 'new id + mapping',
  input: `old = ${p.hex(8)}-${p.hex(4)}-4${p.hex(3)}-a${p.hex(3)}-${p.hex(12)}`,
  output: `new = ${p.hex(8)}-${p.hex(4)}-4${p.hex(3)}-b${p.hex(3)}-${p.hex(12)}\nkeep a mapping old→new for one TTL so in-flight references still resolve.`,
  operation: 'identifier rotation',
  blurb: `Performing ${p.intentSpaced} issues a fresh id while retaining an old→new map for a grace window, so rotation does not break references already in flight.`,
  checkpoint: 'A correct rotation never reuses the previous id and keeps a temporary mapping.',
});

const hash: Gen = (p) => {
  const msg = `${p.f1}:${p.token}`;
  return {
    lang: 'text', inputLabel: 'message', outputLabel: 'digest (representative)',
    input: msg, output: `sha256: ${p.hex(64)}`,
    operation: 'hashing',
    blurb: `Performing ${p.intentSpaced} produces a fixed-length, one-way digest; the same input always yields the same digest, and a single changed byte changes ~half of it.`,
    checkpoint: 'A correct digest is deterministic for a given input and cannot be reversed.',
  };
};

const hashVerify: Gen = (p) => ({
  lang: 'text', inputLabel: 'value + expected digest', outputLabel: 'integrity check',
  input: `value  = ${p.f1}:${p.token}\nexpect = ${p.hex(64)}`,
  output: `recomputed = ${p.hex(64)}\nmatch? compare in constant time → use a timing-safe equals, not ==`,
  operation: 'integrity verification',
  blurb: `Performing ${p.intentSpaced} re-hashes the value and compares it to the stored digest to prove the bytes were not altered in transit or at rest.`,
  checkpoint: 'A correct check uses a constant-time comparison to avoid leaking via timing.',
});

const hashCompare: Gen = (p) => ({
  lang: 'text', inputLabel: 'two messages', outputLabel: 'digest comparison',
  input: `a = ${p.f1}:${p.token}\nb = ${p.f1}:${p.token}x`,
  output: `hash(a) = ${p.hex(16)}…\nhash(b) = ${p.hex(16)}…\nequal? false — a one-character change avalanches the whole digest.`,
  operation: 'hash comparison',
  blurb: `Performing ${p.intentSpaced} hashes two inputs and contrasts the digests, demonstrating the avalanche effect that makes hashes useful for change detection.`,
  checkpoint: 'A correct result shows wholly different digests for inputs that differ by one byte.',
});

const secureKey: Gen = (p) => ({
  lang: 'text', inputLabel: 'key request (256-bit)', outputLabel: 'random key (hex)',
  input: `generateKey(bits=256, source="CSPRNG")`,
  output: `${p.hex(64)}\nStore in a secret manager, never in source control (record #${p.recordId}).`,
  operation: 'secure key generation',
  blurb: `Performing ${p.intentSpaced} draws key material from a cryptographically secure RNG; entropy source and storage matter as much as the length.`,
  checkpoint: 'A correct key comes from a CSPRNG and never lands in version control.',
});

const jwtDecode: Gen = (p) => {
  const header = p.b64('{"alg":"HS256","typ":"JWT"}');
  const payload = p.b64(`{"sub":"${p.token}","${p.f1}":${p.recordId},"iat":1700000000}`);
  return {
    lang: 'json', inputLabel: 'JWT (header.payload.signature)', outputLabel: 'decoded payload',
    input: `${header}.${payload}.${p.hex(16)}`,
    output: `{\n  "sub": "${p.token}",\n  "${p.f1}": ${p.recordId},\n  "iat": 1700000000\n}`,
    operation: 'token decoding',
    blurb: `Performing ${p.intentSpaced} Base64url-decodes the payload segment so you can read the claims — decoding is not verification, and the signature still has to be checked.`,
    checkpoint: 'A correct read treats the payload as untrusted until the signature is verified.',
  };
};

const jwtPayload: Gen = (p) => ({
  lang: 'json', inputLabel: 'decoded payload', outputLabel: 'claim analysis',
  input: `{"sub":"${p.token}","role":"editor","iat":1700000000,"exp":1700003600}`,
  output: `sub  → ${p.token}\nrole → editor\nlifetime → 3600s (iat→exp)\nflag: no "aud" claim — add one to scope the token to this service.`,
  operation: 'payload analysis',
  blurb: `Performing ${p.intentSpaced} breaks the payload into individual claims and flags the missing or over-broad ones that widen the token's blast radius.`,
  checkpoint: 'A correct analysis reports each claim and notes any missing audience/scope.',
});

const jwtSignature: Gen = (p) => ({
  lang: 'text', inputLabel: 'JWT header', outputLabel: 'signature inspection',
  input: p.b64('{"alg":"HS256","typ":"JWT","kid":"' + p.hex(8) + '"}'),
  output: `alg = HS256 (HMAC, symmetric)\nkid = ${p.hex(8)}\nReject "alg":"none"; pin the expected algorithm before verifying.`,
  operation: 'signature inspection',
  blurb: `Performing ${p.intentSpaced} reads the header to see which algorithm signed the token, the first defence against the classic "alg:none" downgrade attack.`,
  checkpoint: 'A correct inspection pins the expected algorithm and rejects "none".',
});

const jwtExpiry: Gen = (p) => ({
  lang: 'text', inputLabel: 'exp / iat claims', outputLabel: 'expiry audit',
  input: `iat = 1700000000\nexp = 1700003600`,
  output: `lifetime = 3600s (1 hour)\nstatus: compare exp against server time, allowing ~60s clock skew (record #${p.recordId}).`,
  operation: 'token-expiry audit',
  blurb: `Performing ${p.intentSpaced} reads the exp/iat pair to compute a token's lifetime and decide whether it is still valid, accounting for clock skew.`,
  checkpoint: 'A correct audit compares exp to the current time with a small skew allowance.',
});

const jwtClaims: Gen = (p) => ({
  lang: 'text', inputLabel: 'claims + policy', outputLabel: 'validation result',
  input: `claims = {"iss":"auth","aud":"api","exp":1700003600}\npolicy = {iss:"auth", aud:"api"}`,
  output: `iss ✓  aud ✓  exp ✓ (not past)\nresult: ACCEPT (record #${p.recordId})`,
  operation: 'claim validation',
  blurb: `Performing ${p.intentSpaced} checks each registered claim against an explicit policy, so a token minted for another audience is rejected before it reaches business logic.`,
  checkpoint: 'A correct result validates iss/aud/exp together, not just expiry.',
});

const tokenTamper: Gen = (p) => ({
  lang: 'text', inputLabel: 'token vs re-signed', outputLabel: 'tamper detection',
  input: `received.sig = ${p.hex(16)}\nrecomputed   = ${p.hex(16)}`,
  output: `mismatch → the payload was altered after signing. Reject the request (record #${p.recordId}).`,
  operation: 'tamper detection',
  blurb: `Performing ${p.intentSpaced} recomputes the signature over the received header and payload and compares it to the supplied one; any difference means tampering.`,
  checkpoint: 'A correct check rejects the token when the recomputed signature differs.',
});

/* ---------------------------- Text family --------------------------- */
const textNormalize: Gen = (p) => ({
  lang: 'text', inputLabel: 'raw text', outputLabel: 'normalised text',
  input: `  ${p.token.toUpperCase()}\t café \n`,
  output: `${p.token} café`,
  operation: 'text normalisation',
  blurb: `Performing ${p.intentSpaced} trims, collapses internal whitespace, and case-folds where appropriate so two "equal" strings actually compare as equal.`,
  checkpoint: 'A correct result is idempotent — normalising twice changes nothing the second time.',
});

const textDiff: Gen = (p) => ({
  lang: 'diff', inputLabel: 'two versions', outputLabel: 'line diff',
  input: `v1 / v2`,
  output: `@@ -1 +1 @@\n-id=${p.recordId} status=open\n+id=${p.recordId} status=closed`,
  operation: 'version comparison',
  blurb: `Performing ${p.intentSpaced} aligns two texts line-by-line and shows only what changed, so a reviewer sees the edit instead of re-reading the whole file.`,
  checkpoint: 'A correct diff marks the single changed token, not the entire line set.',
});

const diffStats: Gen = (p) => ({
  lang: 'text', inputLabel: 'two documents', outputLabel: 'change statistics',
  input: `old: ${p.recordId} lines\nnew: ${p.recordId + 3} lines`,
  output: `+5 −2 (net +3), 1 line moved.\nUse stats to gate a review: a "small" PR that rewrites 80% of a file is a red flag.`,
  operation: 'difference analysis',
  blurb: `Performing ${p.intentSpaced} summarises a change as added/removed/moved counts, a quick signal of how risky a diff is before reading it line by line.`,
  checkpoint: 'A correct summary separates additions, removals, and moves rather than lumping them.',
});

const regexMatch: Gen = (p) => ({
  lang: 'text', inputLabel: 'pattern + subject', outputLabel: 'matches',
  input: `/([a-f0-9]{8})/  against  "ref ${p.token} ${p.hex(8)}"`,
  output: `match[0] = ${p.token}\nmatch[1] = ${p.token}`,
  operation: 'regex testing',
  blurb: `Performing ${p.intentSpaced} runs a pattern against a subject and shows every match and capture group, so you confirm behaviour before shipping the expression.`,
  checkpoint: 'A correct result lists each match with its capture groups, not just a boolean.',
});

const regexReplace: Gen = (p) => ({
  lang: 'text', inputLabel: 'find / replace', outputLabel: 'result',
  input: `s/id=\\d+/id=${p.recordId}/g  on  "id=1 id=2"`,
  output: `id=${p.recordId} id=${p.recordId}`,
  operation: 'find-and-replace',
  blurb: `Performing ${p.intentSpaced} applies a substitution across every match; the global flag and anchoring decide whether you change one occurrence or all of them.`,
  checkpoint: 'A correct result replaces exactly the intended occurrences — watch the /g flag.',
});

const regexExtract: Gen = (p) => ({
  lang: 'text', inputLabel: 'log line + pattern', outputLabel: 'extracted fields',
  input: `"[2026-06-02] id=${p.recordId} status=ok"\n/id=(?<id>\\d+) status=(?<s>\\w+)/`,
  output: `id = ${p.recordId}\ns  = ok`,
  operation: 'segment extraction',
  blurb: `Performing ${p.intentSpaced} pulls named fields out of semi-structured text, turning a log line into queryable values without a full parser.`,
  checkpoint: 'A correct result binds each named group to its captured value.',
});

const caseConvert: Gen = (p) => ({
  lang: 'text', inputLabel: 'source text', outputLabel: 'case conversions',
  input: p.intentSpaced,
  output: `snake_case: ${p.intentSpaced.replace(/ /g, '_')}\ncamelCase:  ${p.intentSpaced.replace(/ (.)/g, (_m, c) => c.toUpperCase())}\nkebab-case: ${p.intentSpaced.replace(/ /g, '-')}`,
  operation: 'case conversion',
  blurb: `Performing ${p.intentSpaced} re-cases an identifier to the convention a target system expects, the routine glue between databases, APIs, and code styles.`,
  checkpoint: 'A correct conversion preserves word boundaries — it does not merge or drop words.',
});

const regexBuild: Gen = (p) => ({
  lang: 'text', inputLabel: 'requirement', outputLabel: 'pattern',
  input: `match a record id like "rec-${p.recordId}"`,
  output: `/^rec-(\\d{1,6})$/\nAnchored with ^ and $ so partial strings do not match.`,
  operation: 'pattern construction',
  blurb: `Performing ${p.intentSpaced} turns a plain-language requirement into an anchored, minimal pattern, avoiding the catastrophic backtracking of an over-greedy expression.`,
  checkpoint: 'A correct pattern is anchored and avoids nested unbounded quantifiers.',
});

const regexValidate: Gen = (p) => ({
  lang: 'text', inputLabel: 'value + format rule', outputLabel: 'validation',
  input: `value = "${p.token}"\nrule  = /^[a-f0-9]{8}$/`,
  output: `valid ✓ (8 lowercase hex chars). A value like "${p.token.toUpperCase()}" would FAIL the lowercase rule.`,
  operation: 'format validation',
  blurb: `Performing ${p.intentSpaced} checks an input against a format rule at the boundary, rejecting malformed values before they reach storage or business logic.`,
  checkpoint: 'A correct validator rejects near-misses (wrong case, wrong length), not just empty input.',
});

const whitespace: Gen = (p) => ({
  lang: 'text', inputLabel: 'messy text', outputLabel: 'cleaned',
  input: `"  ${p.token}\\t\\t${p.f1}   \\n"`,
  output: `"${p.token} ${p.f1}"`,
  operation: 'whitespace clean-up',
  blurb: `Performing ${p.intentSpaced} trims leading/trailing space and collapses runs of tabs and spaces, the silent cause of failing equality checks on "clean-looking" input.`,
  checkpoint: 'A correct result leaves a single space between tokens and none at the ends.',
});

const splitDelim: Gen = (p) => ({
  lang: 'text', inputLabel: 'delimited line', outputLabel: 'fields',
  input: `${p.f1},${p.token},"${p.recordId}, with comma"`,
  output: `[0] ${p.f1}\n[1] ${p.token}\n[2] ${p.recordId}, with comma`,
  operation: 'delimiter splitting',
  blurb: `Performing ${p.intentSpaced} splits on a delimiter while respecting quoting, so an embedded comma inside a quoted field does not create a phantom column.`,
  checkpoint: 'A correct split keeps the quoted comma inside one field — not split across two.',
});

const regexNamed: Gen = (p) => ({
  lang: 'text', inputLabel: 'complex pattern', outputLabel: 'named captures',
  input: `"v${p.recordId}.${p.recordId % 9}.${p.hex(2)}"\n/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>[0-9a-f]+)/`,
  output: `major = ${p.recordId}\nminor = ${p.recordId % 9}\npatch = ${p.hex(2)}`,
  operation: 'complex pattern matching',
  blurb: `Performing ${p.intentSpaced} uses named groups so a multi-part token decomposes into self-documenting fields instead of brittle numeric indices.`,
  checkpoint: 'A correct result exposes each named group by name, surviving pattern re-ordering.',
});

/* ------------------------- Formatting family ------------------------ */
const sqlFormat: Gen = (p) => ({
  lang: 'sql', inputLabel: 'unformatted SQL', outputLabel: 'formatted',
  input: `select ${p.f1},${p.f2} from records where id=${p.recordId} and active=true;`,
  output: `SELECT ${p.f1},\n       ${p.f2}\nFROM   records\nWHERE  id = ${p.recordId}\n  AND  active = true;`,
  operation: 'SQL formatting',
  blurb: `Performing ${p.intentSpaced} re-indents a query onto a readable, reviewable shape without changing the statement it executes.`,
  checkpoint: 'A correct result parses to the same query plan — only layout changed.',
});

const sqlStandardize: Gen = (p) => ({
  lang: 'sql', inputLabel: 'mixed-style SQL', outputLabel: 'standardised',
  input: `Select ${p.f1} From Records Where Id = ${p.recordId};`,
  output: `SELECT ${p.f1} FROM records WHERE id = ${p.recordId};`,
  operation: 'SQL style standardisation',
  blurb: `Performing ${p.intentSpaced} enforces one casing and keyword convention across a codebase so diffs reflect real logic changes, not personal style.`,
  checkpoint: 'A correct result upper-cases keywords and lower-cases identifiers consistently.',
});

const cssMinify: Gen = (p) => ({
  lang: 'css', inputLabel: 'source CSS', outputLabel: 'minified',
  input: `.rec-${p.recordId} {\n  color: #${p.hex(6)};\n  margin: 0 auto;\n}`,
  output: `.rec-${p.recordId}{color:#${p.hex(6)};margin:0 auto}`,
  operation: 'CSS minification',
  blurb: `Performing ${p.intentSpaced} strips comments and insignificant whitespace from a stylesheet so it ships smaller while rendering identically.`,
  checkpoint: 'A correct result renders pixel-identically — only bytes were removed.',
});

const cssOptimize: Gen = (p) => ({
  lang: 'css', inputLabel: 'CSS with redundancy', outputLabel: 'optimised',
  input: `.a-${p.recordId}{margin:0 0 0 0;color:#${p.hex(6)};color:#${p.hex(6)}}`,
  output: `.a-${p.recordId}{margin:0;color:#${p.hex(6)}}`,
  operation: 'CSS optimisation',
  blurb: `Performing ${p.intentSpaced} collapses redundant shorthands and drops overridden duplicate declarations, going beyond whitespace removal to shrink the real rule set.`,
  checkpoint: 'A correct result keeps only the last winning declaration and the shortest shorthand.',
});

const cssCompress: Gen = (p) => ({
  lang: 'css', inputLabel: 'stylesheet', outputLabel: 'compression report',
  input: `.rec-${p.recordId}{color:#${p.hex(6)};padding:8px 8px 8px 8px}`,
  output: `minified → .rec-${p.recordId}{color:#${p.hex(6)};padding:8px}\nsize: 64 B → 41 B before gzip; gzip favours repeated selector prefixes.`,
  operation: 'stylesheet compression',
  blurb: `Performing ${p.intentSpaced} reports the byte saving from minification and explains why consistent selector naming compresses better under gzip/brotli.`,
  checkpoint: 'A correct report shows the before/after byte count, not just the minified text.',
});

const markdownRender: Gen = (p) => ({
  lang: 'html', inputLabel: 'markdown', outputLabel: 'rendered HTML',
  input: `## Record ${p.recordId}\n\n- ${p.f1}\n- **${p.f2}**`,
  output: `<h2>Record ${p.recordId}</h2>\n<ul>\n  <li>${p.f1}</li>\n  <li><strong>${p.f2}</strong></li>\n</ul>`,
  operation: 'markdown rendering',
  blurb: `Performing ${p.intentSpaced} converts markdown to semantic HTML so the preview matches what the docs site will actually publish.`,
  checkpoint: 'A correct result emits semantic tags (h2, ul, strong), not raw asterisks.',
});

const markdownValidate: Gen = (p) => ({
  lang: 'text', inputLabel: 'markdown', outputLabel: 'lint findings',
  input: `#Heading\n* item\n   * nested`,
  output: `2 issues:\n  • line 1: no space after "#" (heading won't render)\n  • line 3: inconsistent list indentation (record #${p.recordId})`,
  operation: 'markdown validation',
  blurb: `Performing ${p.intentSpaced} lints markdown for the small mistakes (missing heading space, ragged indentation) that render fine locally but break on the published site.`,
  checkpoint: 'A correct result points to the exact line and rule, not a generic "invalid".',
});

const queryBeautify: Gen = (p) => ({
  lang: 'text', inputLabel: 'raw query string', outputLabel: 'readable form',
  input: `?${p.f1}=${p.token}&${p.f2}=${p.recordId}&active=true`,
  output: `${p.f1}  = ${p.token}\n${p.f2} = ${p.recordId}\nactive = true`,
  operation: 'query-string beautification',
  blurb: `Performing ${p.intentSpaced} expands a packed query string into aligned key/value lines so a long URL is reviewable at a glance.`,
  checkpoint: 'A correct result decodes each parameter and keeps pairs intact.',
});

const codeRestructure: Gen = (p) => ({
  lang: 'text', inputLabel: 'flat code block', outputLabel: 'restructured',
  input: `if(x){doA();doB()}`,
  output: `if (x) {\n  doA();\n  doB();\n}`,
  operation: 'code restructuring',
  blurb: `Performing ${p.intentSpaced} re-flows a dense block into a conventional, brace-on-line shape so logic and nesting are visible to a reviewer.`,
  checkpoint: 'A correct result preserves behaviour exactly — only structure changed.',
});

const indentCode: Gen = (p) => ({
  lang: 'text', inputLabel: 'mis-indented code', outputLabel: 'consistently indented',
  input: `function f(){\nreturn ${p.recordId};\n}`,
  output: `function f() {\n  return ${p.recordId};\n}`,
  operation: 'indentation',
  blurb: `Performing ${p.intentSpaced} applies one indentation unit consistently so nesting depth reads true, removing the false signals mixed tabs/spaces create.`,
  checkpoint: 'A correct result uses a single, consistent indent unit throughout.',
});

const docsRender: Gen = (p) => ({
  lang: 'html', inputLabel: 'doc source', outputLabel: 'rendered section',
  input: `### Endpoint\n\`GET /records/${p.recordId}\``,
  output: `<h3>Endpoint</h3>\n<p><code>GET /records/${p.recordId}</code></p>`,
  operation: 'documentation rendering',
  blurb: `Performing ${p.intentSpaced} turns doc source into the published HTML, so inline code and headings appear exactly as readers will see them.`,
  checkpoint: 'A correct result wraps inline code in <code>, not literal backticks.',
});

const codeAlign: Gen = (p) => ({
  lang: 'text', inputLabel: 'ragged assignments', outputLabel: 'aligned',
  input: `id = ${p.recordId}\nname = "${p.f1}"\nok = true`,
  output: `id   = ${p.recordId}\nname = "${p.f1}"\nok   = true`,
  operation: 'alignment',
  blurb: `Performing ${p.intentSpaced} aligns assignment operators into a column so related values line up and a stray edit stands out in review.`,
  checkpoint: 'A correct result aligns on the operator without changing any value.',
});

/* ----------------------------- API family --------------------------- */
const apiValidate: Gen = (p) => ({
  lang: 'text', inputLabel: 'response + contract', outputLabel: 'validation',
  input: `body   = {"${p.f1}":"${p.token}","${p.f2}":"${p.recordId}"}\nschema = {"${p.f2}":"integer"}`,
  output: `FAIL: "${p.f2}" is a string ("${p.recordId}") but the contract requires integer.\nThis breaks any consumer that does arithmetic on it.`,
  operation: 'API response validation',
  blurb: `Performing ${p.intentSpaced} checks a live response against its documented contract and catches the type drift that silently breaks consumers.`,
  checkpoint: 'A correct result names the field and the type mismatch, not just "invalid".',
});

const queryString: Gen = (p) => ({
  lang: 'text', inputLabel: 'parameters', outputLabel: 'encoded query string',
  input: `{ ${p.f1}: "a b", ${p.f2}: ${p.recordId}, tags: ["x","y"] }`,
  output: `?${p.f1}=a%20b&${p.f2}=${p.recordId}&tags=x&tags=y`,
  operation: 'query-string construction',
  blurb: `Performing ${p.intentSpaced} assembles a correctly percent-encoded query string, including the repeated-key convention for array values.`,
  checkpoint: 'A correct result encodes spaces as %20 and repeats the key for each array item.',
});

const jwtAuth: Gen = (p) => ({
  lang: 'text', inputLabel: 'auth header', outputLabel: 'authenticated principal',
  input: `Authorization: Bearer <jwt sub=${p.token}>`,
  output: `principal = ${p.token}\nstep order: verify signature → check exp/aud → THEN trust the sub.`,
  operation: 'request authentication',
  blurb: `Performing ${p.intentSpaced} extracts and verifies the bearer token before trusting any claim, the ordering that separates authentication from mere decoding.`,
  checkpoint: 'A correct flow verifies the signature before reading the subject.',
});

const webhookParse: Gen = (p) => ({
  lang: 'json', inputLabel: 'webhook delivery', outputLabel: 'parsed + verified',
  input: `headers: X-Signature: ${p.hex(16)}\nbody: {"event":"record.created","id":${p.recordId}}`,
  output: `event = record.created\nid    = ${p.recordId}\nverify the X-Signature HMAC over the RAW body BEFORE parsing it.`,
  operation: 'webhook parsing',
  blurb: `Performing ${p.intentSpaced} verifies the signature over the raw body first, then parses — the only safe order, since parsing an unverified payload is itself an attack surface.`,
  checkpoint: 'A correct handler verifies the HMAC over the raw bytes before JSON.parse.',
});

const apiError: Gen = (p) => ({
  lang: 'json', inputLabel: 'error response', outputLabel: 'diagnosis',
  input: `HTTP 422\n{"error":"validation_failed","field":"${p.f2}","detail":"expected integer"}`,
  output: `Root cause: "${p.f2}" was sent as a string. Fix the serializer, not the endpoint.\n422 (not 400) means the request was well-formed but semantically wrong.`,
  operation: 'API error debugging',
  blurb: `Performing ${p.intentSpaced} reads the structured error body to locate the offending field, distinguishing a client serialization bug from a server fault.`,
  checkpoint: 'A correct diagnosis maps the status code and field to a concrete cause.',
});

const apiTest: Gen = (p) => ({
  lang: 'text', inputLabel: 'request', outputLabel: 'assertion result',
  input: `GET /records/${p.recordId}\nexpect: 200, body.${p.f1} == "${p.token}"`,
  output: `status 200 ✓\nbody.${p.f1} = "${p.token}" ✓\nresult: PASS`,
  operation: 'endpoint testing',
  blurb: `Performing ${p.intentSpaced} pins an endpoint's status and key fields as assertions, turning a manual curl into a repeatable regression check.`,
  checkpoint: 'A correct test asserts on specific fields, not just a 200 status.',
});

const jsonNormalize: Gen = (p) => ({
  lang: 'json', inputLabel: 'inconsistent payload', outputLabel: 'normalised',
  input: `{"${p.f2}":"${p.recordId}","Active":"true","${p.f1}":"${p.token}"}`,
  output: `{"${p.f1}":"${p.token}","active":true,"${p.f2}":${p.recordId}}`,
  operation: 'data normalisation',
  blurb: `Performing ${p.intentSpaced} coerces types, lower-cases keys, and orders fields into one canonical shape so downstream code handles a single, predictable form.`,
  checkpoint: 'A correct result yields the same shape regardless of input key order or casing.',
});

const apiVersion: Gen = (p) => ({
  lang: 'json', inputLabel: 'v1 → v2 response', outputLabel: 'versioned shape',
  input: `v1: {"${p.f1}":"${p.token}"}`,
  output: `v2: {"${p.f1}":"${p.token}","schemaVersion":2,"${p.f2}":${p.recordId}}\nAdd fields additively; never repurpose an existing field's meaning.`,
  operation: 'response versioning',
  blurb: `Performing ${p.intentSpaced} evolves a payload additively and stamps a version, so old clients keep working while new ones read the added fields.`,
  checkpoint: 'A correct change only adds fields — it never changes an existing field\'s type.',
});

const apiSecure: Gen = (p) => ({
  lang: 'text', inputLabel: 'request checklist', outputLabel: 'hardening result',
  input: `GET /records/${p.recordId}`,
  output: `✓ TLS only  ✓ bearer token verified  ✓ rate-limited\n✗ missing: no per-object authZ — confirm the caller may read record ${p.recordId}.`,
  operation: 'communication hardening',
  blurb: `Performing ${p.intentSpaced} runs a request past a security checklist and surfaces the gap most often missed: object-level authorisation behind a valid token.`,
  checkpoint: 'A correct review checks per-object authorisation, not just authentication.',
});

/* ---------------------------- Data family --------------------------- */
const dataTransform: Gen = (p) => ({
  lang: 'text', inputLabel: 'CSV row', outputLabel: 'JSON record',
  input: `id,name,active\n${p.recordId},${p.f1},true`,
  output: `{"id":${p.recordId},"name":"${p.f1}","active":true}`,
  operation: 'format transformation',
  blurb: `Performing ${p.intentSpaced} maps one serialization format to another while inferring types, the routine bridge between flat exports and structured APIs.`,
  checkpoint: 'A correct result types "true" as a boolean and the id as a number.',
});

const fingerprint: Gen = (p) => ({
  lang: 'text', inputLabel: 'record', outputLabel: 'stable fingerprint',
  input: `{"${p.f1}":"${p.token}","${p.f2}":${p.recordId}}`,
  output: `fingerprint = ${p.hex(16)}\nCanonicalise (sort keys) BEFORE hashing, or key order will change the fingerprint.`,
  operation: 'fingerprinting',
  blurb: `Performing ${p.intentSpaced} hashes a canonicalised record into a stable id for deduplication and change detection, independent of key order or whitespace.`,
  checkpoint: 'A correct fingerprint is identical for two records that differ only in key order.',
});

const serialize: Gen = (p) => ({
  lang: 'json', inputLabel: 'object with Date/Set', outputLabel: 'wire-safe form',
  input: `{ id: ${p.recordId}, created: Date, tags: Set("a","b") }`,
  output: `{"id":${p.recordId},"created":"2026-06-02T00:00:00.000Z","tags":["a","b"]}`,
  operation: 'serialization',
  blurb: `Performing ${p.intentSpaced} converts in-memory types that JSON cannot represent (Date, Set, Map) into wire-safe primitives so nothing is silently dropped.`,
  checkpoint: 'A correct result encodes a Date as ISO-8601 and a Set as an array.',
});

const schemaMigrate: Gen = (p) => ({
  lang: 'json', inputLabel: 'v1 record', outputLabel: 'v2 record',
  input: `{"id":${p.recordId},"name":"${p.f1}"}`,
  output: `{"id":${p.recordId},"fullName":"${p.f1}","schemaVersion":2}\nProvide a down-migration too, so a rollback can reverse the rename.`,
  operation: 'schema migration',
  blurb: `Performing ${p.intentSpaced} maps records from an old shape to a new one with an explicit, reversible transform rather than an ad-hoc rename.`,
  checkpoint: 'A correct migration is reversible — every up has a matching down.',
});

const anonymize: Gen = (p) => ({
  lang: 'json', inputLabel: 'record with PII', outputLabel: 'anonymised',
  input: `{"id":${p.recordId},"email":"user@example.com","ip":"203.0.113.${p.recordId % 255}"}`,
  output: `{"id":${p.recordId},"email":"u***@example.com","ip":"203.0.113.0"}`,
  operation: 'field anonymisation',
  blurb: `Performing ${p.intentSpaced} masks or truncates identifying fields so a dataset can be shared for testing without exposing personal data.`,
  checkpoint: 'A correct result keeps the record usable while making the subject unidentifiable.',
});

const aggregate: Gen = (p) => ({
  lang: 'text', inputLabel: 'records', outputLabel: 'grouped counts',
  input: `[{status:"ok"},{status:"ok"},{status:"err"}] (sample of ${p.recordId})`,
  output: `ok  → 2\nerr → 1\nAlways report the denominator; "2 ok" is meaningless without "of 3".`,
  operation: 'aggregation',
  blurb: `Performing ${p.intentSpaced} groups records and counts each bucket, reporting the total so a rate is interpretable rather than a bare number.`,
  checkpoint: 'A correct result includes the denominator alongside each count.',
});

/* -------------------------- Debugging family ------------------------ */
const traceFlow: Gen = (p) => ({
  lang: 'text', inputLabel: 'correlation id across hops', outputLabel: 'trace',
  input: `trace-id = ${p.token}`,
  output: `gateway  → ${p.token} (200, 8ms)\nservice  → ${p.token} (200, 41ms)\ndb       → ${p.token} (200, 12ms)\nLatency lives in "service"; start there.`,
  operation: 'data-flow tracing',
  blurb: `Performing ${p.intentSpaced} follows one correlation id across hops so you can see where a request slowed or changed, instead of guessing per service.`,
  checkpoint: 'A correct trace ties every hop to the same id and shows per-hop timing.',
});

const outputVerify: Gen = (p) => ({
  lang: 'text', inputLabel: 'actual vs expected', outputLabel: 'verification',
  input: `actual   = {"id":${p.recordId},"ok":true}\nexpected = {"id":${p.recordId},"ok":true}`,
  output: `deep-equal ✓ — output matches the golden record.\nAssert on structure, not on a stringified blob whose key order can vary.`,
  operation: 'output verification',
  blurb: `Performing ${p.intentSpaced} deep-compares a result against a golden record so a regression fails loudly instead of slipping through on cosmetic differences.`,
  checkpoint: 'A correct check compares parsed structures, not raw strings.',
});

const schemaDrift: Gen = (p) => ({
  lang: 'text', inputLabel: 'expected vs live keys', outputLabel: 'drift report',
  input: `expected: [id, ${p.f1}, ${p.f2}]\nlive:     [id, ${p.f1}, created]`,
  output: `− removed: ${p.f2}\n+ added:   created\nA removed field is a breaking change; gate the deploy on it.`,
  operation: 'schema-drift detection',
  blurb: `Performing ${p.intentSpaced} diffs the live shape against the expected one and flags removed fields as the breaking changes they are.`,
  checkpoint: 'A correct report separates added (safe) from removed (breaking) fields.',
});

const transformVerify: Gen = (p) => ({
  lang: 'text', inputLabel: 'transform in/out', outputLabel: 'invariant check',
  input: `in  = {"${p.f1}":"${p.token}"}\nout = {"${p.f1}":"${p.token}","derived":${p.recordId}}`,
  output: `invariant ✓: every input key survives in the output.\nderived field is additive — no source data was dropped.`,
  operation: 'transform verification',
  blurb: `Performing ${p.intentSpaced} asserts that a transform preserves the inputs it should and only adds what it should, catching accidental field loss.`,
  checkpoint: 'A correct check proves no source field was silently dropped.',
});

const reproBug: Gen = (p) => ({
  lang: 'text', inputLabel: 'minimal repro', outputLabel: 'observed vs expected',
  input: `input = "${p.token} "  (note trailing space)`,
  output: `expected = "${p.token}"\nobserved = "${p.token} "\nRoot cause: the trim step runs before concatenation, not after.`,
  operation: 'bug reproduction',
  blurb: `Performing ${p.intentSpaced} reduces a failure to the smallest input that still triggers it, turning "sometimes wrong" into a deterministic, fixable case.`,
  checkpoint: 'A correct repro is minimal and fails every time, not intermittently.',
});

const consistency: Gen = (p) => ({
  lang: 'text', inputLabel: 'two snapshots', outputLabel: 'consistency check',
  input: `snapshot A: id=${p.recordId}, sum=100\nsnapshot B: id=${p.recordId}, sum=98`,
  output: `INCONSISTENT: sum drifted by 2 with no recorded transaction.\nReconcile against the event log before trusting either snapshot.`,
  operation: 'consistency checking',
  blurb: `Performing ${p.intentSpaced} compares two snapshots of the same entity and flags drift that no recorded operation explains — the signature of a lost write.`,
  checkpoint: 'A correct check ties any difference back to a recorded operation, or flags it.',
});

/* ------------------------- Automation family ------------------------ */
const cron: Gen = (p) => ({
  lang: 'text', inputLabel: 'cron expression', outputLabel: 'interpretation',
  input: `${p.recordId % 60} ${p.recordId % 24} * * ${p.recordId % 7}`,
  output: `Runs at minute ${p.recordId % 60}, hour ${p.recordId % 24} (UTC), on weekday ${p.recordId % 7}.\nNext: 2026-06-${String(1 + (p.recordId % 27)).padStart(2, '0')}.`,
  operation: 'schedule interpretation',
  blurb: `Performing ${p.intentSpaced} translates a terse cron expression into plain language and the next fire time, so a schedule is reviewable before it ships.`,
  checkpoint: 'A correct reading states the timezone explicitly — cron has no implicit local time.',
});

const cronValidate: Gen = (p) => ({
  lang: 'text', inputLabel: 'cron expression', outputLabel: 'field validation',
  input: `${p.recordId % 60} 25 * * ${p.recordId % 7}`,
  output: `INVALID: hour field "25" is out of range (0–23). Other fields ok.`,
  operation: 'cron validation',
  blurb: `Performing ${p.intentSpaced} range-checks each cron field so an impossible value is caught at config time, not when the job silently never fires.`,
  checkpoint: 'A correct validator names the out-of-range field and its allowed range.',
});

const cronMonitor: Gen = (p) => ({
  lang: 'text', inputLabel: 'expected vs last run', outputLabel: 'health',
  input: `schedule = every hour\nlast run = 3h 12m ago`,
  output: `MISSED: 3 expected runs did not fire. Alert; a job that fails silently is worse than one that errors loudly.`,
  operation: 'schedule monitoring',
  blurb: `Performing ${p.intentSpaced} compares the last run against the schedule and alerts on missed executions, the failure mode cron itself never reports.`,
  checkpoint: 'A correct monitor alerts on a missing run, not only on a failed one.',
});

const cronCleanup: Gen = (p) => ({
  lang: 'text', inputLabel: 'retention rule', outputLabel: 'cleanup plan',
  input: `delete records older than 30d, batch=${p.recordId % 500 + 100}`,
  output: `0 3 * * *  →  nightly at 03:00 UTC, delete in batches of ${p.recordId % 500 + 100}.\nBatch + off-peak so cleanup never competes with live traffic.`,
  operation: 'periodic cleanup',
  blurb: `Performing ${p.intentSpaced} schedules a batched, off-peak deletion so housekeeping reclaims space without contending with production load.`,
  checkpoint: 'A correct plan batches deletes and runs off-peak with an explicit retention window.',
});

const eventFilter: Gen = (p) => ({
  lang: 'text', inputLabel: 'event stream + rule', outputLabel: 'filtered',
  input: `events: [type=create, type=noise, type=update]\nrule: type in {create, update}`,
  output: `kept: create, update\ndropped: noise (record #${p.recordId})\nFilter at the source to avoid paying to transport events you discard.`,
  operation: 'event filtering',
  blurb: `Performing ${p.intentSpaced} keeps only the events that match a rule, ideally at the source so bandwidth is not spent shipping noise downstream.`,
  checkpoint: 'A correct filter keeps matching events and drops the rest deterministically.',
});

const tagProcess: Gen = (p) => ({
  lang: 'json', inputLabel: 'job', outputLabel: 'tagged job',
  input: `{"job":"export","id":${p.recordId}}`,
  output: `{"job":"export","id":${p.recordId},"runId":"${p.token}","origin":"scheduler","env":"prod"}`,
  operation: 'process tagging',
  blurb: `Performing ${p.intentSpaced} stamps each automated run with a unique run id and provenance so its output is traceable back to the exact execution.`,
  checkpoint: 'A correct tag includes a unique run id, not just a static job name.',
});

/* ----------------------------- Web family --------------------------- */
const htmlSanitize: Gen = (p) => ({
  lang: 'html', inputLabel: 'untrusted HTML', outputLabel: 'sanitised',
  input: `<p>${p.f1}</p><script>steal('${p.token}')</script>`,
  output: `<p>${p.f1}</p>`,
  operation: 'HTML sanitisation',
  blurb: `Performing ${p.intentSpaced} strips active content (script, event handlers, javascript: URLs) from user HTML using an allow-list, the only safe defence against stored XSS.`,
  checkpoint: 'A correct result removes the <script> entirely — escaping alone is not enough here.',
});

const htmlValidate: Gen = (p) => ({
  lang: 'text', inputLabel: 'markup', outputLabel: 'validation',
  input: `<ul><li>${p.f1}<li>${p.f2}</ul><img src="x">`,
  output: `2 issues:\n  • <li> not closed before the next <li>\n  • <img> missing alt attribute (accessibility) — record #${p.recordId}`,
  operation: 'markup validation',
  blurb: `Performing ${p.intentSpaced} checks markup for unclosed tags and accessibility gaps that browsers paper over but crawlers and screen readers do not.`,
  checkpoint: 'A correct result flags both the structural and the accessibility defect.',
});

const urlEncode: Gen = (p) => {
  const raw = `${p.f1} & ${p.token}/x?y`;
  return {
    lang: 'text', inputLabel: 'raw parameter value', outputLabel: 'percent-encoded (RFC 3986)',
    input: raw, output: encodeURIComponent(raw),
    operation: 'URL parameter encoding',
    blurb: `Performing ${p.intentSpaced} percent-encodes the reserved characters in a value so it survives inside a URL without being misread as a delimiter.`,
    checkpoint: 'A correct result encodes spaces, &, / and ? so the value is opaque to the URL parser.',
  };
};

const xssProtect: Gen = (p) => ({
  lang: 'html', inputLabel: 'value into HTML context', outputLabel: 'context-escaped',
  input: `<a title="${p.token}"><script>x</script>`,
  output: `<a title="${p.token}">&lt;script&gt;x&lt;/script&gt;`,
  operation: 'XSS prevention',
  blurb: `Performing ${p.intentSpaced} escapes a value for the exact context it lands in (HTML body vs attribute vs JS), since the right escaping depends entirely on where the value is placed.`,
  checkpoint: 'A correct result neutralises the payload for its specific output context.',
});

const richText: Gen = (p) => ({
  lang: 'html', inputLabel: 'rich text', outputLabel: 'clean semantic HTML',
  input: `<font color="red"><b>${p.f1}</b></font>`,
  output: `<strong>${p.f1}</strong>`,
  operation: 'rich-text formatting',
  blurb: `Performing ${p.intentSpaced} replaces presentational legacy tags with semantic equivalents, so the markup styles cleanly and stays accessible.`,
  checkpoint: 'A correct result uses semantic tags (strong) over presentational ones (font/b).',
});

const formSecure: Gen = (p) => ({
  lang: 'text', inputLabel: 'submitted form', outputLabel: 'validated + escaped',
  input: `email=${p.f1}@x&note=<b>${p.token}</b>&csrf=${p.hex(8)}`,
  output: `email  → validated format ✓\nnote   → escaped: &lt;b&gt;${p.token}&lt;/b&gt;\ncsrf   → token checked ✓`,
  operation: 'form data hardening',
  blurb: `Performing ${p.intentSpaced} validates each field's format, escapes free text for its output context, and checks the CSRF token before the data is trusted.`,
  checkpoint: 'A correct result validates, escapes, AND verifies the CSRF token — all three.',
});

/* ------------------- intent → generator assignment ------------------ */
/* Within every cluster the 12 intents map to 12 DISTINCT generators,   */
/* so no two sibling intents of the same tool share a worked example.   */
const INTENT_GENERATORS: Record<string, Gen> = {
  // json cluster
  'validate-json': jsonValidate,
  'format-json': jsonPretty,
  'inspect-json-structure': jsonInspect,
  'convert-json-to-types': jsonToTypes,
  'compare-json-objects': jsonCompare,
  'transform-json-keys': jsonTransformKeys,
  'extract-json-values': jsonExtract,
  'merge-json-data': jsonMerge,
  'flatten-nested-json': jsonFlatten,
  'detect-json-syntax-errors': jsonDetectErrors,
  'generate-json-schema': jsonSchema,
  'minify-json-payload': jsonMinify,
  // encoding cluster
  'encode-data': base64Encode,
  'decode-data': base64Decode,
  'fix-encoding-bugs': mojibakeFix,
  'convert-character-sets': charsetConvert,
  'handle-unicode-text': unicodeEscape,
  'escape-special-characters': escapeChars,
  'troubleshoot-encoding-mismatch': encodingMismatch,
  'batch-encode-values': batchEncode,
  'decode-nested-encodings': nestedDecode,
  'verify-encoding-roundtrip': roundtrip,
  'convert-binary-to-text': binaryToText,
  'normalize-encoded-output': normalizeEncoding,
  // security cluster
  'generate-identifiers': uuidGen,
  'verify-tokens': jwtDecode,
  'inspect-signatures': jwtSignature,
  'audit-token-expiry': jwtExpiry,
  'hash-sensitive-data': hash,
  'generate-secure-keys': secureKey,
  'validate-jwt-claims': jwtClaims,
  'compare-security-hashes': hashCompare,
  'detect-token-tampering': tokenTamper,
  'rotate-unique-identifiers': uuidRotate,
  'analyze-token-payload': jwtPayload,
  'verify-data-integrity': hashVerify,
  // text cluster
  'normalize-text': textNormalize,
  'compare-versions': textDiff,
  'test-regex': regexMatch,
  'find-and-replace-patterns': regexReplace,
  'extract-text-segments': regexExtract,
  'convert-text-case': caseConvert,
  'analyze-text-differences': diffStats,
  'build-regex-patterns': regexBuild,
  'validate-input-format': regexValidate,
  'clean-up-whitespace': whitespace,
  'split-text-by-delimiter': splitDelim,
  'match-complex-patterns': regexNamed,
  // formatting cluster
  'format-sql': sqlFormat,
  'minify-assets': cssMinify,
  'preview-markdown': markdownRender,
  'indent-nested-code': indentCode,
  'optimize-css-output': cssOptimize,
  'validate-markdown-syntax': markdownValidate,
  'beautify-query-strings': queryBeautify,
  'restructure-code-blocks': codeRestructure,
  'standardize-sql-style': sqlStandardize,
  'compress-stylesheet': cssCompress,
  'render-documentation': docsRender,
  'align-code-formatting': codeAlign,
  // api cluster
  'design-api-schema': jsonSchema,
  'validate-api-response': apiValidate,
  'construct-query-string': queryString,
  'authenticate-api-request': jwtAuth,
  'parse-webhook-payload': webhookParse,
  'debug-api-error': apiError,
  'format-api-documentation': docsRender,
  'test-api-endpoint': apiTest,
  'normalize-api-data': jsonNormalize,
  'optimize-api-payload': jsonMinify,
  'version-api-response': apiVersion,
  'secure-api-communication': apiSecure,
  // data cluster
  'transform-data-format': dataTransform,
  'generate-data-models': jsonToTypes,
  'hash-data-for-storage': hash,
  'encode-binary-data': base64Encode,
  'create-data-fingerprint': fingerprint,
  'validate-data-integrity': hashVerify,
  'serialize-complex-objects': serialize,
  'migrate-data-schema': schemaMigrate,
  'anonymize-sensitive-fields': anonymize,
  'aggregate-data-records': aggregate,
  'generate-unique-identifiers': uuidGen,
  'normalize-data-structure': jsonNormalize,
  // debugging cluster
  'compare-config-files': textDiff,
  'trace-data-flow': traceFlow,
  'isolate-parsing-error': jsonValidate,
  'identify-format-change': diffStats,
  'debug-regex-match': regexMatch,
  'verify-output-format': outputVerify,
  'analyze-log-patterns': regexExtract,
  'pinpoint-encoding-issue': encodingMismatch,
  'detect-schema-drift': schemaDrift,
  'validate-transform-output': transformVerify,
  'reproduce-formatting-bug': reproBug,
  'check-data-consistency': consistency,
  // automation cluster
  'schedule-recurring-task': cron,
  'extract-log-data': regexExtract,
  'generate-batch-ids': uuidGen,
  'parse-automation-output': jsonInspect,
  'validate-cron-schedule': cronValidate,
  'build-extraction-pattern': regexBuild,
  'create-unique-job-ids': uuidRotate,
  'monitor-scheduled-tasks': cronMonitor,
  'automate-data-extraction': regexReplace,
  'filter-event-streams': eventFilter,
  'tag-automated-processes': tagProcess,
  'configure-periodic-cleanup': cronCleanup,
  // web cluster
  'sanitize-html-input': htmlSanitize,
  'optimize-css-bundle': cssOptimize,
  'preview-content-markup': markdownRender,
  'encode-url-parameters': urlEncode,
  'protect-against-xss': xssProtect,
  'minify-stylesheet': cssMinify,
  'render-dynamic-content': docsRender,
  'escape-template-variables': escapeChars,
  'compress-web-assets': cssCompress,
  'validate-markup-output': htmlValidate,
  'format-rich-text': richText,
  'secure-form-data': formSecure,
};

/**
 * Returns an intent-specific worked example, or null if the intent has no
 * dedicated generator (the caller then falls back to its tool-based example).
 * Never throws: any unexpected error returns null so the page still renders.
 */
export function buildIntentExample(p: IntentExampleInput): IntentExampleSpec | null {
  const gen = INTENT_GENERATORS[p.intent];
  if (!gen) return null;
  try {
    return gen(p);
  } catch {
    return null;
  }
}

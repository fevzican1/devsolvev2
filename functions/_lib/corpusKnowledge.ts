/**
 * Unique, non-Mad-Libs knowledge for the /k/ corpus.
 *
 * Previous drafts lowered sibling Jaccard by injecting style/context phrases
 * into every sentence. That passed a shingle gate and failed Bing/Google
 * content quality: keyword stuffing, mixed-topic URLs, and crawler-facing
 * "coordinate lock" copy (prompt-injection / AI-manipulation abuse).
 *
 * This module is the opposite contract:
 *   - tool facts are real mechanics (no audience/style spam)
 *   - intent kernels describe one job
 *   - style chooses a document archetype (runbook vs review checklist vs CI spec)
 *   - context/audience/task appear once, as scope, not in every paragraph
 */

export interface PageKernel {
  cluster: string;
  tool: string;
  intent: string;
  audience: string;
  task: string;
  style: string;
  context: string;
  slug: string;
  toolLabel: string;
  intentLabel: string;
  audienceLabel: string;
  taskPhrase: string;
  stylePhrase: string;
  contextPhrase: string;
  audienceFocus: string;
  audienceConcern: string;
  taskScenario: string;
  taskOutcome: string;
  taskUrgency: string;
}

export interface KnowledgeSection {
  id: string;
  heading: string;
  paragraphs: string[];
  list?: string[];
  ordered?: boolean;
}

export interface ToolKnowledge {
  what: string;
  mechanics: string[];
  pitfalls: string[];
  verify: string;
}

export interface IntentKernel {
  problem: string;
  method: string;
  failsWhen: string;
  doneWhen: string;
}

export const TOOL_KNOWLEDGE: Record<string, ToolKnowledge> = {
  'json-formatter': {
    what: 'JSON Formatter parses a UTF-8 JSON document in the browser, reports the first structural error, and reprints the value with stable indentation so humans and diffs can see the same tree.',
    mechanics: [
      'JSON is a data interchange format, not a JavaScript subset. Values such as NaN or undefined, plus comments and trailing commas, are illegal unless a non-JSON mode is explicit.',
      'A formatter must not change number literals that exceed IEEE-754 precision; reprinting 2^53+1 as a rounded double silently corrupts identifiers.',
      'Key order is not semantically significant in RFC 8259, but many pipelines treat order as a fingerprint — say whether you are sorting keys or preserving them.',
      'Pretty-print whitespace is not validation. A document can look nested and still fail a spec parser on a surrogate, a duplicate key, or a raw control character.',
    ],
    pitfalls: [
      'Treating a green pretty-print as a schema check.',
      'Copying formatted output into a language where numbers became floats.',
      'Assuming duplicate keys keep the last value — parsers disagree.',
    ],
    verify: 'Parse with a strict RFC 8259 parser, then compare a canonical reprint (agreed key order and number spelling) to a known-good fixture.',
  },
  'json-to-typescript': {
    what: 'JSON to TypeScript infers interfaces from example payloads so TypeScript callers fail at compile time when a field type drifts.',
    mechanics: [
      'Inference from one example is a hypothesis, not a contract: a field that is always a string in the sample may be null in production.',
      'Union types appear when the same key holds different shapes; collapsing them to `any` hides the bug the generator exists to catch.',
      'Optional versus missing keys are different: `key?: string` is not the same as `key: string | null`.',
      'Generated names should be stable across runs so diffs stay reviewable; hash-suffix types are a last resort.',
    ],
    pitfalls: [
      'Shipping types generated from a happy-path fixture only.',
      'Editing generated files by hand so the next sample overwrites the truth.',
      'Using `unknown` everywhere and calling the file a model.',
    ],
    verify: 'Compile a fixture pack (normal, empty, null, extra keys) against the emitted interfaces and require zero `any` escapes.',
  },
  'base64-encode-decode': {
    what: 'Base64 Encoder / Decoder maps binary octets to an ASCII alphabet (standard `+/` or URL-safe `-_`) with optional `=` padding, entirely in the browser.',
    mechanics: [
      'Every 3 input bytes become 4 alphabet characters. Remainder lengths 1 and 2 require padding if the decoder is strict.',
      'URL-safe Base64 replaces `+` and `/` so values survive query strings and path segments. Mixing alphabets is the most common interoperability bug.',
      'UTF-8 text must be encoded to bytes before Base64; encoding a JavaScript UTF-16 string as if it were bytes corrupts non-ASCII.',
      'Whitespace in encoded form is illegal for strict decoders and tolerated by others — pick one policy and apply it at every hop.',
      'Normalized encoded output means one alphabet, one padding rule, and no incidental whitespace, so two systems compare equal without ad-hoc trim hacks.',
    ],
    pitfalls: [
      'Double-encoding an already-Base64 string because it “looked binary”.',
      'Sending URL-safe text to a decoder that only accepts `+/`.',
      'Stripping padding on encode but requiring it on decode.',
    ],
    verify: 'Round-trip: bytes → encode (chosen variant) → decode → exact original bytes, then confirm the encoded spelling matches the receiver’s fixture including padding.',
  },
  'url-encode-decode': {
    what: 'URL Encoder / Decoder applies percent-encoding rules so reserved characters survive as data rather than as syntax in a URI.',
    mechanics: [
      'encodeURIComponent and encodeURI are not interchangeable: the latter leaves `?`, `&`, and `/` intact because they are structural.',
      'Space may become `%20` or `+` depending on `application/x-www-form-urlencoded` versus path encoding. Using the wrong one breaks signatures.',
      'Percent-encoding is UTF-8 bytes, not Latin-1. Decoding as Windows-1252 produces mojibake that later looks like “encoding bugs”.',
      'Double-encoding (`%252F`) is a real payload, not always a mistake — but it is a mistake if only one decode hop was specified.',
    ],
    pitfalls: [
      'Encoding a whole URL with encodeURIComponent and destroying the scheme/host.',
      'Mixing `+` spaces in paths with `%20` spaces in the same query.',
      'Decoding once in a pipeline that encoded twice.',
    ],
    verify: 'Split the URL into scheme, path segments, and query pairs; encode each part with the rule that part requires; reconstruct and compare to a golden URI.',
  },
  'html-entity-encode-decode': {
    what: 'HTML Entity Encoder / Decoder converts characters that would be treated as markup (`<`, `>`, `&`, quotes) into character references so text can sit in HTML safely.',
    mechanics: [
      'Named entities (`&amp;`) and numeric references (`&#38;`, `&#x26;`) are equivalent for the same code point; pick one style for diffs.',
      'Encoding is not sanitizing: it does not make a `<script>` string executable or inert by itself if you later insert it as HTML instead of text.',
      'In HTML text nodes, `<` and `&` must be escaped; in attributes, quotes matching the delimiter must be escaped too.',
      'Decoding `&nbsp;` and other non-ASCII named entities requires a real HTML entity table, not a two-entry replace.',
    ],
    pitfalls: [
      'Calling entity-escape “XSS protection” and inserting the result with innerHTML.',
      'Escaping an already-escaped string until the page shows `&amp;amp;`.',
      'Forgetting attribute context and leaving `"` raw.',
    ],
    verify: 'Place the encoded string in the intended HTML context (text vs attribute) and confirm the DOM textContent matches the original unescaped string.',
  },
  'hash-generator': {
    what: 'Hash Generator computes a one-way digest (commonly SHA-256) of the input bytes in Web Crypto so integrity checks do not need a server.',
    mechanics: [
      'A hash identifies content; it does not encrypt it. Anyone with the bytes can recompute the same digest.',
      'Hex and Base64 encodings of the same digest are different strings. Publish the encoding beside the algorithm.',
      'HMAC is not a raw hash: it keys the digest. Feeding a password to SHA-256 without a KDF is not password storage.',
      'Collision resistance depends on the algorithm. MD5 and SHA-1 are not acceptable for security-sensitive integrity.',
    ],
    pitfalls: [
      'Comparing hashes case-insensitively when the verifier is case-sensitive (or the reverse).',
      'Hashing a pretty-printed JSON document and expecting it to match a compact original.',
      'Treating a client-side hash as authentication.',
    ],
    verify: 'Hash a published test vector (empty string, “abc”) and match the known digest, then hash your fixture twice and require equality.',
  },
  'uuid-generator': {
    what: 'UUID Generator produces RFC 9562 identifiers (typically version 4 random, or version 7 time-ordered) without sending entropy to a server.',
    mechanics: [
      'Version 4 UUIDs set version nibble `4` and variant bits `10`; a random hex string without those bits is not a UUID.',
      'Version 7 encodes a Unix timestamp in the high bits so indexes stay roughly sequential — useful in databases that suffered from v4 insert scatter.',
      'Uniqueness is probabilistic. Do not use v4 as a capability secret if the ID is guessable in your threat model; use a longer random token.',
      'Canonical text form is 8-4-4-4-12 hexadecimal with hyphens. Some APIs reject uppercase; others reject missing hyphens.',
    ],
    pitfalls: [
      'Generating IDs from `Math.random()` instead of crypto.getRandomValues.',
      'Assuming UUID string comparison equals binary comparison after stripping hyphens of mixed case.',
      'Using v1 timestamps as proof of event time without a trusted clock.',
    ],
    verify: 'Parse the ID, check version and variant bits, and confirm 128-bit uniqueness across a generated batch with no duplicate hex.',
  },
  'jwt-decoder': {
    what: 'JWT Decoder splits a compact JWS into header, payload, and signature bytes and JSON-parses the payloads — it does not, by itself, verify signatures.',
    mechanics: [
      'A JWT is three Base64url segments. Treating the whole token as JSON or as standard Base64 (with `+ /`) fails decode.',
      'The payload is a claim set, not an access decision. `alg`, `exp`, `nbf`, `iss`, and `aud` must be checked by a trusted verifier.',
      '`alg: none` and algorithm confusion (HMAC verified with a public RSA key) are classic bypasses — a decoder that “succeeds” is not a yes.',
      'Claims may be nested JSON. Pretty-printing must not be confused with signature verification.',
    ],
    pitfalls: [
      'Pasting production tokens into a hosted debugger.',
      'Trusting `role` in an unverified payload.',
      'Ignoring `exp` because the UI showed a name.',
    ],
    verify: 'Decode header and payload, then verify the signature with the real key material on a trusted machine (not this page) before any authorization change.',
  },
  'text-case-converter': {
    what: 'Text Case Converter rewrites letter case (lower, upper, title, camel, snake) without sending the buffer off-device.',
    mechanics: [
      'Unicode case mapping is not ASCII ±32. German ß, Greek sigma, and Turkish i/I need locale-aware mapping.',
      'Title case is not capitalization of every word; hyphenated and apostrophe words have language-specific rules.',
      'Identifier conversions (camelCase ↔ snake_case) must preserve digits and acronyms (`JSON` vs `json` vs `Json`).',
      'Case conversion is not encoding conversion; it will not fix mojibake.',
    ],
    pitfalls: [
      'Lowercasing a checksum or Base64 payload.',
      'Using title case as a substitute for proper-noun detection.',
      'Splitting on spaces only and breaking CJK or emoji ZWJ sequences.',
    ],
    verify: 'Run a fixture that includes ASCII, non-ASCII, digits, and an acronym, then compare to a locale-specified expected spelling.',
  },
  'diff-checker': {
    what: 'Diff Checker compares two texts and highlights inserted, deleted, and unchanged regions so a reviewer can see the actual delta.',
    mechanics: [
      'Line-oriented diffs hide in-line changes; word or character diffs hide structural moves. Pick the granularity the review needs.',
      'Newline style (`LF` vs `CRLF`) and trailing whitespace produce noisy diffs that are not logical changes.',
      'JSON and XML diffs should usually be parsed and canonicalized first, or key-order churn looks like a rewrite.',
      'A diff is evidence of change, not of correctness. Pair it with a semantic check when meaning matters.',
    ],
    pitfalls: [
      'Reviewing a minified vs pretty-printed pair as if it were a logic change.',
      'Ignoring moved blocks that a line diff shows as delete+add.',
      'Pasting secrets into the left/right panes on a shared screen.',
    ],
    verify: 'Start from two known fixtures whose expected hunk list is documented; the tool must surface exactly those hunks and no whitespace-only noise if ignore-space is on.',
  },
  'regex-tester': {
    what: 'Regex Tester compiles a regular expression and shows match spans, capture groups, and failures against sample strings in the browser.',
    mechanics: [
      'JavaScript regex is not PCRE and not POSIX. Lookbehinds, possessive quantifiers, and newline classes differ by engine.',
      '`g` and `lastIndex` mutate state on a shared RegExp object; testers should not leak that into the next sample.',
      'Catastrophic backtracking is a real availability bug. Nested quantifiers on untrusted input belong behind timeouts.',
      'Anchors `^$` versus `\\A\\z` and multiline mode change what “whole string” means.',
    ],
    pitfalls: [
      'Shipping a pattern that matched the demo but uses a different engine in production.',
      'Trusting a match without checking capture groups you will actually use.',
      'Using regex to parse HTML or JSON.',
    ],
    verify: 'Keep a table of inputs (match, no-match, edge) with expected groups; the tester must reproduce that table on the production engine.',
  },
  'sql-formatter': {
    what: 'SQL Formatter reprints a query with consistent clause order and indentation so reviews and logs stop fighting whitespace.',
    mechanics: [
      'SQL dialects disagree on quoting, JSON operators, and LIMIT syntax. A formatter must not rewrite dialect-specific tokens as another vendor’s.',
      'Formatting is not optimization and not injection defence. Parameterize first.',
      'Comments and string literals must be preserved exactly; a formatter that lowercases a string is a data bug.',
      'CTEs, window functions, and VALUES lists need indentation rules that keep the logical tree visible.',
    ],
    pitfalls: [
      'Auto-formatting a generated migration in the same commit as a logic change, burying the real diff.',
      'Sending formatted SQL through a parser that rejects the chosen identifier quoting.',
      'Assuming pretty SQL is equivalent after a vendor-specific function was “tidied”.',
    ],
    verify: 'Format, then parse with the target dialect parser; AST or canonicalized text must match the original statement’s meaning.',
  },
  'css-minifier': {
    what: 'CSS Minifier removes comments and redundant whitespace and may shorten values, aiming for a smaller stylesheet with the same computed styles.',
    mechanics: [
      'Minification must preserve significance: spaces in `calc()`, `var()`, and `url()` are not always optional.',
      'Custom properties and `@supports` blocks are easy to break with aggressive merges.',
      'Source maps are the only honest way to debug minified CSS in production.',
      'A smaller file that changes cascade or specificity is not a successful minify.',
    ],
    pitfalls: [
      'Minifying, then editing the minified file.',
      'Stripping licenses you are required to keep.',
      'Merging rules that differ by media query.',
    ],
    verify: 'Render a fixture page with original vs minified CSS and assert identical computed styles on a representative selector set.',
  },
  'markdown-preview': {
    what: 'Markdown Preview renders CommonMark (plus the site’s chosen extensions) to HTML in the browser so authors see the same structure readers will.',
    mechanics: [
      'Markdown flavours disagree on tables, autolinks, and raw HTML. Preview with the same engine the publisher uses.',
      'Raw HTML in Markdown is an XSS surface. Previewing untrusted Markdown must sanitize; trusted docs may allow a tag allowlist.',
      'Indented code vs fenced code vs inline code have different escaping rules for entities.',
      'Line-ending and trailing-space hard breaks are easy to miss in a preview that wraps.',
    ],
    pitfalls: [
      'Authoring against GitHub flavour and publishing on a CommonMark-only renderer.',
      'Pasting HTML from a rich editor and assuming it is inert.',
      'Using preview as accessibility QA — it is not a screen-reader test.',
    ],
    verify: 'A fixture Markdown file must produce a stored HTML snapshot (sanitized if untrusted) with stable heading IDs.',
  },
  'cron-helper': {
    what: 'Cron Helper explains five-or-six-field cron expressions as human next-run times so schedules are reviewed before they hit a production scheduler.',
    mechanics: [
      'Cron is not UTC by default on every platform. The same expression fires at different instants in `TZ=Europe/Istanbul` versus UTC.',
      'Five-field Unix cron vs six-field (with seconds) vs AWS cron vs GitHub `on.schedule` are different grammars.',
      'Day-of-month and day-of-week together are OR in some implementations and AND in others — this is a famous footgun.',
      '`@daily` aliases and `H` Jenkins hashes are not portable to a generic cron parser.',
    ],
    pitfalls: [
      'Validating syntax only and never printing the next ten fire times.',
      'Assuming Sunday is 0 everywhere (Quartz uses 1–7).',
      'Deploying a schedule copied from a different timezone without restating TZ.',
    ],
    verify: 'For a frozen “now” timestamp and timezone, the helper’s next-run list must match the target scheduler’s documentation examples.',
  },
};

export const INTENT_KERNEL: Record<string, IntentKernel> = {
  'validate-json': { problem: 'A payload that looks like JSON can still fail a strict parser or a schema.', method: 'Parse first, then validate required keys and types against the contract you actually ship.', failsWhen: 'Pretty-print success is treated as validity.', doneWhen: 'A known-good fixture parses and a known-bad fixture fails at the expected token.' },
  'format-json': { problem: 'Inconsistent indentation and key order make reviews noisy and hide real edits.', method: 'Parse, reprint with an agreed indent and key policy, and keep number spellings intact.', failsWhen: 'Formatting rewrites values or sorts keys the pipeline uses as a fingerprint.', doneWhen: 'Two semantically equal documents reprint identically under the team policy.' },
  'inspect-json-structure': { problem: 'Nested objects hide missing keys and type flips until a consumer crashes.', method: 'Walk the tree, list paths, types, and null/empty cases, then compare to the documented shape.', failsWhen: 'Only the first level is inspected.', doneWhen: 'Every path in the fixture is named with a type and a nullability note.' },
  'convert-json-to-types': { problem: 'Callers treat example JSON as a type and then ship `any`.', method: 'Infer interfaces from several fixtures, mark optionals from absences, and ban `any`.', failsWhen: 'A single happy-path sample drives the model.', doneWhen: 'The fixture pack compiles against the emitted types with no escapes.' },
  'compare-json-objects': { problem: 'String compare flags key-order and whitespace, not semantic change.', method: 'Parse both sides, canonicalize, then diff structure and values.', failsWhen: 'Minified vs pretty-printed is reported as a logical delta.', doneWhen: 'Only real value/type/key changes remain in the hunk list.' },
  'transform-json-keys': { problem: 'Upstream camelCase and downstream snake_case silently drop fields.', method: 'Map keys with an explicit dictionary, then verify no unmapped key survives.', failsWhen: 'A regex rename hits nested keys you did not intend.', doneWhen: 'A round-trip map (or documented one-way map) matches the target fixture keys.' },
  'extract-json-values': { problem: 'Deep values are copied by hand and drift from the source document.', method: 'Select paths (dot/JSON Pointer), extract, and type-check the results.', failsWhen: 'Array indexes are hard-coded against an unordered list.', doneWhen: 'Extracted values match a table of path → expected value.' },
  'merge-json-data': { problem: 'Deep merge vs shallow merge vs array-concat policies disagree across services.', method: 'State the merge algebra, apply it, and list conflicts instead of last-write-wins by accident.', failsWhen: 'Arrays of objects merge by index instead of by identity key.', doneWhen: 'Conflict list is empty or each conflict has an explicit resolution.' },
  'flatten-nested-json': { problem: 'Nested documents cannot be loaded into tabular tools without a declared flattening rule.', method: 'Flatten with a path separator policy and escape rules for keys that contain the separator.', failsWhen: 'Two different paths collapse to the same flat key.', doneWhen: 'Inflate(flatten(x)) matches x for the fixture (or the documented information loss is listed).' },
  'detect-json-syntax-errors': { problem: 'Parsers report “unexpected token” without a pointer a human can jump to.', method: 'Capture line, column, and nearby snippet for the first error; do not continue as if the rest were valid.', failsWhen: 'A second error is “fixed” while the first remains.', doneWhen: 'Each broken fixture fails at the documented position.' },
  'generate-json-schema': { problem: 'Schemas written from memory miss enums, formats, and required flags.', method: 'Derive a draft schema from representative fixtures, then tighten types by hand.', failsWhen: 'additionalProperties is left open in a closed contract.', doneWhen: 'Valid fixtures pass and invalid fixtures fail the generated schema.' },
  'minify-json-payload': { problem: 'Whitespace inflates payloads and still is not a correctness check.', method: 'Parse and serialize compactly without changing values.', failsWhen: 'Minify is done with regex and breaks strings that contain spaces.', doneWhen: 'Compact form parses to the same value as the pretty form.' },
  'encode-data': { problem: 'Binary or reserved characters leave a transport that expects ASCII.', method: 'Choose the encoding the next hop documents, encode bytes (not JS UTF-16 code units), and label the variant.', failsWhen: 'The default alphabet is assumed.', doneWhen: 'The encoded spelling matches the receiver fixture.' },
  'decode-data': { problem: 'Encoded text is copied around until nobody knows the original bytes.', method: 'Decode with the documented alphabet and padding policy, then inspect bytes/UTF-8.', failsWhen: 'A lenient decoder hides alphabet mix-ups.', doneWhen: 'Decoded bytes match the original fixture and a strict decode also succeeds.' },
  'fix-encoding-bugs': { problem: 'Mojibake and double-encoding look similar in a log snippet.', method: 'Identify the last hop that changed bytes, reproduce with the same codec, and stop at the first transform that matches.', failsWhen: 'Random re-encoding is applied until it “looks right” on one machine.', doneWhen: 'A documented before/after pair is reproduced on a second machine.' },
  'convert-character-sets': { problem: 'Latin-1, UTF-8, and Windows-1252 labels are wrong in headers.', method: 'Decode as the actual source charset, re-encode as the target, and reject unmappable code points unless a fallback is explicit.', failsWhen: 'Bytes are labeled UTF-8 because the file “is text”.', doneWhen: 'Round-trip through the two charsets matches the mapping table.' },
  'handle-unicode-text': { problem: 'Normalization form (NFC/NFD) and combining marks break equality and regex.', method: 'Normalize to the form the protocol specifies, then operate.', failsWhen: 'String length is used as character count.', doneWhen: 'NFC equality holds for visually identical fixtures.' },
  'escape-special-characters': { problem: 'Characters that are syntax in the next language leak into data.', method: 'Escape for that language’s grammar only (URL vs HTML vs JSON vs shell are different).', failsWhen: 'A single catch-all escape is reused across contexts.', doneWhen: 'The escaped string round-trips in the target context and is harmless there.' },
  'troubleshoot-encoding-mismatch': { problem: 'Producer and consumer disagree on alphabet, charset, or percent rules.', method: 'Capture the exact bytes on the wire, decode with each suspected rule, and keep the rule that matches a known plaintext.', failsWhen: 'Only the UI rendering is compared.', doneWhen: 'Both sides emit the same encoded spelling for the fixture.' },
  'batch-encode-values': { problem: 'A list is encoded item-by-item with inconsistent variants.', method: 'Apply one encoder configuration to every item and checksum the batch.', failsWhen: 'Failures are skipped silently.', doneWhen: 'Every item has an output or a named error; none are omitted.' },
  'decode-nested-encodings': { problem: 'Base64 wrapping percent-encoding wrapping JSON is decoded in the wrong order.', method: 'Peel one layer at a time, recording the codec used, until the inner document parses.', failsWhen: 'Two layers are decoded in one regex.', doneWhen: 'The inner fixture parses and each layer’s spelling is documented.' },
  'verify-encoding-roundtrip': { problem: 'An encoder that cannot invert will corrupt data at the next hop.', method: 'encode(decode(x)) and decode(encode(x)) against the same variant.', failsWhen: 'Only one direction is tested.', doneWhen: 'Both directions match the original bytes/text.' },
  'convert-binary-to-text': { problem: 'Binary blobs cannot travel in JSON/logs without a textual encoding.', method: 'Use Base64 (or hex if short) and declare it in the field name or schema.', failsWhen: 'ISO-8859-1 is used as a “binary string”.', doneWhen: 'The text form decodes to the original SHA-256 of the blob.' },
  'normalize-encoded-output': { problem: 'Two valid encodings of the same bytes (padding, alphabet, whitespace) fail equality checks in CI.', method: 'Decode, then re-encode with one team variant: alphabet, padding, and whitespace policy.', failsWhen: 'Trim and hope is used instead of a real decode.', doneWhen: 'All legal spellings of the fixture collapse to one canonical encoding.' },
  'generate-identifiers': { problem: 'Colliding or guessable IDs leak records or break inserts.', method: 'Use a UUID (v4 or v7) from CSPRNG, persist the canonical spelling, and never mint IDs from timestamps alone.', failsWhen: 'Math.random or autoincrement is used as a secret.', doneWhen: 'A batch has unique RFC-shaped IDs and the version nibble is correct.' },
  'verify-tokens': { problem: 'A token that decodes is treated as authentic.', method: 'Decode only to inspect; verify signature, issuer, audience, and expiry with trusted keys.', failsWhen: 'Client-side decode is the authorization check.', doneWhen: 'A valid signed fixture verifies and a tampered one fails.' },
  'inspect-signatures': { problem: 'Signature bytes are ignored because the payload looks right.', method: 'Separate header, payload, and signature; record alg; verify with the matching key type.', failsWhen: 'alg from the header is trusted without a server allowlist.', doneWhen: 'Known-good signature verifies and alg-confusion fixtures fail.' },
  'audit-token-expiry': { problem: 'Expired or not-yet-valid tokens still open sessions.', method: 'Read `nbf`/`exp`/`iat`, compare to a trusted clock with documented leeway, and log skew.', failsWhen: 'Local workstation time is assumed correct.', doneWhen: 'Expired fixtures are rejected and fresh ones accepted at the documented leeway.' },
  'hash-sensitive-data': { problem: 'Secrets need integrity or lookup without storing plaintext.', method: 'Use a password KDF for passwords and SHA-256/HMAC for integrity of non-password bytes; never reversible “encryption” with a client-side hash.', failsWhen: 'MD5 of a password is stored.', doneWhen: 'Test vectors match and plaintext never appears in logs.' },
  'generate-secure-keys': { problem: 'Weak keys are copied from examples into production.', method: 'Draw key material from crypto.getRandomValues at the required length; do not derive from passphrases without a KDF.', failsWhen: 'A UUID is used as an AES key.', doneWhen: 'Key length and encoding match the algorithm’s documented requirements.' },
  'validate-jwt-claims': { problem: 'Required claims are missing or the wrong type.', method: 'After signature verify, check types and allowlists for iss, aud, sub, and custom claims.', failsWhen: 'Presence of a `sub` string is enough.', doneWhen: 'A claims table (required/optional/forbidden) is enforced on fixtures.' },
  'compare-security-hashes': { problem: 'Timing-unsafe string compare and encoding mismatches create both bugs and oracles.', method: 'Decode to bytes, then constant-time compare.', failsWhen: 'Hex case or Base64 padding causes a false mismatch.', doneWhen: 'Equal digests compare equal across encodings you document; unequal ones fail.' },
  'detect-token-tampering': { problem: 'Payload JSON is edited while the signature is left stale — or swapped.', method: 'Recompute/verify signature; treat any decode-without-verify as untrusted.', failsWhen: 'UI shows the edited claims as if they were signed.', doneWhen: 'Any bit flip in payload or signature fails verification.' },
  'rotate-unique-identifiers': { problem: 'Old IDs remain valid forever after a leak or tenant move.', method: 'Issue a new ID, dual-write a mapping with an expiry, then reject the old ID.', failsWhen: 'The old ID is aliased forever.', doneWhen: 'Old ID fails after the cutover instant and the mapping is recorded.' },
  'analyze-token-payload': { problem: 'Opaque tokens hide the claims you need for debugging.', method: 'Decode for diagnosis only; never copy production tokens into tickets.', failsWhen: 'The payload is pasted into a public tracker.', doneWhen: 'Claims are listed with types and no signature is treated as proof.' },
  'verify-data-integrity': { problem: 'Bits change in transit or at rest without a detector.', method: 'Hash at write, store the digest separately, hash at read, compare.', failsWhen: 'The digest travels in the same unsigned blob as the data with no MAC.', doneWhen: 'A mutated fixture fails the compare.' },
  'normalize-text': { problem: 'Equivalent text disagrees on Unicode form, spaces, or newlines.', method: 'NFKC/NFC as specified, collapse the whitespace class you document, unify newlines.', failsWhen: 'Trim only the ends.', doneWhen: 'Visually identical fixtures compare equal after normalize.' },
  'compare-versions': { problem: 'Version strings are compared lexicographically (`10` < `9`).', method: 'Parse SemVer or the team’s scheme, then compare tuples.', failsWhen: 'String sort is used for release gates.', doneWhen: 'A table of version pairs matches the documented order.' },
  'test-regex': { problem: 'A pattern that matches the demo fails in production data.', method: 'Run a fixture table on the same engine the service uses, including no-match rows.', failsWhen: 'Only one match is tried.', doneWhen: 'Every row’s match/groups equal the table.' },
  'find-and-replace-patterns': { problem: 'A replace is too greedy and edits strings it should skip.', method: 'Preview diffs, use bounded patterns, then apply.', failsWhen: 'Replace-all is done without a diff.', doneWhen: 'Only intended spans change; a checksum of the rest holds.' },
  'extract-text-segments': { problem: 'Needed spans are copied by eye from logs.', method: 'Use a tested regex or splitter with capture groups and reject partial matches.', failsWhen: 'Greedy `.*` eats delimiters.', doneWhen: 'Extracted segments match the gold list.' },
  'convert-text-case': { problem: 'Identifier and display case rules are mixed.', method: 'Choose locale and identifier style separately; convert; verify acronyms.', failsWhen: 'toUpperCase is used as a caseless compare for hashes.', doneWhen: 'Fixtures match the style guide including acronyms.' },
  'analyze-text-differences': { problem: 'Two documents “look the same” but differ in NBSP, BOM, or bidi marks.', method: 'Diff at character granularity with whitespace and invisible-code-point visibility.', failsWhen: 'A line diff is trusted after wrapping.', doneWhen: 'Invisible deltas are listed or confirmed absent.' },
  'build-regex-patterns': { problem: 'Ad-hoc regexes accumulate until they are unreadable and unsafe.', method: 'Write the pattern from a grammar, add comments/tests, then measure backtracking on long fail strings.', failsWhen: 'The pattern is edited in production logs.', doneWhen: 'The test table passes and a long non-match returns in a bounded time.' },
  'validate-input-format': { problem: 'Free text enters a field that a downstream parser will treat as syntax.', method: 'Validate against the actual grammar (not a guess regex) before accept.', failsWhen: 'Length checks stand in for format.', doneWhen: 'Valid/invalid fixture lists behave as documented.' },
  'clean-up-whitespace': { problem: 'Tabs, NBSP, and trailing spaces break hashes and diffs.', method: 'Define the whitespace policy, apply it, and keep interior spaces that are data.', failsWhen: 'All Unicode space is collapsed including in strings that must preserve it.', doneWhen: 'Hash of cleaned fixtures is stable across paste sources.' },
  'split-text-by-delimiter': { problem: 'CSV-like splits ignore quoted delimiters.', method: 'Use a real splitter for the dialect; do not `split(\',\')` on quoted CSV.', failsWhen: 'Delimiter appears inside a quoted field and shifts columns.', doneWhen: 'A quoted-delimiter fixture keeps column counts.' },
  'match-complex-patterns': { problem: 'Multi-line, overlapping, or alternative patterns are tested on one line only.', method: 'Enable the correct flags, test multiline fixtures, and assert span indexes.', failsWhen: 'Dotall/multiline flags differ from production.', doneWhen: 'Spans match the annotated fixture.' },
  'format-sql': { problem: 'Query reviews are unreadable and dialect tokens get rewritten.', method: 'Parse with the target dialect, reprint with team indent, preserve literals.', failsWhen: 'A generic beautifier changes vendor functions.', doneWhen: 'Formatted SQL parses to the same meaning.' },
  'minify-assets': { problem: 'Asset size hurts load time but naive minify breaks runtime.', method: 'Minify with a tool that understands the language, keep a source map, compare behaviour.', failsWhen: 'Whitespace strip is applied to a syntax it does not understand.', doneWhen: 'Behaviour fixture still passes and size drops are measured.' },
  'preview-markdown': { problem: 'Authors write to a flavour the publisher does not render.', method: 'Preview with the publisher engine and sanitizer settings.', failsWhen: 'A different website’s preview is trusted.', doneWhen: 'Snapshot HTML matches the publishing pipeline.' },
  'indent-nested-code': { problem: 'Indentation hides the real tree and, in some languages, changes meaning.', method: 'Apply the language formatter, not a generic tab converter.', failsWhen: 'Python/YAML meaning changes with indent.', doneWhen: 'Formatter output is idempotent and tests still pass.' },
  'optimize-css-output': { problem: 'Unused or overlapping CSS inflates CSSOM work.', method: 'Remove proven-dead rules, minify, and verify computed styles on key selectors.', failsWhen: 'A rule is dropped because a naive crawler missed a runtime class.', doneWhen: 'Visual/computed-style fixtures hold.' },
  'validate-markdown-syntax': { problem: 'Broken fences and headings publish as unexpected HTML.', method: 'Lint with the same engine, fail on unbalanced fences and duplicate heading IDs if required.', failsWhen: 'Preview “looks fine” on a short screen.', doneWhen: 'Lint is clean and snapshot HTML is stable.' },
  'beautify-query-strings': { problem: 'Query strings are compared as raw text and hide encoding issues.', method: 'Parse pairs, decode values with the correct rule, sort if order is insignificant, reprint.', failsWhen: 'Order-sensitive signatures are sorted.', doneWhen: 'Semantically equal queries reprint equal under the policy.' },
  'restructure-code-blocks': { problem: 'Fenced blocks and indentation confuse renderers and copy-paste.', method: 'Normalize fence language tags and indent inside fences without touching surrounding Markdown.', failsWhen: 'Outer Markdown indent is applied inside a fence.', doneWhen: 'Highlighted output matches the intended language and content.' },
  'standardize-sql-style': { problem: 'Keyword case and clause order differ per author.', method: 'Adopt one style (keyword case, comma policy) and enforce in CI.', failsWhen: 'Style is applied only on some directories.', doneWhen: 'Formatter is idempotent on the repo sample.' },
  'compress-stylesheet': { problem: 'CSS over the wire is larger than the CPU savings of a bad minify.', method: 'Minify safely, then gzip/brotli at the edge; measure both.', failsWhen: 'Minify breaks calc() to save a few bytes.', doneWhen: 'Computed-style fixtures pass and compressed size is recorded.' },
  'render-documentation': { problem: 'Docs render differently in Git vs the site.', method: 'Render with the site pipeline, including mermaid/tables/sanitizer.', failsWhen: 'README preview is the release check.', doneWhen: 'Published HTML snapshot matches CI.' },
  'align-code-formatting': { problem: 'Mixed formatters fight in the same file.', method: 'One formatter per language, same version in editor and CI.', failsWhen: 'Editor format-on-save disagrees with CI.', doneWhen: 'CI format check is empty on a freshly formatted tree.' },
  'design-api-schema': { problem: 'Endpoints accumulate implicit shapes.', method: 'Write the schema first (OpenAPI/JSON Schema), generate examples, and validate both directions.', failsWhen: 'The implementation is the only schema.', doneWhen: 'Examples validate and a breaking change is a version bump.' },
  'validate-api-response': { problem: 'A 200 body does not match the documented schema.', method: 'Check status, content-type, then schema; keep failing examples.', failsWhen: 'Only status codes are asserted.', doneWhen: 'Contract tests pass for success and error bodies.' },
  'construct-query-string': { problem: 'Query builders disagree on encoding and array repeat syntax.', method: 'Encode each name/value with the API’s rule (`%20` vs `+`, repeated keys vs `[]`).', failsWhen: 'JSON is dumped into a single query param without encoding.', doneWhen: 'The serialized query matches the API fixture.' },
  'authenticate-api-request': { problem: 'Auth headers are copied wrong (scheme, extra spaces, stale tokens).', method: 'Build the header from a verified token; do not log it; refresh on 401 per spec.', failsWhen: 'Bearer tokens are pasted into URLs.', doneWhen: 'A recorded request (redacted) matches the required header shape.' },
  'parse-webhook-payload': { problem: 'Webhook bodies are signed and encoded; naive JSON.parse hides failures.', method: 'Verify signature on raw bytes, then parse, then schema-validate.', failsWhen: 'The body is parsed before signature verify (canonicalization breaks the MAC).', doneWhen: 'Valid signed fixtures pass and mutated bodies fail the MAC.' },
  'debug-api-error': { problem: 'Error bodies are unstructured and the status is ignored.', method: 'Record status, headers, and parsed error fields; compare to the catalog.', failsWhen: 'Retry loops on 400s.', doneWhen: 'The error maps to a documented code and a next action.' },
  'format-api-documentation': { problem: 'Examples in docs do not match the schema.', method: 'Generate examples from the schema or validate docs examples in CI.', failsWhen: 'Screenshots are the source of truth.', doneWhen: 'Every example validates.' },
  'test-api-endpoint': { problem: 'Manual clicks miss auth, pagination, and error paths.', method: 'Script happy path, 401/403/404, and contract validation.', failsWhen: 'Only the happy path is recorded.', doneWhen: 'The four classes of test are green on a staging fixture.' },
  'normalize-api-data': { problem: 'The same resource has different shapes across versions or vendors.', method: 'Map into an internal DTO with explicit field transforms and defaults.', failsWhen: 'Consumers each special-case the vendor.', doneWhen: 'Two vendor fixtures map to one internal fixture.' },
  'optimize-api-payload': { problem: 'Chatty payloads waste bandwidth and hide the fields that matter.', method: 'Drop unused fields, compact JSON, consider pagination; measure size and parse time.', failsWhen: 'Fields are removed that a client still needs.', doneWhen: 'Size budget is met and contract tests still pass.' },
  'version-api-response': { problem: 'Breaking changes ship under the same URL.', method: 'Version in the path or negotiate; keep old fixtures on the old version.', failsWhen: 'Optional fields become required without a bump.', doneWhen: 'Old clients still validate against the old schema.' },
  'secure-api-communication': { problem: 'Tokens and PII travel in query strings and logs.', method: 'TLS, Authorization header, no secrets in URLs, redact logs.', failsWhen: 'Access tokens are in Referer.', doneWhen: 'A traffic sample shows no secret in URL or log fields.' },
  'transform-data-format': { problem: 'CSV/JSON/XML conversions drop types and encodings.', method: 'Parse with the source schema, convert types explicitly, serialize to the target.', failsWhen: 'toString() is the type system.', doneWhen: 'A typed fixture survives the conversion with the documented coercions only.' },
  'generate-data-models': { problem: 'Models are typed from one row.', method: 'Profile many rows for nulls, enums, and max lengths, then emit the model.', failsWhen: 'The first row’s types win.', doneWhen: 'The model accepts the profiled corpus and rejects planted invalids.' },
  'hash-data-for-storage': { problem: 'Stored blobs need integrity without encrypting the value.', method: 'SHA-256 the canonical bytes, store digest beside the blob, verify on read.', failsWhen: 'Pretty-printed JSON is hashed and compact JSON is stored.', doneWhen: 'A bit flip fails verify.' },
  'encode-binary-data': { problem: 'Binary cannot sit in JSON/text logs.', method: 'Base64 (declare URL-safe or not) and store the encoding name.', failsWhen: 'Escaped binary is mixed with UTF-8 text in one field with no label.', doneWhen: 'SHA-256 of decoded bytes matches the source blob.' },
  'create-data-fingerprint': { problem: 'Change detection needs a stable identity for a document.', method: 'Canonicalize, then hash; document what is excluded (timestamps, key order).', failsWhen: 'Raw bytes including volatile fields are hashed.', doneWhen: 'Semantically equal fixtures share a fingerprint; intended changes do not.' },
  'serialize-complex-objects': { problem: 'Cycles, dates, and maps do not JSON-serialize portably.', method: 'Define the codec (ISO dates, map as entries), reject cycles, and version the codec.', failsWhen: 'JSON.stringify is used on Map/Date without a replacer.', doneWhen: 'Round-trip equals the original under the codec rules.' },
  'migrate-data-schema': { problem: 'Old documents must load after a field rename.', method: 'Write expand/contract migrations, dual-read, then drop the old field.', failsWhen: 'A one-shot rewrite with no rollback.', doneWhen: 'Old and new fixtures load into the current model.' },
  'anonymize-sensitive-fields': { problem: 'Fixtures and logs contain PII.', method: 'Replace listed paths with stable fakes; never hash that is reversible for small sets without salt policy.', failsWhen: 'Email local-parts are left intact.', doneWhen: 'A scanner finds no original PII in the output fixture.' },
  'aggregate-data-records': { problem: 'Counts disagree because of duplicate keys and timezone buckets.', method: 'Define the grain, dedupe, then aggregate in a specified timezone.', failsWhen: 'Local browser TZ is used for a global report.', doneWhen: 'Aggregates match a hand-computed fixture.' },
  'generate-unique-identifiers': { problem: 'Imported rows collide on natural keys.', method: 'Mint UUID v4/v7 for surrogate IDs; keep natural keys unique with a real constraint.', failsWhen: 'Name+date is assumed unique.', doneWhen: 'Inserts of the fixture batch do not collide.' },
  'normalize-data-structure': { problem: 'The same entity is an object in one API and an array of pairs in another.', method: 'Map to one internal shape with tests for empty, singleton, and many.', failsWhen: 'Call sites each normalize differently.', doneWhen: 'All source fixtures become the internal fixture.' },
  'compare-config-files': { problem: 'Config diffs are noisy with comments and key order.', method: 'Parse, drop comments if insignificant, canonicalize, diff.', failsWhen: 'A comment-only change blocks a release.', doneWhen: 'Semantic diffs match the intended change list.' },
  'trace-data-flow': { problem: 'A value changes at an unknown hop.', method: 'Snapshot the value (and hash) at each boundary until the mutating hop is identified.', failsWhen: 'Only the ends are compared.', doneWhen: 'The mutating hop is named with before/after hashes.' },
  'isolate-parsing-error': { problem: 'A parser error is blamed on the wrong layer.', method: 'Minimize the input, keep the error, then add back until it returns.', failsWhen: 'The full payload is edited at random.', doneWhen: 'A minimal repro file is attached to the ticket.' },
  'identify-format-change': { problem: 'A silent schema add/remove breaks consumers.', method: 'Diff schemas or inferred shapes between versions; fail CI on undeclared breaks.', failsWhen: 'Only example payloads are compared.', doneWhen: 'Declared changes match the changelog; no extras.' },
  'debug-regex-match': { problem: 'A match fails and the engine gives no reason.', method: 'Simplify the pattern, test substrings, inspect flags and lastIndex.', failsWhen: 'The pattern is rewritten from scratch each time.', doneWhen: 'The failing input is in the table with the correct expectation.' },
  'verify-output-format': { problem: 'Output “looks like JSON” or “looks like CSV” but is not.', method: 'Parse with the real parser; do not sniff.', failsWhen: 'The first character is used as a type.', doneWhen: 'Parser success and schema success both hold.' },
  'analyze-log-patterns': { problem: 'Incidents hide in unstructured logs.', method: 'Extract a pattern, test on a slice, then count; keep false-positive examples.', failsWhen: 'A pattern is promoted from one line.', doneWhen: 'Precision/recall on a labeled slice is recorded.' },
  'pinpoint-encoding-issue': { problem: 'A downstream system rejects a payload that another accepted.', method: 'Compare hex dumps at both ends; identify charset vs Base64 vs percent.', failsWhen: 'The UI string is compared.', doneWhen: 'The first differing byte and the codec mismatch are named.' },
  'detect-schema-drift': { problem: 'Production data grows fields the tests never saw.', method: 'Infer shape from a sample, diff against the schema, alert on new/missing paths.', failsWhen: 'Drift is noticed only after a crash.', doneWhen: 'Planted extra fields are detected in the sample job.' },
  'validate-transform-output': { problem: 'A transform returns without checking the target contract.', method: 'Schema-validate output, then hash-compare to a gold file when deterministic.', failsWhen: 'Row counts alone are the check.', doneWhen: 'Gold compare or schema validate is green.' },
  'reproduce-formatting-bug': { problem: 'A format bug appears only on one machine.', method: 'Capture exact input bytes, tool version, and options; replay elsewhere.', failsWhen: 'A retyped sample is used.', doneWhen: 'A second machine matches the bug or the version gap is named.' },
  'check-data-consistency': { problem: 'Two stores disagree on the same entity.', method: 'Compare canonicalized records on a shared key; list mismatches.', failsWhen: 'Counts match but IDs do not.', doneWhen: 'Mismatch list is empty or each row has an owner.' },
  'schedule-recurring-task': { problem: 'Cron that “looks right” fires in the wrong TZ or never.', method: 'Expand next runs in the scheduler’s TZ; confirm DST behaviour.', failsWhen: 'Syntax validation is the only gate.', doneWhen: 'Next-run list matches the ops calendar.' },
  'extract-log-data': { problem: 'Needed fields sit inside noisy lines.', method: 'Pin a regex/parser with a labeled slice; export JSON.', failsWhen: 'Grep is the pipeline.', doneWhen: 'Extracted JSON matches the labeled slice.' },
  'generate-batch-ids': { problem: 'A batch rerun collides with the previous ID.', method: 'Mint UUID v7 (time-ordered) or v4 per attempt; store attempt number separately.', failsWhen: 'The filename date is the ID.', doneWhen: 'Two runs in the same second still unique.' },
  'parse-automation-output': { problem: 'Automation prints human text that a parser then guesses at.', method: 'Prefer JSON output flags; if text, use a tested grammar.', failsWhen: 'Column-aligned text is split on spaces.', doneWhen: 'Parser fixtures from real runs pass.' },
  'validate-cron-schedule': { problem: 'Invalid or ambiguous cron is deployed.', method: 'Parse with the vendor grammar, print next fires, reject day-of-month+week footguns unless documented.', failsWhen: 'A web “cron tester” for a different grammar is used.', doneWhen: 'Vendor examples parse and the bad fixture is rejected.' },
  'build-extraction-pattern': { problem: 'One-off greps become production parsers.', method: 'Write tests first, then the pattern, then a timeout on fail paths.', failsWhen: 'The pattern is tuned only on matches, not on near-misses.', doneWhen: 'Match and near-miss tables pass.' },
  'create-unique-job-ids': { problem: 'Job systems reuse names and overwrite artifacts.', method: 'UUID plus a human prefix; immutable object keys.', failsWhen: '“latest” is the only name.', doneWhen: 'Artifact keys are unique across the fixture runs.' },
  'monitor-scheduled-tasks': { problem: 'Missed fires are noticed by users.', method: 'Alert on missing heartbeat within 2× the interval; include TZ in the alert.', failsWhen: 'Success logs without a dead-man switch.', doneWhen: 'A skipped run pages within the SLO.' },
  'automate-data-extraction': { problem: 'Manual copy from reports does not scale and is unreviewed.', method: 'Script the extract, snapshot fixtures, schema-validate, then schedule.', failsWhen: 'UI scraping without a contract.', doneWhen: 'Scheduled job output matches the snapshot schema.' },
  'filter-event-streams': { problem: 'Filters drop events that still matter or pass noise.', method: 'Write include/exclude tests on a labeled stream slice.', failsWhen: 'A filter is deployed from one example event.', doneWhen: 'Precision/recall on the slice is recorded.' },
  'tag-automated-processes': { problem: 'Jobs cannot be attributed in logs.', method: 'Inject a correlation ID (UUID) at creation and require it in every log line.', failsWhen: 'PID is the only identifier.', doneWhen: 'A grep of the ID reconstructs the run.' },
  'configure-periodic-cleanup': { problem: 'Cleanup is too aggressive or never runs.', method: 'Define age/size policy, dry-run the delete set, then apply with a dry-run log kept.', failsWhen: 'rm -rf in cron with no inventory.', doneWhen: 'Dry-run list matches policy on a fixture directory.' },
  'sanitize-html-input': { problem: 'Untrusted HTML executes in a privileged origin.', method: 'Parse HTML, keep an allowlist of tags/attrs, serialize; never regex-strip scripts.', failsWhen: 'Blacklist of `script` is used.', doneWhen: 'XSS fixture pack is inert in the target context.' },
  'optimize-css-bundle': { problem: 'CSS bundles include unused rules and duplicate media blocks.', method: 'Purge with a real usage set, minify, verify pages.', failsWhen: 'Purge sees only static class names and drops runtime ones.', doneWhen: 'Key pages’ computed styles match and size drops.' },
  'preview-content-markup': { problem: 'CMS markup looks different after sanitizer/CSS.', method: 'Preview through the same sanitizer and CSS as production.', failsWhen: 'A local Markdown preview is used.', doneWhen: 'Preview HTML snapshot equals production renderer.' },
  'encode-url-parameters': { problem: 'Reserved characters break routing or signatures.', method: 'encodeURIComponent per parameter; do not encode the whole URL.', failsWhen: 'Spaces become `+` in a path.', doneWhen: 'The reconstructed URL matches the API fixture.' },
  'protect-against-xss': { problem: 'Untrusted strings hit HTML, attributes, or JS contexts.', method: 'Context-specific encoding or a sanitizer; CSP as defence in depth.', failsWhen: 'One HTML-escape is used for JS context.', doneWhen: 'The XSS pack does not execute in each context.' },
  'minify-stylesheet': { problem: 'Comments and whitespace dominate CSS bytes.', method: 'Language-aware minify plus computed-style check.', failsWhen: 'calc() spaces are removed.', doneWhen: 'Visual fixtures pass.' },
  'render-dynamic-content': { problem: 'Templates interpolate untrusted data into HTML.', method: 'Use auto-escaping templates; only explicitly mark safe HTML after sanitize.', failsWhen: 'String concat builds HTML.', doneWhen: 'Injected fixtures show as text, not DOM.' },
  'escape-template-variables': { problem: 'Mustache/JSX/Handlebars escaping rules are mixed up.', method: 'Follow that engine’s escape; never double-escape; test each context.', failsWhen: 'HTML-escaped text is placed into a `<script>` JSON blob.', doneWhen: 'Context fixtures render safely.' },
  'compress-web-assets': { problem: 'Uncompressed assets waste bandwidth.', method: 'Minify where safe, then Brotli/gzip at the edge; cache the compressed form.', failsWhen: 'Pre-compressed files are served without the matching Content-Encoding.', doneWhen: 'Transfer size and Content-Encoding are correct on a sample.' },
  'validate-markup-output': { problem: 'Templates emit invalid HTML that browsers silently fix differently.', method: 'Serialize, then run an HTML checker on the fragment.', failsWhen: 'The page “looks fine” in one browser.', doneWhen: 'Checker is clean for the fragment fixture.' },
  'format-rich-text': { problem: 'Rich text from editors includes extra spans and unsafe tags.', method: 'Normalize to a small schema (paragraphs, lists, links), sanitize, serialize.', failsWhen: 'innerHTML of the editor is stored raw.', doneWhen: 'Normalized HTML matches the schema and XSS pack is inert.' },
  'secure-form-data': { problem: 'Form bodies carry tokens and are logged or cached.', method: 'POST, CSRF token, autocomplete off for secrets, never put secrets in query.', failsWhen: 'GET forms send passwords.', doneWhen: 'A traffic sample shows POST bodies not logged in full.' },
};

const DEFAULT_INTENT: IntentKernel = {
  problem: 'The operation is done by eye and cannot be replayed.',
  method: 'Use the tool on a representative sample, then compare to a known-good reference.',
  failsWhen: 'A toy string is the only input.',
  doneWhen: 'A second person reproduces the same output from the same sample and settings.',
};

export function finishPtr(style: string): string {
  switch (style) {
    case 'as-part-of-ci-cd-pipeline': return 'the CI pass condition';
    case 'during-code-review': return 'the review sign-off bar';
    case 'without-installing-cli-tools': return 'the no-install finish';
    case 'with-safe-local-processing': return 'the on-device finish';
    case 'while-keeping-data-private': return 'the no-copy finish';
    case 'for-quick-prototyping': return 'the spike promotion rule';
    case 'with-step-by-step-instructions': return 'the lesson-complete line';
    case 'with-automated-validation': return 'the invariant statement';
    default: return 'the tab’s done line';
  }
}

export function stopPtr(style: string): string {
  switch (style) {
    case 'as-part-of-ci-cd-pipeline': return 'the red-job condition';
    case 'during-code-review': return 'the request-changes bar';
    case 'without-installing-cli-tools': return 'the no-install abort';
    case 'with-safe-local-processing': return 'the egress abort';
    case 'while-keeping-data-private': return 'the extra-copy fail';
    case 'for-quick-prototyping': return 'the spike-is-lying test';
    case 'with-step-by-step-instructions': return 'the mid-lesson fail';
    case 'with-automated-validation': return 'the invariant break';
    default: return 'the tab’s stop line';
  }
}

export function intentKernel(intent: string): IntentKernel {
  return INTENT_KERNEL[intent] ?? DEFAULT_INTENT;
}

export function toolKnowledge(tool: string): ToolKnowledge {
  return TOOL_KNOWLEDGE[tool] ?? {
    what: `${tool} is a browser-local DevSolve tool for inspecting and transforming developer data.`,
    mechanics: ['Operations run on the device. Record input, settings, and output together.'],
    pitfalls: ['Treating a UI result as a signed production decision.'],
    verify: 'Reproduce the result from a stored fixture on a second machine.',
  };
}

/**
 * Document archetypes — the primary uniqueness lever. Siblings that share
 * tool+intent+audience+task but differ in style get a different genre, not
 * the same essay with adjectives swapped.
 */
export function archetypeSections(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel): KnowledgeSection[] {
  const t = k.toolLabel;
  const job = k.intentLabel;
  switch (k.style) {
    case 'without-installing-cli-tools':
      return [
        {
          id: 'constraint',
          heading: `Doing ${job} when you cannot install a CLI`,
          paragraphs: [
            `That matters here because the machine may be locked down: no Homebrew, no apt, no corporate software request. The browser tab is the runtime.`,
            `If a step requires a binary, you are on the wrong guide.`,
            `Save the output as a file the reviewer can open without extra tools.`,
          ],
          list: [
            'Use a throwaway browser profile if the payload is sensitive.',
            'Do not shell out “just this once” — that abandons the constraint.',
            'Save the output as a file the reviewer can open without extra tools.',
          ],
        },
        {
          id: 'mechanics',
          heading: `What ${t} is allowed to be on a no-install machine`,
          paragraphs: [
            `The only runtime is the tab. If a mechanic only exists as a CLI flag, it is out of scope here.`,
            `Readers on kiosk images should finish ${job} with a file they can open in Notepad or Preview — not with a brew formula.`,
          ],
        },
        {
          id: 'abort',
          heading: 'Stop conditions',
          paragraphs: [
            `If you hit ${stopPtr(k.style)}, freeze the input bytes rather than improvising a CLI.`,
            `Verification without installs is the acceptance check on this page — not a brew formula.`,
          ],
          list: [
            'A sudo prompt means you left this sibling.',
            'A missing PATH entry is not a defect here.',
            'Capture bytes before you invent a workaround.',
          ],
        },
      ];
    case 'directly-in-your-browser':
      return [
        {
          id: 'loop',
          heading: `The paste → run → read loop for ${job}`,
          paragraphs: [
            `In this guide the whole loop stays in one tab so a teammate can repeat it from a written sample, not from a setup document.`,
            `The job to finish in that loop is ${job}, read against a fixture — not against a vibe.`,
            `Copy settings + output into the ticket so the loop is replayable.`,
          ],
          list: [
            'Paste a representative sample, not a one-line toy.',
            'Read the output against the “done when” line below before you leave the tab.',
            'Copy settings + output into the ticket so the loop is replayable.',
          ],
        },
        {
          id: 'mechanics',
          heading: `How to read ${t} in the tab`,
          paragraphs: [
            `Watch the output the way you would watch a test runner: against a fixture, not against a vibe.`,
            `If you only needed a one-liner API call, this interactive sibling is the wrong citation.`,
          ],
        },
        {
          id: 'done',
          heading: 'When to close the tab',
          paragraphs: [
            `Done when ${finishPtr(k.style)} holds.`,
            `Not done when ${stopPtr(k.style)} is true.`,
          ],
        },
      ];
    case 'with-step-by-step-instructions':
      return [
        {
          id: 'teach',
          heading: `Teachable sequence: ${job}`,
          paragraphs: [
            `This page is the checklist-grade path. Each stage names the input, the action, and the signal to move on.`,
            `Why the sequence exists: a first-timer should finish with the same pack as a veteran.`,
            `Method you will teach: named input, named ${t} action, named signal to move on.`,
          ],
        },
        {
          id: 'why',
          heading: 'Why the sequence is written out',
          paragraphs: [
            `Veterans skip steps they can no longer see. This URL writes the signal after each click so a first-timer still produces the same pack.`,
            `The failure you call out while teaching is ${stopPtr(k.style)}.`,
          ],
        },
        {
          id: 'mistakes',
          heading: 'Mistakes to correct in the moment',
          paragraphs: [`The failure mode to call out while teaching is ${stopPtr(k.style)}, plus the pitfalls list.`],
          list: [
            'Skipping the “why” because the click is obvious to you.',
            'Demoing a toy string the learner will copy forever.',
            'Leaving the pack in your head instead of in the notes.',
          ],
        },
      ];
    case 'with-safe-local-processing':
      return [
        {
          id: 'boundary',
          heading: `Local-only processing for ${job}`,
          paragraphs: [
            `Safe local processing is a hard boundary: the payload must not leave the device.`,
            `If an upload prompt appears, abort.`,
            `Prefer a profile that is not syncing typed data to a vault you did not intend to use.`,
          ],
          list: [
            'Confirm the browser is not syncing typed data to a password-manager cloud vault you do not intend to use.',
            'Prefer offline/cache already loaded; do not paste into a different origin.',
            'Record that no egress occurred next to the evidence pack.',
          ],
        },
        {
          id: 'mechanics',
          heading: `What “on-device” forbids for ${t}`,
          paragraphs: [
            `No temporary bucket, no “debug upload”, no other origin.`,
            `If classification later allows a managed pipeline, switch siblings — do not weaken this one.`,
          ],
        },
        {
          id: 'verify',
          heading: 'Local verification',
          paragraphs: [`Use the acceptance check on this page — still on-device.`, `Done when ${finishPtr(k.style)} holds.`],
        },
      ];
    case 'while-keeping-data-private':
      return [
        {
          id: 'privacy',
          heading: `Privacy-first ${job}`,
          paragraphs: [
            `Success includes “no extra copy of the data was created”.`,
            `Do not paste production secrets into tickets, chat, or hosted debuggers.`,
          ],
          list: [
            'Redact PII in any screenshot.',
            'Use synthetic fixtures when the real payload is classified.',
            'If a vendor paste box is required, this is the wrong URL.',
          ],
        },
        {
          id: 'mechanics',
          heading: `Correctness without extra copies`,
          paragraphs: [
            `Privacy does not relax ${job}. The extra rule is that a leak still fails the ticket.`,
            `Redaction is part of the procedure, not an afterthought for the slide deck.`,
          ],
        },
        {
          id: 'fails',
          heading: 'Privacy failures vs technical failures',
          paragraphs: [
            `Technical failure is whatever ${stopPtr(k.style)} names.`,
            `Privacy failure: a correct result that created an unapproved copy.`,
            `Use the acceptance check; do not invent a second definition.`,
          ],
        },
      ];
    case 'for-quick-prototyping':
      return [
        {
          id: 'spike',
          heading: `A short spike for ${job}`,
          paragraphs: [
            `This is a disposable pass: you want a direction in minutes, not a release gate.`,
            `Hypothesis: you want a direction in minutes, not a release gate. Fast method: smallest sample that moves the question.`,
            `Write down what you will throw away. Production hardening is a different page.`,
          ],
          list: [
            'Time-box the tab session.',
            'Keep the winning fixture; delete the rest.',
            `Promotion rule later: ${finishPtr(k.style)}, encoded as a test.`,
          ],
        },
        {
          id: 'mechanics',
          heading: `Enough ${t} to not fool the spike`,
          paragraphs: [
            `A pretty result on a toy string is how spikes lie. Use the acceptance check.`,
            `Write down what you will throw away before you start, or you will ship the tab session.`,
          ],
        },
        {
          id: 'stop',
          heading: 'When the spike is lying',
          paragraphs: [`The spike is lying when ${stopPtr(k.style)} is true, or when the sample was a toy.`],
        },
      ];
    case 'during-code-review':
      return [
        {
          id: 'pr',
          heading: `What to paste into the ${job} review`,
          paragraphs: [
            `Review mode wants a small, regenerable artifact: input sample, ${t} settings, output.`,
            `Reviewers should not need a DM to replay the check.`,
          ],
          list: [
            'Keep the snippet short enough for a PR comment.',
            'Include the fixture id and settings beside the output.',
            'Do not paste production secrets into the review thread.',
          ],
        },
        {
          id: 'bar',
          heading: 'Sign-off bar',
          paragraphs: [
            `Approve when ${finishPtr(k.style)} holds.`,
            `Request changes when ${stopPtr(k.style)} holds.`,
            `The snippet must be regenerable from the thread.`,
          ],
        },
        {
          id: 'out',
          heading: 'Out of scope for this review',
          paragraphs: [
            'Overnight batch jobs, cluster-scale throughput, and vendor SLA debates belong on other URLs. This review is about whether the sample was checked correctly with this tool.',
            `If the proof is a long log, link a CI sibling instead of pasting it here.`,
          ],
          list: [
            'PR comments that require a DM to replay.',
            'Screenshots with no settings beside them.',
            'Production tokens in the thread.',
          ],
        },
      ];
    case 'as-part-of-ci-cd-pipeline':
      return [
        {
          id: 'contract',
          heading: `CI contract for ${job}`,
          paragraphs: [
            `The browser pass is a rehearsal for an automated gate. Freeze a fixture, name the assertion, then port it.`,
            `Assertion in plain language: ${finishPtr(k.style)}.`,
            `The pipeline should fail when ${stopPtr(k.style)} is true.`,
          ],
        },
        {
          id: 'port',
          heading: `What to port from ${t}`,
          paragraphs: [
            `Port flags, alphabet, indent, or dialect — not a screenshot.`,
            `Name the golden file after the fixture id so CODEOWNERS and grep stay obvious.`,
          ],
          list: [
            'Store the fixture next to the test, not in a wiki screenshot.',
            'Pin the algorithm/variant (alphabet, indent, dialect) in the test name.',
            'Do not call a hosted API from CI for this check.',
          ],
        },
        {
          id: 'red',
          heading: 'What a red build means',
          paragraphs: [
            `A red job means the invariant broke, not that “the formatter is picky”.`,
            `Common false reds: ${tk.pitfalls.join('; ')}`,
          ],
        },
      ];
    case 'with-automated-validation':
      return [
        {
          id: 'invariant',
          heading: `The invariant for ${job}`,
          paragraphs: [
            `Attach a machine-checkable statement to the human-readable result.`,
            `Invariant: ${finishPtr(k.style)}, as equality/schema/digest.`,
            `Breakage looks like ${stopPtr(k.style)}.`,
          ],
        },
        {
          id: 'encode',
          heading: 'How to encode the check',
          paragraphs: [
            `Write the check so a script can fail — see Acceptance criteria.`,
            `Prefer equality of canonical bytes over visual inspection. Name the variant in the assertion message so a red log is diagnosable.`,
            `Keep a negative fixture that must fail; a check that cannot fail is theatre.`,
          ],
          list: [
            'Prefer equality of canonical bytes over visual inspection.',
            'Name the codec/variant in the assertion message.',
            'Keep a negative fixture that must fail.',
          ],
        },
        {
          id: 'pitfalls',
          heading: 'Assertions that do not actually assert',
          paragraphs: ['If you cannot state the check in one sentence, you are not done.'],
          list: [
            'Visual “looks fine” with no expected bytes.',
            'An assertion that cannot fail.',
            'A missing negative fixture.',
          ],
        },
      ];
    default:
      return [
        {
          id: 'overview',
          heading: `How ${t} handles ${job}`,
          paragraphs: [`${t} is the runtime for ${job} on this URL.`, `Verification is the acceptance check on this page.`],
        },
        {
          id: 'verify',
          heading: 'Verification',
          paragraphs: [`Use the acceptance check on this page.`, `Done when ${finishPtr(k.style)} holds.`],
          list: [
            'Replay from the pack, not from memory.',
            'Record settings next to the output.',
            'Do not treat a pretty-print as a signed decision.',
          ],
        },
      ];
  }
}

export function contextSection(k: PageKernel, bodyBlock: string, demand: string): KnowledgeSection {
  return {
    id: 'context',
    heading: `Constraints that apply in this setting`,
    paragraphs: [
      bodyBlock,
      demand,
      `Those constraints change the evidence you keep, not the core mechanics of ${k.toolLabel}. Do not copy a procedure from a different setting and expect the same acceptance bar.`,
    ],
  };
}

export function audienceSection(k: PageKernel): KnowledgeSection {
  return {
    id: 'audience',
    heading: `Notes for a ${k.audienceLabel}`,
    paragraphs: [
      `Your focus on this URL is ${k.audienceFocus}. The usual miss for this role is ${k.audienceConcern}; finish by making ${k.taskOutcome} possible.`,
    ],
  };
}

export function naturalSteps(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel): string[] {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return [
        `Commit a fixture that demonstrates ${k.intentLabel} (include a negative case).`,
        `Record the ${k.toolLabel} options that the job must copy.`,
        `Implement ${tk.verify} as an assertion in CI.`,
        `Fail the build when ${ik.failsWhen}`,
        `On red, compare fixture bytes before changing production config.`,
      ];
    case 'during-code-review':
      return [
        `Put the smallest representative sample in the review notes.`,
        `Run ${k.toolLabel} and paste output + settings under the diff.`,
        `Ask the reviewer to regenerate from those notes only.`,
        `Accept when ${ik.doneWhen}`,
        `Reject when ${ik.failsWhen}`,
      ];
    case 'with-step-by-step-instructions':
      return [
        `State the problem in one sentence: ${ik.problem}`,
        `Open ${k.toolLabel} and load the sample.`,
        `Carry out the procedure in the sections above, in order.`,
        `Read the mechanics section before you move on.`,
        `Confirm the done-when line in the takeaways.`,
        `If it failed, name the pitfall: ${tk.pitfalls[0] ?? ik.failsWhen}`,
      ];
    case 'for-quick-prototyping':
      return [
        `Time-box the spike.`,
        `Try ${ik.method} on a small sample.`,
        `Keep only the fixture that moved the hypothesis.`,
        `Write the follow-up test you will owe production: ${ik.doneWhen}`,
      ];
    default:
      return [
        `Take a sample that looks like production data for ${k.intentLabel}.`,
        `Run it through ${k.toolLabel}.`,
        `Follow the method in the job section above, then verify.`,
      `Compare the result to a known-good fixture.`,
        `Stop if ${ik.failsWhen}`,
        `Finish when ${ik.doneWhen}`,
      ];
  }
}

export function naturalPitfalls(tk: ToolKnowledge, ik: IntentKernel): string[] {
  return [
    ik.failsWhen,
    'Using a toy sample that hides the encoding, null, or size behaviour you will hit later.',
    'Leaving no fixture, so the next person cannot replay the check.',
    tk.pitfalls[0] ?? 'Treating a UI result as a signed production decision.',
  ];
}

export function decisionFor(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel): {
  heading: string;
  when: string[];
  notWhen: string[];
  verdict: string;
} {
  const t = k.toolLabel;
  const job = k.intentLabel;
  switch (k.style) {
    case 'without-installing-cli-tools':
      return {
        heading: `When a no-install ${job} pass is the right move`,
        when: [
          `The laptop cannot take a package install, and ${t} in a browser is the only legal runtime.`,
          `You still need a real ${job} result, not a screenshot of someone else’s CLI.`,
        ],
        notWhen: [
          'A blessed CLI is already on the image and the reviewer expects that binary’s flags.',
          'The file is too large for a tab; this page is the reference check, not the bulk path.',
        ],
        verdict: `Stay here when ${job} must happen with zero installs using ${t}.`,
      };
    case 'directly-in-your-browser':
      return {
        heading: `When an interactive ${job} tab is enough`,
        when: [
          `You can paste a sample, run ${t}, and read the result in one sitting.`,
          `A teammate should be able to repeat the same paste from the ticket.`,
        ],
        notWhen: [
          'The check must run unattended on every commit — use the CI sibling.',
          'You only needed an API one-liner.',
        ],
        verdict: `This URL is the interactive ${job} pass with ${t}, not the pipeline spec.`,
      };
    case 'with-step-by-step-instructions':
      return {
        heading: `When ${job} has to be teachable`,
        when: [
          `Someone who has not done ${job} before must finish with the same evidence pack.`,
          `You are willing to write the “why” under each click in ${t}.`,
        ],
        notWhen: [
          'The reader already knows the flow and only wants a one-line reminder.',
          'You are mid-incident and need the short runbook sibling.',
        ],
        verdict: `Use this page as the teachable ${job} sequence on ${t}.`,
      };
    case 'with-safe-local-processing':
      return {
        heading: `When ${job} cannot leave the device`,
        when: [
          `The payload’s classification forbids upload, and ${t} stays in-process.`,
          `You can abort if any hop asks for egress.`,
        ],
        notWhen: [
          'A vendor processor is already approved and you only need bulk speed.',
          'The data is synthetic and egress is irrelevant — a faster sibling is fine.',
        ],
        verdict: `Local-only ${job} with ${t}: if it uploaded, you used the wrong guide.`,
      };
    case 'while-keeping-data-private':
      return {
        heading: `When privacy is part of “done” for ${job}`,
        when: [
          `A correct answer that created an extra copy still fails the ticket.`,
          `Screenshots and chat pastes must be redacted even after ${t} succeeds.`,
        ],
        notWhen: [
          'The sample is public test data and privacy overhead is wasted motion.',
          'You need a hosted debugger — that is a different, worse trade for secrets.',
        ],
        verdict: `Privacy-first ${job}: no extra copies, ${t} on-device.`,
      };
    case 'for-quick-prototyping':
      return {
        heading: `When ${job} is a spike, not a gate`,
        when: [
          `You need a direction in minutes with ${t}, and you will throw most of it away.`,
          `A follow-up test will be written later; it is not this tab’s job.`,
        ],
        notWhen: [
          'Release management needs a binary go/no-go — use that sibling.',
          'You are already past prototype and skipping the assertion.',
        ],
        verdict: `Spike-only ${job} with ${t}; promote the winning fixture, not the tab session.`,
      };
    case 'during-code-review':
      return {
        heading: `When ${job} belongs in the review thread`,
        when: [
          `A reviewer must replay ${t} from the PR comment without a DM.`,
          `The artifact is small enough to paste next to the diff.`,
        ],
        notWhen: [
          'The proof is a long batch log — link a CI sibling instead.',
          'Production secrets would have to go in the comment.',
        ],
        verdict: `Review-sized ${job} evidence from ${t}, regenerable from the thread.`,
      };
    case 'as-part-of-ci-cd-pipeline':
      return {
        heading: `When ${job} must fail the build`,
        when: [
          `The browser pass is only a rehearsal; the assertion will live in CI.`,
          `A red job should mean ${stopPtr(k.style)} is true.`,
        ],
        notWhen: [
          'This is a one-off incident paste that will never become a job.',
          'You cannot freeze a fixture yet — finish a spike first.',
        ],
        verdict: `CI contract for ${job}: fixture + ${t} options + assertion.`,
      };
    case 'with-automated-validation':
      return {
        heading: `When ${job} needs a machine-checkable invariant`,
        when: [
          `You can state “done” as equality, schema, or hash — not “looks fine”.`,
          `You can point at the acceptance check on this page.`,
        ],
        notWhen: [
          'You are still exploring and cannot name the invariant.',
          'The check is inherently visual with no expected bytes.',
        ],
        verdict: `Automated ${job}: if it cannot fail a script, it is not this page.`,
      };
    default:
      return {
        heading: `When this ${job} guide applies`,
        when: [`You need to ${job} and ${t} is the right class of tool.`],
        notWhen: ['You only wanted the generic tool page.'],
        verdict: `Use this page to ${job} with ${t}.`,
      };
  }
}

export function naturalFaq(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel): { question: string; answer: string }[] {
  return [
    {
      question: `How do I ${k.intentLabel} with ${k.toolLabel}?`,
      answer: `Open ${k.toolLabel}, load a representative sample, apply the method in the procedure below, then compare against a known-good fixture.`,
    },
    {
      question: `Does ${k.toolLabel} upload my data?`,
      answer: 'No. The tool runs in your browser. Do not paste secrets into tickets or third-party debuggers either.',
    },
    {
      question: `When is this page the wrong choice?`,
      answer: 'If the working method or setting in the title is not yours, open the matching guide. If you need bulk server throughput, keep this as the reference check and automate separately.',
    },
    {
      question: `What does “done” mean?`,
      answer: ik.doneWhen,
    },
    {
      question: `What is the usual failure?`,
      answer: ik.failsWhen,
    },
    {
      question: `How is this different from the generic ${k.toolLabel} page?`,
      answer: `The tool page is the product. This URL is one job (${k.intentLabel}) written for the method and setting named in the title.`,
    },
  ];
}

export function naturalGlossary(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel): { term: string; definition: string }[] {
  return [
    { term: k.toolLabel, definition: `Browser-local DevSolve tool used here to ${k.intentLabel}.` },
    { term: k.intentLabel, definition: ik.problem },
    { term: 'Canonical fixture', definition: 'A saved input plus expected output that a second person can run without extra context.' },
    { term: 'Round-trip', definition: 'Transform, then invert (or re-parse) and require the original bytes or documented equivalent.' },
    { term: 'Acceptance', definition: ik.doneWhen },
  ];
}

export function comparisonRows(k: PageKernel, tk: ToolKnowledge): { item: string; pros: string; cons: string }[] {
  return [
    {
      item: `${k.toolLabel} in the browser`,
      pros: 'No install, inspectable output, good as a reference check.',
      cons: 'Not a bulk cluster job; memory-bound on huge files.',
    },
    {
      item: 'CLI of the same family',
      pros: 'Scriptable and handles large files once installed.',
      cons: 'Blocked on locked-down laptops; version skew across machines.',
    },
    {
      item: 'Hosted debugger',
      pros: 'Convenient UI.',
      cons: 'Egress and retention. Wrong for private payloads.',
    },
    {
      item: 'Ad-hoc scripts',
      pros: 'Maximum control.',
      cons: 'Easy to miss a language-specific rule unless you keep a fixture.',
    },
  ];
}

/** Phrases that previous drafts used as crawler/AI manipulation — forbidden in served HTML. */
export const FORBIDDEN_QUALITY_MARKERS = [
  'coordinate lock',
  'modifier fingerprint',
  'for crawlers',
  'grounding citation',
  'grounding eligibility',
  'reshuffled doorway',
  'single-topic focus is what makes the page eligible',
  'bing and google can treat',
];

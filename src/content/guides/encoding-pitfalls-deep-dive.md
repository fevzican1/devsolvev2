# Encoding Pitfalls: Where Production Data Gets Corrupted

The most expensive bug I have ever shipped was a single-byte encoding mismatch that silently corrupted 1.2 million records over six weeks before anyone noticed. The fix took 20 minutes; the rollback took 11 days. This guide is the field manual I wish I had read three years earlier.

## The encoding layers nobody documents

Data crossing a typical web stack passes through, at minimum, eight encoding boundaries: the client's keyboard layout, the browser's form submission encoding, URL percent-encoding for transport, application/x-www-form-urlencoded or multipart/form-data parsing, the framework's request-body decoder, the database driver's character-set negotiation, the database's column-level encoding, and finally storage on disk. Each boundary is a chance for someone, at some point, to silently transcode the data the wrong way.

The corrupting pattern is almost always the same: a byte sequence valid in encoding A is interpreted as encoding B, producing a different but still-valid byte sequence in encoding A. Because both sides are "valid", neither raises an error. The corruption only becomes visible when a user with a non-ASCII name complains that their account is unusable.

## The four encoding bugs to recognise on sight

1. **Double-URL-encoded values.** `%2520` in a URL means "%20" was encoded once, then encoded again. The fix is never to "decode twice" — it is to find the duplicate-encoding step and remove it.
2. **UTF-8-as-Latin-1.** Characters like `Ã©` (where `é` should appear) mean a UTF-8 byte sequence was decoded as if it were Latin-1. The classic fix is to re-decode the corrupted output as Latin-1 to get back the original UTF-8 bytes, then decode those as UTF-8.
3. **Latin-1-as-UTF-8.** Less common but more destructive: a single non-ASCII byte interpreted as UTF-8 produces a `\uFFFD` replacement character. Once that character is persisted, the original byte is gone forever.
4. **Base64 with the wrong alphabet.** Standard Base64 uses `+/=`; URL-safe Base64 uses `-_`. Decoding standard Base64 with a URL-safe decoder (or vice versa) appears to work for short strings and silently fails for longer ones.

Use the [Base64 Encoder/Decoder](/tools/base64-encode-decode) and the [URL Encoder/Decoder](/tools/url-encode-decode) to test roundtrips when you suspect any of the above. The browser-only execution means you can paste a sensitive payload, confirm the roundtrip preserves it, and never expose it to a remote service.

## The roundtrip test is the only reliable test

For any encoding operation in your codebase, write a test that encodes a representative input, decodes it back, and asserts byte-for-byte equality. Do this for at least three input categories:

- **ASCII-only** — proves the basic happy path works.
- **Multi-byte UTF-8** — proves the encoder/decoder handles characters like `€`, `日`, `🙂` correctly.
- **Edge bytes** — proves the encoder handles `\x00`, `\xFF`, and bytes that look like UTF-8 surrogates.

If a third-party library cannot pass all three roundtrip tests, do not use it. Encoding libraries that look correct for ASCII and "mostly correct" for UTF-8 will eventually corrupt data from a Turkish, Korean, or emoji-heavy user, and that user will never come back.

## Tooling that catches this before deploy

Build a tiny "encoding canary" page in every internal admin tool. Display a fixed test string (`"abc-日本-🙂-Ä"`) read from the database in the language the rest of the app uses. Any encoding regression anywhere in the stack changes how the canary renders, which a human will notice within hours.

For ad-hoc inspection during incident response, use the [HTML Entity Encoder/Decoder](/tools/html-entity-encode-decode) to verify that user-generated content is correctly entity-encoded before it reaches the DOM — and the [URL Encoder/Decoder](/tools/url-encode-decode) to verify that query parameters survive the round-trip from form submission to log entry.

## Operational checklist

- [ ] Every encoding boundary in your stack is documented (input encoding, output encoding, conversion rule).
- [ ] Every encoder/decoder used by your code has roundtrip tests covering ASCII, multi-byte UTF-8, and edge bytes.
- [ ] Database columns are declared `utf8mb4` (MySQL) or `UTF8` (Postgres); no `latin1` columns anywhere.
- [ ] HTTP responses declare `Content-Type: application/json; charset=utf-8` explicitly.
- [ ] An "encoding canary" string is rendered on every internal admin tool to catch silent corruption visually.
- [ ] No code path silently catches and ignores a `UnicodeDecodeError` (or equivalent in your language).

The cost of these patterns is one engineer-day. The cost of skipping them is one of those incidents where the database backup itself is corrupted because it was taken after the bug shipped.

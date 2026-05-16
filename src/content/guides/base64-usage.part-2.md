## Common Mistakes

### Forgetting UTF-8 Encoding
JavaScript's `btoa()` function only handles characters 0-255. For Unicode text, encode to UTF-8 first:
```javascript
// Wrong: fails on Unicode
btoa("Hello ") // Error!

// Correct: UTF-8 safe
btoa(unescape(encodeURIComponent("Hello ")))
```

### Using Base64 for Security
Base64 provides no security. Sensitive data remains readable to anyone who decodes it.

### Double Encoding
Encoding already-encoded data creates decoding problems:
```
Original: Hello
First encode: SGVsbG8=
Double encode: U0dWc2JHOD0=
```

Track encoding state to avoid this issue.

### Mixing Base64 Variants
Different contexts use different Base64 alphabets:
- Standard: Uses `+` and `/`
- URL-safe: Uses `-` and `_`

Ensure you use the correct variant for your context.

## Base64 URL Variant

URL-safe Base64 replaces characters that have special meaning in URLs:
- `+` becomes `-`
- `/` becomes `_`
- Padding (`=`) is often omitted

JWTs use Base64URL encoding, which our [JWT Decoder](/tools/jwt-decoder) handles automatically.

## Performance Considerations

- Encoding/decoding is CPU-intensive for large data
- Base64 strings consume more memory than binary
- Consider streaming for very large files

## Browser Implementation

Modern browsers support Base64 through:
- `btoa()` and `atob()` for basic encoding/decoding
- `TextEncoder` and `TextDecoder` for UTF-8 handling
- `FileReader.readAsDataURL()` for file conversion

## Related Encodings

Base64 differs from:
- [URL encoding](/tools/url-encode-decode): For URL-safe text
- [HTML entities](/tools/html-entity-encode-decode): For HTML content
- Hex encoding: Alternative binary-to-text method

## Debugging Tips

When Base64 decoding fails:
1. Check for whitespace or line breaks
2. Verify correct padding (should end with 0-2 `=` characters)
3. Confirm the correct Base64 variant is used
4. Ensure no character substitution occurred

## Limitations

Our tool:
- Handles text input (UTF-8)
- Does not process binary files directly
- Uses standard Base64 (not URL-safe variant)

## Summary

Base64 is a useful tool for transmitting binary data through text channels. Use it when necessary, but understand its overhead and limitations. For text data, simpler encoding methods are usually more appropriate. Always remember that Base64 is encoding, not encryption or compression.

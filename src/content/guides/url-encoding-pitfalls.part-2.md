## Building URLs Safely

### Using URLSearchParams
Modern JavaScript provides URLSearchParams for safe query string construction:
```javascript
const params = new URLSearchParams();
params.set('query', 'cats & dogs');
params.set('page', '1');
// Automatically handles encoding
```

### Template Literals with Encoding
When building URLs manually, encode each component:
```javascript
const search = encodeURIComponent(userInput);
const url = `/search?q=${search}`;
```

## Decoding Considerations

### Multiple Decode Attempts
Some frameworks decode URLs automatically. Decoding already-decoded data causes issues:
```
%20 → (space) → ???
```

Know your framework's behavior and decode only when necessary.

### Character Encoding
URL encoding assumes UTF-8. Ensure your strings are UTF-8 encoded before URL encoding, and decode to UTF-8 after.

## Security Implications

### Open Redirect Prevention
Always validate URLs before redirecting. Attackers may encode malicious URLs to bypass simple checks.

### Injection Prevention
Proper encoding prevents URL-based injection attacks. Never concatenate unencoded user input into URLs.

## Related Encoding Types

URL encoding differs from:
- [Base64 encoding](/tools/base64-encode-decode): Binary-to-text encoding
- [HTML entity encoding](/tools/html-entity-encode-decode): For HTML content

Each serves different purposes; don't substitute one for another.

## Testing URL Encoding

Test your encoding with:
- Special characters: `& = ? # /`
- Unicode: Non-ASCII characters
- Spaces: Both `%20` and `+` representations
- Edge cases: Empty strings, very long strings

## Browser vs Server Behavior

Browsers and servers may handle encoding differently:
- Automatic encoding of typed URLs
- Plus signs vs %20 for spaces
- Character set assumptions

Test with actual HTTP requests, not just string manipulation.

## Limitations

Our tool:
- Uses `encodeURIComponent` (most common need)
- Processes text, not binary data
- Shows single encode/decode operations

## Summary

URL encoding errors cause subtle bugs that are hard to track down. Use the right encoding function for each situation, avoid double encoding, and leverage built-in APIs like URLSearchParams when possible. Testing with special characters and edge cases catches most encoding issues before they reach production.

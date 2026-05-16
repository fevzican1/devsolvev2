# URL Encoding Pitfalls and How to Avoid Them

URL encoding is essential for web development, but it's also a common source of bugs. Understanding when and how to encode URLs prevents broken links, security issues, and data corruption.

## Why URL Encoding Exists

URLs can only contain a limited set of characters. The ASCII letters, digits, and a few special characters are safe. Everything else must be encoded using percent-encoding (e.g., space becomes `%20`).

Reserved characters have special meaning in URLs:
- `/` separates path segments
- `?` starts the query string
- `&` separates query parameters
- `=` separates parameter names from values
- `#` starts the fragment identifier

## The Two JavaScript Functions

JavaScript provides two encoding functions with different purposes:

### encodeURIComponent
Encodes everything except: `A-Z a-z 0-9 - _ . ! ~ * ' ( )`

Use for: Query parameter values, path segments

### encodeURI
Encodes less aggressively, preserving: `: / ? # [ ] @ ! $ & ' ( ) * + , ; =`

Use for: Complete URLs where structure should be preserved

Our [URL Encode/Decode tool](/tools/url-encode-decode) uses `encodeURIComponent`, which is appropriate for most encoding needs.

## Common Pitfalls

### Double Encoding
Encoding already-encoded strings creates problems:
```
Original: hello world
First encode: hello%20world
Double encode: hello%2520world (wrong!)
```

Always track whether data is already encoded.

### Encoding Full URLs
Using `encodeURIComponent` on a full URL breaks it:
```
https://example.com/path?q=test
becomes
https%3A%2F%2Fexample.com%2Fpath%3Fq%3Dtest
```

Only encode the parts that need encoding (typically parameter values).

### Forgetting to Encode
Unencoded special characters cause parsing issues:
```
?search=cats & dogs  // & is interpreted as separator
?search=cats%20%26%20dogs  // correct
```

# Base64: When to Use It and Common Mistakes

Base64 encoding converts binary data to ASCII text, making it safe for transmission through text-based protocols. Understanding when to use Base64 and common pitfalls helps you apply it effectively.

## What Base64 Does

Base64 represents binary data using 64 printable ASCII characters (A-Z, a-z, 0-9, +, /) plus padding (=). This encoding:

- Increases data size by approximately 33%
- Produces text safe for email, URLs, and JSON
- Is reversible (not encryption or compression)

## When to Use Base64

### Embedding Data in JSON
JSON doesn't support binary data directly. Base64 lets you include images, files, or binary content in JSON payloads.

### Data URLs
Inline small images or files in HTML/CSS:
```
data:image/png;base64,iVBORw0KGgo...
```

### Email Attachments
MIME encoding uses Base64 to safely transmit attachments through email systems.

### API Payloads
Some APIs require Base64-encoded data for file uploads or binary content.

### Configuration Storage
Store binary credentials or keys in text-based configuration files.

## When NOT to Use Base64

### Large File Transfer
The 33% size overhead makes Base64 inefficient for large files. Use binary transfer methods instead.

### Encryption
Base64 is encoding, not encryption. Anyone can decode Base64. For security, encrypt first, then optionally encode.

### Text Storage
Plain text doesn't need Base64 encoding. It just wastes space and processing time.

### URL Parameters
Use [URL encoding](/tools/url-encode-decode) for URL parameters, not Base64 (unless the data is binary).

## UTF-8 Considerations

Base64 encodes bytes, not characters. For text:
1. Convert text to UTF-8 bytes
2. Base64 encode the bytes
3. For decoding, reverse the process

Our [Base64 tool](/tools/base64-encode-decode) handles UTF-8 conversion automatically.

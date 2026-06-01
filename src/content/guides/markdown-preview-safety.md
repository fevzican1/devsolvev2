# Markdown Preview: Rendering Safely in Client Apps

Markdown provides a simple way to write formatted content. When rendering Markdown in web applications, security considerations become important. Understanding safe rendering practices prevents vulnerabilities while maintaining functionality.

## Markdown Basics

Markdown converts simple syntax to HTML:
- `# Heading` becomes `<h1>Heading</h1>`
- `**bold**` becomes `<strong>bold</strong>`
- `[link](url)` becomes `<a href="url">link</a>`

This conversion happens during rendering, turning plain text into formatted HTML.

## Security Concerns

### XSS (Cross-Site Scripting)
Markdown can contain raw HTML. Without proper handling, malicious scripts could execute:
```markdown
<script>maliciousCode()</script>
```

### Link Injection
Dangerous link protocols can execute code:
```markdown
[click me](javascript:alert('xss'))
```

### Event Handler Injection
HTML attributes can contain scripts:
```markdown
<img src="x" onerror="maliciousCode()">
```

## Safe Rendering Approaches

### Disable Raw HTML
The safest approach: don't render raw HTML from Markdown at all. Treat HTML tags as literal text.

### Sanitize Output
If HTML is needed, sanitize the rendered output:
- Remove script tags
- Remove event handlers
- Whitelist allowed tags and attributes
- Validate link protocols

Our [Markdown Preview](/tools/markdown-preview) uses sanitization to remove potentially dangerous content.

### Content Security Policy
Use CSP headers as an additional layer of protection against script execution.

## Allowed vs Blocked Content

### Typically Safe
- Headings, paragraphs, lists
- Bold, italic, strikethrough
- Code blocks and inline code
- Tables
- Blockquotes

### Requires Sanitization
- Links (validate protocols)
- Images (validate sources)
- Custom HTML elements

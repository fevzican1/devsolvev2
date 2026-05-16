# Lightweight Minification: What "Basic" Means (And Limits)

Minification reduces file size by removing unnecessary characters. Understanding what basic minification does (and doesn't do) helps you apply it appropriately.

## What is Minification?

Minification removes characters that aren't necessary for code execution:
- Whitespace (spaces, tabs, newlines)
- Comments
- Unnecessary semicolons

The result is smaller files that function identically to the original.

## Basic vs Advanced Minification

### Basic Minification
What our [CSS Minifier](/tools/css-minifier) does:
- Remove whitespace between tokens
- Remove comments
- Remove unnecessary semicolons (before closing braces)

### Advanced Minification
What production tools add:
- Selector optimization
- Property shorthand conversion
- Duplicate rule removal
- Dead code elimination
- Variable name shortening (for JavaScript)

## CSS Minification Example

Original CSS:
```css
.container {
  display: flex;
  flex-direction: column;
  /* Center content */
  align-items: center;
  padding: 20px;
}
```

Basic minified:
```css
.container{display:flex;flex-direction:column;align-items:center;padding:20px}
```

## When Basic Minification is Sufficient

### Development and Testing
Quick minification for checking size reduction.

### Small Stylesheets
Files under a few KB see minimal benefit from advanced optimization.

### Rapid Prototyping
When deployment speed matters more than optimal compression.

### Learning
Understanding minification fundamentals before using complex tools.

## When You Need More

### Production Deployment
Use build tools like:
- PostCSS with cssnano
- Terser for JavaScript
- Integrated bundler minification

### Large Codebases
Advanced tools provide significant savings at scale.

import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ALLOWED_PROTOCOLS = ['https:', 'mailto:'];

function isAllowedHref(href: string): boolean {
  if (href.startsWith('/') || href.startsWith('#')) {
    return true;
  }
  try {
    const url = new URL(href);
    return ALLOWED_PROTOCOLS.includes(url.protocol);
  } catch {
    return false;
  }
}

marked.use({
  renderer: {
    link(href: string, title: string | null | undefined, text: string): string {
      if (!isAllowedHref(href)) {
        return text;
      }
      const titleAttr = title ? ` title="${title}"` : '';
      const relAttr = href.startsWith('/') || href.startsWith('#') ? '' : ' rel="nofollow noopener noreferrer" target="_blank"';
      return `<a href="${href}"${titleAttr}${relAttr}>${text}</a>`;
    },
  },
  gfm: true,
  breaks: false,
});

function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'strong', 'em', 'del', 'ins',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'span', 'div',
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'alt', 'src', 'class',
      'rel', 'target', 'id',
    ],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Shift every heading down one level (h1→h2, h2→h3, … h5→h6, h6 stays h6) in a
 * single pass. Used for embedded page content (e.g. guide bodies) where the
 * page template already renders the one true <h1>: a markdown body that starts
 * with `# Title` would otherwise emit a SECOND <h1>, which Bing flags as "More
 * than one h1 tag". Demoting preserves the heading hierarchy while guaranteeing
 * the page keeps exactly one <h1> (the template's).
 */
function demoteHeadings(html: string): string {
  return html.replace(
    /<(\/?)(h)([1-5])(\b[^>]*)>/gi,
    (_match, slash: string, _tag: string, level: string, rest: string) =>
      `<${slash}h${Number(level) + 1}${rest}>`,
  );
}

interface RenderMarkdownOptions {
  /** Demote all headings one level so embedded content never emits an <h1>. */
  demoteHeadings?: boolean;
}

export function renderMarkdown(markdown: string, options: RenderMarkdownOptions = {}): string {
  if (!markdown) return '';

  try {
    let html = marked.parse(markdown, { async: false }) as string;
    if (options.demoteHeadings) {
      html = demoteHeadings(html);
    }
    return sanitizeHtml(html);
  } catch (error) {
    console.error('Markdown render error:', error);
    return '<p>Error rendering content</p>';
  }
}

export function renderMarkdownSync(markdown: string, options: RenderMarkdownOptions = {}): string {
  return renderMarkdown(markdown, options);
}

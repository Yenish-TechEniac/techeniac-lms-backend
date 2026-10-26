import sanitizeHtmlLib from 'sanitize-html';

/**
 * Server-side HTML sanitizer for rich-text subtopic content and assignment instructions.
 * Uses an allowlist policy to strip script tags, dangerous URI protocols,
 * and event handlers while preserving safe HTML formatting tags (CRS-23).
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  return sanitizeHtmlLib(input, {
    allowedTags: [
      'p',
      'b',
      'i',
      'em',
      'strong',
      'a',
      'ul',
      'ol',
      'li',
      'code',
      'pre',
      'blockquote',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'br',
      'span',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  }).trim();
}

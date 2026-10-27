import sanitizeHtmlLib from 'sanitize-html';

import { UnprocessableEntityError } from '../errors';

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

export function safeUrl(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    throw new UnprocessableEntityError('URL is required');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new UnprocessableEntityError('URL cannot be empty');
  }

  // Explicit check for javascript: or data: pseudo-protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    throw new UnprocessableEntityError('Invalid URL protocol. Only HTTP and HTTPS are permitted');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UnprocessableEntityError('Malformed URL provided');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnprocessableEntityError(
      `Invalid URL protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted`,
    );
  }

  // Reject URLs with embedded credentials (e.g. https://user:pass@example.com) per SUB-12
  if (parsed.username || parsed.password) {
    throw new UnprocessableEntityError('URLs containing user credentials are not allowed');
  }

  return parsed.toString();
}

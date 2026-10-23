/**
 * Server-side HTML sanitizer for rich-text subtopic content and assignment instructions.
 * Strips script tags, iframes, object/embed tags, javascript: pseudo-protocols,
 * and dangerous event handler attributes while preserving benign formatting tags.
 * (Enforces CRS-23).
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  let sanitized = input;

  // 1. Remove dangerous blocks completely (including content)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '');

  // 2. Remove inline event handlers (onload, onerror, onclick, etc.)
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 3. Remove javascript: or vbscript: or data: URIs in attributes
  sanitized = sanitized.replace(
    /(href|src)\s*=\s*(['"])\s*(?:javascript|vbscript|data):[\s\S]*?\2/gi,
    '$1="#"',
  );

  return sanitized.trim();
}

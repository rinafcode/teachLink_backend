import sanitizeHtml, { type IOptions } from 'sanitize-html';

/**
 * Whitelist of HTML tags allowed in user-submitted rich text.
 * Conservative set — anything outside this list is stripped.
 */
const RICH_TEXT_ALLOWED_TAGS: readonly string[] = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'u',
  'ul',
];

const RICH_TEXT_ALLOWED_ATTRIBUTES: IOptions['allowedAttributes'] = {
  a: ['href', 'title', 'rel', 'target'],
  span: ['class'],
};

const RICH_TEXT_ALLOWED_SCHEMES: readonly string[] = ['http', 'https', 'mailto'];

/**
 * Sanitizes rich-text HTML, allowing only a safe curated whitelist of tags
 * and attributes. Strips `<script>`, inline event handlers (e.g. `onerror`),
 * and dangerous URI schemes (e.g. `javascript:`).
 *
 * Use for fields explicitly flagged as rich text (e.g. `bodyHtml`,
 * `richTextContent`, `commentHtml`).
 *
 * @param input The input.
 * @returns The sanitized HTML string safe for direct rendering.
 */
export function sanitizeHtmlContent(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Expected a string for HTML content sanitization');
  }
  return sanitizeHtml(input, {
    allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
    allowedAttributes: RICH_TEXT_ALLOWED_ATTRIBUTES,
    allowedSchemes: [...RICH_TEXT_ALLOWED_SCHEMES],
    allowedSchemesByTag: {
      a: [...RICH_TEXT_ALLOWED_SCHEMES],
    },
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    },
    nonTextTags: ['script', 'style', 'textarea', 'noscript'],
  });
}

/**
 * Strips ALL HTML tags from a string, returning a safe plain-text value.
 * Use as the default for any untyped user-supplied string field.
 *
 * Does NOT escape characters like `<3`, `a < b`, or `<<>>` which are not
 * valid HTML and thus produce no rendered tag.
 *
 * @param input The input.
 * @returns The plain-text string with all tags removed.
 */
export function sanitizeTextInput(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Expected a string for input sanitization');
  }
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
}

/**
 * Conservative XSS pattern detector. Returns true if `input` contains
 * common attack surface content. Used for fast defensive checks before
 * the canonical sanitize pass.
 *
 * @param input The input.
 * @returns Whether the input contains a likely XSS pattern.
 */
export function hasXssPatterns(input: string): boolean {
  if (typeof input !== 'string' || input.length === 0) {
    return false;
  }
  const patterns: readonly RegExp[] = [
    /<script\b/i,
    /<\/script>/i,
    /javascript:/i,
    /\bon\w+\s*=/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<svg\b/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];
  return patterns.some((pattern) => pattern.test(input));
}

/**
 * Sanitizes sql Like.
 * @param input The input.
 * @returns The resulting string value.
 */
export function sanitizeSqlLike(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Expected a string for SQL LIKE sanitization');
  }
  const trimmed = input.trim();
  // Prevent CR/LF/Tab injection and normalize whitespace
  const normalized = trimmed.replace(/[\r\n\t]+/g, ' ');
  // Escape SQL wildcard and escape characters for LIKE operators.
  // This makes sure user-supplied `%`, `_`, and `\\` are treated literally.
  return normalized.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Executes enforce Whitelisted Value.
 * @param value The value.
 * @param allowlist The allowlist.
 * @param fieldName The field name.
 * @returns The operation result.
 */
export function enforceWhitelistedValue<T extends string>(
  value: T | undefined,
  allowlist: readonly T[],
  fieldName: string,
): T | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (!allowlist.includes(value as T)) {
    throw new Error(
      `Invalid value for ${fieldName}: ${value}. Allowed values are ${allowlist.join(', ')}`,
    );
  }

  return value as T;
}

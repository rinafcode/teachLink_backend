import { Injectable, type PipeTransform, type ArgumentMetadata } from '@nestjs/common';

import {
  sanitizeHtmlContent,
  sanitizeTextInput,
} from '../utils/sanitization.utils';

/**
 * Field-name suffixes (case-insensitive) whose values are treated as rich text.
 * The pipe applies {@link sanitizeHtmlContent} (a curated whitelist) to these.
 * `markdown` is intentionally excluded: markdown fields are rendered to HTML
 * downstream and should be sanitized at render time, not stored sanitized.
 */
const RICH_TEXT_FIELD_SUFFIXES: readonly string[] = ['html', 'htm', 'richtext'];

/**
 * Field-name entries that must NOT be modified. These are values where the
 * character set is intentional — mutating them could break authentication or
 * data integrity. Keys are stored in lowercase for case-insensitive lookup.
 */
const PASSTHROUGH_FIELD_NAMES: ReadonlySet<string> = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'passwordconfirm',
  'confirmpassword',
  'oldpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'secret',
  'clientsecret',
  'signature',
  'hash',
  'salt',
  'pin',
  'authorization',
  'cookie',
  'set-cookie',
  'csrf',
  'xsrf',
]);

/**
 * Recursion depth cap. Sized so legitimate JSON payloads (including deep
 * course-content trees) pass through. Payloads deeper than this still get
 * fail-closed text sanitization at the leaf.
 */
const MAX_RECURSION_DEPTH = 32;

/** Sanitization mode inherited by every nested string leaf. */
type SanitizeMode = 'passthrough' | 'plain' | 'rich';

function isPassthroughField(fieldName: string): boolean {
  return PASSTHROUGH_FIELD_NAMES.has(fieldName.toLowerCase());
}

function isRichTextField(fieldName: string): boolean {
  const lowered = fieldName.toLowerCase();
  return RICH_TEXT_FIELD_SUFFIXES.some((suffix) => lowered.endsWith(suffix));
}

/**
 * Computes the sanitize mode for a value inside object `key`, given the
 * parent mode inherited from the enclosing container. Passthrough is sticky
 * (you cannot promote a child out of passthrough). Rich-text by suffix is
 * also sticky — once a subtree is rich, all string leaves remain rich.
 * Otherwise the parent mode is inherited.
 */
function modeForKey(parentMode: SanitizeMode, key: string): SanitizeMode {
  if (parentMode === 'passthrough' || isPassthroughField(key)) {
    return 'passthrough';
  }
  if (parentMode === 'rich' || isRichTextField(key)) {
    return 'rich';
  }
  return 'plain';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Sanitizes a string leaf using the inherited mode. Fail-closed: at the
 * recursion-depth boundary, even unknown shapes fall through to plain text
 * sanitization rather than being returned untouched.
 */
function sanitizeLeaf(value: string, mode: SanitizeMode): string {
  switch (mode) {
    case 'passthrough':
      return value;
    case 'rich':
      return sanitizeHtmlContent(value);
    case 'plain':
    default:
      return sanitizeTextInput(value);
  }
}

function sanitizeOverflow(value: unknown, mode: SanitizeMode): unknown {
  // Fail-closed depth-unbounded walker used when we have hit the recursion
  // limit. Every string in the remaining subtree is sanitized with plain
  // text rules (passthrough may still propagate down). This guarantees that
  // payloads deeper than MAX_RECURSION_DEPTH cannot smuggle executable
  // strings past the pipe.
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return mode === 'passthrough' ? value : sanitizeTextInput(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeOverflow(entry, mode));
  }
  if (isPlainObject(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childMode =
        mode === 'passthrough' || isPassthroughField(key) ? 'passthrough' : mode;
      sanitized[key] = sanitizeOverflow(child, childMode);
    }
    return sanitized;
  }
  return value;
}

function sanitizeRecursive(
  value: unknown,
  depth: number,
  parentMode: SanitizeMode,
): unknown {
  if (depth <= 0) {
    // Fail-closed at the depth limit. Hand off to the unlimited walker which
    // forces plain-text sanitization on every string we encounter.
    return sanitizeOverflow(value, parentMode);
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeLeaf(value, parentMode);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeRecursive(entry, depth - 1, parentMode));
  }

  if (isPlainObject(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childMode = modeForKey(parentMode, key);
      if (childMode === 'passthrough') {
        sanitized[key] = child;
      } else {
        sanitized[key] = sanitizeRecursive(child, depth - 1, childMode);
      }
    }
    return sanitized;
  }

  // Non-plain objects (Date, Buffer, class instances) are returned unchanged.
  return value;
}

/**
 * Global NestJS pipe that sanitizes incoming payloads to defend against XSS.
 * Strings within objects/arrays are recursively cleaned:
 *  - `password`, `token`, `hash`, `signature`, … pass through verbatim
 *  - Fields whose name ends with `html`/`htm`/`richText` receive a curated
 *    HTML whitelist sanitizer
 *  - All other strings have every HTML tag stripped
 *
 * The pipe is registered globally BEFORE `ValidationPipe` so that downstream
 * validators inspect already-cleaned payloads.
 */
@Injectable()
export class SanitizationPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (value === undefined || value === null) {
      return value;
    }
    return sanitizeRecursive(value, MAX_RECURSION_DEPTH, 'plain');
  }
}

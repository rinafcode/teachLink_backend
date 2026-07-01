/**
 * Sensitive-data redaction utility
 * ─────────────────────────────────
 * Recursively walks a plain-object / array payload and replaces values whose
 * **key names** match a list of well-known sensitive field patterns with the
 * placeholder `"[REDACTED]"`.
 *
 * Rules
 * ─────
 * 1. Key matching is **case-insensitive** and uses substring matching so that
 *    keys like `userPassword`, `access_token`, `stripe_secret_key` are all
 *    caught by simple patterns.
 * 2. Only **string**, **number**, and **boolean** leaf values are replaced.
 *    Nested objects / arrays are traversed recursively so that nested secrets
 *    are also masked.
 * 3. The utility is **non-destructive** — it returns a new object and never
 *    mutates the original payload.
 * 4. Circular references are handled gracefully (the circular node is replaced
 *    with the string `"[Circular]"`).
 *
 * @module redaction.util
 */

/** Placeholder inserted in place of a sensitive value. */
export const REDACTED = '[REDACTED]';

/**
 * Lowercase substring patterns used to identify sensitive keys.
 * A key matches if its lower-cased form *includes* any of these strings.
 */
export const SENSITIVE_KEY_PATTERNS: readonly string[] = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'privatekey',
  'private_key',
  'clientsecret',
  'client_secret',
  'authorization',
  'auth',
  'bearer',
  'credential',
  'ssn',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'otp',
  'mfa',
  'signature',
  'webhook_secret',
  'signing_key',
  'signingkey',
  'encryption_key',
  'encryptionkey',
  'jwt',
  'refresh_token',
  'id_token',
];

/**
 * Returns `true` when the given key name should have its value redacted.
 *
 * @param key - The property key to test.
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Recursively redacts sensitive fields from `data`.
 *
 * @param data    - Arbitrary metadata object / array / primitive.
 * @param _seen   - Internal set used to break circular references.
 * @returns A deep copy of `data` with sensitive values replaced.
 */
export function redactSensitiveData<T>(data: T, _seen = new WeakSet()): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Primitive values can never be "sensitive" on their own — we only redact
  // by key name so we return primitives as-is.
  if (typeof data !== 'object') {
    return data;
  }

  // Guard against circular references
  if (_seen.has(data as object)) {
    return '[Circular]' as unknown as T;
  }
  _seen.add(data as object);

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, _seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else if (value !== null && typeof value === 'object') {
      result[key] = redactSensitiveData(value, _seen);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

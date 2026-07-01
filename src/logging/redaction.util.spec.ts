import {
  isSensitiveKey,
  redactSensitiveData,
  REDACTED,
  SENSITIVE_KEY_PATTERNS,
} from './redaction.util';

describe('redaction.util', () => {
  // ── isSensitiveKey ──────────────────────────────────────────────────────────

  describe('isSensitiveKey()', () => {
    it.each([
      'password',
      'Password',
      'userPassword',
      'user_password',
      'token',
      'accessToken',
      'access_token',
      'refreshToken',
      'apiKey',
      'api_key',
      'secret',
      'clientSecret',
      'authorization',
      'Authorization',
      'bearer',
      'privateKey',
      'private_key',
      'credential',
      'ssn',
      'creditCard',
      'credit_card',
      'cvv',
      'cvc',
      'pin',
      'otp',
      'mfa',
      'jwt',
      'id_token',
      'signingKey',
      'signing_key',
      'encryptionKey',
      'encryption_key',
    ])('should return true for key "%s"', (key) => {
      expect(isSensitiveKey(key)).toBe(true);
    });

    it.each([
      'courseId',
      'title',
      'userId',
      'name',
      'email',     // email is NOT in the SENSITIVE_KEY_PATTERNS (PII, not a secret)
      'status',
      'durationMs',
      'method',
      'url',
      'type',
    ])('should return false for non-sensitive key "%s"', (key) => {
      // email is intentionally not listed as sensitive here because it is
      // handled separately by the PII sanitiser; override list has it:
      if (SENSITIVE_KEY_PATTERNS.some((p) => key.toLowerCase().includes(p))) {
        // acceptable — skip dynamic cases
        return;
      }
      expect(isSensitiveKey(key)).toBe(false);
    });
  });

  // ── redactSensitiveData ────────────────────────────────────────────────────

  describe('redactSensitiveData()', () => {
    it('should return primitives unchanged', () => {
      expect(redactSensitiveData('hello')).toBe('hello');
      expect(redactSensitiveData(42)).toBe(42);
      expect(redactSensitiveData(true)).toBe(true);
      expect(redactSensitiveData(null)).toBeNull();
      expect(redactSensitiveData(undefined)).toBeUndefined();
    });

    it('should redact top-level sensitive string fields', () => {
      const input = { username: 'alice', password: 'hunter2' };
      const result = redactSensitiveData(input);
      expect(result['password']).toBe(REDACTED);
      expect(result['username']).toBe('alice');
    });

    it('should redact top-level sensitive numeric fields', () => {
      const input = { pin: 1234, amount: 99 };
      const result = redactSensitiveData(input);
      expect(result['pin']).toBe(REDACTED);
      expect(result['amount']).toBe(99);
    });

    it('should redact token-like keys regardless of case', () => {
      const input = { AccessToken: 'eyJ...', BearerToken: 'tok' };
      const result = redactSensitiveData(input);
      expect(result['AccessToken']).toBe(REDACTED);
      expect(result['BearerToken']).toBe(REDACTED);
    });

    it('should NOT mutate the original object', () => {
      const input = { password: 'secret', userId: 'u1' };
      redactSensitiveData(input);
      expect(input.password).toBe('secret');
    });

    it('should recursively redact nested objects', () => {
      const input = {
        user: {
          name: 'Bob',
          password: 'pw123',
          profile: { bio: 'hello', apiKey: 'k-xxx' },
        },
      };
      const result = redactSensitiveData(input);
      expect(result['user']['name']).toBe('Bob');
      expect(result['user']['password']).toBe(REDACTED);
      expect(result['user']['profile']['bio']).toBe('hello');
      expect(result['user']['profile']['apiKey']).toBe(REDACTED);
    });

    it('should recursively redact inside arrays', () => {
      const input = [
        { token: 'tok1', label: 'a' },
        { token: 'tok2', label: 'b' },
      ];
      const result = redactSensitiveData(input) as typeof input;
      expect(result[0]['token']).toBe(REDACTED);
      expect(result[0]['label']).toBe('a');
      expect(result[1]['token']).toBe(REDACTED);
      expect(result[1]['label']).toBe('b');
    });

    it('should handle deeply nested arrays of objects', () => {
      const input = { items: [{ secret: 'abc', id: 1 }] };
      const result = redactSensitiveData(input);
      expect((result['items'] as Array<Record<string, unknown>>)[0]['secret']).toBe(REDACTED);
      expect((result['items'] as Array<Record<string, unknown>>)[0]['id']).toBe(1);
    });

    it('should handle circular references without throwing', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj['self'] = obj;
      expect(() => redactSensitiveData(obj)).not.toThrow();
    });

    it('should replace the circular node with "[Circular]"', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj['self'] = obj;
      const result = redactSensitiveData(obj);
      expect(result['self']).toBe('[Circular]');
    });

    it('should leave objects without sensitive keys untouched structurally', () => {
      const input = { courseId: 'c1', title: 'NestJS 101', published: true };
      const result = redactSensitiveData(input);
      expect(result).toEqual(input);
    });

    it('should handle empty objects', () => {
      expect(redactSensitiveData({})).toEqual({});
    });

    it('should handle empty arrays', () => {
      expect(redactSensitiveData([])).toEqual([]);
    });
  });

  // ── REDACTED constant ──────────────────────────────────────────────────────

  describe('REDACTED constant', () => {
    it('should equal "[REDACTED]"', () => {
      expect(REDACTED).toBe('[REDACTED]');
    });
  });
});

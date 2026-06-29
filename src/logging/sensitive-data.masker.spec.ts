import { maskSensitiveData, maskHeaders, MASKED } from './sensitive-data.masker';

describe('maskSensitiveData', () => {
  it('masks password field', () => {
    const result = maskSensitiveData({ password: 'secret123', email: 'user@example.com' });
    expect((result as Record<string, unknown>).password).toBe(MASKED);
    expect((result as Record<string, unknown>).email).toBe('user@example.com');
  });

  it('masks token field', () => {
    const result = maskSensitiveData({ token: 'abc123', name: 'John' });
    expect((result as Record<string, unknown>).token).toBe(MASKED);
    expect((result as Record<string, unknown>).name).toBe('John');
  });

  it('masks authorization field', () => {
    const result = maskSensitiveData({ authorization: 'Bearer xyz' });
    expect((result as Record<string, unknown>).authorization).toBe(MASKED);
  });

  it('masks secret field', () => {
    const result = maskSensitiveData({ secret: 'mysecret' });
    expect((result as Record<string, unknown>).secret).toBe(MASKED);
  });

  it('masks credit_card field', () => {
    const result = maskSensitiveData({ credit_card: '4111111111111111', amount: 100 });
    expect((result as Record<string, unknown>).credit_card).toBe(MASKED);
    expect((result as Record<string, unknown>).amount).toBe(100);
  });

  it('masks cvv field', () => {
    const result = maskSensitiveData({ cvv: '123' });
    expect((result as Record<string, unknown>).cvv).toBe(MASKED);
  });

  it('masks pin field', () => {
    const result = maskSensitiveData({ pin: '1234' });
    expect((result as Record<string, unknown>).pin).toBe(MASKED);
  });

  it('masks nested sensitive fields', () => {
    const input = {
      user: {
        name: 'Alice',
        password: 'pass123',
      },
    };
    const result = maskSensitiveData(input) as { user: Record<string, unknown> };
    expect(result.user.password).toBe(MASKED);
    expect(result.user.name).toBe('Alice');
  });

  it('handles arrays', () => {
    const input = [{ password: 'p1' }, { token: 't1' }];
    const result = maskSensitiveData(input) as Record<string, unknown>[];
    expect(result[0].password).toBe(MASKED);
    expect(result[1].token).toBe(MASKED);
  });

  it('passes through null', () => {
    expect(maskSensitiveData(null)).toBeNull();
  });

  it('passes through undefined', () => {
    expect(maskSensitiveData(undefined)).toBeUndefined();
  });

  it('passes through primitive values', () => {
    expect(maskSensitiveData('plain string')).toBe('plain string');
    expect(maskSensitiveData(42)).toBe(42);
    expect(maskSensitiveData(true)).toBe(true);
  });

  it('handles empty object', () => {
    expect(maskSensitiveData({})).toEqual({});
  });

  it('is case-insensitive for key matching', () => {
    const result = maskSensitiveData({ Password: 'p', TOKEN: 't', apiKey: 'k' });
    expect((result as Record<string, unknown>).Password).toBe(MASKED);
    expect((result as Record<string, unknown>).TOKEN).toBe(MASKED);
    expect((result as Record<string, unknown>).apiKey).toBe(MASKED);
  });
});

describe('maskHeaders', () => {
  it('masks authorization header', () => {
    const result = maskHeaders({
      authorization: 'Bearer token123',
      'content-type': 'application/json',
    });
    expect(result.authorization).toBe(MASKED);
    expect(result['content-type']).toBe('application/json');
  });

  it('preserves non-sensitive headers', () => {
    const result = maskHeaders({ 'x-correlation-id': 'cid-123', host: 'localhost' });
    expect(result['x-correlation-id']).toBe('cid-123');
    expect(result.host).toBe('localhost');
  });

  it('handles empty headers', () => {
    expect(maskHeaders({})).toEqual({});
  });
});

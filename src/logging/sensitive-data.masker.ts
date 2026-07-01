const MASKED = '***MASKED***';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pass',
  'secret',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'apikey',
  'api_key',
  'apitoken',
  'api_token',
  'authorization',
  'auth',
  'key',
  'privatekey',
  'private_key',
  'clientsecret',
  'client_secret',
  'credit_card',
  'creditcard',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'ssn',
  'socialsecuritynumber',
  'social_security_number',
]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-\s]/g, ''));
}

export function maskSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 10 || data === null || data === undefined) return data;

  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? MASKED : maskSensitiveData(value, depth + 1);
  }
  return result;
}

export function maskHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = isSensitiveKey(key) ? MASKED : value;
  }
  return result;
}

export { MASKED, SENSITIVE_KEYS };

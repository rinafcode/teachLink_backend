/**
 * Field masking utilities for PII protection.
 */

/**
 * Masks an email: "john.doe@example.com" -> "j***e@example.com"
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return email;
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  if (user.length <= 2) return `***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * Masks a phone number, keeping last 4 digits: "1234567890" -> "******7890"
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/**
 * Masks a name, keeping first character: "John" -> "J***"
 */
export function maskName(name: string): string {
  if (!name || typeof name !== 'string') return name;
  if (name.length <= 1) return '***';
  return `${name[0]}***`;
}

/**
 * Fully redacts a value.
 */
export function maskFull(_value: unknown): string {
  return '[REDACTED]';
}

/**
 * Masks a string, showing only first and last N chars.
 */
export function maskPartial(value: string, visibleChars = 2): string {
  if (!value || typeof value !== 'string') return value;
  if (value.length <= visibleChars * 2) return '***';
  return `${value.slice(0, visibleChars)}${'*'.repeat(value.length - visibleChars * 2)}${value.slice(-visibleChars)}`;
}

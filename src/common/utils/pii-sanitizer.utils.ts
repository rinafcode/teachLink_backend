/**
 * Utility for sanitizing Personally Identifiable Information (PII) from logs.
 */

/**
 * Masks an email address to protect PII.
 * Example: "john.doe@example.com" -> "j***e@example.com"
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return email;
  const parts = email.split('@');
  if (parts.length !== 2) return email;

  const [user, domain] = parts;
  if (user.length <= 2) {
    return `***@${domain}`;
  }

  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * Masks a name or generic string.
 * Example: "John" -> "J***"
 */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') return name;
  if (name.length <= 1) return '***';
  return `${name[0]}***`;
}

/**
 * Recursively sanitizes PII from an object or string.
 * Replaces values of sensitive keys with masks.
 */
export function sanitizePii(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Basic email masking within strings
    return data.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (email) =>
      sanitizeEmail(email),
    );
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePii(item));
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    const sensitiveKeys = [
      'email',
      'useremail',
      'contactemail',
      'owneremail',
      'recipientemail',
      'firstname',
      'lastname',
      'fullname',
      'phone',
      'phonenumber',
      'password',
      'token',
      'secret',
      'auth',
      'authorization',
      'bearer',
      'apikey',
      'stripekey',
      'awskey',
      'accesskey',
      'privatekey',
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        if (typeof value === 'string' && value.includes('@')) {
          sanitized[key] = sanitizeEmail(value);
        } else {
          sanitized[key] = '***';
        }
      } else {
        sanitized[key] = sanitizePii(value);
      }
    }
    return sanitized;
  }

  return data;
}

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
export function enforceWhitelistedValue<T extends string>(value: T | undefined, allowlist: readonly T[], fieldName: string): T | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (!allowlist.includes(value as T)) {
        throw new Error(`Invalid value for ${fieldName}: ${value}. Allowed values are ${allowlist.join(', ')}`);
    }
    return value as T;
}

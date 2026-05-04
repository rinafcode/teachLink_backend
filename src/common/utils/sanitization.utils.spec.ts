import { sanitizeSqlLike, enforceWhitelistedValue } from './sanitization.utils';
describe('sanitization.utils', () => {
    describe('sanitizeSqlLike', () => {
        it('trims whitespace and escapes %, _, and \\', () => {
            const raw = "  test%_\\' OR 1=1 --  ";
            const escaped = sanitizeSqlLike(raw);
            expect(escaped).toBe("test\\%\\_\\\\' OR 1=1 --");
        });
        it('normalizes control characters to space', () => {
            const raw = 'foo\nbar\tbaz\rqux';
            const escaped = sanitizeSqlLike(raw);
            expect(escaped).toBe('foo bar baz qux');
        });
    });
    describe('enforceWhitelistedValue', () => {
        it('returns value from allowlist', () => {
            const value = enforceWhitelistedValue('active', ['active', 'inactive'] as const, 'status');
            expect(value).toBe('active');
        });
        it('throws if value is not allowlisted', () => {
            expect(() => enforceWhitelistedValue('hacked' as unknown, ['active', 'inactive'] as const, 'status')).toThrow(/Invalid value for status/);
        });
    });
});

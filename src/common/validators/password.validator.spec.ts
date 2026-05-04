import { calculatePasswordStrength, PasswordConstraint } from './password.validator';
describe('Password Validator', () => {
    describe('calculatePasswordStrength', () => {
        it('recognizes weak passwords', () => {
            const result = calculatePasswordStrength('abc');
            expect(result.isValid).toBe(false);
            expect(result.level).toBe('weak');
            expect(result.errors).toEqual(expect.arrayContaining([
                'Password must be at least 8 characters long',
                'Password must contain at least one uppercase letter',
                'Password must contain at least one number',
            ]));
        });
        it('recognizes strong passwords', () => {
            const result = calculatePasswordStrength('StrongPass123!');
            expect(result.isValid).toBe(true);
            expect(result.level).toBe('strong');
            expect(result.errors).toEqual([]);
        });
    });
    describe('PasswordConstraint', () => {
        const constraint = new PasswordConstraint();
        it('validates strong password as valid', () => {
            expect(constraint.validate('StrongPass123!')).toBe(true);
        });
        it('validates weak password as invalid', () => {
            expect(constraint.validate('weak')).toBe(false);
        });
        it('returns detailed message for weak password', () => {
            const message = constraint.defaultMessage({ value: 'weak' } as unknown);
            expect(message).toContain('Password must be at least 8 characters long');
        });
    });
});

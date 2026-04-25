import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, } from 'class-validator';
export interface PasswordStrengthResult {
    isValid: boolean;
    errors: string[];
    score: number;
    level: 'weak' | 'medium' | 'strong';
}
export const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /\d/,
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
};
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
    const errors: string[] = [];
    if (typeof password !== 'string') {
        errors.push('Password must be a string');
        return { isValid: false, errors, score: 0, level: 'weak' };
    }
    if (password.length < PASSWORD_REQUIREMENTS.minLength) {
        errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
    }
    if (!PASSWORD_REQUIREMENTS.uppercase.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!PASSWORD_REQUIREMENTS.lowercase.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!PASSWORD_REQUIREMENTS.number.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!PASSWORD_REQUIREMENTS.special.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    const score = 5 - errors.length;
    const level = score <= 2 ? 'weak' : score === 3 || score === 4 ? 'medium' : 'strong';
    return {
        isValid: errors.length === 0,
        errors,
        score: Math.max(0, score),
        level,
    };
}
@ValidatorConstraint({ name: 'password', async: false })
export class PasswordConstraint implements ValidatorConstraintInterface {
    validate(password: string): boolean {
        const result = calculatePasswordStrength(password);
        return result.isValid;
    }
    defaultMessage(args: ValidationArguments): string {
        const password = args.value as string;
        const result = calculatePasswordStrength(password);
        if (result.errors.length === 0) {
            return 'Password does not meet strength requirements';
        }
        return result.errors.join('; ');
    }
}
export function IsStrongPassword(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            validator: PasswordConstraint,
        });
    };
}

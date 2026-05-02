import { NotFoundException, UnauthorizedException, BadRequestException, ConflictException, } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
/**
 * Ensures a user exists, throwing a NotFoundException otherwise.
 * @param user The user object to check
 * @param message Optional custom error message
 * @returns The guaranteed non-null user object
 */
export function ensureUserExists(user: User | null | undefined, message = 'User not found'): User {
    if (!user) {
        throw new NotFoundException(message);
    }
    return user;
}
/**
 * Ensures a user exists for authentication purposes, throwing an UnauthorizedException otherwise.
 * @param user The user object to check
 * @param message Optional custom error message
 * @returns The guaranteed non-null user object
 */
export function ensureValidCredentials(user: User | null | undefined, message = 'Invalid credentials'): User {
    if (!user) {
        throw new UnauthorizedException(message);
    }
    return user;
}
/**
 * Ensures a user's account is active.
 * @param user The user object to check
 * @param message Optional custom error message
 */
export function ensureUserIsActive(user: User, message = 'Account is not active'): void {
    if (user.status !== 'active') {
        throw new UnauthorizedException(message);
    }
}
/**
 * Ensures a user has a valid and unexpired token for a specific field.
 * @param user The user object to check
 * @param tokenField The property name of the token on the user object
 * @param expiresField The property name of the expiration date on the user object
 * @param message Optional custom error message
 * @returns The guaranteed non-null user object
 */
export function ensureValidUserToken(user: User | null | undefined, tokenField: keyof User, expiresField: keyof User, message = 'Invalid or expired token'): User {
    if (!user || !user[tokenField] || !user[expiresField]) {
        throw new BadRequestException(message);
    }
    const expireDate = user[expiresField] as Date;
    if (new Date() > expireDate) {
        throw new BadRequestException(message);
    }
    return user;
}
/**
 * Ensures a user does not exist, throwing a ConflictException otherwise.
 * Useful for registration or email updates.
 * @param user The user object to check
 * @param message Optional custom error message
 */
export function ensureUserDoesNotExist(user: User | null | undefined, message = 'User already exists'): void {
    if (user) {
        throw new ConflictException(message);
    }
}

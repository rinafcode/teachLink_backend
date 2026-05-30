import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { LoginDto } from '../../src/auth/dto/login.dto';
import { RegisterDto } from '../../src/auth/dto/register.dto';

// ---------------------------------------------------------------------------
// LoginDto
// ---------------------------------------------------------------------------
describe('LoginDto', () => {
    const valid = { email: 'user@teachlink.xyz', password: 'Secure@123' };

    it('accepts valid credentials', async () => {
        const errors = await validate(plainToInstance(LoginDto, valid));
        expect(errors).toHaveLength(0);
    });

    it('rejects a missing email', async () => {
        const errors = await validate(plainToInstance(LoginDto, { password: valid.password }));
        expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('rejects an invalid email format', async () => {
        const errors = await validate(plainToInstance(LoginDto, { ...valid, email: 'not-an-email' }));
        expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('normalises email to lowercase', () => {
        const instance = plainToInstance(LoginDto, { ...valid, email: 'USER@TEACHLINK.XYZ' });
        expect(instance.email).toBe('user@teachlink.xyz');
    });

    it('rejects a password shorter than 8 characters', async () => {
        const errors = await validate(plainToInstance(LoginDto, { ...valid, password: 'Ab@1' }));
        expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('rejects a missing password', async () => {
        const errors = await validate(plainToInstance(LoginDto, { email: valid.email }));
        expect(errors.some((e) => e.property === 'password')).toBe(true);
    });
});

import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { GetUsersDto } from '../../src/users/dto/get-users.dto';

describe('GetUsersDto', () => {
    it('accepts an empty query (all fields optional)', async () => {
        const errors = await validate(plainToInstance(GetUsersDto, {}));
        expect(errors).toHaveLength(0);
    });

    it('accepts valid status values', async () => {
        for (const status of ['active', 'inactive', 'suspended', 'pending']) {
            const errors = await validate(plainToInstance(GetUsersDto, { status }));
            expect(errors, `should accept status="${status}"`).toHaveLength(0);
        }
    });

    it('accepts valid role values', async () => {
        for (const role of ['student', 'instructor', 'admin', 'moderator']) {
            const errors = await validate(plainToInstance(GetUsersDto, { role }));
            expect(errors, `should accept role="${role}"`).toHaveLength(0);
        }
    });

    it('rejects an unrecognised status', async () => {
        const errors = await validate(plainToInstance(GetUsersDto, { status: 'banned' }));
        expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('rejects an unrecognised role', async () => {
        const errors = await validate(plainToInstance(GetUsersDto, { role: 'superuser' }));
        expect(errors.some((e) => e.property === 'role')).toBe(true);
    });

    it('accepts both status and role together', async () => {
        const errors = await validate(
            plainToInstance(GetUsersDto, { status: 'active', role: 'student' }),
        );
        expect(errors).toHaveLength(0);
    });
});
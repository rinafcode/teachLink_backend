import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BulkDeleteMediaDto } from './media.dto';

describe('BulkDeleteMediaDto', () => {
  it('accepts a valid array of content IDs', async () => {
    const errors = await validate(
      plainToInstance(BulkDeleteMediaDto, { contentIds: ['abc123', 'def456'] }),
    );
    expect(errors).toHaveLength(0);
  });

  it('accepts a single content ID', async () => {
    const errors = await validate(plainToInstance(BulkDeleteMediaDto, { contentIds: ['abc123'] }));
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing contentIds field', async () => {
    const errors = await validate(plainToInstance(BulkDeleteMediaDto, {}));
    expect(errors.some((e) => e.property === 'contentIds')).toBe(true);
  });

  it('rejects a plain string instead of an array', async () => {
    // This was the original bug — no @IsArray() meant this passed silently
    const errors = await validate(plainToInstance(BulkDeleteMediaDto, { contentIds: 'abc123' }));
    expect(errors.some((e) => e.property === 'contentIds')).toBe(true);
  });

  it('rejects an empty array', async () => {
    const errors = await validate(plainToInstance(BulkDeleteMediaDto, { contentIds: [] }));
    expect(errors.some((e) => e.property === 'contentIds')).toBe(true);
  });

  it('rejects an array exceeding 100 items', async () => {
    const errors = await validate(
      plainToInstance(BulkDeleteMediaDto, {
        contentIds: Array.from({ length: 101 }, (_, i) => `id-${i}`),
      }),
    );
    expect(errors.some((e) => e.property === 'contentIds')).toBe(true);
  });

  it('rejects an array containing empty strings', async () => {
    const errors = await validate(
      plainToInstance(BulkDeleteMediaDto, { contentIds: ['abc123', ''] }),
    );
    expect(errors.some((e) => e.property === 'contentIds')).toBe(true);
  });

  it('rejects an array containing non-string values', async () => {
    const errors = await validate(plainToInstance(BulkDeleteMediaDto, { contentIds: [123, 456] }));
    expect(errors.some((e) => e.property === 'contentIds')).toBe(true);
  });

  it('accepts exactly 100 items (boundary)', async () => {
    const errors = await validate(
      plainToInstance(BulkDeleteMediaDto, {
        contentIds: Array.from({ length: 100 }, (_, i) => `id-${i}`),
      }),
    );
    expect(errors).toHaveLength(0);
  });
});

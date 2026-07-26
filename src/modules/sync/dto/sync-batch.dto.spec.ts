import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SyncBatchDto } from './sync-batch.dto';

describe('SyncBatchDto', () => {
  it('accepts a valid batch payload', async () => {
    const dto = plainToInstance(SyncBatchDto, {
      actions: [{ actionType: 'create', payload: { id: '1' } }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects payload with non-array actions', async () => {
    const dto = plainToInstance(SyncBatchDto, {
      actions: 'not-an-array' as any,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'actions')).toBe(true);
  });
});

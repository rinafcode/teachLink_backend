import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateRateLimitingDto } from './update-rate-limiting.dto';

describe('UpdateRateLimitingDto', () => {
  it('accepts a partial update payload', async () => {
    const dto = plainToInstance(UpdateRateLimitingDto, {
      limit: 200,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty payload', async () => {
    const dto = plainToInstance(UpdateRateLimitingDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects limit exceeding maximum', async () => {
    const dto = plainToInstance(UpdateRateLimitingDto, {
      limit: 999999999,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative priority', async () => {
    const dto = plainToInstance(UpdateRateLimitingDto, {
      priority: -1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid rate limit type', async () => {
    const dto = plainToInstance(UpdateRateLimitingDto, {
      type: 'invalid-type',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects non-numeric windowSeconds', async () => {
    const dto = plainToInstance(UpdateRateLimitingDto, {
      windowSeconds: 'not-a-number',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

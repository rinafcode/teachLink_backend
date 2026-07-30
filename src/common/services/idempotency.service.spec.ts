import { ConfigService } from '@nestjs/config';
import { IdempotencyService, IdempotencyRecord } from './idempotency.service';

describe('IdempotencyService', () => {
  const makeRedis = () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  });

  it('treats corrupted JSON as a cache miss and logs a warning', async () => {
    const redis = makeRedis();
    redis.get.mockResolvedValue('{not-json');
    const logger = { warn: jest.fn() };
    const service = new IdempotencyService(redis as any, new ConfigService({})) as any;
    service.logger = logger;

    await expect(service.getRecord('broken-key')).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('broken-key'));
  });

  it('treats truncated payloads as a cache miss and heals the entry', async () => {
    const redis = makeRedis();
    redis.get.mockResolvedValue('{"idempotencyKey":"abc"');
    const logger = { warn: jest.fn() };
    const service = new IdempotencyService(redis as any, new ConfigService({})) as any;
    service.logger = logger;

    await expect(service.getRecord('truncated-key')).resolves.toBeNull();
    expect(redis.del).toHaveBeenCalledWith('idempotency:record:truncated-key');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('truncated-key'));
  });

  it('returns a valid parsed record', async () => {
    const redis = makeRedis();
    const record: IdempotencyRecord = {
      idempotencyKey: 'valid-key',
      fingerprint: 'fingerprint',
      statusCode: 200,
      response: { ok: true },
      cachedAt: 123,
    };
    redis.get.mockResolvedValue(JSON.stringify(record));
    const service = new IdempotencyService(redis as any, new ConfigService({}));

    await expect(service.getRecord('valid-key')).resolves.toEqual(record);
  });

  it('rejects malformed record objects', async () => {
    const redis = makeRedis();
    redis.get.mockResolvedValue(JSON.stringify({ fingerprint: 'only-fingerprint' }));
    const logger = { warn: jest.fn() };
    const service = new IdempotencyService(redis as any, new ConfigService({})) as any;
    service.logger = logger;

    await expect(service.getRecord('bad-shape-key')).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('bad-shape-key'));
  });
});

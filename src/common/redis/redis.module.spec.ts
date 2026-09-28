/**
 * Issue #837 — verifies `RedisModule.forRoot()` wires a working `REDIS_CLIENT`
 * provider through NestJS DI, backed by `ioredis-mock` so no real Redis
 * connection is required.
 */
jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis.module';
import { REDIS_CLIENT } from './redis.constants';
import { resetSharedRedisClientForTests } from '../../config/cache.config';

describe('RedisModule', () => {
  afterEach(() => {
    resetSharedRedisClientForTests();
  });

  it('provides a working REDIS_CLIENT from forRoot()', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        RedisModule.forRoot(),
      ],
    }).compile();

    const client = moduleRef.get(REDIS_CLIENT);
    expect(client).toBeDefined();

    await client.set('redis-module-key', 'redis-module-value');
    await expect(client.get('redis-module-key')).resolves.toBe('redis-module-value');

    await moduleRef.close();
  });

  it('is global, so REDIS_CLIENT is injectable by feature modules without re-importing it', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        RedisModule.forRoot(),
        RedisModule.forRoot(), // multiple imports must not open a second connection
      ],
    }).compile();

    const client = moduleRef.get(REDIS_CLIENT);
    expect(client).toBeDefined();

    await moduleRef.close();
  });
});

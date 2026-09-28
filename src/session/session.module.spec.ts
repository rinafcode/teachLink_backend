/**
 * Issue #837 — end-to-end integration test proving SessionModule connects
 * through the shared, HA-aware Redis connection (standalone by default,
 * Sentinel when REDIS_SENTINEL_HOSTS is configured) instead of opening its
 * own connection. Backed by `ioredis-mock` so no real Redis/Sentinel
 * deployment is required.
 */
jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SessionModule } from './session.module';
import { SessionService } from './session.service';
import { SESSION_REDIS_CLIENT } from './session.constants';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { resetSharedRedisClientForTests } from '../config/cache.config';

describe('SessionModule (Redis HA integration)', () => {
  afterEach(() => {
    resetSharedRedisClientForTests();
  });

  it('aliases SESSION_REDIS_CLIENT to the shared REDIS_CLIENT connection', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), SessionModule],
    }).compile();

    const sharedClient = moduleRef.get(REDIS_CLIENT);
    const sessionClient = moduleRef.get(SESSION_REDIS_CLIENT);
    expect(sessionClient).toBe(sharedClient);

    const sessionService = moduleRef.get(SessionService);
    const sid = await sessionService.createSession('user-1', { role: 'student' });
    const session = await sessionService.getSession(sid);
    expect(session?.userId).toBe('user-1');

    await moduleRef.close();
  });

  it('serves sessions through a Sentinel-configured shared client when REDIS_SENTINEL_HOSTS is set', async () => {
    process.env.REDIS_SENTINEL_HOSTS = 'sentinel1:26379,sentinel2:26379';
    process.env.REDIS_SENTINEL_NAME = 'mymaster';

    try {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), SessionModule],
      }).compile();

      const sessionService = moduleRef.get(SessionService);
      const sid = await sessionService.createSession('user-2');
      expect(await sessionService.getSession(sid)).not.toBeNull();

      await moduleRef.close();
    } finally {
      delete process.env.REDIS_SENTINEL_HOSTS;
      delete process.env.REDIS_SENTINEL_NAME;
    }
  });
});

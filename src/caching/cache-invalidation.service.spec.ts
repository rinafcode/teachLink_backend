import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheInvalidationService } from './cache-invalidation.service';
import { APP_EVENTS } from '../common/constants/event.constants';
import { CACHE_PREFIXES } from './caching.constants';

jest.mock('../config/cache.config', () => ({
  getSharedRedisClient: jest.fn(() => ({
    scan: jest.fn().mockResolvedValue(['0', []]),
    del: jest.fn(),
  })),
}));

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let cacheManager: { del: jest.Mock; clear: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    cacheManager = {
      del: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    eventEmitter = { emit: jest.fn() };
    service = new CacheInvalidationService(
      cacheManager as never,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('invalidates a single cache key and emits event', async () => {
    await service.invalidateKey('cache:course:1');

    expect(cacheManager.del).toHaveBeenCalledWith('cache:course:1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(APP_EVENTS.CACHE_INVALIDATED, {
      key: 'cache:course:1',
      type: 'single',
    });
  });

  it('invalidates course-related keys on course cache invalidation', async () => {
    await service.invalidateCourseCache('course-1');

    expect(cacheManager.del).toHaveBeenCalledWith(`${CACHE_PREFIXES.COURSE}:course-1`);
  });

  it('invalidates user profile keys on user cache invalidation', async () => {
    await service.invalidateUserCache('user-1');

    expect(cacheManager.del).toHaveBeenCalledWith(`${CACHE_PREFIXES.USER}:user-1`);
    expect(cacheManager.del).toHaveBeenCalledWith(`${CACHE_PREFIXES.USER_PROFILE}:user-1`);
  });

  it('routes entity changes to course invalidation', async () => {
    await service.handleDataChange('course', 'course-99');
    expect(cacheManager.del).toHaveBeenCalledWith(`${CACHE_PREFIXES.COURSE}:course-99`);
  });
});

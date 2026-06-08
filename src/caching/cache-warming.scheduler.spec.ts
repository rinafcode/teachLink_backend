import { CacheWarmingScheduler } from './cache-warming.scheduler';
import { CacheWarmingService } from './cache-warming.service';
import { CachingService } from './caching.service';

describe('CacheWarmingScheduler', () => {
  let scheduler: CacheWarmingScheduler;
  let warming: {
    warmAll: jest.Mock;
    warmSearchResults: jest.Mock;
    warmUserProfiles: jest.Mock;
    warmCoursesList: jest.Mock;
    warmPopularCourses: jest.Mock;
  };
  let caching: { publishHitRateMetrics: jest.Mock };

  beforeEach(() => {
    warming = {
      warmAll: jest.fn().mockResolvedValue([
        { target: 'COURSES_LIST', keysWarmed: 1, durationMs: 5 },
      ]),
      warmSearchResults: jest
        .fn()
        .mockResolvedValue({ target: 'SEARCH_RESULTS', keysWarmed: 4, durationMs: 3 }),
      warmUserProfiles: jest
        .fn()
        .mockResolvedValue({ target: 'USER_PROFILE', keysWarmed: 10, durationMs: 8 }),
      warmCoursesList: jest
        .fn()
        .mockResolvedValue({ target: 'COURSES_LIST', keysWarmed: 1, durationMs: 4 }),
      warmPopularCourses: jest
        .fn()
        .mockResolvedValue({ target: 'POPULAR_COURSES', keysWarmed: 1, durationMs: 6 }),
    };
    caching = { publishHitRateMetrics: jest.fn() };
    scheduler = new CacheWarmingScheduler(
      warming as unknown as CacheWarmingService,
      caching as unknown as CachingService,
    );
  });

  it('runs full warm-up on module init', async () => {
    await scheduler.onModuleInit();
    expect(warming.warmAll).toHaveBeenCalledTimes(1);
  });

  it('delegates scheduled search warming to CacheWarmingService', async () => {
    await scheduler.warmSearchResults();
    expect(warming.warmSearchResults).toHaveBeenCalledTimes(1);
  });

  it('delegates scheduled profile warming to CacheWarmingService', async () => {
    await scheduler.warmUserProfiles();
    expect(warming.warmUserProfiles).toHaveBeenCalledTimes(1);
  });

  it('publishes cache hit-rate metrics on schedule', () => {
    scheduler.publishCacheMetrics();
    expect(caching.publishHitRateMetrics).toHaveBeenCalledWith('application');
  });
});

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
      warmAll: jest
        .fn()
        .mockResolvedValue([{ target: 'COURSES_LIST', keysWarmed: 1, durationMs: 5 }]),
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

  // ── Deferred startup warming ────────────────────────────────────────────────

  it('runs full warm-up after the startup delay via onApplicationBootstrap', async () => {
    jest.useFakeTimers();
    const bootstrapPromise = scheduler.onApplicationBootstrap();
    // Advance past STARTUP_DELAY_MS
    await jest.runAllTimersAsync();
    await bootstrapPromise;
    jest.useRealTimers();

    expect(warming.warmAll).toHaveBeenCalledTimes(1);
  });

  it('does NOT call warmAll before the startup delay has elapsed', async () => {
    jest.useFakeTimers();
    // Start bootstrap but do not advance timers
    void scheduler.onApplicationBootstrap();
    expect(warming.warmAll).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  // ── Scheduled methods ───────────────────────────────────────────────────────

  it('delegates scheduled search warming to CacheWarmingService', async () => {
    await scheduler.warmSearchResults();
    expect(warming.warmSearchResults).toHaveBeenCalledTimes(1);
  });

  it('delegates scheduled profile warming to CacheWarmingService', async () => {
    await scheduler.warmUserProfiles();
    expect(warming.warmUserProfiles).toHaveBeenCalledTimes(1);
  });

  it('delegates scheduled course list warming to CacheWarmingService', async () => {
    await scheduler.warmCoursesList();
    expect(warming.warmCoursesList).toHaveBeenCalledTimes(1);
  });

  it('delegates scheduled popular courses warming to CacheWarmingService', async () => {
    await scheduler.warmPopularCourses();
    expect(warming.warmPopularCourses).toHaveBeenCalledTimes(1);
  });

  it('publishes cache hit-rate metrics on schedule', () => {
    scheduler.publishCacheMetrics();
    expect(caching.publishHitRateMetrics).toHaveBeenCalledWith('application');
  });
});

import { CacheInvalidationListener } from './cache-invalidation.listener';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CACHE_EVENTS } from './caching.constants';

describe('CacheInvalidationListener', () => {
  let listener: CacheInvalidationListener;
  let invalidation: {
    invalidateCourseCache: jest.Mock;
    invalidateUserCache: jest.Mock;
    invalidatePattern: jest.Mock;
  };

  beforeEach(() => {
    invalidation = {
      invalidateCourseCache: jest.fn().mockResolvedValue(undefined),
      invalidateUserCache: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    };
    listener = new CacheInvalidationListener(
      invalidation as unknown as CacheInvalidationService,
    );
  });

  it('invalidates course caches on course update events', async () => {
    await listener.onCourseChange({ id: 'course-1' });
    expect(invalidation.invalidateCourseCache).toHaveBeenCalledWith('course-1');
  });

  it('invalidates user profile caches on user update events', async () => {
    await listener.onUserChange({ id: 'user-1' });
    expect(invalidation.invalidateUserCache).toHaveBeenCalledWith('user-1');
  });

  it('invalidates list and popular caches on enrollment events', async () => {
    await listener.onEnrollmentChange({ id: 'enrollment-1' });
    expect(invalidation.invalidatePattern).toHaveBeenCalledWith('cache:courses:list:*');
    expect(invalidation.invalidatePattern).toHaveBeenCalledWith('cache:popular:*');
  });

  it('invalidates search caches when search index updates', async () => {
    await listener.onSearchIndexUpdated();
    expect(invalidation.invalidatePattern).toHaveBeenCalledWith('cache:search:*');
  });

  it('responds to documented cache event constants', () => {
    expect(CACHE_EVENTS.COURSE_UPDATED).toBe('cache.course.updated');
    expect(CACHE_EVENTS.USER_UPDATED).toBe('cache.user.updated');
  });
});

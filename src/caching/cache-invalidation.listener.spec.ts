import { CacheInvalidationListener } from './cache-invalidation.listener';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CACHE_EVENTS } from './caching.constants';

const makeMockInvalidation = () => ({
  invalidateCourseCache: jest.fn().mockResolvedValue(undefined),
  invalidateUserCache: jest.fn().mockResolvedValue(undefined),
  invalidatePattern: jest.fn().mockResolvedValue(undefined),
});

describe('CacheInvalidationListener', () => {
  let listener: CacheInvalidationListener;
  let invalidation: ReturnType<typeof makeMockInvalidation>;

  beforeEach(() => {
    invalidation = makeMockInvalidation();
    listener = new CacheInvalidationListener(invalidation as unknown as CacheInvalidationService);
  });

  // ── CACHE_EVENTS constants ─────────────────────────────────────────────────

  describe('CACHE_EVENTS constants', () => {
    it('defines all expected event name values', () => {
      expect(CACHE_EVENTS.COURSE_UPDATED).toBe('cache.course.updated');
      expect(CACHE_EVENTS.USER_UPDATED).toBe('cache.user.updated');
      expect(CACHE_EVENTS.ENROLLMENT_CREATED).toBe('cache.enrollment.created');
      expect(CACHE_EVENTS.SEARCH_INDEX_UPDATED).toBe('cache.search.updated');
    });
  });

  // ── onCourseChange ─────────────────────────────────────────────────────────

  describe('onCourseChange', () => {
    it('invalidates the course cache for the given id', async () => {
      await listener.onCourseChange({ id: 'course-1' });
      expect(invalidation.invalidateCourseCache).toHaveBeenCalledWith('course-1');
    });

    it('does not touch user or pattern caches', async () => {
      await listener.onCourseChange({ id: 'course-1' });
      expect(invalidation.invalidateUserCache).not.toHaveBeenCalled();
      expect(invalidation.invalidatePattern).not.toHaveBeenCalled();
    });

    it('propagates with an undefined id without throwing', async () => {
      await expect(listener.onCourseChange({ id: undefined as any })).resolves.not.toThrow();
      expect(invalidation.invalidateCourseCache).toHaveBeenCalledWith(undefined);
    });
  });

  // ── onUserChange ───────────────────────────────────────────────────────────

  describe('onUserChange', () => {
    it('invalidates the user cache for the given id', async () => {
      await listener.onUserChange({ id: 'user-1' });
      expect(invalidation.invalidateUserCache).toHaveBeenCalledWith('user-1');
    });

    it('does not touch course or pattern caches', async () => {
      await listener.onUserChange({ id: 'user-1' });
      expect(invalidation.invalidateCourseCache).not.toHaveBeenCalled();
      expect(invalidation.invalidatePattern).not.toHaveBeenCalled();
    });

    it('propagates with an undefined id without throwing', async () => {
      await expect(listener.onUserChange({ id: undefined as any })).resolves.not.toThrow();
      expect(invalidation.invalidateUserCache).toHaveBeenCalledWith(undefined);
    });
  });

  // ── onEnrollmentChange ─────────────────────────────────────────────────────

  describe('onEnrollmentChange', () => {
    it('invalidates the course list cache pattern', async () => {
      await listener.onEnrollmentChange({ id: 'enrollment-1' });
      expect(invalidation.invalidatePattern).toHaveBeenCalledWith('cache:courses:list:*');
    });

    it('invalidates the popular content cache pattern', async () => {
      await listener.onEnrollmentChange({ id: 'enrollment-1' });
      expect(invalidation.invalidatePattern).toHaveBeenCalledWith('cache:popular:*');
    });

    it('invalidates exactly two patterns and nothing else', async () => {
      await listener.onEnrollmentChange({ id: 'enrollment-1' });
      expect(invalidation.invalidatePattern).toHaveBeenCalledTimes(2);
      expect(invalidation.invalidateCourseCache).not.toHaveBeenCalled();
      expect(invalidation.invalidateUserCache).not.toHaveBeenCalled();
    });
  });

  // ── onSearchIndexUpdated ───────────────────────────────────────────────────

  describe('onSearchIndexUpdated', () => {
    it('invalidates the search cache pattern', async () => {
      await listener.onSearchIndexUpdated();
      expect(invalidation.invalidatePattern).toHaveBeenCalledWith('cache:search:*');
    });

    it('invalidates exactly one pattern and nothing else', async () => {
      await listener.onSearchIndexUpdated();
      expect(invalidation.invalidatePattern).toHaveBeenCalledTimes(1);
      expect(invalidation.invalidateCourseCache).not.toHaveBeenCalled();
      expect(invalidation.invalidateUserCache).not.toHaveBeenCalled();
    });
  });
});

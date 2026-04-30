import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CachingService } from '../caching.service';
import { CacheStrategiesService } from '../strategies/cache-strategies.service';
import { CACHE_EVENTS } from '../caching.constants';

export interface InvalidationResult {
  pattern: string;
  keysDeleted: number;
}

/**
 * Provides cache Invalidation operations.
 */
@Injectable()
export class CacheInvalidationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly tagIndex: Map<string, Set<string>> = new Map();

  constructor(
    private readonly cachingService: CachingService,
    private readonly strategiesService: CacheStrategiesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Executes on Module Init.
   * @returns The operation result.
   */
  onModuleInit() {
    this.logger.log('Cache invalidation service initialized');
  }

  /**
   * Executes on Module Destroy.
   * @returns The operation result.
   */
  onModuleDestroy() {
    this.tagIndex.clear();
  }

  /**
   * Invalidate cache by pattern
   * @param pattern - Pattern to match (e.g., 'cache:course:*')
   */
  async invalidateByPattern(pattern: string): Promise<InvalidationResult> {
    this.logger.debug(`Invalidating cache pattern: ${pattern}`);
    const keysDeleted = await this.cachingService.delPattern(pattern);

    return { pattern, keysDeleted };
  }

  /**
   * Invalidate cache by multiple patterns
   * @param patterns - Array of patterns to invalidate
   */
  async invalidateByPatterns(patterns: string[]): Promise<InvalidationResult[]> {
    const results: InvalidationResult[] = [];

    for (const pattern of patterns) {
      const result = await this.invalidateByPattern(pattern);
      results.push(result);
    }

    return results;
  }

  /**
   * Invalidate cache by tag
   * @param tag - Tag to invalidate
   */
  async invalidateByTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) {
      return 0;
    }

    let deleted = 0;
    for (const key of keys) {
      await this.cachingService.del(key);
      deleted++;
    }

    this.tagIndex.delete(tag);
    this.logger.debug(`Invalidated ${deleted} keys for tag: ${tag}`);
    return deleted;
  }

  /**
   * Register a key with a tag for tag-based invalidation
   * @param tag - Tag to associate with the key
   * @param key - Cache key
   */
  registerKeyWithTag(tag: string, key: string): void {
    if (!this.tagIndex.has(tag)) {
      this.tagIndex.set(tag, new Set());
    }
    const tagSet = this.tagIndex.get(tag);
    if (tagSet) {
      tagSet.add(key);
    }
  }

  /**
   * Unregister a key from a tag
   * @param tag - Tag to dissociate from the key
   * @param key - Cache key
   */
  unregisterKeyFromTag(tag: string, key: string): void {
    const keys = this.tagIndex.get(tag);
    if (keys) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagIndex.delete(tag);
      }
    }
  }

  /**
   * Invalidate all cache entries related to a course
   */
  async invalidateCourse(courseId: string): Promise<InvalidationResult[]> {
    const patterns = [
      `cache:course:${courseId}:*`,
      `cache:course:${courseId}`,
      'cache:courses:list:*',
      'cache:search:*',
      'cache:popular:*',
    ];

    this.eventEmitter.emit(CACHE_EVENTS.COURSE_UPDATED, { courseId });
    return this.invalidateByPatterns(patterns);
  }

  /**
   * Invalidate all cache entries related to a user
   */
  async invalidateUser(userId: string): Promise<InvalidationResult[]> {
    const patterns = [
      `cache:user:${userId}:*`,
      `cache:user:${userId}`,
      `cache:user:profile:${userId}`,
    ];

    this.eventEmitter.emit(CACHE_EVENTS.USER_UPDATED, { userId });
    return this.invalidateByPatterns(patterns);
  }

  /**
   * Invalidate all cache entries related to an enrollment
   */
  async invalidateEnrollment(
    enrollmentId: string,
    courseId?: string,
  ): Promise<InvalidationResult[]> {
    const patterns = [`cache:enrollment:${enrollmentId}:*`, `cache:enrollment:${enrollmentId}`];

    if (courseId) {
      patterns.push(`cache:course:${courseId}:enrollments:*`);
    }

    this.eventEmitter.emit(CACHE_EVENTS.ENROLLMENT_UPDATED, { enrollmentId, courseId });
    return this.invalidateByPatterns(patterns);
  }

  /**
   * Invalidate search cache
   */
  async invalidateSearch(): Promise<InvalidationResult[]> {
    const patterns = ['cache:search:*'];
    this.eventEmitter.emit(CACHE_EVENTS.SEARCH_INDEX_UPDATED);
    return this.invalidateByPatterns(patterns);
  }

  /**
   * Clear all application cache
   */
  async clearAll(): Promise<number> {
    return this.cachingService.clearAll();
  }

  // Event handlers for automatic invalidation

  /**
   * Handles course Updated Event.
   * @param payload The payload to process.
   */
  @OnEvent(CACHE_EVENTS.COURSE_UPDATED)
  async handleCourseUpdatedEvent(payload: { courseId: string }): Promise<void> {
    this.logger.debug(`Handling course updated event for: ${payload.courseId}`);
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.COURSE_UPDATED);
    await this.invalidateByPatterns(patterns);
  }

  /**
   * Handles course Deleted Event.
   * @param payload The payload to process.
   */
  @OnEvent(CACHE_EVENTS.COURSE_DELETED)
  async handleCourseDeletedEvent(payload: { courseId: string }): Promise<void> {
    this.logger.debug(`Handling course deleted event for: ${payload.courseId}`);
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.COURSE_DELETED);
    await this.invalidateByPatterns(patterns);
  }

  /**
   * Handles user Updated Event.
   * @param payload The payload to process.
   */
  @OnEvent(CACHE_EVENTS.USER_UPDATED)
  async handleUserUpdatedEvent(payload: { userId: string }): Promise<void> {
    this.logger.debug(`Handling user updated event for: ${payload.userId}`);
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.USER_UPDATED);
    await this.invalidateByPatterns(patterns);
  }

  /**
   * Handles user Deleted Event.
   * @param payload The payload to process.
   */
  @OnEvent(CACHE_EVENTS.USER_DELETED)
  async handleUserDeletedEvent(payload: { userId: string }): Promise<void> {
    this.logger.debug(`Handling user deleted event for: ${payload.userId}`);
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.USER_DELETED);
    await this.invalidateByPatterns(patterns);
  }

  /**
   * Handles enrollment Created Event.
   * @param payload The payload to process.
   */
  @OnEvent(CACHE_EVENTS.ENROLLMENT_CREATED)
  async handleEnrollmentCreatedEvent(payload: {
    enrollmentId: string;
    courseId: string;
  }): Promise<void> {
    this.logger.debug(`Handling enrollment created event for: ${payload.enrollmentId}`);
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.ENROLLMENT_CREATED);
    await this.invalidateByPatterns(patterns);
  }

  /**
   * Handles enrollment Updated Event.
   * @param payload The payload to process.
   */
  @OnEvent(CACHE_EVENTS.ENROLLMENT_UPDATED)
  async handleEnrollmentUpdatedEvent(payload: {
    enrollmentId: string;
    courseId?: string;
  }): Promise<void> {
    this.logger.debug(`Handling enrollment updated event for: ${payload.enrollmentId}`);
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.ENROLLMENT_UPDATED);
    await this.invalidateByPatterns(patterns);
  }

  /**
   * Handles search Index Updated Event.
   */
  @OnEvent(CACHE_EVENTS.SEARCH_INDEX_UPDATED)
  async handleSearchIndexUpdatedEvent(): Promise<void> {
    this.logger.debug('Handling search index updated event');
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.SEARCH_INDEX_UPDATED);
    await this.invalidateByPatterns(patterns);
  }

  @OnEvent(CACHE_EVENTS.CATEGORY_UPDATED)
  async handleCategoryUpdatedEvent(): Promise<void> {
    this.logger.debug('Handling category updated event');
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.CATEGORY_UPDATED);
    await this.invalidateByPatterns(patterns);
  }

  @OnEvent(CACHE_EVENTS.TAG_UPDATED)
  async handleTagUpdatedEvent(): Promise<void> {
    this.logger.debug('Handling tag updated event');
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.TAG_UPDATED);
    await this.invalidateByPatterns(patterns);
  }

  @OnEvent(CACHE_EVENTS.LESSON_UPDATED)
  async handleLessonUpdatedEvent(): Promise<void> {
    this.logger.debug('Handling lesson updated event');
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.LESSON_UPDATED);
    await this.invalidateByPatterns(patterns);
  }

  @OnEvent(CACHE_EVENTS.QUIZ_UPDATED)
  async handleQuizUpdatedEvent(): Promise<void> {
    this.logger.debug('Handling quiz updated event');
    const patterns = this.strategiesService.getPatternsForEvent(CACHE_EVENTS.QUIZ_UPDATED);
    await this.invalidateByPatterns(patterns);
  }

  /**
   * Get invalidation statistics
   */
  getStats(): {
    registeredTags: number;
    totalTrackedKeys: number;
  } {
    let totalKeys = 0;
    for (const keys of this.tagIndex.values()) {
      totalKeys += keys.size;
    }

    return {
      registeredTags: this.tagIndex.size,
      totalTrackedKeys: totalKeys,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CACHE_EVENTS } from './caching.constants';
import { CacheInvalidationService } from './cache-invalidation.service';

interface EntityEventPayload {
  id: string;
}

/**
 * Listens for cache invalidation events and clears stale entries on write.
 */
@Injectable()
export class CacheInvalidationListener {
  private readonly logger = new Logger(CacheInvalidationListener.name);

  constructor(private readonly invalidation: CacheInvalidationService) {}

  @OnEvent(CACHE_EVENTS.COURSE_CREATED)
  @OnEvent(CACHE_EVENTS.COURSE_UPDATED)
  @OnEvent(CACHE_EVENTS.COURSE_DELETED)
  async onCourseChange(payload: EntityEventPayload): Promise<void> {
    this.logger.debug(`Invalidating course cache for ${payload.id}`);
    await this.invalidation.invalidateCourseCache(payload.id);
  }

  @OnEvent(CACHE_EVENTS.USER_UPDATED)
  @OnEvent(CACHE_EVENTS.USER_DELETED)
  async onUserChange(payload: EntityEventPayload): Promise<void> {
    this.logger.debug(`Invalidating user cache for ${payload.id}`);
    await this.invalidation.invalidateUserCache(payload.id);
  }

  @OnEvent(CACHE_EVENTS.ENROLLMENT_CREATED)
  @OnEvent(CACHE_EVENTS.ENROLLMENT_UPDATED)
  async onEnrollmentChange(payload: EntityEventPayload): Promise<void> {
    this.logger.debug(`Invalidating course list caches after enrollment ${payload.id}`);
    await this.invalidation.invalidatePattern('cache:courses:list:*');
    await this.invalidation.invalidatePattern('cache:popular:*');
  }

  @OnEvent(CACHE_EVENTS.SEARCH_INDEX_UPDATED)
  async onSearchIndexUpdated(): Promise<void> {
    this.logger.debug('Invalidating search result caches');
    await this.invalidation.invalidatePattern('cache:search:*');
  }

  @OnEvent(CACHE_EVENTS.CATEGORY_UPDATED)
  @OnEvent(CACHE_EVENTS.TAG_UPDATED)
  @OnEvent(CACHE_EVENTS.LESSON_UPDATED)
  @OnEvent(CACHE_EVENTS.QUIZ_UPDATED)
  async onRelatedContentUpdated(payload: EntityEventPayload): Promise<void> {
    this.logger.debug(`Invalidating related caches for ${payload.id}`);
    await this.invalidation.invalidatePattern('cache:search:*');
    await this.invalidation.invalidatePattern('cache:courses:list:*');
  }
}

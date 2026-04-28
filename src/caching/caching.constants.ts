export const CACHE_REDIS_CLIENT = 'CACHE_REDIS_CLIENT';

/**
 * Cache TTL (Time-To-Live) values in seconds.
 *
 * ## Caching Strategy
 *
 * TeachLink uses a Redis-backed cache-aside pattern:
 *  1. On read, check cache first; on miss, fetch from DB and populate cache.
 *  2. On write/delete, invalidate or update the relevant cache keys.
 *
 * ### TTL Policy
 * TTLs are chosen based on data volatility and read frequency:
 *
 * | Key              | TTL        | Rationale                                      |
 * |------------------|------------|------------------------------------------------|
 * | USER_SESSION     | 7 days     | Long-lived auth sessions; invalidated on logout|
 * | COURSE_METADATA  | 15 min     | Frequently read, infrequently updated          |
 * | COURSE_DETAILS   | 5 min      | May change (price, seats); short TTL           |
 * | SEARCH_RESULTS   | 2 min      | High read volume; stale results acceptable     |
 * | USER_PROFILE     | 10 min     | Moderate update frequency                      |
 * | STATIC_CONTENT   | 1 hour     | Rarely changes; safe to cache long             |
 * | POPULAR_COURSES  | 30 min     | Computed ranking; refresh periodically         |
 * | ENROLLMENT_DATA  | 5 min      | Changes on enroll/unenroll events              |
 *
 * ### Cache Key Versioning
 * All keys are prefixed with `cache:<entity>` (see CACHE_PREFIXES).
 * To bust all keys for an entity type, increment the version suffix:
 *   e.g. `cache:course:v2:<id>`
 *
 * ### Invalidation
 * Cache invalidation is event-driven via CACHE_EVENTS. Services emit these
 * events after mutations; the CachingModule subscribes and deletes stale keys.
 */
export const CACHE_TTL = {
  USER_SESSION: 604800, // 7 days
  COURSE_METADATA: 900, // 15 minutes
  COURSE_DETAILS: 300, // 5 minutes
  SEARCH_RESULTS: 120, // 2 minutes
  USER_PROFILE: 600, // 10 minutes
  STATIC_CONTENT: 3600, // 1 hour
  POPULAR_COURSES: 1800, // 30 minutes
  ENROLLMENT_DATA: 300, // 5 minutes
} as const;

export const CACHE_PREFIXES = {
  COURSE: 'cache:course',
  COURSES_LIST: 'cache:courses:list',
  USER: 'cache:user',
  USER_PROFILE: 'cache:user:profile',
  SEARCH: 'cache:search',
  POPULAR: 'cache:popular',
  ENROLLMENT: 'cache:enrollment',
  FEATURED: 'cache:featured',
  SYSTEM_CONFIG: 'cache:system:config',
  USERS_LIST: 'cache:users:list',
  CATEGORY: 'cache:category',
  TAG: 'cache:tag',
  LESSON: 'cache:lesson',
  QUIZ: 'cache:quiz',
} as const;

export const CACHE_EVENTS = {
  COURSE_CREATED: 'cache.course.created',
  COURSE_UPDATED: 'cache.course.updated',
  COURSE_DELETED: 'cache.course.deleted',
  USER_UPDATED: 'cache.user.updated',
  USER_DELETED: 'cache.user.deleted',
  ENROLLMENT_CREATED: 'cache.enrollment.created',
  ENROLLMENT_UPDATED: 'cache.enrollment.updated',
  SEARCH_INDEX_UPDATED: 'cache.search.updated',
  CATEGORY_UPDATED: 'cache.category.updated',
  TAG_UPDATED: 'cache.tag.updated',
  LESSON_UPDATED: 'cache.lesson.updated',
  QUIZ_UPDATED: 'cache.quiz.updated',
  CACHE_INVALIDATED: 'cache.invalidated',
  CACHE_PURGED: 'cache.purged',
} as const;

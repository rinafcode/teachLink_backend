export const CACHE_REDIS_CLIENT = 'CACHE_REDIS_CLIENT';

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
} as const;

export const CACHE_EVENTS = {
  COURSE_UPDATED: 'cache.course.updated',
  COURSE_DELETED: 'cache.course.deleted',
  USER_UPDATED: 'cache.user.updated',
  USER_DELETED: 'cache.user.deleted',
  ENROLLMENT_CREATED: 'cache.enrollment.created',
  ENROLLMENT_UPDATED: 'cache.enrollment.updated',
  SEARCH_INDEX_UPDATED: 'cache.search.updated',
  CACHE_INVALIDATED: 'cache.invalidated',
  CACHE_PURGED: 'cache.purged',
} as const;

import { CACHE_PREFIXES } from './caching.constants';
import { SearchFilters } from '../search/search.service';
import { SEARCH_CONSTANTS } from '../search/search.constants';

export function buildCourseListKey(scope: 'published' | 'all' = 'published'): string {
  return `${CACHE_PREFIXES.COURSES_LIST}:${scope}`;
}

export function buildPopularCoursesKey(): string {
  return `${CACHE_PREFIXES.POPULAR}:courses`;
}

export function buildCourseKey(courseId: string): string {
  return `${CACHE_PREFIXES.COURSE}:${courseId}`;
}

export function buildUserProfileKey(userId: string): string {
  return `${CACHE_PREFIXES.USER_PROFILE}:${userId}`;
}

export function buildSearchCacheKey(
  query: string,
  filters?: SearchFilters,
  sort?: string,
  page = 1,
  limit: number = SEARCH_CONSTANTS.DEFAULT_PAGE_SIZE,
): string {
  const str = `${query}:${JSON.stringify(filters ?? {})}:${sort ?? 'default'}:${page}:${limit}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return `${CACHE_PREFIXES.SEARCH}:${hash.toString()}`;
}

// ---------------------------------------------------------------------------
// Computation cache key builder — Issue #603
//
// Format: cache:computation:<type>:<identifier>
// Examples:
//   cache:computation:leaderboard:top-players:10
//   cache:computation:leaderboard:user-rank:user-abc
// ---------------------------------------------------------------------------
export function buildComputationKey(type: string, identifier: string): string {
  return `cache:computation:${type}:${identifier}`;
}

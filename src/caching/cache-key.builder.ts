import { CACHE_PREFIXES } from './caching.constants';
import { SearchFilters } from '../search/search.service';
import { SEARCH_CONSTANTS } from '../search/search.constants';

function assertTenantId(tenantId: string | undefined, context: string): string {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new Error(`Tenant identifier is required for ${context}`);
  }
  return tenantId;
}

export function buildCourseListKey(
  tenantId: string,
  scope: 'published' | 'all' = 'published',
): string {
  const resolvedTenantId = assertTenantId(tenantId, 'course list cache key');
  return `cache:${resolvedTenantId}:${CACHE_PREFIXES.COURSES_LIST.replace('cache:', '')}:${scope}`;
}

export function buildPopularCoursesKey(tenantId: string): string {
  const resolvedTenantId = assertTenantId(tenantId, 'popular courses cache key');
  return `cache:${resolvedTenantId}:${CACHE_PREFIXES.POPULAR.replace('cache:', '')}:courses`;
}

export function buildCourseKey(tenantId: string, courseId: string): string {
  const resolvedTenantId = assertTenantId(tenantId, 'course cache key');
  return `cache:${resolvedTenantId}:${CACHE_PREFIXES.COURSE.replace('cache:', '')}:${courseId}`;
}

export function buildUserProfileKey(tenantId: string, userId: string): string {
  const resolvedTenantId = assertTenantId(tenantId, 'user profile cache key');
  return `cache:${resolvedTenantId}:${CACHE_PREFIXES.USER_PROFILE.replace('cache:', '')}:${userId}`;
}

export function buildSearchCacheKey(
  tenantId: string,
  query: string,
  filters?: SearchFilters,
  sort?: string,
  page = 1,
  limit: number = SEARCH_CONSTANTS.DEFAULT_PAGE_SIZE,
): string {
  const resolvedTenantId = assertTenantId(tenantId, 'search cache key');
  const str = `${query}:${JSON.stringify(filters ?? {})}:${sort ?? 'default'}:${page}:${limit}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return `cache:${resolvedTenantId}:${CACHE_PREFIXES.SEARCH.replace('cache:', '')}:${hash.toString()}`;
}

// ---------------------------------------------------------------------------
// Computation cache key builder — Issue #603
//
// Format: cache:{tenant}:computation:{type}:{identifier}
// Examples:
//   cache:tenant-a:computation:leaderboard:top-players:10
//   cache:tenant-a:computation:leaderboard:user-rank:user-abc
// ---------------------------------------------------------------------------
export function buildComputationKey(tenantId: string, type: string, identifier: string): string {
  const resolvedTenantId = assertTenantId(tenantId, 'computation cache key');
  return `cache:${resolvedTenantId}:computation:${type}:${identifier}`;
}

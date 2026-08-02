# PR Description: Redis-backed cache for RBAC (#1018)

## Overview
This PR implements a Redis-backed caching layer for role and permission resolution in the authorization path. Because authorization runs on almost every authenticated request, fetching from PostgreSQL on every request causes high DB read load.

## Changes Made
- Added `RbacCacheService` in `src/rbac/rbac-cache.service.ts` which uses `ioredis` for caching.
- Integrated a bounded memory cache in `RbacCacheService` and established Redis pub/sub mechanism to instantly propagate invalidation to all instances upon role or permission mutations.
- Updated `RolesService` to inject `RbacCacheService` and exposed `getCachedRolePermissions` which reads from the cache or DB.
- Updated `RolesService` and `PermissionsService` to invalidate cache when role/permission is mutated.
- Updated `JwtStrategy` in `src/auth/jwt.strategy.ts` to use `getCachedRolePermissions` instead of doing SQL joins to get permissions.
- Exposed metrics `rbac_cache_hits_total`, `rbac_cache_misses_total`, and `rbac_revocation_propagation_latency_ms` via `prom-client` to monitor cache performance.
- Added integration test `rbac-cache.integration.spec.ts` asserting that a permission removal takes effect on the next request across two service instances.

## Acceptance Criteria
- [x] Repeated authorization checks for one role issue no repeated database queries.
- [x] Revoking a permission takes effect immediately on every replica.
- [x] Authorization cache hit rate is exported as a metric.
- [x] A revocation propagation test passes against a two-instance setup.

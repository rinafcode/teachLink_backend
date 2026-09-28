/**
 * Issue #798 — DI tokens for {@link ThreatDetectionService}.
 *
 * String token (rather than the `Redis` class directly) so the test suite can
 * supply a `createMockRedisClient()` instance without instantiating a real
 * `ioredis.Redis`. `SecurityModule` binds this token to `getSharedRedisClient()`.
 */
export const THREAT_REDIS_CLIENT = 'THREAT_REDIS_CLIENT';

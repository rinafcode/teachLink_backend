/**
 * DI token for the shared ioredis connection provided by {@link RedisModule}.
 * String token (rather than the `Redis` class) so tests can inject a mock
 * client — e.g. an `ioredis-mock` instance — without opening a real socket.
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

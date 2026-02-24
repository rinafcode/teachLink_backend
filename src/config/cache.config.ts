import { redisStore } from 'cache-manager-redis-store';

export const cacheConfig = {
  store: redisStore,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  ttl: parseInt(process.env.REDIS_TTL || '60', 10), // default TTL in seconds
};
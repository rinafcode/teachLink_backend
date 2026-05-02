import { Injectable, ForbiddenException } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Provides distributed Limiter operations.
 */
@Injectable()
export class DistributedLimiterService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.redis.on('error', () => {
      // Prevent unhandled error events during Redis outages.
    });
  }

  /**
   * Executes sliding Window Check.
   * @param key The key.
   * @param limit The maximum number of results.
   * @param windowInSeconds The window in seconds.
   */
  async slidingWindowCheck(key: string, limit: number, windowInSeconds: number): Promise<void> {
    const now = Date.now();
    const windowStart = now - windowInSeconds * 1000;

    const pipeline = this.redis.pipeline();

    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, `${now}`);
    pipeline.zcard(key);
    pipeline.expire(key, windowInSeconds);

    const results = await pipeline.exec();
    const requestCount = results?.[2]?.[1] as number;

    if (requestCount > limit) {
      throw new ForbiddenException('Rate limit exceeded');
    }
}

import { Injectable, ForbiddenException } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class DistributedLimiterService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async slidingWindowCheck(
    key: string,
    limit: number,
    windowInSeconds: number,
  ): Promise<void> {
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
}
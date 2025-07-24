import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class DistributedLimiterService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly WINDOW_SIZE = 60; // seconds
  private readonly MAX_REQUESTS = 30; // per window, can be made configurable

  onModuleInit() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  onModuleDestroy() {
    if (this.redis) {
      this.redis.disconnect();
    }
  }

  /**
   * Distributed rate limiting using Redis. Returns true if allowed, false otherwise.
   */
  async isAllowed(userId: string, endpoint: string): Promise<boolean> {
    const key = `rate:${userId}:${endpoint}`;
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `${key}:${Math.floor(now / this.WINDOW_SIZE)}`;
    const count = await this.redis.incr(windowKey);
    if (count === 1) {
      await this.redis.expire(windowKey, this.WINDOW_SIZE);
    }
    return count <= this.MAX_REQUESTS;
  }
}

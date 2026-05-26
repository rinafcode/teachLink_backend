import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Provides distributed Lock operations.
 */
@Injectable()
export class DistributedLockService {
  private redis = new Redis(process.env.REDIS_URL);

  constructor() {
    this.redis.on('error', () => {
      // Prevent unhandled error events during Redis outages.
    });
  }

  /**
   * Executes acquire Lock.
   * @param key The key.
   * @param ttl The ttl.
   * @returns Whether the operation succeeded.
   */
  async acquireLock(key: string, ttl = 5000): Promise<boolean> {
    const result = await this.redis.set(key, 'locked', 'PX', ttl, 'NX');
    return result === 'OK';
  }

  /**
   * Executes release Lock.
   * @param key The key.
   */
  async releaseLock(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class DistributedLockService {
  private redis = new Redis(process.env.REDIS_URL);

  async acquireLock(key: string, ttl = 5000): Promise<boolean> {
    const result = await this.redis.set(key, 'locked', 'PX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
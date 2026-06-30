import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

const RELEASE_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

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
   * Atomically acquires a lock via a single SET key value NX PX command,
   * so two concurrent callers can never both believe they hold it.
   * @param key The key.
   * @param ttl The ttl in milliseconds.
   * @returns A unique token if acquired, or null if the lock is already held.
   */
  async acquireLock(key: string, ttl = 5000): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(key, token, 'PX', ttl, 'NX');
    return result === 'OK' ? token : null;
  }

  /**
   * Releases the lock, but only if it is still held by this token. This
   * prevents releasing a lock that has since expired and been acquired by
   * another caller.
   * @param key The key.
   * @param token The token returned by acquireLock.
   */
  async releaseLock(key: string, token: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
  }

  /**
   * Acquires the lock, runs fn, and always releases the lock afterwards
   * (even if fn throws). Throws if the lock cannot be acquired.
   */
  async withLock<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const token = await this.acquireLock(key, ttl);
    if (!token) {
      throw new Error(`Could not acquire lock: ${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(key, token);
    }
  }
}

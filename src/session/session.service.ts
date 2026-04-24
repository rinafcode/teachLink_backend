import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { SESSION_REDIS_CLIENT } from './session.constants';

interface ISessionRecord {
  sid: string;
  userId: string;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Provides session operations.
 */
@Injectable()
export class SessionService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private readonly sessionPrefix: string;
  private readonly legacySessionPrefix: string;
  private readonly sessionTtlSeconds: number;
  private readonly lockTtlMs: number;
  private readonly lockRetries: number;
  private readonly lockRetryDelayMs: number;

  constructor(
    @Inject(SESSION_REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.sessionPrefix = this.configService.get<string>('AUTH_SESSION_PREFIX') || 'auth:sess:';
    this.legacySessionPrefix =
      this.configService.get<string>('AUTH_SESSION_LEGACY_PREFIX') || 'session:';
    this.sessionTtlSeconds = parseInt(
      this.configService.get<string>('AUTH_SESSION_TTL_SECONDS') || '604800',
      10,
    );
    this.lockTtlMs = parseInt(this.configService.get<string>('SESSION_LOCK_TTL_MS') || '5000', 10);
    this.lockRetries = parseInt(
      this.configService.get<string>('SESSION_LOCK_MAX_RETRIES') || '5',
      10,
    );
    this.lockRetryDelayMs = parseInt(
      this.configService.get<string>('SESSION_LOCK_RETRY_DELAY_MS') || '120',
      10,
    );
  }

  /**
   * Executes on Module Destroy.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }

  /**
   * Creates session.
   * @param userId The user identifier.
   * @param metadata The data to process.
   * @returns The resulting string value.
   */
  async createSession(userId: string, metadata: Record<string, unknown> = {}): Promise<string> {
    const sid = randomUUID();
    const now = Date.now();
    const session: ISessionRecord = {
      sid,
      userId,
      metadata,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.redis.set(
      this.sessionKey(sid),
      JSON.stringify(session),
      'EX',
      this.sessionTtlSeconds,
    );
    return sid;
  }

  async getSession(sid: string): Promise<ISessionRecord | null> {
    const data = await this.redis.get(this.sessionKey(sid));
    if (!data) {
      return this.migrateLegacySessionIfNeeded(sid);
    }

    try {
      return JSON.parse(data) as ISessionRecord;
    } catch {
      this.logger.warn(`Invalid session payload for sid=${sid}`);
      return null;
    }
  }

  /**
   * Executes touch Session.
   * @param sid The sid.
   * @param metadataPatch The data to process.
   */
  async touchSession(sid: string, metadataPatch: Record<string, unknown> = {}): Promise<void> {
    const session = await this.getSession(sid);
    if (!session) {
      return;
    }

    const nextSession: ISessionRecord = {
      ...session,
      metadata: {
        ...session.metadata,
        ...metadataPatch,
      },
      updatedAt: Date.now(),
      version: session.version + 1,
    };

    await this.redis
      .multi()
      .set(this.sessionKey(sid), JSON.stringify(nextSession))
      .expire(this.sessionKey(sid), this.sessionTtlSeconds)
      .exec();
  }

  /**
   * Removes session.
   * @param sid The sid.
   */
  async removeSession(sid: string): Promise<void> {
    await this.redis.del(this.sessionKey(sid));
  }

  /**
   * Executes migrate Session.
   * @param oldSid The old sid.
   * @param newSid The new sid.
   * @returns The resulting string value.
   */
  async migrateSession(oldSid: string, newSid = randomUUID()): Promise<string> {
    const existing = await this.getSession(oldSid);
    if (!existing) {
      return newSid;
    }

    const migrated: ISessionRecord = {
      ...existing,
      sid: newSid,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    await this.redis
      .multi()
      .set(this.sessionKey(newSid), JSON.stringify(migrated), 'EX', this.sessionTtlSeconds)
      .del(this.sessionKey(oldSid))
      .exec();

    return newSid;
  }

  /**
   * Executes with Lock.
   * @param lockName The lock name.
   * @param handler The handler.
   * @returns The resulting t.
   */
  async withLock<T>(lockName: string, handler: () => Promise<T>): Promise<T> {
    const lockKey = `lock:${lockName}`;
    const lockToken = randomUUID();
    let locked = false;

    for (let attempt = 0; attempt <= this.lockRetries; attempt += 1) {
      const response = await this.redis.set(lockKey, lockToken, 'PX', this.lockTtlMs, 'NX');
      if (response === 'OK') {
        locked = true;
        break;
      }

      if (attempt < this.lockRetries) {
        await this.delay(this.lockRetryDelayMs);
      }
    }

    if (!locked) {
      throw new Error(`Could not acquire lock: ${lockName}`);
    }

    try {
      return await handler();
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  private async migrateLegacySessionIfNeeded(sid: string): Promise<ISessionRecord | null> {
    const legacyKey = `${this.legacySessionPrefix}${sid}`;
    const currentKey = this.sessionKey(sid);

    if (legacyKey === currentKey) {
      return null;
    }

    const legacyData = await this.redis.get(legacyKey);
    if (!legacyData) {
      return null;
    }

    const now = Date.now();
    const migrated: ISessionRecord = {
      sid,
      userId: 'unknown',
      metadata: {
        source: 'legacy',
        payload: legacyData,
      },
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.redis
      .multi()
      .set(currentKey, JSON.stringify(migrated), 'EX', this.sessionTtlSeconds)
      .del(legacyKey)
      .exec();

    this.logger.log(`Migrated legacy session sid=${sid} to prefix=${this.sessionPrefix}`);
    return migrated;
  }

  private async releaseLock(lockKey: string, lockToken: string): Promise<void> {
    const releaseScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
    `;

    await this.redis.eval(releaseScript, 1, lockKey, lockToken);
  }

  private sessionKey(sid: string): string {
    return `${this.sessionPrefix}${sid}`;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

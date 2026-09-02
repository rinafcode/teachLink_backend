import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Redis } from 'ioredis';
import {
  IDEMPOTENCY_DEFAULT_LOCK_TTL_MS,
  IDEMPOTENCY_DEFAULT_POLL_INTERVAL_MS,
  IDEMPOTENCY_DEFAULT_TTL_SECONDS,
  IDEMPOTENCY_DEFAULT_WAIT_TIMEOUT_MS,
  IDEMPOTENCY_REDIS_CLIENT,
} from '../constants/idempotency.constants';

export interface IdempotencyRecord {
  idempotencyKey: string;
  fingerprint: string;
  statusCode: number;
  response: unknown;
  responseHeaders?: Record<string, string>;
  cachedAt: number;
  ttlSeconds?: number;
}

export interface IdempotencyLockRecord {
  idempotencyKey: string;
  fingerprint: string;
  lockedAt: number;
}

export interface IdempotencyRequestScope {
  method: string;
  routePath: string;
  idempotencyKey: string;
}

export interface IdempotencyRequestFingerprint {
  method: string;
  routePath: string;
  body: unknown;
  query: unknown;
  params: unknown;
}

export interface IdempotencyRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  ttl?(key: string): Promise<number>;
  keys?(pattern: string): Promise<string[]>;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly defaultTTLSeconds: number;

  constructor(
    @Inject(IDEMPOTENCY_REDIS_CLIENT) private readonly redisClient: Redis | IdempotencyRedisClient,
    private readonly configService: ConfigService,
  ) {
    this.defaultTTLSeconds = this.configService.get<number>(
      'IDEMPOTENCY_TTL_SECONDS',
      IDEMPOTENCY_DEFAULT_TTL_SECONDS,
    );
  }

  async getRecord(key: string): Promise<IdempotencyRecord | null> {
    try {
      const record = await this.redisClient.get(this.getRecordKey(key));
      if (!record) {
        return null;
      }

      const parsedRecord = this.parseRecord<IdempotencyRecord>(record, key);
      if (!parsedRecord) {
        await this.deleteRecord(key);
        return null;
      }

      return parsedRecord;
    } catch (error) {
      this.logger.warn(`Failed to read idempotency record for key ${key}: ${String(error)}`);
      return null;
    }
  }

  async saveRecord(key: string, record: IdempotencyRecord): Promise<void> {
    try {
      const ttlSeconds = record.ttlSeconds ?? this.defaultTTLSeconds;
      await this.redisClient.set(this.getRecordKey(key), JSON.stringify(record), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.error(
        'Error saving idempotency record',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async deleteRecord(key: string): Promise<void> {
    try {
      await this.redisClient.del(this.getRecordKey(key));
    } catch (error) {
      this.logger.error(
        'Error deleting idempotency record',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async getLockRecord(key: string): Promise<IdempotencyLockRecord | null> {
    try {
      const record = await this.redisClient.get(this.getLockKey(key));
      if (!record) {
        return null;
      }

      const parsedRecord = this.parseRecord<IdempotencyLockRecord>(record, key);
      if (!parsedRecord) {
        await this.deleteLockRecord(key);
        return null;
      }

      return parsedRecord;
    } catch (error) {
      this.logger.warn(`Failed to read idempotency lock record for key ${key}: ${String(error)}`);
      return null;
    }
  }

  async acquireLock(
    key: string,
    fingerprint: string,
    ttlMs = IDEMPOTENCY_DEFAULT_LOCK_TTL_MS,
  ): Promise<boolean> {
    try {
      const result = await this.redisClient.set(
        this.getLockKey(key),
        JSON.stringify({
          idempotencyKey: key,
          fingerprint,
          lockedAt: Date.now(),
        } satisfies IdempotencyLockRecord),
        'PX',
        ttlMs,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      this.logger.error(
        'Error acquiring idempotency lock',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await this.redisClient.del(this.getLockKey(key));
    } catch (error) {
      this.logger.error(
        'Error releasing idempotency lock',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async waitForRecord(
    key: string,
    timeoutMs = IDEMPOTENCY_DEFAULT_WAIT_TIMEOUT_MS,
    pollIntervalMs = IDEMPOTENCY_DEFAULT_POLL_INTERVAL_MS,
  ): Promise<IdempotencyRecord | null> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const record = await this.getRecord(key);
      if (record) {
        return record;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return null;
  }

  async cleanup(): Promise<void> {
    try {
      const keys = this.redisClient.keys ? await this.redisClient.keys('idempotency:*') : [];
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      this.logger.error(
        'Error cleaning up idempotency records',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  buildScopeKey(scope: IdempotencyRequestScope): string {
    return crypto
      .createHash('sha256')
      .update(`${scope.method.toUpperCase()}:${scope.routePath}:${scope.idempotencyKey}`)
      .digest('hex');
  }

  buildFingerprint(fingerprint: IdempotencyRequestFingerprint): string {
    const payload = JSON.stringify({
      method: fingerprint.method.toUpperCase(),
      routePath: fingerprint.routePath,
      body: fingerprint.body ?? null,
      query: fingerprint.query ?? null,
      params: fingerprint.params ?? null,
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private parseRecord<T>(value: string, key: string): T | null {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!this.isValidRecordShape(parsed)) {
        this.logger.warn(`Malformed idempotency payload for key ${key}`);
        return null;
      }
      return parsed as T;
    } catch (error) {
      this.logger.warn(`Malformed idempotency payload for key ${key}: ${String(error)}`);
      return null;
    }
  }

  private isValidRecordShape(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const record = value as Record<string, unknown>;
    const hasValidString = (field: string) =>
      typeof record[field] === 'string' && record[field] !== '';
    const hasValidNumber = (field: string) =>
      typeof record[field] === 'number' && Number.isFinite(record[field]);

    if (!hasValidString('idempotencyKey') || !hasValidString('fingerprint')) {
      return false;
    }

    if (!hasValidNumber('statusCode') || !hasValidNumber('cachedAt')) {
      return false;
    }

    if (record.responseHeaders !== undefined) {
      const headers = record.responseHeaders;
      if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) {
        return false;
      }
    }

    if (record.ttlSeconds !== undefined && typeof record.ttlSeconds !== 'number') {
      return false;
    }

    return true;
  }

  private async deleteLockRecord(key: string): Promise<void> {
    try {
      await this.redisClient.del(this.getLockKey(key));
    } catch (error) {
      this.logger.warn(`Failed to delete lock record for key ${key}: ${String(error)}`);
    }
  }

  private getRecordKey(key: string): string {
    return `idempotency:record:${key}`;
  }

  private getLockKey(key: string): string {
    return `idempotency:lock:${key}`;
  }
}

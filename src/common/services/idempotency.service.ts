import { Injectable, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface IdempotencyRecord {
  idempotencyKey: string;
  statusCode: number;
  response: any;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class IdempotencyService implements OnModuleInit {
  private redisClient: Redis;
  private defaultTTL: number;

  constructor(private configService: ConfigService) {
    this.defaultTTL = this.configService.get<number>('IDEMPOTENCY_TTL_SECONDS', 86400); // 24 hours default
  }

  async onModuleInit() {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', undefined),
    });

    this.redisClient.on('error', (error) => {
      console.error('Redis idempotency client error:', error);
    });
  }

  async getRecord(key: string): Promise<IdempotencyRecord | null> {
    try {
      const record = await this.redisClient.get(`idempotency:${key}`);
      if (record) {
        return JSON.parse(record);
      }
      return null;
    } catch (error) {
      console.error('Error getting idempotency record:', error);
      return null;
    }
  }

  async saveRecord(key: string, record: IdempotencyRecord): Promise<void> {
    try {
      const ttl = record.ttl || this.defaultTTL;
      await this.redisClient.set(
        `idempotency:${key}`,
        JSON.stringify(record),
        'EX',
        ttl,
      );
    } catch (error) {
      console.error('Error saving idempotency record:', error);
    }
  }

  async deleteRecord(key: string): Promise<void> {
    try {
      await this.redisClient.del(`idempotency:${key}`);
    } catch (error) {
      console.error('Error deleting idempotency record:', error);
    }
  }

  async acquireLock(key: string, ttlMs: number = 5000): Promise<boolean> {
    try {
      const result = await this.redisClient.set(
        `idempotency:lock:${key}`,
        '1',
        'PX',
        ttlMs,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      console.error('Error acquiring idempotency lock:', error);
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await this.redisClient.del(`idempotency:lock:${key}`);
    } catch (error) {
      console.error('Error releasing idempotency lock:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      const keys = await this.redisClient.keys('idempotency:*');
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      console.error('Error cleaning up idempotency records:', error);
    }
  }

  generateKey(userId: string, endpoint: string, payload: any): string {
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto
      .createHash('sha256')
      .update(`${userId}:${endpoint}:${payloadHash}`)
      .digest('hex');
  }
}

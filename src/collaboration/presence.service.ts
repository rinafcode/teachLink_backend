import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { SESSION_REDIS_CLIENT } from '../session/session.constants';

export interface PresenceInfo {
  userId: string;
  sessionId: string;
  joinedAt: Date;
  lastSeenAt: Date;
  cursorPosition?: number;
}

const PRESENCE_KEY_PREFIX = 'collab:presence:';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(@Inject(SESSION_REDIS_CLIENT) private readonly redis: Redis) {}

  async join(sessionId: string, userId: string): Promise<PresenceInfo> {
    const now = new Date();
    const info: PresenceInfo = { userId, sessionId, joinedAt: now, lastSeenAt: now };
    const key = `${PRESENCE_KEY_PREFIX}${sessionId}`;
    await this.redis.hset(key, userId, JSON.stringify(info));
    return info;
  }

  async leave(sessionId: string, userId: string): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${sessionId}`;
    await this.redis.hdel(key, userId);
    const remaining = await this.redis.hlen(key);
    if (remaining === 0) {
      await this.redis.del(key);
    }
  }

  async updateCursor(sessionId: string, userId: string, cursorPosition: number): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${sessionId}`;
    const raw = await this.redis.hget(key, userId);
    if (!raw) return;
    const info: PresenceInfo = JSON.parse(raw);
    info.cursorPosition = cursorPosition;
    info.lastSeenAt = new Date();
    await this.redis.hset(key, userId, JSON.stringify(info));
  }

  async getPresence(sessionId: string): Promise<PresenceInfo[]> {
    const key = `${PRESENCE_KEY_PREFIX}${sessionId}`;
    const entries = await this.redis.hgetall(key);
    return Object.values(entries).map((raw) => {
      const info: PresenceInfo = JSON.parse(raw);
      info.joinedAt = new Date(info.joinedAt);
      info.lastSeenAt = new Date(info.lastSeenAt);
      return info;
    });
  }

  async isPresent(sessionId: string, userId: string): Promise<boolean> {
    const key = `${PRESENCE_KEY_PREFIX}${sessionId}`;
    return (await this.redis.hexists(key, userId)) === 1;
  }
}

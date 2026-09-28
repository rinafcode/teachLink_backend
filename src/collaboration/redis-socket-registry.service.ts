import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { SESSION_REDIS_CLIENT } from '../session/session.constants';

const SOCKET_KEY_PREFIX = 'collab:socket:';
const SOCKET_TTL_SECONDS = 86400;
const DISCONNECT_GRACE_SECONDS = 30;

export interface SocketMapping {
  sessionId: string;
  userId: string;
}

@Injectable()
export class RedisSocketRegistryService {
  private readonly logger = new Logger(RedisSocketRegistryService.name);

  constructor(@Inject(SESSION_REDIS_CLIENT) private readonly redis: Redis) {}

  async set(socketId: string, mapping: SocketMapping): Promise<void> {
    const key = `${SOCKET_KEY_PREFIX}${socketId}`;
    await this.redis.hset(key, mapping);
    await this.redis.expire(key, SOCKET_TTL_SECONDS);
  }

  async get(socketId: string): Promise<SocketMapping | null> {
    const key = `${SOCKET_KEY_PREFIX}${socketId}`;
    const result = await this.redis.hgetall(key);
    if (!result.sessionId || !result.userId) return null;
    return { sessionId: result.sessionId, userId: result.userId };
  }

  async remove(socketId: string): Promise<void> {
    const key = `${SOCKET_KEY_PREFIX}${socketId}`;
    await this.redis.del(key);
  }

  async setGraceDisconnect(socketId: string, mapping: SocketMapping): Promise<void> {
    const key = `${SOCKET_KEY_PREFIX}${socketId}`;
    await this.redis.hset(key, mapping);
    await this.redis.expire(key, DISCONNECT_GRACE_SECONDS);
  }
}

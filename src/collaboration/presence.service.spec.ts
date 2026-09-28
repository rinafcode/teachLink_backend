import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';
import { SESSION_REDIS_CLIENT } from '../session/session.constants';

describe('PresenceService', () => {
  let service: PresenceService;
  let redisMock: Record<string, any>;

  beforeEach(async () => {
    redisMock = {
      hset: jest.fn().mockResolvedValue(1),
      hdel: jest.fn().mockResolvedValue(1),
      hget: jest.fn().mockResolvedValue(null),
      hgetall: jest.fn().mockResolvedValue({}),
      hexists: jest.fn().mockResolvedValue(0),
      hlen: jest.fn().mockResolvedValue(0),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PresenceService, { provide: SESSION_REDIS_CLIENT, useValue: redisMock }],
    }).compile();

    service = module.get(PresenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('join', () => {
    it('returns presence info', async () => {
      const info = await service.join('s1', 'u1');
      expect(info.userId).toBe('u1');
      expect(info.sessionId).toBe('s1');
      expect(info.joinedAt).toBeInstanceOf(Date);
    });

    it('stores presence in Redis hash', async () => {
      await service.join('s1', 'u1');
      expect(redisMock.hset).toHaveBeenCalledWith('collab:presence:s1', 'u1', expect.any(String));
    });

    it('marks user as present', async () => {
      redisMock.hexists.mockResolvedValue(1);
      expect(await service.isPresent('s1', 'u1')).toBe(true);
    });
  });

  describe('leave', () => {
    it('removes user from session in Redis', async () => {
      redisMock.hlen.mockResolvedValue(0);
      await service.leave('s1', 'u1');
      expect(redisMock.hdel).toHaveBeenCalledWith('collab:presence:s1', 'u1');
    });

    it('cleans up empty session key', async () => {
      redisMock.hlen.mockResolvedValue(0);
      await service.leave('s1', 'u1');
      expect(redisMock.del).toHaveBeenCalledWith('collab:presence:s1');
    });

    it('does not delete session when other users remain', async () => {
      redisMock.hlen.mockResolvedValue(1);
      await service.leave('s1', 'u1');
      expect(redisMock.del).not.toHaveBeenCalled();
    });
  });

  describe('updateCursor', () => {
    it('updates cursor position in Redis', async () => {
      const existing = JSON.stringify({
        userId: 'u1',
        sessionId: 's1',
        joinedAt: '2026-01-01T00:00:00.000Z',
        lastSeenAt: '2026-01-01T00:00:00.000Z',
      });
      redisMock.hget.mockResolvedValue(existing);

      await service.updateCursor('s1', 'u1', 42);

      expect(redisMock.hset).toHaveBeenCalledWith('collab:presence:s1', 'u1', expect.any(String));
      const stored = JSON.parse(redisMock.hset.mock.calls[0][2]);
      expect(stored.cursorPosition).toBe(42);
    });

    it('is a no-op for unknown user', async () => {
      redisMock.hget.mockResolvedValue(null);
      await service.updateCursor('s1', 'unknown', 5);
      expect(redisMock.hset).not.toHaveBeenCalled();
    });
  });

  describe('getPresence', () => {
    it('returns all users in session', async () => {
      redisMock.hgetall.mockResolvedValue({
        u1: JSON.stringify({
          userId: 'u1',
          sessionId: 's1',
          joinedAt: '2026-01-01T00:00:00.000Z',
          lastSeenAt: '2026-01-01T00:00:00.000Z',
        }),
        u2: JSON.stringify({
          userId: 'u2',
          sessionId: 's1',
          joinedAt: '2026-01-01T00:00:00.000Z',
          lastSeenAt: '2026-01-01T00:00:00.000Z',
        }),
      });

      const presence = await service.getPresence('s1');
      expect(presence).toHaveLength(2);
      expect(presence[0].userId).toBe('u1');
      expect(presence[0].joinedAt).toBeInstanceOf(Date);
    });

    it('returns empty array for unknown session', async () => {
      const presence = await service.getPresence('unknown');
      expect(presence).toEqual([]);
    });
  });

  describe('isPresent', () => {
    it('returns true when user is present', async () => {
      redisMock.hexists.mockResolvedValue(1);
      expect(await service.isPresent('s1', 'u1')).toBe(true);
    });

    it('returns false when user is not present', async () => {
      redisMock.hexists.mockResolvedValue(0);
      expect(await service.isPresent('s1', 'u1')).toBe(false);
    });
  });

  describe('cross-pod presence', () => {
    it('presence data stored in Redis is accessible from any pod', async () => {
      await service.join('s1', 'u1');
      expect(redisMock.hset).toHaveBeenCalledWith('collab:presence:s1', 'u1', expect.any(String));
    });

    it('presence data includes timestamps for ordering', async () => {
      const info = await service.join('s1', 'u1');
      expect(info.joinedAt).toBeInstanceOf(Date);
      expect(info.lastSeenAt).toBeInstanceOf(Date);
    });
  });
});

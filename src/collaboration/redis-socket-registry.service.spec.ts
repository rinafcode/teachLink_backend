import { Test, TestingModule } from '@nestjs/testing';
import { RedisSocketRegistryService } from './redis-socket-registry.service';
import { SESSION_REDIS_CLIENT } from '../session/session.constants';

describe('RedisSocketRegistryService', () => {
  let service: RedisSocketRegistryService;
  let redisMock: Record<string, any>;

  beforeEach(async () => {
    redisMock = {
      hset: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({}),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisSocketRegistryService,
        { provide: SESSION_REDIS_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = module.get(RedisSocketRegistryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('set', () => {
    it('stores socket mapping in Redis with TTL', async () => {
      await service.set('sock-1', { sessionId: 's1', userId: 'u1' });

      expect(redisMock.hset).toHaveBeenCalledWith('collab:socket:sock-1', {
        sessionId: 's1',
        userId: 'u1',
      });
      expect(redisMock.expire).toHaveBeenCalledWith('collab:socket:sock-1', 86400);
    });
  });

  describe('get', () => {
    it('returns mapping when present', async () => {
      redisMock.hgetall.mockResolvedValue({ sessionId: 's1', userId: 'u1' });

      const result = await service.get('sock-1');

      expect(result).toEqual({ sessionId: 's1', userId: 'u1' });
      expect(redisMock.hgetall).toHaveBeenCalledWith('collab:socket:sock-1');
    });

    it('returns null when no mapping exists', async () => {
      redisMock.hgetall.mockResolvedValue({});

      const result = await service.get('sock-unknown');

      expect(result).toBeNull();
    });

    it('returns null when partial mapping exists', async () => {
      redisMock.hgetall.mockResolvedValue({ sessionId: 's1' });

      const result = await service.get('sock-1');

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes socket mapping from Redis', async () => {
      await service.remove('sock-1');

      expect(redisMock.del).toHaveBeenCalledWith('collab:socket:sock-1');
    });
  });

  describe('setGraceDisconnect', () => {
    it('sets mapping with short TTL for reconnect grace period', async () => {
      await service.setGraceDisconnect('sock-1', { sessionId: 's1', userId: 'u1' });

      expect(redisMock.hset).toHaveBeenCalledWith('collab:socket:sock-1', {
        sessionId: 's1',
        userId: 'u1',
      });
      expect(redisMock.expire).toHaveBeenCalledWith('collab:socket:sock-1', 30);
    });
  });

  describe('disconnect cleanup', () => {
    it('socket mapping is removed on disconnect via setGraceDisconnect', async () => {
      const mapping = { sessionId: 's1', userId: 'u1' };
      await service.set('sock-1', mapping);
      jest.clearAllMocks();

      await service.setGraceDisconnect('sock-1', mapping);

      expect(redisMock.hset).toHaveBeenCalledWith('collab:socket:sock-1', mapping);
      expect(redisMock.expire).toHaveBeenCalledWith('collab:socket:sock-1', 30);
    });
  });

  describe('cross-pod socket membership', () => {
    it('multiple sockets for same session are tracked independently', async () => {
      await service.set('sock-1', { sessionId: 's1', userId: 'u1' });
      await service.set('sock-2', { sessionId: 's1', userId: 'u2' });

      expect(redisMock.hset).toHaveBeenCalledTimes(2);
      expect(redisMock.hset).toHaveBeenNthCalledWith(1, 'collab:socket:sock-1', {
        sessionId: 's1',
        userId: 'u1',
      });
      expect(redisMock.hset).toHaveBeenNthCalledWith(2, 'collab:socket:sock-2', {
        sessionId: 's1',
        userId: 'u2',
      });
    });

    it('same user with different sockets tracked separately', async () => {
      await service.set('sock-1', { sessionId: 's1', userId: 'u1' });
      await service.set('sock-2', { sessionId: 's1', userId: 'u1' });

      redisMock.hgetall.mockResolvedValueOnce({ sessionId: 's1', userId: 'u1' });
      redisMock.hgetall.mockResolvedValueOnce({ sessionId: 's1', userId: 'u1' });

      const r1 = await service.get('sock-1');
      const r2 = await service.get('sock-2');

      expect(r1).toEqual({ sessionId: 's1', userId: 'u1' });
      expect(r2).toEqual({ sessionId: 's1', userId: 'u1' });
    });
  });

  describe('reconnect restores membership', () => {
    it('new socket can read mapping set by previous connection', async () => {
      await service.set('sock-new', { sessionId: 's1', userId: 'u1' });

      redisMock.hgetall.mockResolvedValue({ sessionId: 's1', userId: 'u1' });

      const result = await service.get('sock-new');

      expect(result).toEqual({ sessionId: 's1', userId: 'u1' });
    });

    it('old socket mapping expires after grace period', async () => {
      await service.setGraceDisconnect('sock-old', { sessionId: 's1', userId: 'u1' });

      expect(redisMock.expire).toHaveBeenCalledWith('collab:socket:sock-old', 30);
    });
  });
});

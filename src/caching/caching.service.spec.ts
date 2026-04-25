import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CachingService } from './caching.service';
import { CACHE_REDIS_CLIENT } from './caching.constants';
import { createMockRedisClient, createMockConfigService } from 'test/utils/mock-factories';
import Redis from 'ioredis';

describe('CachingService', () => {
  let service: CachingService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    // ─── Initialize Mocks ──────────────────────────────────────────────────
    mockRedis = createMockRedisClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CachingService,
        {
          provide: ConfigService,
          useValue: createMockConfigService({ CACHE_TTL: 300 }),
        },
        {
          provide: CACHE_REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<CachingService>(CachingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return cached value', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: '1', name: 'Test' }));

      const result = await service.get('test:key');

      expect(result).toEqual({ id: '1', name: 'Test' });
      expect(mockRedis.get).toHaveBeenCalledWith('test:key');
    });

    it('should return null when key not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('test:key');

      expect(result).toBeNull();
    });

    it('should return raw string for non-JSON values', async () => {
      mockRedis.get.mockResolvedValue('raw-string-value');

      const result = await service.get('test:key');

      expect(result).toBe('raw-string-value');
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      await service.set('test:key', { data: 'value' }, 60);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:key',
        JSON.stringify({ data: 'value' }),
        'EX',
        60,
      );
    });

    it('should set value without TTL when ttl is 0', async () => {
      await service.set('test:key', { data: 'value' }, 0);

      expect(mockRedis.set).toHaveBeenCalledWith('test:key', JSON.stringify({ data: 'value' }));
    });

    it('should set string value directly', async () => {
      await service.set('test:key', 'string-value');

      expect(mockRedis.set).toHaveBeenCalledWith('test:key', 'string-value', 'EX', 300);
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      await service.del('test:key');

      expect(mockRedis.del).toHaveBeenCalledWith('test:key');
    });
  });

  describe('delPattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', ['key1', 'key2']]);

      const result = await service.delPattern('test:*');

      expect(result).toBe(2);
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
    });

    it('should return 0 when no keys match', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      const result = await service.delPattern('test:*');

      expect(result).toBe(0);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value when available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));

      const factory = jest.fn();
      const result = await service.getOrSet('test:key', factory, 60);

      expect(result).toEqual({ cached: true });
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result when not available', async () => {
      mockRedis.get.mockResolvedValue(null);
      const factory = jest.fn().mockResolvedValue({ new: 'data' });

      const result = await service.getOrSet('test:key', factory, 60);

      expect(result).toEqual({ new: 'data' });
      expect(factory).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists('test:key');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.exists('test:key');

      expect(result).toBe(false);
    });
  });

  describe('getTtl', () => {
    it('should return TTL of key', async () => {
      mockRedis.ttl.mockResolvedValue(120);

      const result = await service.getTtl('test:key');

      expect(result).toBe(120);
    });
  });

  describe('incr', () => {
    it('should increment by 1 by default', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const result = await service.incr('counter');

      expect(result).toBe(1);
      expect(mockRedis.incr).toHaveBeenCalledWith('counter');
    });

    it('should increment by specified amount', async () => {
      mockRedis.incrby.mockResolvedValue(5);

      const result = await service.incr('counter', 5);

      expect(result).toBe(5);
      expect(mockRedis.incrby).toHaveBeenCalledWith('counter', 5);
    });
  });

  describe('mget', () => {
    it('should get multiple values', async () => {
      mockRedis.mget.mockResolvedValue([
        JSON.stringify({ id: 1 }),
        null,
        JSON.stringify({ id: 3 }),
      ]);

      const result = await service.mget(['key1', 'key2', 'key3']);

      expect(result).toEqual([{ id: 1 }, null, { id: 3 }]);
    });

    it('should return empty array for empty input', async () => {
      const result = await service.mget([]);

      expect(result).toEqual([]);
      expect(mockRedis.mget).not.toHaveBeenCalled();
    });
  });

  describe('mset', () => {
    it('should set multiple values', async () => {
      const mockPipeline = {
        set: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      await service.mset(
        [
          { key: 'key1', value: { id: 1 } },
          { key: 'key2', value: { id: 2 } },
        ],
        60,
      );

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.info
        .mockResolvedValueOnce('used_memory_human:1.5M\n')
        .mockResolvedValueOnce('db0:keys=100\n')
        .mockResolvedValueOnce('keyspace_hits:1000\nkeyspace_misses:100\n');

      const result = await service.getStats();

      expect(result).toEqual({
        keys: 100,
        memory: '1.5M',
        hits: 1000,
        misses: 100,
      });
    });
  });

  describe('generateKey', () => {
    it('should generate key with prefix and parts', () => {
      const result = service.generateKey('prefix', 'part1', 'part2');

      expect(result).toBe('prefix:part1:part2');
    });
  });

  describe('getTTLConstants', () => {
    it('should return TTL constants', () => {
      const result = service.getTTLConstants();

      expect(result).toHaveProperty('USER_SESSION');
      expect(result).toHaveProperty('COURSE_DETAILS');
      expect(result).toHaveProperty('SEARCH_RESULTS');
    });
  });
});

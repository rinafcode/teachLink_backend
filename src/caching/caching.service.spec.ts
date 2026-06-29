import { CachingService } from './caching.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';

describe('CachingService', () => {
  let service: CachingService;
  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    clear: jest.Mock;
  };
  let metrics: { updateCacheHitRate: jest.Mock };

  beforeEach(() => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    metrics = { updateCacheHitRate: jest.fn() };
    (cacheManager as any).store = {
      keys: jest.fn().mockResolvedValue(['cache:test:1', 'cache:test:2']),
    };
    service = new CachingService(
      cacheManager as never,
      metrics as unknown as MetricsCollectionService,
    );
  });

  describe('getOrSet', () => {
    it('returns cached value without calling factory on hit', async () => {
      cacheManager.get.mockResolvedValue({ id: '1' });
      const factory = jest.fn();

      const result = await service.getOrSet('cache:test:1', factory, 60);

      expect(result).toEqual({ id: '1' });
      expect(factory).not.toHaveBeenCalled();
      expect(service.getStats().hits).toBe(1);
      expect(service.getStats().misses).toBe(0);
    });

    it('populates cache from factory on miss', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const factory = jest.fn().mockResolvedValue({ id: '2' });

      const result = await service.getOrSet('cache:test:2', factory, 120);

      expect(result).toEqual({ id: '2' });
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).toHaveBeenCalledWith('cache:test:2', { id: '2' }, 120000);
      expect(service.getStats().misses).toBe(1);
    });
  });

  describe('deleteByPattern', () => {
    it('uses store.keys to delete matching keys when client scan is unavailable', async () => {
      await service.deleteByPattern('cache:test:*');
      expect((cacheManager as any).store.keys).toHaveBeenCalledWith('cache:test:*');
      expect(cacheManager.del).toHaveBeenCalledWith('cache:test:1');
      expect(cacheManager.del).toHaveBeenCalledWith('cache:test:2');
    });
  });

  describe('hit rate metrics', () => {
    it('calculates hit rate and publishes to metrics', async () => {
      cacheManager.get.mockResolvedValueOnce('cached').mockResolvedValueOnce(undefined);
      await service.get('hit-key');
      await service.get('miss-key');

      service.publishHitRateMetrics('application');

      expect(service.getStats().hitRate).toBe(50);
      expect(metrics.updateCacheHitRate).toHaveBeenCalledWith('application', 50);
    });
  });
});

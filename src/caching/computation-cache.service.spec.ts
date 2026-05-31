import { ComputationCacheService } from './computation-cache.service';
import { CachingService } from './caching.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { COMPUTATION_TTL } from './caching.constants';

describe('ComputationCacheService', () => {
  let service: ComputationCacheService;
  let caching: {
    get: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
  };
  let metrics: { updateCacheHitRate: jest.Mock };

  beforeEach(() => {
    caching = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    metrics = { updateCacheHitRate: jest.fn() };
    service = new ComputationCacheService(
      caching as unknown as CachingService,
      metrics as unknown as MetricsCollectionService,
    );
  });

  // ── Cache hit ──────────────────────────────────────────────────────────────

  it('returns cached value and does not call factory on hit', async () => {
    const cached = [{ id: 'user-1', totalPoints: 500 }];
    caching.get.mockResolvedValue(cached);
    const factory = jest.fn();

    const result = await service.compute(
      'leaderboard:top-players',
      '10',
      factory,
      COMPUTATION_TTL.LEADERBOARD,
    );

    expect(result).toEqual(cached);
    expect(factory).not.toHaveBeenCalled();
    expect(service.getStats().hits).toBe(1);
    expect(service.getStats().misses).toBe(0);
  });

  // ── Cache miss ─────────────────────────────────────────────────────────────

  it('calls factory and caches result on miss', async () => {
    caching.get.mockResolvedValue(undefined);
    const data = [{ id: 'user-1', totalPoints: 500 }];
    const factory = jest.fn().mockResolvedValue(data);

    const result = await service.compute(
      'leaderboard:top-players',
      '10',
      factory,
      COMPUTATION_TTL.LEADERBOARD,
    );

    expect(result).toEqual(data);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(caching.set).toHaveBeenCalledWith(
      expect.stringContaining('leaderboard:top-players'),
      data,
      COMPUTATION_TTL.LEADERBOARD,
    );
    expect(service.getStats().misses).toBe(1);
  });

  // ── Stampede protection ────────────────────────────────────────────────────

  it('deduplicates concurrent requests for the same key', async () => {
    caching.get.mockResolvedValue(undefined);
    const data = [{ id: 'user-1', totalPoints: 500 }];
    const factory = jest.fn().mockResolvedValue(data);

    const [r1, r2, r3] = await Promise.all([
      service.compute('leaderboard:top-players', '10', factory, COMPUTATION_TTL.LEADERBOARD),
      service.compute('leaderboard:top-players', '10', factory, COMPUTATION_TTL.LEADERBOARD),
      service.compute('leaderboard:top-players', '10', factory, COMPUTATION_TTL.LEADERBOARD),
    ]);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(data);
    expect(r2).toEqual(data);
    expect(r3).toEqual(data);
  });

  // ── User rank computation ──────────────────────────────────────────────────

  it('caches user rank computation with correct key and TTL', async () => {
    caching.get.mockResolvedValue(undefined);
    const factory = jest.fn().mockResolvedValue(42);

    const result = await service.compute(
      'leaderboard:user-rank',
      'user-abc',
      factory,
      COMPUTATION_TTL.USER_RANK,
    );

    expect(result).toBe(42);
    expect(caching.set).toHaveBeenCalledWith(
      expect.stringContaining('user-rank'),
      42,
      COMPUTATION_TTL.USER_RANK,
    );
  });

  // ── Invalidation ───────────────────────────────────────────────────────────

  it('deletes the correct cache key on invalidation', async () => {
    await service.invalidate('leaderboard:top-players', '10');

    expect(caching.delete).toHaveBeenCalledWith(
      expect.stringContaining('leaderboard:top-players'),
    );
  });

  // ── Performance metrics ────────────────────────────────────────────────────

  it('calculates hit rate correctly after mixed hits and misses', async () => {
    caching.get
      .mockResolvedValueOnce([{ id: 'user-1' }])
      .mockResolvedValueOnce(undefined);

    const factory = jest.fn().mockResolvedValue([]);

    await service.compute('leaderboard:top-players', '10', factory, COMPUTATION_TTL.LEADERBOARD);
    await service.compute('leaderboard:top-players', '5', factory, COMPUTATION_TTL.LEADERBOARD);

    const stats = service.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(50);
  });

  it('publishes computation hit rate to Prometheus metrics', async () => {
    caching.get.mockResolvedValue([{ id: 'user-1' }]);
    const factory = jest.fn();

    await service.compute('leaderboard:top-players', '10', factory, COMPUTATION_TTL.LEADERBOARD);

    service.publishMetrics();

    expect(metrics.updateCacheHitRate).toHaveBeenCalledWith('computation', 100);
  });

  it('publishes zero hit rate when no requests have been made', () => {
    service.publishMetrics();
    expect(metrics.updateCacheHitRate).toHaveBeenCalledWith('computation', 0);
  });
});

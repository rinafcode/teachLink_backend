import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdaptiveTTLService, AdaptiveTTLRule } from './adaptive-ttl.service';

jest.mock('../config/cache.config', () => ({
  getSharedRedisClient: jest.fn(() => mockRedis),
}));

const rule: AdaptiveTTLRule = {
  keyPattern: 'cache:course:*',
  minTtl: 180,
  maxTtl: 1800,
  hitRateThreshold: 0.6,
  accessFrequencyThreshold: 5,
  adjustmentFactor: 1.3,
  enabled: true,
};

let mockRedis: {
  get: jest.Mock;
  set: jest.Mock;
  incr: jest.Mock;
  zadd: jest.Mock;
  zremrangebyrank: jest.Mock;
  zrevrange: jest.Mock;
  zrangebyscore: jest.Mock;
  zremrangebyscore: jest.Mock;
};

describe('AdaptiveTTLService', () => {
  let service: AdaptiveTTLService;
  let eventEmitter: { emit: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(JSON.stringify([rule])),
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      zadd: jest.fn().mockResolvedValue(1),
      zremrangebyrank: jest.fn().mockResolvedValue(0),
      zrevrange: jest.fn().mockResolvedValue([]),
      zrangebyscore: jest.fn().mockResolvedValue([]),
      zremrangebyscore: jest.fn().mockResolvedValue(0),
    };
    eventEmitter = { emit: jest.fn() };
    configService = { get: jest.fn() };

    service = new AdaptiveTTLService(
      configService as never,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('getAdaptiveTTL', () => {
    it('returns the default TTL when no rule matches the key', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([rule]));

      const ttl = await service.getAdaptiveTTL('cache:unmatched:1', 100);

      expect(ttl).toBe(100);
    });

    it('returns the default TTL when the matching rule is disabled', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([{ ...rule, enabled: false }]));

      const ttl = await service.getAdaptiveTTL('cache:course:1', 100);

      expect(ttl).toBe(100);
    });

    it('clamps the default TTL to the rule bounds when no metrics are supplied', async () => {
      const ttl = await service.getAdaptiveTTL('cache:course:1', 10);
      expect(ttl).toBe(rule.minTtl);
    });

    it('increases TTL and records the adjustment for high hit rate and frequency', async () => {
      const ttl = await service.getAdaptiveTTL('cache:course:1', 500, 0.9, 10);

      expect(ttl).toBe(Math.round(500 * rule.adjustmentFactor));
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.ttl.adjusted',
        expect.objectContaining({ key: 'cache:course:1', reason: expect.any(String) }),
      );
    });

    it('decreases TTL for a low hit rate', async () => {
      const ttl = await service.getAdaptiveTTL('cache:course:1', 500, 0.1, 10);
      expect(ttl).toBeLessThan(500);
      expect(ttl).toBeGreaterThanOrEqual(rule.minTtl);
    });

    it('treats corrupt rule data as a miss and returns the default TTL', async () => {
      mockRedis.get.mockResolvedValue('not-json');

      const ttl = await service.getAdaptiveTTL('cache:course:1', 250);

      expect(ttl).toBe(250);
      expect(mockRedis.incr).toHaveBeenCalledWith('cache:metrics:deserialization_failures_total');
    });
  });

  describe('getRecentAdjustments', () => {
    it('parses stored adjustment records', async () => {
      const record = {
        key: 'k',
        oldTtl: 1,
        newTtl: 2,
        reason: 'r',
        hitRate: 1,
        accessFrequency: 1,
        timestamp: new Date().toISOString(),
      };
      mockRedis.zrevrange.mockResolvedValue([JSON.stringify(record)]);

      const result = await service.getRecentAdjustments(10);

      expect(result).toEqual([record]);
      expect(mockRedis.zrevrange).toHaveBeenCalledWith(expect.any(String), 0, 9);
    });

    it('skips corrupt entries rather than throwing', async () => {
      mockRedis.zrevrange.mockResolvedValue(['not-json']);

      const result = await service.getRecentAdjustments();

      expect(result).toEqual([]);
    });
  });

  describe('getAdjustmentStats', () => {
    it('aggregates increased/decreased counts and the average ratio', async () => {
      mockRedis.zrangebyscore.mockResolvedValue([
        JSON.stringify({ key: 'a', oldTtl: 100, newTtl: 200 }),
        JSON.stringify({ key: 'a', oldTtl: 100, newTtl: 50 }),
      ]);

      const stats = await service.getAdjustmentStats(24);

      expect(stats.totalAdjustments).toBe(2);
      expect(stats.increasedTtl).toBe(1);
      expect(stats.decreasedTtl).toBe(1);
      expect(stats.topAdjustedKeys).toEqual(['a']);
    });

    it('returns a neutral average (1) when there are no adjustments in range', async () => {
      mockRedis.zrangebyscore.mockResolvedValue([]);

      const stats = await service.getAdjustmentStats();

      expect(stats).toEqual({
        totalAdjustments: 0,
        increasedTtl: 0,
        decreasedTtl: 0,
        averageAdjustment: 1,
        topAdjustedKeys: [],
      });
    });
  });

  describe('getRules', () => {
    it('returns the parsed rules from Redis', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([rule]));
      await expect(service.getRules()).resolves.toEqual([rule]);
    });

    it('falls back to the built-in defaults when Redis has no rules stored', async () => {
      mockRedis.get.mockResolvedValue(null);
      const rules = await service.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('falls back to the built-in defaults on corrupt data', async () => {
      mockRedis.get.mockResolvedValue('not-json');
      const rules = await service.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe('updateRules', () => {
    it('persists the rules and emits an update event', async () => {
      await service.updateRules([rule]);

      expect(mockRedis.set).toHaveBeenCalledWith(expect.any(String), JSON.stringify([rule]));
      expect(eventEmitter.emit).toHaveBeenCalledWith('cache.adaptive_ttl.rules_updated', [rule]);
    });
  });

  describe('updateRule', () => {
    it('appends a new rule when the pattern does not already exist', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([rule]));
      const newRule = { ...rule, keyPattern: 'cache:new:*' };

      await service.updateRule(newRule);

      const persisted = JSON.parse(mockRedis.set.mock.calls[0][1]);
      expect(persisted).toEqual(expect.arrayContaining([rule, newRule]));
    });

    it('replaces an existing rule with the same key pattern', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([rule]));
      const updated = { ...rule, maxTtl: 9999 };

      await service.updateRule(updated);

      const persisted = JSON.parse(mockRedis.set.mock.calls[0][1]);
      expect(persisted).toEqual([updated]);
    });
  });

  describe('removeRule', () => {
    it('removes a rule matching the given pattern', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([rule]));

      await service.removeRule(rule.keyPattern);

      expect(mockRedis.set).toHaveBeenCalledWith(expect.any(String), JSON.stringify([]));
    });

    it('is a no-op when no rule matches the pattern', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([rule]));

      await service.removeRule('cache:does-not-exist:*');

      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('toggleRule', () => {
    it('flips the enabled flag for a matching rule', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([rule]));

      await service.toggleRule(rule.keyPattern, false);

      const persisted = JSON.parse(mockRedis.set.mock.calls[0][1]);
      expect(persisted[0].enabled).toBe(false);
    });

    it('is a no-op when no rule matches the pattern', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([rule]));

      await service.toggleRule('cache:does-not-exist:*', false);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOldAdjustments', () => {
    it('logs when stale records were removed', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(5);
      await expect(service.cleanupOldAdjustments()).resolves.toBeUndefined();
      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
    });

    it('is silent when nothing needed cleaning up', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      await expect(service.cleanupOldAdjustments()).resolves.toBeUndefined();
    });
  });

  describe('handlePerformanceAnalysis', () => {
    it('emits a recommendation when the adaptive TTL differs from the current TTL', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([rule]));

      await service.handlePerformanceAnalysis({
        key: 'cache:course:1',
        hitRate: 0.9,
        accessFrequency: 10,
        currentTtl: 500,
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.ttl.recommendation',
        expect.objectContaining({ key: 'cache:course:1', currentTtl: 500 }),
      );
    });

    it('does not emit a recommendation when the TTL would not change', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([{ ...rule, enabled: false }]));

      await service.handlePerformanceAnalysis({
        key: 'cache:course:1',
        hitRate: 0.9,
        accessFrequency: 10,
        currentTtl: 500,
      });

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'cache.ttl.recommendation',
        expect.anything(),
      );
    });
  });
});

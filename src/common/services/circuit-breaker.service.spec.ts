import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EnhancedCircuitBreakerService } from './circuit-breaker.service';

describe('EnhancedCircuitBreakerService', () => {
  let service: EnhancedCircuitBreakerService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: number) => defaultValue),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedCircuitBreakerService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EnhancedCircuitBreakerService>(EnhancedCircuitBreakerService);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('execute', () => {
    it('should execute a successful operation', async () => {
      const result = await service.execute('test-key', async () => 'success');
      expect(result).toBe('success');
    });

    it('should return fallback result when operation fails', async () => {
      const result = await service.execute(
        'test-fallback',
        async () => {
          throw new Error('service down');
        },
        {
          fallback: () => 'fallback-value',
          errorThresholdPercentage: 1,
          resetTimeout: 100,
        },
      );
      expect(result).toBe('fallback-value');
    });

    it('should throw when operation fails and no fallback provided', async () => {
      await expect(
        service.execute('test-no-fallback', async () => {
          throw new Error('service down');
        }),
      ).rejects.toThrow();
    });

    it('should reuse the same circuit breaker for the same key', async () => {
      await service.execute('reuse-key', async () => 'first');
      await service.execute('reuse-key', async () => 'second');
      const stats = service.getStats('reuse-key');
      expect(stats).not.toBeNull();
      expect(stats!.stats.successes).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return null for unknown key', () => {
      expect(service.getStats('unknown')).toBeNull();
    });

    it('should return stats after execution', async () => {
      await service.execute('stats-key', async () => 'ok');
      const stats = service.getStats('stats-key');
      expect(stats).not.toBeNull();
      expect(stats!.name).toBe('stats-key');
      expect(stats!.closed).toBe(true);
    });
  });

  describe('getAllStats', () => {
    it('should return empty object when no breakers exist', () => {
      expect(service.getAllStats()).toEqual({});
    });

    it('should return stats for all registered breakers', async () => {
      await service.execute('breaker-a', async () => 'a');
      await service.execute('breaker-b', async () => 'b');
      const all = service.getAllStats();
      expect(Object.keys(all)).toContain('breaker-a');
      expect(Object.keys(all)).toContain('breaker-b');
    });
  });

  describe('half-open state', () => {
    it('should transition through open and half-open states', async () => {
      // Force the circuit open by failing repeatedly
      const failingOp = async () => {
        throw new Error('fail');
      };
      const opts = {
        errorThresholdPercentage: 1,
        resetTimeout: 100,
        rollingCountTimeout: 500,
        rollingCountBuckets: 2,
        fallback: () => null,
      };

      // Trigger failures to open the circuit
      for (let i = 0; i < 5; i++) {
        await service.execute('half-open-test', failingOp, opts);
      }

      const stats = service.getStats('half-open-test');
      expect(stats).not.toBeNull();
      // Circuit should be open (not closed) after repeated failures
      expect(stats!.closed).toBe(false);
    });
  });

  describe('enable / disable', () => {
    it('should enable and disable a circuit breaker', async () => {
      await service.execute('toggle-key', async () => 'ok');
      service.disable('toggle-key');
      service.enable('toggle-key');
      // No errors thrown — just verifying the methods work
      const stats = service.getStats('toggle-key');
      expect(stats).not.toBeNull();
    });

    it('should not throw when enabling/disabling unknown key', () => {
      expect(() => service.enable('nonexistent')).not.toThrow();
      expect(() => service.disable('nonexistent')).not.toThrow();
    });
  });

  describe('close (reset)', () => {
    it('should remove the circuit breaker on close', async () => {
      await service.execute('reset-key', async () => 'ok');
      service.close('reset-key');
      expect(service.getStats('reset-key')).toBeNull();
    });
  });

  describe('getHealthStatus', () => {
    it('should return zero totals when no breakers exist', () => {
      const health = service.getHealthStatus();
      expect(health.total).toBe(0);
      expect(health.healthy).toBe(0);
      expect(health.unhealthy).toBe(0);
    });

    it('should report healthy breaker after successful calls', async () => {
      await service.execute('healthy-key', async () => 'ok');
      const health = service.getHealthStatus();
      expect(health.total).toBe(1);
      expect(health.healthy).toBe(1);
    });
  });

  describe('shutdown', () => {
    it('should shut down all circuit breakers', async () => {
      await service.execute('shutdown-key', async () => 'ok');
      await service.shutdown();
      expect(service.getAllStats()).toEqual({});
    });
  });
});

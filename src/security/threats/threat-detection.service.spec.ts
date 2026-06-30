import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenOperationException } from '../../common/exceptions/app.exceptions';
import { ThreatDetectionService } from './threat-detection.service';
import { THREAT_REDIS_CLIENT } from './threat-detection.constants';
import { createMockRedisClient } from '../../../test/utils/mock-factories';

/**
 * Helper: build a Test module that wires the service with the supplied
 * Redis mock + ConfigService. Centralised because every test in the suite
 * builds this module the same way.
 */
async function buildModule(redis: ReturnType<typeof createMockRedisClient>) {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      ThreatDetectionService,
      { provide: THREAT_REDIS_CLIENT, useValue: redis },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string, fallback?: unknown) => {
            // Use the documented defaults; tests can override via direct injection.
            if (key === 'THREAT_FAILED_ATTEMPT_THRESHOLD') return 10;
            if (key === 'THREAT_FAILED_ATTEMPT_WINDOW_SECONDS') return 15 * 60;
            if (key === 'THREAT_FAILED_ATTEMPT_KEY_PREFIX')
              return 'threat:failed-attempts:';
            return fallback;
          }),
        },
      },
    ],
  }).compile();
  return moduleRef.get(ThreatDetectionService);
}

describe('ThreatDetectionService (Issue #798 — Redis-backed counters)', () => {
  let service: ThreatDetectionService;
  let redis: ReturnType<typeof createMockRedisClient>;

  beforeEach(async () => {
    redis = createMockRedisClient();
    service = await buildModule(redis);
  });

  describe('recordFailure — INCR + first-call EXPIRE', () => {
    it('calls INCR with the per-IP key', async () => {
      redis.incr.mockResolvedValueOnce(1);

      await service.recordFailure('192.168.0.1');

      expect(redis.incr).toHaveBeenCalledWith('threat:failed-attempts:192.168.0.1');
    });

    it('sets EXPIRE on the first failure (INCR returned 1)', async () => {
      redis.incr.mockResolvedValueOnce(1);

      await service.recordFailure('192.168.0.1');

      expect(redis.expire).toHaveBeenCalledWith(
        'threat:failed-attempts:192.168.0.1',
        15 * 60,
      );
    });

    it('does NOT set EXPIRE on subsequent calls in the same window', async () => {
      redis.incr.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
      await service.recordFailure('192.168.0.1');
      await service.recordFailure('192.168.0.1');
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('does not throw when Redis INCR fails (fails open for tracking)', async () => {
      redis.incr.mockRejectedValueOnce(new Error('connection lost'));
      await expect(service.recordFailure('192.168.0.1')).resolves.toBeUndefined();
    });
  });

  describe('analyzeRequest — GET + threshold check', () => {
    it('does not throw when no failure counter is stored', async () => {
      redis.get.mockResolvedValueOnce(null);
      await expect(service.analyzeRequest('192.168.0.2')).resolves.toBeUndefined();
    });

    it('does not throw while count is at or below the threshold', async () => {
      redis.get.mockResolvedValueOnce('10');
      await expect(service.analyzeRequest('192.168.0.2')).resolves.toBeUndefined();
    });

    it('throws ForbiddenOperationException when count exceeds the threshold', async () => {
      redis.get.mockResolvedValueOnce('11');
      await expect(service.analyzeRequest('192.168.0.2')).rejects.toBeInstanceOf(
        ForbiddenOperationException,
      );
    });

    it('fails open when Redis GET errors (does not block legitimate traffic)', async () => {
      redis.get.mockRejectedValueOnce(new Error('connection lost'));
      await expect(service.analyzeRequest('192.168.0.2')).resolves.toBeUndefined();
    });
  });

  describe('reset', () => {
    it('DELs the per-IP key', async () => {
      redis.del.mockResolvedValueOnce(1);
      await service.reset('192.168.0.3');
      expect(redis.del).toHaveBeenCalledWith('threat:failed-attempts:192.168.0.3');
    });

    it('does not throw when Redis DEL fails', async () => {
      redis.del.mockRejectedValueOnce(new Error('connection lost'));
      await expect(service.reset('192.168.0.3')).resolves.toBeUndefined();
    });
  });

  describe('expiry semantics (Issue #798 acceptance)', () => {
    it('a failure counter that has expired no longer triggers analyseRequest', async () => {
      // Simulate an empty store: Redis returned null after the previous key
      // expired — meaning the failure window cleared correctly.
      redis.get.mockResolvedValue(null);
      await expect(service.analyzeRequest('192.168.0.4')).resolves.toBeUndefined();
    });
  });

  describe('introspection helpers', () => {
    it('resolveKey returns the prefixed Redis key', () => {
      expect(service.resolveKey('10.0.0.1')).toBe('threat:failed-attempts:10.0.0.1');
    });

    it('has() returns true when EXISTS returns > 0', async () => {
      redis.exists.mockResolvedValueOnce(1);
      expect(await service.has('10.0.0.1')).toBe(true);
    });

    it('has() returns false when EXISTS returns 0', async () => {
      redis.exists.mockResolvedValueOnce(0);
      expect(await service.has('10.0.0.1')).toBe(false);
    });

    it('has() degrades to false on Redis error', async () => {
      redis.exists.mockRejectedValueOnce(new Error('boom'));
      expect(await service.has('10.0.0.1')).toBe(false);
    });
  });
});

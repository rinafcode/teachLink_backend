import { ThreatDetectionService } from './threat-detection.service';

/**
 * Helper: build a string IP for index `n` so we can deterministically
 * know which entry should be the "oldest" (first inserted).
 */
function ipFor(index: number): string {
  return `10.0.${Math.floor(index / 256) % 256}.${index % 256}`;
}

describe('ThreatDetectionService', () => {
  describe('behaviour (preserves existing semantics)', () => {
    it('does not throw before the failure threshold is reached', () => {
      const svc = new ThreatDetectionService({ max: 100, ttlMs: 60_000 });
      const ip = '192.168.0.1';

      // 11 attempts is still allowed (attempts > 10 means 11+ throws)
      for (let i = 0; i < 10; i++) svc.recordFailure(ip);
      expect(() => svc.analyzeRequest(ip)).not.toThrow();
    });

    it('throws ForbiddenOperationException once attempts exceed 10', () => {
      const svc = new ThreatDetectionService({ max: 100, ttlMs: 60_000 });
      const ip = '192.168.0.2';

      for (let i = 0; i < 11; i++) svc.recordFailure(ip);
      expect(() => svc.analyzeRequest(ip)).toThrow(/Suspicious activity detected/);
    });

    it('clears the failure counter on reset()', () => {
      const svc = new ThreatDetectionService({ max: 100, ttlMs: 60_000 });
      const ip = '192.168.0.3';

      for (let i = 0; i < 11; i++) svc.recordFailure(ip);
      expect(() => svc.analyzeRequest(ip)).toThrow();

      svc.reset(ip);
      expect(() => svc.analyzeRequest(ip)).not.toThrow();
      expect(svc.has(ip)).toBe(false);
    });
  });

  describe('bounded cap (issue #882 acceptance criterion: 50k max)', () => {
    it('caps the cache at the configured maximum entries', () => {
      const cap = 50_000;
      const svc = new ThreatDetectionService({ max: cap, ttlMs: 60 * 60 * 1000 });

      for (let i = 0; i < cap + 1; i++) {
        svc.recordFailure(ipFor(i));
      }

      // Bounded at exactly the cap (spec: "Map size is bounded at 50,000 entries")
      expect(svc.getCacheSize()).toBe(cap);
    });

    it('evicts the oldest entry when inserting the (cap+1)-th entry', () => {
      const cap = 50_000;
      const svc = new ThreatDetectionService({ max: cap, ttlMs: 60 * 60 * 1000 });

      const firstIp = ipFor(0);

      // Fill to capacity
      for (let i = 0; i < cap; i++) {
        svc.recordFailure(ipFor(i));
      }
      expect(svc.has(firstIp)).toBe(true);

      // The (cap+1)-th insertion triggers LRU eviction; the oldest entry
      // (the first one we inserted) should be gone.
      svc.recordFailure(ipFor(cap));

      expect(svc.has(firstIp)).toBe(false);
      expect(svc.getCacheSize()).toBe(cap);
    });

    it('uses the documented 50,000 entry cap when no options are provided', () => {
      const svc = new ThreatDetectionService();
      expect(svc.getCacheSize()).toBe(0);
      // Sanity: the default must match the documented value.
      expect(ThreatDetectionService.MAX_ENTRIES).toBe(50_000);
    });
  });

  describe('TTL (issue #882 acceptance criterion: 15-minute expiry)', () => {
    it('expires entries after the configured TTL has elapsed', async () => {
      // Tiny TTL keeps the test fast while still exercising the same code path.
      const ttlMs = 30;
      const svc = new ThreatDetectionService({ max: 100, ttlMs });

      const ip = '192.168.0.42';
      for (let i = 0; i < 11; i++) svc.recordFailure(ip);
      expect(() => svc.analyzeRequest(ip)).toThrow();

      // Wait past the TTL so the entry is reaped.
      await new Promise((resolve) => setTimeout(resolve, ttlMs + 50));

      // After expiry the entry is gone — analyseRequest should not throw.
      expect(() => svc.analyzeRequest(ip)).not.toThrow();
      expect(svc.has(ip)).toBe(false);
    });

    it('uses a 15-minute TTL by default', () => {
      expect(ThreatDetectionService.TTL_MS).toBe(15 * 60 * 1000);
    });
  });
});

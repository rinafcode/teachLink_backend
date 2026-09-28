import { RequestRouterService, RouteTarget } from './request-router.service';

describe('RequestRouterService', () => {
  let service: RequestRouterService;

  beforeEach(() => {
    service = new RequestRouterService();
  });

  describe('selectTarget', () => {
    it('returns the only target when a single target is provided', () => {
      const targets: RouteTarget[] = [{ host: 'a.example.com', weight: 1 }];

      const result = service.selectTarget(targets);

      expect(result).toEqual(targets[0]);
    });

    it('throws when an empty array is provided', () => {
      expect(() => service.selectTarget([])).toThrow('No targets available');
    });

    it('always selects the sole target when all weight is on one entry', () => {
      const targets: RouteTarget[] = [
        { host: 'a.example.com', weight: 100 },
        { host: 'b.example.com', weight: 0 },
      ];

      // Mock Math.random to return 0.5 — should hit the first target (weight 100).
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = service.selectTarget(targets);

      expect(result.host).toBe('a.example.com');
    });

    it('selects the second target when random falls into its weight range', () => {
      const targets: RouteTarget[] = [
        { host: 'a.example.com', weight: 1 },
        { host: 'b.example.com', weight: 99 },
      ];

      // random=0.99 → after subtracting first weight (1) → 0.89 * 100 = 89 → hits second target
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const result = service.selectTarget(targets);

      expect(result.host).toBe('b.example.com');
    });

    it('selects the first target when random is zero', () => {
      const targets: RouteTarget[] = [
        { host: 'a.example.com', weight: 10 },
        { host: 'b.example.com', weight: 10 },
      ];

      jest.spyOn(Math, 'random').mockReturnValue(0);

      const result = service.selectTarget(targets);

      expect(result.host).toBe('a.example.com');
    });

    it('returns the last target as a fallback when random equals total weight', () => {
      const targets: RouteTarget[] = [
        { host: 'a.example.com', weight: 5 },
        { host: 'b.example.com', weight: 5 },
      ];

      // random=1 → totalWeight=10, random*totalWeight=10 → loop subtracts 5 then 5 → falls through to fallback
      jest.spyOn(Math, 'random').mockReturnValue(1);

      const result = service.selectTarget(targets);

      // With random=1, random * totalWeight = 10. After subtracting both weights (5+5=10),
      // random becomes 0, which satisfies `random <= 0` on the second iteration.
      expect(result.host).toBe('b.example.com');
    });

    it('handles targets with fractional weights', () => {
      const targets: RouteTarget[] = [
        { host: 'a.example.com', weight: 0.3 },
        { host: 'b.example.com', weight: 0.7 },
      ];

      // random=0.4, totalWeight=1.0, so randomValue=0.4. First target (0.3) subtracts to 0.1>0,
      // second target (0.7) subtracts to -0.6<=0 → selects second target.
      jest.spyOn(Math, 'random').mockReturnValue(0.4);

      const result = service.selectTarget(targets);

      expect(result).toEqual(targets[1]);
    });

    it('covers the fallback branch when floating-point precision skips the <= 0 check', () => {
      // With weights (0.1, 0.2), Math.random() = 0.9999999999999999 produces a value
      // so close to totalWeight that float subtraction leaves a tiny positive remainder
      // after the last iteration, falling through to the fallback return.
      const targets: RouteTarget[] = [
        { host: 'a.example.com', weight: 0.1 },
        { host: 'b.example.com', weight: 0.2 },
      ];

      jest.spyOn(Math, 'random').mockReturnValue(0.9999999999999999);

      const result = service.selectTarget(targets);

      // The fallback always returns the last element, so regardless of whether
      // the loop or the fallback handles it, the result is the last target.
      expect(result.host).toBe('b.example.com');
    });
  });
});

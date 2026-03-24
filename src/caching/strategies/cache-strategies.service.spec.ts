import { Test, TestingModule } from '@nestjs/testing';
import { CacheStrategiesService } from './cache-strategies.service';
import { CACHE_EVENTS } from '../caching.constants';

describe('CacheStrategiesService', () => {
  let service: CacheStrategiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheStrategiesService],
    }).compile();

    service = module.get<CacheStrategiesService>(CacheStrategiesService);
  });

  describe('getStrategy', () => {
    it('should return course details strategy', () => {
      const strategy = service.getStrategy('course:details');

      expect(strategy).toBeDefined();
      expect(strategy?.ttl).toBe(300);
      expect(strategy?.prefix).toBe('cache:course');
    });

    it('should return user profile strategy', () => {
      const strategy = service.getStrategy('user:profile');

      expect(strategy).toBeDefined();
      expect(strategy?.ttl).toBe(600);
      expect(strategy?.prefix).toBe('cache:user:profile');
    });

    it('should return undefined for unknown strategy', () => {
      const strategy = service.getStrategy('unknown:strategy');

      expect(strategy).toBeUndefined();
    });
  });

  describe('getTtl', () => {
    it('should return TTL for known strategy', () => {
      const ttl = service.getTtl('course:details');

      expect(ttl).toBe(300);
    });

    it('should return default TTL for unknown strategy', () => {
      const ttl = service.getTtl('unknown');

      expect(ttl).toBe(300);
    });
  });

  describe('getPrefix', () => {
    it('should return prefix for known strategy', () => {
      const prefix = service.getPrefix('course:details');

      expect(prefix).toBe('cache:course');
    });

    it('should return default prefix for unknown strategy', () => {
      const prefix = service.getPrefix('unknown');

      expect(prefix).toBe('cache');
    });
  });

  describe('getInvalidationEvents', () => {
    it('should return events for course strategy', () => {
      const events = service.getInvalidationEvents('course:details');

      expect(events).toContain(CACHE_EVENTS.COURSE_UPDATED);
      expect(events).toContain(CACHE_EVENTS.COURSE_DELETED);
    });
  });

  describe('getRelatedPatterns', () => {
    it('should return patterns for strategy', () => {
      const patterns = service.getRelatedPatterns('course:details');

      expect(patterns).toContain('cache:course:*');
      expect(patterns).toContain('cache:courses:list:*');
    });
  });

  describe('getStrategiesForEvent', () => {
    it('should return strategies for COURSE_UPDATED event', () => {
      const strategies = service.getStrategiesForEvent(CACHE_EVENTS.COURSE_UPDATED);

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some((s) => s.name === 'course:details')).toBe(true);
    });
  });

  describe('getPatternsForEvent', () => {
    it('should return patterns for COURSE_UPDATED event', () => {
      const patterns = service.getPatternsForEvent(CACHE_EVENTS.COURSE_UPDATED);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some((p) => p.includes('course'))).toBe(true);
    });
  });

  describe('getAllStrategies', () => {
    it('should return all registered strategies', () => {
      const strategies = service.getAllStrategies();

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some((s) => s.name === 'course:details')).toBe(true);
      expect(strategies.some((s) => s.name === 'user:profile')).toBe(true);
    });
  });

  describe('buildKey', () => {
    it('should build key with parts', () => {
      const key = service.buildKey('course:details', '123');

      expect(key).toBe('cache:course:123');
    });

    it('should build key with multiple parts', () => {
      const key = service.buildKey('course:details', '123', 'modules');

      expect(key).toBe('cache:course:123:modules');
    });
  });

  describe('getDefaultStrategy', () => {
    it('should return default strategy', () => {
      const strategy = service.getDefaultStrategy();

      expect(strategy.name).toBe('default');
      expect(strategy.ttl).toBe(300);
    });
  });

  describe('registerStrategy', () => {
    it('should register new strategy', () => {
      service.registerStrategy({
        name: 'custom:strategy',
        ttl: 1000,
        prefix: 'cache:custom',
        invalidateOnEvents: [],
        relatedPatterns: ['cache:custom:*'],
      });

      const strategy = service.getStrategy('custom:strategy');
      expect(strategy).toBeDefined();
      expect(strategy?.ttl).toBe(1000);
    });
  });
});

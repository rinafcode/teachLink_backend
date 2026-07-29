import { SearchService, SEARCH_CACHE_TTL_MS } from './search.service';
import { Repository } from 'typeorm';
import { ElasticsearchService } from '@nestjs/elasticsearch';

/**
 * Issue #814 — verifies the SearchService constructs the new `to_tsquery`
 * parameter correctly, falls back gracefully when Elasticsearch is unavailable,
 * and sanitizes tsquery metacharacters in autocomplete.
 */
describe('SearchService (Issue #814 full-text search)', () => {
  let service: SearchService;
  let courseRepository: jest.Mocked<Repository<any>>;
  let elasticsearch: { search: jest.Mock; ping: jest.Mock };
  let isolationService: { getTenantId: jest.Mock };
  let metricsService: { searchFallbackCounter: { inc: jest.Mock } };

  beforeEach(() => {
    courseRepository = {
      createQueryBuilder: jest.fn(),
    } as any;

    elasticsearch = { search: jest.fn(), ping: jest.fn().mockResolvedValue(true) };
    isolationService = { getTenantId: jest.fn().mockReturnValue(null) };
    metricsService = { searchFallbackCounter: { inc: jest.fn() } };

    service = new SearchService(
      courseRepository as any,
      elasticsearch as any,
      metricsService as any,
      isolationService as any,
      undefined as any,
    );
  });

  function makeQb(result: { rows: any[]; total: number }) {
    const qb: any = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([result.rows, result.total]),
    };
    return qb;
  }

  it('uses tsvector ranking when a query is supplied and DB is the source', async () => {
    // Simulate ES unavailable so the DB path is taken.
    elasticsearch.search.mockRejectedValueOnce(new Error('ES down'));
    const qb = makeQb({ rows: [{ id: 'c1', title: 'Hooks' }], total: 1 });
    courseRepository.createQueryBuilder.mockReturnValueOnce(qb);

    await service.search('react hooks');

    // The call to qb.where(...) is a Brackets instance wrapping a nested
    // callback. Verify it's a single argument and that the inner callback
    // drove both the tsquery match and the ILIKE fallback.
    expect(qb.where).toHaveBeenCalledTimes(1);
    const bracketsArg = qb.where.mock.calls[0][0];
    expect(typeof bracketsArg).toBe('object');
    expect(typeof bracketsArg.whereFactory).toBe('function');

    // Simulate the bracket factory invocation to inspect what it produces.
    const innerQb = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
    };
    bracketsArg.whereFactory(innerQb);
    expect(innerQb.where).toHaveBeenCalledWith(
      expect.stringContaining('search_vector @@ plainto_tsquery'),
      { query: 'react hooks' },
    );
    expect(innerQb.orWhere).toHaveBeenCalledWith(expect.stringContaining('title ILIKE'), {
      fallback: expect.stringContaining('react'),
    });

    // When relevance ordering is in play, qb.orderBy is called with 'rank'.
    expect(qb.orderBy).toHaveBeenCalledWith('rank', 'DESC');
  });

  it('falls back to createdAt ordering when no query is supplied', async () => {
    elasticsearch.search.mockRejectedValueOnce(new Error('ES down'));
    const qb = makeQb({ rows: [], total: 0 });
    courseRepository.createQueryBuilder.mockReturnValueOnce(qb);

    await service.search('');

    expect(qb.where).not.toHaveBeenCalled();
    expect(qb.orderBy).toHaveBeenCalledWith('course.createdAt', 'DESC');
  });

  it('autocomplete uses simple tsquery with prefix operator', async () => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'c1', title: 'React' }]),
    };
    courseRepository.createQueryBuilder.mockReturnValueOnce(qb);

    await service.getAutoComplete('re');

    expect(qb.where).toHaveBeenCalledWith(
      expect.stringContaining('to_tsquery'),
      expect.objectContaining({ tsq: 're:*' }),
    );
  });

  it('autocomplete sanitizes tsquery metacharacters', async () => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    courseRepository.createQueryBuilder.mockReturnValueOnce(qb);

    await service.getAutoComplete('a&b|c');

    expect(qb.where).toHaveBeenCalledWith(
      expect.stringContaining('to_tsquery'),
      expect.objectContaining({ tsq: 'a b c:*' }),
    );
  });

  it('uses Elasticsearch fast-path when present and successful', async () => {
    await service.onModuleInit(); // Set to available

    elasticsearch.search.mockResolvedValueOnce({
      hits: { total: { value: 1 }, hits: [{ _source: { id: 'c1', title: 'X' } }] },
    } as any);

    const result = await service.search('react');

    expect(result.source).toBe('elasticsearch');
    expect(result.total).toBe(1);
    expect(elasticsearch.search).toHaveBeenCalled();
    expect(courseRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(metricsService.searchFallbackCounter.inc).not.toHaveBeenCalled();
  });

  it('falls back to DB when Elasticsearch throws', async () => {
    await service.onModuleInit(); // Set to available

    elasticsearch.search.mockRejectedValueOnce(new Error('ES down'));
    const qb = makeQb({ rows: [], total: 0 });
    courseRepository.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.search('react');

    expect(result.source).toBeUndefined();
    expect(result.query).toBe('react');
    expect(metricsService.searchFallbackCounter.inc).toHaveBeenCalledWith({ reason: 'error' });
  });

  it('falls back to DB when ping fails at startup', async () => {
    elasticsearch.ping.mockRejectedValueOnce(new Error('Down'));
    await service.onModuleInit(); // Sets to unavailable

    const qb = makeQb({ rows: [], total: 0 });
    courseRepository.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.search('react');

    // Should skip trying ES
    expect(elasticsearch.search).not.toHaveBeenCalled();
    expect(result.source).toBeUndefined();
    expect(metricsService.searchFallbackCounter.inc).toHaveBeenCalledWith({
      reason: 'unavailable',
    });
  });

  describe('Issue #889 — Tenant isolation enforcement on Elasticsearch queries', () => {
    it('tenant_a_search_excludes_tenant_b_content', async () => {
      await service.onModuleInit(); // Set ES as available
      isolationService.getTenantId.mockReturnValue('tenant-a');

      const mockEsDocs = [
        { _source: { id: 'c1', title: 'Course A1', tenantId: 'tenant-a' } },
        { _source: { id: 'c2', title: 'Course A2', tenantId: 'tenant-a' } },
      ];

      elasticsearch.search.mockImplementationOnce(async (params: any) => {
        const filterClause = params.query?.bool?.filter;
        expect(filterClause).toEqual(expect.arrayContaining([{ term: { tenantId: 'tenant-a' } }]));

        return {
          hits: {
            total: { value: mockEsDocs.length },
            hits: mockEsDocs,
          },
        };
      });

      const result = await service.search('Course');

      expect(result.source).toBe('elasticsearch');
      expect(result.results.length).toBe(2);
      const hasTenantBContent = result.results.some((doc: any) => doc.tenantId === 'tenant-b');
      expect(hasTenantBContent).toBe(false);
    });

    it('tenant_filter_applied_with_empty_query', async () => {
      await service.onModuleInit(); // Set ES as available
      isolationService.getTenantId.mockReturnValue('tenant-a');

      elasticsearch.search.mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.search('');

      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([{ term: { tenantId: 'tenant-a' } }]),
            }),
          }),
        }),
      );
    });

    it('tenant_filter_applied_across_all_query_methods', async () => {
      isolationService.getTenantId.mockReturnValue('tenant-a');

      elasticsearch.search.mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
      });

      await (service as any).tryElasticsearch('test', undefined, 1, 20);

      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([service.buildTenantFilter('tenant-a')]),
            }),
          }),
        }),
      );
    });
  });

  describe('Issue #917 — cache key uniqueness and TTL', () => {
    let cacheStore: Map<string, { value: any; ttl: number }>;
    let cacheManager: { get: jest.Mock; set: jest.Mock };
    let serviceWithCache: SearchService;

    beforeEach(() => {
      cacheStore = new Map();
      cacheManager = {
        get: jest.fn(async (key: string) => cacheStore.get(key)?.value),
        set: jest.fn(async (key: string, value: any, ttl: number) => {
          cacheStore.set(key, { value, ttl });
        }),
      };

      serviceWithCache = new SearchService(
        courseRepository as any,
        elasticsearch as any,
        metricsService as any,
        isolationService as any,
        cacheManager as any,
      );
    });

    it('produces different cache keys and page sizes for requests differing only in limit', async () => {
      // Make ES unavailable so the DB path is taken for both calls.
      elasticsearch.search.mockRejectedValue(new Error('ES down'));

      const qb5 = makeQb({
        rows: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }, { id: 'c5' }],
        total: 50,
      });
      const qb100 = makeQb({
        rows: Array.from({ length: 100 }, (_, i) => ({ id: `c${i}` })),
        total: 500,
      });
      courseRepository.createQueryBuilder.mockReturnValueOnce(qb5).mockReturnValueOnce(qb100);

      const result5 = await serviceWithCache.search('react', undefined, undefined, 1, 5);
      const result100 = await serviceWithCache.search('react', undefined, undefined, 1, 100);

      // Different page sizes in the returned results
      expect(result5.limit).toBe(5);
      expect(result100.limit).toBe(100);

      // Two distinct cache keys were written
      const setKeys = cacheManager.set.mock.calls.map((c) => c[0]);
      expect(setKeys).toHaveLength(2);
      expect(setKeys[0]).not.toBe(setKeys[1]);

      // The keys differ specifically in the limit segment (last component)
      expect(setKeys[0].endsWith(':5')).toBe(true);
      expect(setKeys[1].endsWith(':100')).toBe(true);
    });

    it('uses the same cache entry for filter objects with identical content but different key order', async () => {
      elasticsearch.search.mockRejectedValue(new Error('ES down'));

      const qb = makeQb({ rows: [{ id: 'c1', title: 'React' }], total: 1 });
      courseRepository.createQueryBuilder.mockReturnValue(qb);

      // First call with filters in one key order
      const filtersA = { price: { gte: 10, lte: 100 }, category: 'programming' };
      await serviceWithCache.search('react', filtersA, undefined, 1, 20);

      // Second call with the same filters in a different key order
      const filtersB = { category: 'programming', price: { lte: 100, gte: 10 } };
      const result = await serviceWithCache.search('react', filtersB, undefined, 1, 20);

      // The second call should have hit the cache — no new DB query
      expect(courseRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(result.limit).toBe(20);
    });

    it('sets the cache TTL to SEARCH_CACHE_TTL_MS (30_000 ms / 30 seconds)', async () => {
      elasticsearch.search.mockRejectedValue(new Error('ES down'));
      const qb = makeQb({ rows: [], total: 0 });
      courseRepository.createQueryBuilder.mockReturnValueOnce(qb);

      await serviceWithCache.search('react', undefined, undefined, 1, 20);

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        SEARCH_CACHE_TTL_MS,
      );
      expect(SEARCH_CACHE_TTL_MS).toBe(30_000);
    });
  });
});

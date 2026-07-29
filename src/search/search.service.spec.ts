import { BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';
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
});

// ---------------------------------------------------------------------------
// Issue #999 — getAvailableFilters derives facets from real data
// ---------------------------------------------------------------------------

describe('SearchService.getAvailableFilters (Issue #999)', () => {
  let service: SearchService;
  let courseRepository: jest.Mocked<Repository<any>>;

  /** Build a fluent query-builder mock whose getRawMany returns `rows`. */
  function makeAggQb(rows: any[]) {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
  }

  beforeEach(() => {
    courseRepository = { createQueryBuilder: jest.fn() } as any;
    service = new SearchService(
      courseRepository as any,
      { search: jest.fn() } as any,
      undefined,
      undefined as any,
    );
  });

  it('returns facet values and counts derived from published courses', async () => {
    const aggQb = makeAggQb([
      { category: 'programming', count: '12' },
      { category: 'design', count: '4' },
    ]);
    courseRepository.createQueryBuilder.mockReturnValueOnce(aggQb as any);

    const result = await service.getAvailableFilters();

    // Category facets reflect DB data
    expect(result.categories).toEqual([
      { value: 'programming', count: 12 },
      { value: 'design', count: 4 },
    ]);

    // levels and languages are empty arrays until those columns are added
    expect(result.levels).toEqual([]);
    expect(result.languages).toEqual([]);
  });

  it('filters only published courses in the aggregation query', async () => {
    const aggQb = makeAggQb([]);
    courseRepository.createQueryBuilder.mockReturnValueOnce(aggQb as any);

    await service.getAvailableFilters();

    expect(aggQb.where).toHaveBeenCalledWith('course.status = :status', {
      status: 'published',
    });
  });

  it('omits null and empty-string category values', async () => {
    const aggQb = makeAggQb([]);
    courseRepository.createQueryBuilder.mockReturnValueOnce(aggQb as any);

    await service.getAvailableFilters();

    expect(aggQb.andWhere).toHaveBeenCalledWith('course.category IS NOT NULL');
    expect(aggQb.andWhere).toHaveBeenCalledWith("course.category <> ''");
  });

  it('returns cached result on repeated calls within the TTL window', async () => {
    const cacheStore = new Map<string, any>();
    const cacheManager = {
      get: jest.fn((key: string) => Promise.resolve(cacheStore.get(key))),
      set: jest.fn((key: string, val: any) => {
        cacheStore.set(key, val);
        return Promise.resolve();
      }),
      del: jest.fn((key: string) => {
        cacheStore.delete(key);
        return Promise.resolve();
      }),
    } as any;

    service = new SearchService(
      courseRepository as any,
      { search: jest.fn() } as any,
      undefined,
      cacheManager,
    );

    const aggQb = makeAggQb([{ category: 'programming', count: '5' }]);
    courseRepository.createQueryBuilder.mockReturnValue(aggQb as any);

    // First call: cache miss — hits DB
    await service.getAvailableFilters();
    expect(courseRepository.createQueryBuilder).toHaveBeenCalledTimes(1);

    // Second call: cache hit — does NOT hit DB again
    await service.getAvailableFilters();
    expect(courseRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('invalidates the facets cache when a course is created or updated', async () => {
    const cacheStore = new Map<string, any>();
    const cacheManager = {
      get: jest.fn((key: string) => Promise.resolve(cacheStore.get(key))),
      set: jest.fn((key: string, val: any) => {
        cacheStore.set(key, val);
        return Promise.resolve();
      }),
      del: jest.fn((key: string) => {
        cacheStore.delete(key);
        return Promise.resolve();
      }),
    } as any;

    service = new SearchService(
      courseRepository as any,
      { search: jest.fn() } as any,
      undefined,
      cacheManager,
    );

    // Warm the cache
    const aggQb = makeAggQb([{ category: 'programming', count: '5' }]);
    courseRepository.createQueryBuilder.mockReturnValue(aggQb as any);
    await service.getAvailableFilters();
    expect(cacheManager.set).toHaveBeenCalledTimes(1);

    // Simulate a course creation event
    await (service as any).onCourseChanged({ id: 'course-new' });

    expect(cacheManager.del).toHaveBeenCalledWith(expect.stringContaining('facets'));

    // Next request re-runs the aggregation
    await service.getAvailableFilters();
    expect(courseRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it('returns empty arrays and logs error when aggregation fails', async () => {
    courseRepository.createQueryBuilder.mockImplementationOnce(() => {
      throw new Error('DB connection lost');
    });

    const result = await service.getAvailableFilters();

    expect(result).toEqual({ categories: [], levels: [], languages: [] });
  });
});

// ---------------------------------------------------------------------------
// Issue #999 — validateFilters rejects unknown category values
// ---------------------------------------------------------------------------

describe('SearchService.validateFilters (Issue #999)', () => {
  let service: SearchService;
  let courseRepository: jest.Mocked<Repository<any>>;

  function makeAggQb(rows: any[]) {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
  }

  beforeEach(() => {
    courseRepository = { createQueryBuilder: jest.fn() } as any;
    service = new SearchService(
      courseRepository as any,
      { search: jest.fn() } as any,
      undefined,
      undefined as any,
    );
  });

  it('passes when the category exists in the live facet set', async () => {
    const aggQb = makeAggQb([{ category: 'programming', count: '5' }]);
    courseRepository.createQueryBuilder.mockReturnValueOnce(aggQb as any);

    await expect(
      service.validateFilters({ category: 'programming' }),
    ).resolves.toBeUndefined();
  });

  it('passes when an array of categories are all valid', async () => {
    const aggQb = makeAggQb([
      { category: 'programming', count: '5' },
      { category: 'design', count: '3' },
    ]);
    courseRepository.createQueryBuilder.mockReturnValueOnce(aggQb as any);

    await expect(
      service.validateFilters({ category: ['programming', 'design'] }),
    ).resolves.toBeUndefined();
  });

  it('throws BadRequestException for an unknown category string', async () => {
    const aggQb = makeAggQb([{ category: 'programming', count: '5' }]);
    courseRepository.createQueryBuilder.mockReturnValueOnce(aggQb as any);

    await expect(
      service.validateFilters({ category: 'web-development' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException listing all unknown values in the message', async () => {
    const aggQb = makeAggQb([{ category: 'programming', count: '5' }]);
    courseRepository.createQueryBuilder.mockReturnValueOnce(aggQb as any);

    const err = await service
      .validateFilters({ category: ['unknown-a', 'unknown-b'] })
      .catch((e) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).message).toContain('unknown-a');
    expect((err as BadRequestException).message).toContain('unknown-b');
  });

  it('passes when no category filter is supplied', async () => {
    await expect(service.validateFilters({})).resolves.toBeUndefined();
    // No DB query should be run
    expect(courseRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('search() returns 400 when a filter with an unknown category is passed', async () => {
    // Facet agg returns only 'programming'
    const aggQb = makeAggQb([{ category: 'programming', count: '5' }]);
    courseRepository.createQueryBuilder.mockReturnValueOnce(aggQb as any);

    await expect(
      service.search('', { category: 'nonexistent' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

/**
 * Issue #814 — verifies the SearchService constructs the new `to_tsquery`
 * parameter correctly, falls back gracefully when Elasticsearch is unavailable,
 * and sanitizes tsquery metacharacters in autocomplete.
 */
describe('SearchService (Issue #814 full-text search)', () => {
  let service: SearchService;
  let courseRepository: jest.Mocked<Repository<any>>;
  let elasticsearch: { search: jest.Mock };
  let isolationService: { getTenantId: jest.Mock };

  beforeEach(() => {
    courseRepository = {
      createQueryBuilder: jest.fn(),
    } as any;

    elasticsearch = { search: jest.fn() };
    isolationService = { getTenantId: jest.fn().mockReturnValue(null) };

    service = new SearchService(
      courseRepository as any,
      elasticsearch as any,
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
    elasticsearch.search.mockResolvedValueOnce({
      hits: { total: { value: 1 }, hits: [{ _source: { id: 'c1', title: 'X' } }] },
    } as any);

    const result = await service.search('react');

    expect(result.source).toBe('elasticsearch');
    expect(result.total).toBe(1);
    expect(elasticsearch.search).toHaveBeenCalled();
    expect(courseRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('falls back to DB when Elasticsearch throws', async () => {
    elasticsearch.search.mockRejectedValueOnce(new Error('ES down'));
    const qb = makeQb({ rows: [], total: 0 });
    courseRepository.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.search('react');

    expect(result.source).toBeUndefined();
    expect(result.query).toBe('react');
  });

  describe('Issue #889 — Tenant isolation enforcement on Elasticsearch queries', () => {
    it('tenant_a_search_excludes_tenant_b_content', async () => {
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
});

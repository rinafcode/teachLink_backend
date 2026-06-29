import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SEARCH_CONSTANTS } from './search.constants';
import { Course } from '../courses/entities/course.entity';

// ---------------------------------------------------------------------------
// Shared mock objects
// ---------------------------------------------------------------------------

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  setParameter: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  getMany: jest.fn().mockResolvedValue([]),
};

const mockCourseRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
};

// Elasticsearch stub — has no `connectionPool` so isElasticsearchAvailable()
// returns false, forcing the PG-FTS path in all unit tests.
const mockElasticsearch = {};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: NestElasticsearchService, useValue: mockElasticsearch },
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: getRepositoryToken(Course), useValue: mockCourseRepo },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Cache ──────────────────────────────────────────────────────────────────

  it('should use cache when available', async () => {
    const cached = {
      results: [{ id: '1' }],
      total: 1,
      page: 1,
      limit: 20,
      query: 'test',
      filters: {},
      facets: {},
    };
    mockCache.get.mockResolvedValue(cached);

    const result = await service.search('test', undefined, 'relevance', 1, 20);

    expect(result).toEqual(cached);
    expect(mockCourseRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  // ── Full-text search (PG-FTS path) ────────────────────────────────────────

  it('should use search_vector @@ plainto_tsquery instead of ILIKE for non-empty queries', async () => {
    mockCache.get.mockResolvedValue(undefined);
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.search('javascript', undefined, undefined, 1, 20);

    // The FTS where clause must contain the @@ operator.
    const whereCalls = mockQueryBuilder.where.mock.calls;
    expect(whereCalls.length).toBeGreaterThan(0);
    const ftsCall = whereCalls.find(
      (args: any[]) => typeof args[0] === 'string' && args[0].includes('@@'),
    );
    expect(ftsCall).toBeDefined();

    // Specifically must NOT use ILIKE with a leading wildcard.
    const ilikeCalls = whereCalls.filter(
      (args: any[]) =>
        typeof args[0] === 'string' &&
        args[0].includes('ILIKE') &&
        (args[1] as any)?.query?.startsWith('%'),
    );
    expect(ilikeCalls).toHaveLength(0);
  });

  it('should add ts_rank as a select alias for relevance scoring', async () => {
    mockCache.get.mockResolvedValue(undefined);
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.search('python', undefined, undefined, 1, 20);

    const addSelectCalls = mockQueryBuilder.addSelect.mock.calls;
    const rankCall = addSelectCalls.find(
      (args: any[]) => typeof args[0] === 'string' && args[0].includes('ts_rank'),
    );
    expect(rankCall).toBeDefined();
  });

  it('should skip the FTS where clause for an empty query', async () => {
    mockCache.get.mockResolvedValue(undefined);
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.search('', undefined, undefined, 1, 20);

    // No where() call should reference plainto_tsquery.
    const whereCalls = mockQueryBuilder.where.mock.calls;
    const ftsCall = whereCalls.find(
      (args: any[]) => typeof args[0] === 'string' && args[0].includes('plainto_tsquery'),
    );
    expect(ftsCall).toBeUndefined();
  });

  // ── Filters & sorting ─────────────────────────────────────────────────────

  it('should build query with filters and return results', async () => {
    mockCache.get.mockResolvedValue(undefined);
    const mockCourses = [{ id: '1', title: 'Test Course', price: 50 }];
    mockQueryBuilder.getManyAndCount.mockResolvedValue([mockCourses, 1]);

    const result = await service.search(
      'javascript',
      {
        category: 'programming',
        price: { gte: 0, lte: 100 },
        rating: { gte: 4 },
        instructor: 'Jane Doe',
      },
      'rating_desc',
      1,
      20,
    );

    expect(mockCourseRepo.createQueryBuilder).toHaveBeenCalled();
    expect(result.results).toEqual(mockCourses);
    expect(result.total).toBe(1);
  });

  // ── Performance ───────────────────────────────────────────────────────────

  it('should execute search quickly', async () => {
    mockCache.get.mockResolvedValue(undefined);
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    const start = Date.now();
    const result = await service.search(
      'search term',
      {
        category: ['programming', 'design'],
        price: { gte: 0, lte: 300 },
        rating: { gte: 4 },
        instructor: 'Jane Doe',
      },
      'price_desc',
    );

    expect(result).toBeDefined();
    expect(Date.now() - start).toBeLessThan(100);
  });

  // ── Autocomplete ──────────────────────────────────────────────────────────

  it('should return empty array for short autocomplete queries', async () => {
    const result = await service.getAutoComplete('a');
    expect(result).toEqual([]);
  });

  it('should use prefix ILIKE (no leading wildcard) for autocomplete', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([{ id: '1', title: 'JavaScript Basics' }]);

    await service.getAutoComplete('java');

    const whereCalls = mockQueryBuilder.where.mock.calls;
    const prefixCall = whereCalls.find(
      (args: any[]) =>
        typeof args[0] === 'string' &&
        args[0].includes('ILIKE') &&
        (args[1] as any)?.query === 'java%',
    );
    expect(prefixCall).toBeDefined();
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('should return empty results gracefully on repository error', async () => {
    mockCache.get.mockResolvedValue(undefined);
    mockQueryBuilder.getManyAndCount.mockRejectedValue(new Error('DB connection lost'));

    const result = await service.search('react', undefined, undefined, 1, 20);

    expect(result).toEqual({ results: [], total: 0, page: 1, limit: 20, query: 'react' });
  });
});

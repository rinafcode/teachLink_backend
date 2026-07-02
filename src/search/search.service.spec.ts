import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { Course } from '../courses/entities/course.entity';
import { IsolationService } from '../tenancy/isolation/isolation.service';

const TENANT_A = 'tenant-a-uuid';
const TENANT_B = 'tenant-b-uuid';

/** Seed courses across two tenants */
const allCourses: Partial<Course>[] = [
  { id: '1', title: 'JavaScript Basics', description: 'JS intro', tenantId: TENANT_A, price: 0 } as Course,
  { id: '2', title: 'JavaScript Advanced', description: 'JS advanced', tenantId: TENANT_A, price: 50 } as Course,
  { id: '3', title: 'JavaScript for B', description: 'JS for tenant B', tenantId: TENANT_B, price: 10 } as Course,
  { id: '4', title: 'Python Basics', description: 'Python intro', tenantId: TENANT_B, price: 0 } as Course,
];

function makeQueryBuilder(tenantId: string | null) {
  let filtered = [...allCourses];

  const qb: any = {
    _tenantId: tenantId,
    _query: null as string | null,
    _category: null as string[] | null,
    _minPrice: undefined as number | undefined,
    _maxPrice: undefined as number | undefined,

    where(cond: string, params?: any) {
      if (cond.includes('tenantId')) {
        filtered = filtered.filter((c) => c.tenantId === params.tenantId);
      } else if (cond.includes('title ILIKE') || cond.includes('description ILIKE')) {
        const q = (params.query as string).replace(/%/g, '');
        filtered = filtered.filter(
          (c) =>
            c.title?.toLowerCase().includes(q.toLowerCase()) ||
            c.description?.toLowerCase().includes(q.toLowerCase()),
        );
      }
      return qb;
    },
    andWhere(cond: string, params?: any) {
      return qb.where(cond, params);
    },
    orderBy() {
      return qb;
    },
    skip() {
      return qb;
    },
    take() {
      return qb;
    },
    select() {
      return qb;
    },
    getManyAndCount: jest.fn().mockImplementation(() => Promise.resolve([filtered, filtered.length])),
    getMany: jest.fn().mockImplementation(() => Promise.resolve(filtered)),
  };
  return qb;
}

function buildModule(tenantId: string | null) {
  const mockIsolationService = { getTenantId: jest.fn().mockReturnValue(tenantId) };
  const mockCourseRepo = {
    createQueryBuilder: jest.fn().mockImplementation(() => makeQueryBuilder(tenantId)),
  };
  const mockCache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };

  return Test.createTestingModule({
    providers: [
      SearchService,
      { provide: NestElasticsearchService, useValue: {} },
      { provide: CACHE_MANAGER, useValue: mockCache },
      { provide: getRepositoryToken(Course), useValue: mockCourseRepo },
      { provide: IsolationService, useValue: mockIsolationService },
    ],
  }).compile();
}

describe('SearchService – tenant isolation', () => {
  describe('search()', () => {
    it('returns only Tenant A courses when Tenant A context is active', async () => {
      const module: TestingModule = await buildModule(TENANT_A);
      const service = module.get<SearchService>(SearchService);

      const result = await service.search('javascript');

      expect(result.results.every((c: Course) => c.tenantId === TENANT_A)).toBe(true);
      expect(result.results.some((c: Course) => c.tenantId === TENANT_B)).toBe(false);
    });

    it('returns only Tenant B courses when Tenant B context is active', async () => {
      const module: TestingModule = await buildModule(TENANT_B);
      const service = module.get<SearchService>(SearchService);

      const result = await service.search('javascript');

      expect(result.results.every((c: Course) => c.tenantId === TENANT_B)).toBe(true);
      expect(result.results.some((c: Course) => c.tenantId === TENANT_A)).toBe(false);
    });

    it('applies tenant filter even when no query parameters are provided', async () => {
      const module: TestingModule = await buildModule(TENANT_A);
      const service = module.get<SearchService>(SearchService);

      const result = await service.search('');

      expect(result.results.every((c: Course) => c.tenantId === TENANT_A)).toBe(true);
    });

    it('cross-boundary: Tenant A search never returns Tenant B courses', async () => {
      const moduleA: TestingModule = await buildModule(TENANT_A);
      const serviceA = moduleA.get<SearchService>(SearchService);

      const resultA = await serviceA.search('javascript');
      const tenantBIds = allCourses.filter((c) => c.tenantId === TENANT_B).map((c) => c.id);
      const returnedIds = resultA.results.map((c: Course) => c.id);

      tenantBIds.forEach((id) => {
        expect(returnedIds).not.toContain(id);
      });
    });
  });

  describe('getAutoComplete()', () => {
    it('returns only Tenant A autocomplete suggestions', async () => {
      const module: TestingModule = await buildModule(TENANT_A);
      const service = module.get<SearchService>(SearchService);

      const results = await service.getAutoComplete('java');

      // All returned course IDs should belong to Tenant A
      const tenantACourseIds = allCourses.filter((c) => c.tenantId === TENANT_A).map((c) => c.id);
      results.forEach((r) => {
        expect(tenantACourseIds).toContain(r.metadata?.courseId);
      });
    });

    it('autocomplete cross-boundary: Tenant A never sees Tenant B suggestions', async () => {
      const module: TestingModule = await buildModule(TENANT_A);
      const service = module.get<SearchService>(SearchService);

      const results = await service.getAutoComplete('java');
      const tenantBCourseIds = allCourses.filter((c) => c.tenantId === TENANT_B).map((c) => c.id);

      results.forEach((r) => {
        expect(tenantBCourseIds).not.toContain(r.metadata?.courseId);
      });
    });
  });

  describe('buildTenantFilter()', () => {
    it('returns a term filter with the given tenantId', async () => {
      const module: TestingModule = await buildModule(TENANT_A);
      const service = module.get<SearchService>(SearchService);

      expect(service.buildTenantFilter(TENANT_A)).toEqual({ term: { tenantId: TENANT_A } });
    });
  });
});

// ── Existing unit tests preserved ─────────────────────────────────────────────

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
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

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: NestElasticsearchService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: getRepositoryToken(Course), useValue: mockCourseRepo },
        { provide: IsolationService, useValue: { getTenantId: jest.fn().mockReturnValue(null) } },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

  describe('Autocomplete LRU Cache', () => {
    it('should evict oldest entries when cache cap is reached', async () => {
      const mockCourses = [
        { id: '1', title: 'Course 1' },
        { id: '2', title: 'Course 2' },
      ];
      mockQueryBuilder.getMany.mockResolvedValue(mockCourses);

      // Fill cache beyond its max size (1000 entries)
      for (let i = 0; i < 1001; i++) {
        await service.getAutoComplete(`query${i}`);
      }

      // First entry should have been evicted
      const firstResult = await service.getAutoComplete('query0');
      expect(mockQueryBuilder.getMany).toHaveBeenCalled(); // Cache miss, so DB query is made

      // Last entry should still be cached
      mockQueryBuilder.getMany.mockClear();
      const lastResult = await service.getAutoComplete('query1000');
      expect(mockQueryBuilder.getMany).not.toHaveBeenCalled(); // Cache hit, no DB query
    });

    it('should enforce TTL via cache backend', async () => {
      const mockCourses = [{ id: '1', title: 'Course 1' }];
      mockQueryBuilder.getMany.mockResolvedValue(mockCourses);

      // First call - cache miss
      await service.getAutoComplete('test');
      expect(mockQueryBuilder.getMany).toHaveBeenCalledTimes(1);

      // Second call immediately - cache hit
      await service.getAutoComplete('test');
      expect(mockQueryBuilder.getMany).toHaveBeenCalledTimes(1);

      // Wait for TTL to expire (300000ms = 5 minutes)
      // In test, we can't actually wait 5 minutes, but we verify the TTL is configured
      // The LRU cache handles TTL automatically, so we just verify the cache is using TTL
      const cache = (service as any).autocompleteCache;
      expect(cache.options.ttl).toBe(300000);
    });
  });
});

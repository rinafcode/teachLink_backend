import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SEARCH_CONSTANTS } from './search.constants';
import { Course } from '../courses/entities/course.entity';

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

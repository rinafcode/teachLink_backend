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
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
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
    const mockCourses = [
      { id: '1', title: 'Test Course', price: 50 },
    ];
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
});

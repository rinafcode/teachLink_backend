import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { SearchService } from './search.service';
import { SEARCH_CONSTANTS } from './search.constants';

const mockElasticsearch = {
  search: jest.fn(),
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
        { provide: NestElasticsearchService, useValue: mockElasticsearch },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should use cache when available', async () => {
    const cached = { results: [{ id: '1' }], total: 1, page: 1, limit: 20, query: 'test', filters: {}, facets: {} };
    mockCache.get.mockResolvedValue(cached);

    const result = await service.search('test', undefined, 'relevance', 1, 20);

    expect(result).toEqual(cached);
    expect(mockElasticsearch.search).not.toHaveBeenCalled();
  });

  it('should build Elasticsearch query with filters and return parsed buckets', async () => {
    mockCache.get.mockResolvedValue(undefined);
    mockElasticsearch.search.mockResolvedValue({
      hits: {
        hits: [{ _id: '1', _score: 10, _source: { title: 'Test Course' } }],
        total: { value: 1 },
      },
      aggregations: {
        categories: { buckets: [{ key: 'programming', doc_count: 4 }] },
        levels: { buckets: [{ key: 'beginner', doc_count: 2 }] },
        languages: { buckets: [{ key: 'en', doc_count: 4 }] },
        instructors: { buckets: [{ key: 'Jane Doe', doc_count: 3 }] },
        priceRanges: { buckets: [{ key: 'Free', doc_count: 1 }] },
        ratingBuckets: { buckets: [{ key: 4.5, doc_count: 2 }] },
      },
    });

    const result = await service.search(
      'javascript',
      { category: 'programming', price: { gte: 0, lte: 100 }, rating: { gte: 4 }, instructor: 'Jane Doe' },
      'rating_desc',
      1,
      20,
    );

    expect(mockElasticsearch.search).toHaveBeenCalled();
    expect(result.results[0]).toEqual({ id: '1', score: 10, title: 'Test Course' });
    expect(result.facets.categories[0].key).toBe('programming');
    expect(result.facets.instructors[0].key).toBe('Jane Doe');
    expect(result.total).toBe(1);
  });

  it('should build a complex search request quickly', () => {
    const start = Date.now();
    const body = (service as any).buildSearchRequest('search term', {
      category: ['programming', 'design'],
      price: { gte: 0, lte: 300 },
      rating: { gte: 4 },
      instructor: 'Jane Doe',
    }, 'price_desc');

    expect(body.query).toBeDefined();
    expect(Date.now() - start).toBeLessThan(100);
  });
});

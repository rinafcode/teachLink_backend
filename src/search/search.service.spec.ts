import { SearchService } from './search.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { AutoCompleteService } from './autocomplete/autocomplete.service';
import { SearchFiltersService } from './filters/search-filters.service';
import { CachingService } from '../caching/caching.service';

describe('SearchService', () => {
  let service: SearchService;
  let elasticsearchService: jest.Mocked<ElasticsearchService>;
  let cachingService: jest.Mocked<CachingService>;
  let autoCompleteService: jest.Mocked<AutoCompleteService>;
  let searchFiltersService: jest.Mocked<SearchFiltersService>;

  beforeEach(() => {
    elasticsearchService = {
      search: jest.fn(),
      index: jest.fn(),
    } as unknown as jest.Mocked<ElasticsearchService>;
    elasticsearchService.index.mockResolvedValue({} as any);

    cachingService = {
      getOrSet: jest.fn(async (_key: string, factory: () => Promise<any>) => factory()),
    } as unknown as jest.Mocked<CachingService>;

    autoCompleteService = {
      getSuggestions: jest.fn(),
    } as unknown as jest.Mocked<AutoCompleteService>;

    searchFiltersService = {
      getFilters: jest.fn(),
    } as unknown as jest.Mocked<SearchFiltersService>;

    service = new SearchService(
      elasticsearchService,
      autoCompleteService,
      searchFiltersService,
      cachingService,
    );
  });

  it('sanitizes input, normalizes filters, and applies bounded pagination', async () => {
    elasticsearchService.search.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: '1',
            _score: 10,
            _source: { title: 'NestJS Fundamentals' },
            highlight: { title: ['NestJS'] },
          },
        ],
      },
      aggregations: {
        categories: { buckets: [] },
        levels: { buckets: [] },
        price_ranges: { buckets: [] },
      },
    } as any);

    const result = await service.performSearch(
      '  NestJS   ',
      { category: ' Backend ', language: ['EN', 'en', ''], price: { gte: 0, invalid: 'x' } },
      'relevance',
      { page: 0, limit: 100 },
    );

    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);

    expect(elasticsearchService.search).toHaveBeenCalledTimes(1);
    const esQuery = elasticsearchService.search.mock.calls[0][0] as any;

    expect(esQuery.from).toBe(0);
    expect(esQuery.size).toBe(50);
    expect(esQuery.timeout).toBe('1500ms');
    expect(esQuery.highlight).toBeDefined();
    expect(esQuery.query.function_score.query.bool.filter).toEqual(
      expect.arrayContaining([
        { term: { category: 'backend' } },
        { terms: { language: ['en'] } },
        { range: { price: { gte: 0 } } },
      ]),
    );
  });

  it('supports filter-only search without highlight when query is empty', async () => {
    elasticsearchService.search.mockResolvedValueOnce({
      hits: {
        total: { value: 0 },
        hits: [],
      },
      aggregations: {
        categories: { buckets: [] },
        levels: { buckets: [] },
        price_ranges: { buckets: [] },
      },
    } as any);

    await service.performSearch('   ', { level: 'Beginner' }, 'relevance', {
      page: 2,
      limit: 10,
    });

    const esQuery = elasticsearchService.search.mock.calls[0][0] as any;
    expect(esQuery.from).toBe(10);
    expect(esQuery.size).toBe(10);
    expect(esQuery.highlight).toBeUndefined();
    expect(esQuery.query.function_score.query).toEqual({
      bool: {
        filter: [{ term: { level: 'beginner' } }],
      },
    });
  });

  it('normalizes autocomplete input before cache and downstream call', async () => {
    autoCompleteService.getSuggestions.mockResolvedValueOnce(['nestjs']);

    await service.getAutoComplete('  nestjs  ');

    expect(cachingService.getOrSet).toHaveBeenCalledWith(
      expect.stringContaining('autocomplete:nestjs'),
      expect.any(Function),
      expect.any(Number),
    );
    expect(autoCompleteService.getSuggestions).toHaveBeenCalledWith('nestjs');
  });
});

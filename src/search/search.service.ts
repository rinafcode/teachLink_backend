import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { AutoCompleteService } from './autocomplete/autocomplete.service';
import { SearchFiltersService } from './filters/search-filters.service';
import { CachingService } from '../caching/caching.service';
import { CACHE_TTL, CACHE_PREFIXES } from '../caching/caching.constants';

export const COURSES_INDEX = 'courses';
export const SEARCH_ANALYTICS_INDEX = 'search_analytics';
const SEARCH_SOURCE_FIELDS = [
  'id',
  'title',
  'description',
  'tags',
  'category',
  'level',
  'language',
  'price',
  'rating',
  'views',
  'enrollments',
  'duration',
  'instructorId',
  'instructorName',
  'status',
  'createdAt',
  'updatedAt',
];

type SearchOptions = {
  page?: number;
  limit?: number;
};

type SearchFilters = {
  category?: string | string[];
  level?: string | string[];
  language?: string | string[];
  instructorId?: string;
  price?: { gte?: number; lte?: number; gt?: number; lt?: number };
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly autoCompleteService: AutoCompleteService,
    private readonly searchFiltersService: SearchFiltersService,
    private readonly cachingService: CachingService,
  ) {}

  async performSearch(query: string, filters: any, sort?: string, options: SearchOptions = {}) {
    const sanitizedQuery = (query ?? '').trim().slice(0, 200);
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 20));
    const from = (page - 1) * limit;
    const normalizedFilters = this.normalizeFilters(filters);
    const cacheKey = `${CACHE_PREFIXES.SEARCH}:${this.hashSearchParams(
      sanitizedQuery,
      normalizedFilters,
      sort,
      page,
      limit,
    )}`;
    const hasQuery = sanitizedQuery.length > 0;

    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        const result = await this.elasticsearchService.search({
          index: COURSES_INDEX,
          from,
          size: limit,
          timeout: '1500ms',
          track_total_hits: 10000,
          _source: SEARCH_SOURCE_FIELDS,
          query: {
            function_score: {
              query: this.buildSearchQuery(sanitizedQuery, normalizedFilters, hasQuery),
              functions: [
                {
                  field_value_factor: {
                    field: 'views',
                    factor: 0.1,
                    modifier: 'log1p' as const,
                    missing: 1,
                  },
                },
                {
                  field_value_factor: {
                    field: 'rating',
                    factor: 0.5,
                    modifier: 'none' as const,
                    missing: 0,
                  },
                },
                {
                  gauss: {
                    createdAt: {
                      origin: 'now',
                      scale: '90d',
                      offset: '7d',
                      decay: 0.5,
                    },
                  },
                },
              ],
              score_mode: 'sum' as const,
              boost_mode: 'multiply' as const,
            },
          },
          sort: this.buildSort(sort),
          highlight: hasQuery
            ? {
                fields: {
                  title: {},
                  description: { fragment_size: 150, number_of_fragments: 1 },
                },
              }
            : undefined,
          aggs: {
            categories: { terms: { field: 'category' } },
            levels: { terms: { field: 'level' } },
            price_ranges: {
              range: {
                field: 'price',
                ranges: [{ to: 50 }, { from: 50, to: 100 }, { from: 100, to: 200 }, { from: 200 }],
              },
            },
          },
        });

        const total =
          typeof result.hits.total === 'object'
            ? result.hits.total.value
            : (result.hits.total ?? 0);

        const hits = result.hits.hits;
        const aggs = result.aggregations as any;

        const rankedResults = this.rankResults(hits);
        this.logSearch(sanitizedQuery, rankedResults.length, normalizedFilters, sort);

        return {
          results: rankedResults,
          total,
          page,
          limit,
          facets: {
            categories: aggs?.categories?.buckets ?? [],
            levels: aggs?.levels?.buckets ?? [],
            priceRanges: aggs?.price_ranges?.buckets ?? [],
          },
        };
      },
      CACHE_TTL.SEARCH_RESULTS,
    );
  }

  async getAutoComplete(query: string) {
    const sanitizedQuery = (query ?? '').trim().slice(0, 100);
    const cacheKey = `${CACHE_PREFIXES.SEARCH}:autocomplete:${sanitizedQuery}`;

    return this.cachingService.getOrSet(
      cacheKey,
      () => this.autoCompleteService.getSuggestions(sanitizedQuery),
      CACHE_TTL.SEARCH_RESULTS,
    );
  }

  async getAvailableFilters() {
    const cacheKey = `${CACHE_PREFIXES.SEARCH}:filters`;

    return this.cachingService.getOrSet(
      cacheKey,
      () => this.searchFiltersService.getFilters(),
      CACHE_TTL.STATIC_CONTENT,
    );
  }

  async getSearchAnalytics(days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const result = await this.elasticsearchService.search({
      index: SEARCH_ANALYTICS_INDEX,
      size: 0,
      query: {
        range: {
          timestamp: { gte: from.toISOString() },
        },
      },
      aggs: {
        total_searches: { value_count: { field: 'query.keyword' } },
        top_queries: {
          terms: { field: 'query.keyword', size: 10 },
          aggs: {
            avg_results: { avg: { field: 'resultsCount' } },
          },
        },
        zero_result_queries: {
          filter: { term: { resultsCount: 0 } },
          aggs: {
            queries: { terms: { field: 'query.keyword', size: 10 } },
          },
        },
        searches_over_time: {
          date_histogram: {
            field: 'timestamp',
            calendar_interval: 'day' as const,
          },
        },
      },
    });

    const aggs = result.aggregations as any;
    return {
      totalSearches: aggs?.total_searches?.value ?? 0,
      topQueries: aggs?.top_queries?.buckets ?? [],
      zeroResultQueries: aggs?.zero_result_queries?.queries?.buckets ?? [],
      searchesOverTime: aggs?.searches_over_time?.buckets ?? [],
    };
  }

  private buildFilters(filters: any) {
    const esFilters: any[] = [];
    if (filters.category) {
      const category = this.normalizeKeywordValue(filters.category);
      if (Array.isArray(category)) {
        esFilters.push({ terms: { category } });
      } else if (category) {
        esFilters.push({ term: { category } });
      }
    }
    if (filters.level) {
      const level = this.normalizeKeywordValue(filters.level);
      if (Array.isArray(level)) {
        esFilters.push({ terms: { level } });
      } else if (level) {
        esFilters.push({ term: { level } });
      }
    }
    if (filters.price) {
      esFilters.push({ range: { price: filters.price } });
    }
    if (filters.language) {
      const language = this.normalizeKeywordValue(filters.language);
      if (Array.isArray(language)) {
        esFilters.push({ terms: { language } });
      } else if (language) {
        esFilters.push({ term: { language } });
      }
    }
    if (filters.instructorId) {
      const instructorId = this.normalizeString(filters.instructorId, false);
      if (instructorId) {
        esFilters.push({ term: { instructorId } });
      }
    }
    return esFilters;
  }

  private buildSearchQuery(query: string, filters: any, hasQuery: boolean): Record<string, any> {
    if (!hasQuery) {
      return {
        bool: {
          filter: this.buildFilters(filters),
        },
      };
    }

    return {
      bool: {
        filter: this.buildFilters(filters),
        should: [
          {
            multi_match: {
              query,
              fields: ['title^3', 'description^2', 'content', 'tags^2'],
              type: 'best_fields' as const,
              operator: 'and' as const,
              fuzziness: 'AUTO:4,7',
              prefix_length: 1,
            },
          },
          {
            multi_match: {
              query,
              type: 'bool_prefix' as const,
              fields: ['title.search', 'title.search._2gram', 'title.search._3gram'],
              boost: 2,
            },
          },
        ],
        minimum_should_match: 1,
      },
    };
  }

  private buildSort(sort?: string) {
    if (sort === 'relevance') {
      return ['_score'];
    } else if (sort === 'popularity') {
      return [{ views: { order: 'desc' as const } }];
    } else if (sort === 'rating') {
      return [{ rating: { order: 'desc' as const } }];
    } else if (sort === 'newest') {
      return [{ createdAt: { order: 'desc' as const } }];
    } else if (sort === 'price_asc') {
      return [{ price: { order: 'asc' as const } }];
    } else if (sort === 'price_desc') {
      return [{ price: { order: 'desc' as const } }];
    }
    return ['_score'];
  }

  private rankResults(hits: any[]) {
    return hits.map((hit) => ({
      ...hit._source,
      id: hit._id,
      score: hit._score,
      highlights: hit.highlight ?? {},
    }));
  }

  private logSearch(query: string, resultsCount: number, filters?: any, sort?: string): void {
    // Fire-and-forget: analytics must not slow down or fail search responses
    this.elasticsearchService
      .index({
        index: SEARCH_ANALYTICS_INDEX,
        document: {
          query,
          resultsCount,
          filters: filters ?? {},
          sort: sort ?? 'relevance',
          timestamp: new Date().toISOString(),
        },
      })
      .catch((err) => {
        this.logger.warn(`Search analytics logging failed: ${err.message}`);
      });
  }

  private hashSearchParams(
    query: string,
    filters: any,
    sort?: string,
    page = 1,
    limit = 20,
  ): string {
    const str = `${query}:${JSON.stringify(filters)}:${sort ?? 'default'}:${page}:${limit}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private normalizeFilters(filters: any): SearchFilters {
    const safeFilters = filters && typeof filters === 'object' ? filters : {};
    const normalized: SearchFilters = {};

    const category = this.normalizeKeywordValue(safeFilters.category);
    if (category) {
      normalized.category = category;
    }

    const level = this.normalizeKeywordValue(safeFilters.level);
    if (level) {
      normalized.level = level;
    }

    const language = this.normalizeKeywordValue(safeFilters.language);
    if (language) {
      normalized.language = language;
    }

    const instructorId = this.normalizeString(safeFilters.instructorId, false);
    if (instructorId) {
      normalized.instructorId = instructorId;
    }

    const price = this.normalizePriceRange(safeFilters.price);
    if (price) {
      normalized.price = price;
    }

    return normalized;
  }

  private normalizeKeywordValue(value: unknown): string | string[] | null {
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => this.normalizeString(item, true))
        .filter((item): item is string => !!item);
      if (normalized.length === 0) {
        return null;
      }
      return Array.from(new Set(normalized)).sort();
    }

    return this.normalizeString(value, true);
  }

  private normalizeString(value: unknown, lowerCase: boolean): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    return lowerCase ? normalized.toLowerCase() : normalized;
  }

  private normalizePriceRange(
    value: unknown,
  ): { gte?: number; lte?: number; gt?: number; lt?: number } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const range = value as Record<string, unknown>;
    const normalized: { gte?: number; lte?: number; gt?: number; lt?: number } = {};
    for (const key of ['gte', 'lte', 'gt', 'lt'] as const) {
      const currentValue = range[key];
      if (typeof currentValue === 'number' && Number.isFinite(currentValue)) {
        normalized[key] = currentValue;
      }
    }

    return Object.keys(normalized).length > 0 ? normalized : null;
  }
}

import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import type { Cache } from 'cache-manager';
import { SEARCH_CONSTANTS } from './search.constants';

export interface SearchFilters {
  category?: string | string[];
  level?: string | string[];
  language?: string | string[];
  instructorId?: string;
  instructor?: string;
  price?: {
    gte?: number;
    lte?: number;
    gt?: number;
    lt?: number;
  };
  rating?: {
    gte?: number;
    lte?: number;
    gt?: number;
    lt?: number;
  };
}
//jhjgkjubj
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly elasticsearch: NestElasticsearchService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  async search(
    query: string,
    filters?: SearchFilters,
    sort?: string,
    page = 1,
    limit: number = SEARCH_CONSTANTS.DEFAULT_PAGE_SIZE,
  ): Promise<any> {
    const safeQuery = query?.trim() ?? '';
    const safeLimit = Math.min(limit, SEARCH_CONSTANTS.MAX_PAGE_SIZE);
    const cacheKey = this.generateCacheKey(safeQuery, filters, sort, page, safeLimit);

    if (this.cacheManager) {
      const cached = await this.cacheManager.get<any>(cacheKey);
      if (cached) {
        this.logger.log(`Search cache hit for key ${cacheKey}`);
        return cached;
      }
    }

    const searchBody = this.buildSearchRequest(safeQuery, filters, sort);
    const response = await this.elasticsearch.search({
      index: 'courses',
      from: (page - 1) * safeLimit,
      size: safeLimit,
      body: searchBody,
      track_total_hits: SEARCH_CONSTANTS.TRACK_TOTAL_HITS,
      timeout: SEARCH_CONSTANTS.ELASTICSEARCH_TIMEOUT,
    });

    const result = {
      results: (response.hits?.hits || []).map((hit) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      })),
      total: typeof response.hits?.total === 'object' ? response.hits.total.value : response.hits?.total || 0,
      page,
      limit: safeLimit,
      query: safeQuery,
      filters: filters || {},
      facets: this.parseAggregations(response.aggregations),
    };

    if (this.cacheManager) {
      await this.cacheManager.set(cacheKey, result, { ttl: 30 });
    }

    return result;
  }

  async getAutoComplete(query: string): Promise<string[]> {
    const safeQuery = query?.trim() ?? '';
    if (!safeQuery) {
      return [];
    }

    const response = await this.elasticsearch.search({
      index: 'courses',
      size: SEARCH_CONSTANTS.AUTOCOMPLETE_SIZE,
      _source: ['title'],
      body: {
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query: safeQuery,
                  type: 'bool_prefix',
                  fields: ['title.search', 'title', 'tags^2', 'instructorName^2'],
                },
              },
              {
                prefix: {
                  'title.keyword': safeQuery.toLowerCase(),
                },
              },
            ],
          },
        },
      },
    });

    const suggestions = new Set<string>();
    (response.hits?.hits || []).forEach((hit) => {
      if (hit._source?.title) {
        suggestions.add(hit._source.title);
      }
    });

    return [...suggestions].slice(0, SEARCH_CONSTANTS.AUTOCOMPLETE_SIZE);
  }

  async getAvailableFilters(): Promise<any> {
    const response = await this.elasticsearch.search({
      index: 'courses',
      size: 0,
      body: {
        aggs: this.buildFacetAggregations(),
      },
      timeout: SEARCH_CONSTANTS.ELASTICSEARCH_TIMEOUT,
    });

    const aggs = this.parseAggregations(response.aggregations);
    return {
      categories: aggs.categories,
      levels: aggs.levels,
      languages: aggs.languages,
      instructors: aggs.instructors,
      priceRanges: aggs.priceRanges,
      ratingBuckets: aggs.ratingBuckets,
    };
  }

  async getAnalytics(days: number = 7): Promise<any> {
    const response = await this.elasticsearch.search({
      index: 'search_analytics',
      size: 0,
      body: {
        query: {
          range: {
            timestamp: {
              gte: `now-${days}d/d`,
              lte: 'now',
            },
          },
        },
        aggs: {
          topQueries: {
            terms: {
              field: 'query',
              size: SEARCH_CONSTANTS.TOP_QUERIES_SIZE,
            },
          },
          averageResults: {
            avg: {
              field: 'resultsCount',
            },
          },
        },
      },
      timeout: SEARCH_CONSTANTS.ELASTICSEARCH_TIMEOUT,
    });

    const totalSearches = typeof response.hits?.total === 'object' ? response.hits.total.value : response.hits?.total || 0;
    const averageResults = response.aggregations?.averageResults?.value ?? 0;
    const topQueries = (response.aggregations?.topQueries?.buckets || []).map((bucket) => ({
      query: bucket.key,
      count: bucket.doc_count,
    }));

    return {
      topQueries,
      totalSearches,
      averageResults,
    };
  }

  private buildSearchRequest(query: string, filters?: SearchFilters, sort?: string): Record<string, unknown> {
    const boolQuery: Record<string, unknown> = {
      bool: {
        filter: this.buildFilterClauses(filters),
      },
    };

    if (query) {
      boolQuery.bool['should'] = [
        {
          multi_match: {
            query,
            type: 'best_fields',
            fields: [
              'title^5',
              'title.search^8',
              'description^2',
              'content',
              'tags^3',
              'instructorName^2',
            ],
            fuzziness: 'AUTO',
            operator: 'and',
          },
        },
        {
          match_phrase_prefix: {
            'title.search': {
              query,
              slop: 2,
            },
          },
        },
      ];
      boolQuery.bool['minimum_should_match'] = 1;
    } else {
      boolQuery.bool['must'] = [{ match_all: {} }];
    }

    return {
      query: {
        function_score: {
          query: boolQuery,
          functions: [
            {
              field_value_factor: {
                field: 'rating',
                factor: SEARCH_CONSTANTS.RATING_BOOST_FACTOR,
                missing: 1,
              },
            },
            {
              field_value_factor: {
                field: 'views',
                factor: SEARCH_CONSTANTS.VIEWS_BOOST_FACTOR,
                missing: 0,
              },
            },
            {
              gauss: {
                createdAt: {
                  origin: 'now',
                  scale: '30d',
                  decay: 0.5,
                },
              },
            },
          ],
          score_mode: 'avg',
          boost_mode: 'sum',
        },
      },
      sort: this.buildSort(sort),
      aggs: this.buildFacetAggregations(),
    };
  }

  private buildFilterClauses(filters?: SearchFilters): Record<string, unknown>[] {
    if (!filters) {
      return [];
    }

    const clauses: Record<string, unknown>[] = [];

    if (filters.category) {
      clauses.push(this.buildTermOrTermsClause('category', filters.category));
    }

    if (filters.level) {
      clauses.push(this.buildTermOrTermsClause('level', filters.level));
    }

    if (filters.language) {
      clauses.push(this.buildTermOrTermsClause('language', filters.language));
    }

    if (filters.instructorId) {
      clauses.push({ term: { instructorId: filters.instructorId } });
    }

    if (filters.instructor) {
      clauses.push({ term: { 'instructorName.keyword': filters.instructor } });
    }

    if (filters.price) {
      clauses.push({ range: { price: filters.price } });
    }

    if (filters.rating) {
      clauses.push({ range: { rating: filters.rating } });
    }

    return clauses;
  }

  private buildTermOrTermsClause(field: string, value: string | string[]): Record<string, unknown> {
    return Array.isArray(value)
      ? { terms: { [field]: value } }
      : { term: { [field]: value } };
  }

  private buildSort(sort?: string): Array<Record<string, unknown>> {
    switch (sort) {
      case 'price_asc':
        return [{ price: 'asc' }, { _score: 'desc' }];
      case 'price_desc':
        return [{ price: 'desc' }, { _score: 'desc' }];
      case 'rating_desc':
        return [{ rating: 'desc' }, { _score: 'desc' }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      default:
        return [{ _score: 'desc' }, { createdAt: 'desc' }];
    }
  }

  private buildFacetAggregations(): Record<string, unknown> {
    return {
      categories: {
        terms: {
          field: 'category',
          size: SEARCH_CONSTANTS.AGG_CATEGORIES_SIZE,
        },
      },
      levels: {
        terms: {
          field: 'level',
          size: SEARCH_CONSTANTS.AGG_LEVELS_SIZE,
        },
      },
      languages: {
        terms: {
          field: 'language',
          size: SEARCH_CONSTANTS.AGG_LANGUAGES_SIZE,
        },
      },
      instructors: {
        terms: {
          field: 'instructorName.keyword',
          size: SEARCH_CONSTANTS.AGG_INSTRUCTORS_SIZE,
        },
      },
      priceRanges: {
        range: {
          field: 'price',
          ranges: [
            { to: 0, key: 'Free' },
            { from: 0, to: SEARCH_CONSTANTS.PRICE_RANGES.LOW, key: 'Budget' },
            { from: SEARCH_CONSTANTS.PRICE_RANGES.LOW, to: SEARCH_CONSTANTS.PRICE_RANGES.MID, key: 'Mid-range' },
            { from: SEARCH_CONSTANTS.PRICE_RANGES.MID, key: 'Premium' },
          ],
        },
      },
      ratingBuckets: {
        histogram: {
          field: 'rating',
          interval: 0.5,
          min_doc_count: 0,
        },
      },
    };
  }

  private parseAggregations(aggregations?: Record<string, any>): Record<string, any> {
    if (!aggregations) {
      return {
        categories: [],
        levels: [],
        languages: [],
        instructors: [],
        priceRanges: [],
        ratingBuckets: [],
      };
    }

    return {
      categories: (aggregations.categories?.buckets || []).map((bucket) => ({ key: bucket.key, count: bucket.doc_count })),
      levels: (aggregations.levels?.buckets || []).map((bucket) => ({ key: bucket.key, count: bucket.doc_count })),
      languages: (aggregations.languages?.buckets || []).map((bucket) => ({ key: bucket.key, count: bucket.doc_count })),
      instructors: (aggregations.instructors?.buckets || []).map((bucket) => ({ key: bucket.key, count: bucket.doc_count })),
      priceRanges: (aggregations.priceRanges?.buckets || []).map((bucket) => ({ key: bucket.key, count: bucket.doc_count, from: bucket.from, to: bucket.to })),
      ratingBuckets: (aggregations.ratingBuckets?.buckets || []).map((bucket) => ({ key: bucket.key, count: bucket.doc_count })),
    };
  }

  private generateCacheKey(
    query: string,
    filters?: SearchFilters,
    sort?: string,
    page = 1,
    limit: number = SEARCH_CONSTANTS.DEFAULT_PAGE_SIZE,
  ): string {
    const str = `${query}:${JSON.stringify(filters)}:${sort ?? 'default'}:${page}:${limit}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `search:${hash}`;
  }
}

import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import type { Cache } from 'cache-manager';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
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

interface AutocompleteResult {
  title: string;
  type: 'course' | 'category' | 'trending';
  metadata?: Record<string, any>;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly AUTOCOMPLETE_LIMIT = 10;
  private readonly CACHE_TTL_MS = 300000; // 5 minutes
  private autocompleteCache: Map<string, { results: AutocompleteResult[]; timestamp: number }> =
    new Map();

  constructor(
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
  ) {}

  constructor(
    private readonly elasticsearch: NestElasticsearchService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  /**
   * Search logic with Elasticsearch integration
   * Currently uses database as fallback for basic search
   */
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
    // Build a basic database search query for now; Elasticsearch integration can be added later.
    if (!query) {
      return {
        results: [],
        total: 0,
        page,
        limit,
        filters: filters || {},
        query,
      };
    }

    try {
      const qb = this.courseRepository.createQueryBuilder('course');

      // Basic keyword search
      qb.where('course.title ILIKE :query OR course.description ILIKE :query', {
        query: `%${query}%`,
      });

      // Apply filters
      if (filters?.category) {
        const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
        qb.andWhere('course.category IN (:categories)', { categories });
      }

      if (filters?.instructorId) {
        qb.andWhere('course.instructorId = :instructorId', { instructorId: filters.instructorId });
      }

      if (filters?.price) {
        if (filters.price.gte !== undefined) {
          qb.andWhere('course.price >= :minPrice', { minPrice: filters.price.gte });
        }
        if (filters.price.lte !== undefined) {
          qb.andWhere('course.price <= :maxPrice', { maxPrice: filters.price.lte });
        }
      }

      // Apply sorting
      if (sort === 'price_asc') {
        qb.orderBy('course.price', 'ASC');
      } else if (sort === 'price_desc') {
        qb.orderBy('course.price', 'DESC');
      } else if (sort === 'newest') {
        qb.orderBy('course.createdAt', 'DESC');
      } else if (sort === 'rating') {
        qb.orderBy('course.averageRating', 'DESC');
      } else {
        qb.orderBy('course.createdAt', 'DESC'); // Default sort
      }

      // Pagination
      const skip = (page - 1) * limit;
      qb.skip(skip).take(limit);

      const [results, total] = await qb.getManyAndCount();

      return {
        results,
        total,
        page,
        limit,
        filters: filters || {},
        query,
      };
    } catch (err) {
      this.logger.error(`Search failed: ${(err as Error).message}`, err as Error);
      return {
        results: [],
        total: 0,
        page,
        limit,
        filters: filters || {},
        query,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Get autocomplete suggestions with multi-source aggregation
   * Combines course titles, categories, and trending searches
   */
  async getAutoComplete(query: string): Promise<AutocompleteResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    // Check cache first
    const cached = this.autocompleteCache.get(query);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.results;
    }

    try {
      const results: AutocompleteResult[] = [];

      // Get matching course titles
      const courses = await this.courseRepository
        .createQueryBuilder('course')
        .where('course.title ILIKE :query', { query: `${query}%` })
        .orWhere('course.title ILIKE :queryMiddle', { queryMiddle: `% ${query}%` })
        .orderBy('course.enrollmentCount', 'DESC')
        .take(this.AUTOCOMPLETE_LIMIT)
        .select(['course.id', 'course.title', 'course.category'])
        .getMany();

      results.push(
        ...courses.map((course) => ({
          title: course.title,
          type: 'course' as const,
          metadata: { courseId: course.id, category: course.category },
        })),
      );

      // Add category suggestions if available
      const categories = await this.getCategoryAutocompleteSuggestions(query);
      results.push(...categories);

      // Add trending searches
      const trending = await this.getTrendingSearchSuggestions(query);
      results.push(...trending);

      // Deduplicate and limit results
      const deduplicated = this.deduplicateResults(results).slice(0, this.AUTOCOMPLETE_LIMIT);

      // Cache results
      this.autocompleteCache.set(query, {
        results: deduplicated,
        timestamp: Date.now(),
      });

      return deduplicated;
    } catch (err) {
      this.logger.error(`Autocomplete failed for query "${query}": ${(err as Error).message}`, err as Error);
      return [];
    }
  }

  /**
   * Get category suggestions for autocomplete
   */
  private async getCategoryAutocompleteSuggestions(query: string): Promise<AutocompleteResult[]> {
    try {
      const categories = await this.courseRepository
        .createQueryBuilder('course')
        .select('DISTINCT course.category', 'category')
        .where('course.category IS NOT NULL')
        .andWhere('course.category ILIKE :query', { query: `${query}%` })
        .take(5)
        .getRawMany();

      return categories
        .map((row) => row.category)
        .filter(Boolean)
        .map((category: string) => ({
          title: category,
          type: 'category' as const,
          metadata: { category },
        }))
        .slice(0, 3);
    } catch (err) {
      this.logger.warn(
        `Category autocomplete fallback for query '${query}' due to error: ${(err as Error).message}`,
      );
      const fallback = ['programming', 'web-development', 'data-science', 'design', 'business'];
      return fallback
        .filter((cat) => cat.toLowerCase().startsWith(query.toLowerCase()))
        .map((cat) => ({
          title: cat,
          type: 'category' as const,
          metadata: { category: cat },
        }))
        .slice(0, 3);
    }
  }

  /**
   * Get trending search suggestions
   */
  private async getTrendingSearchSuggestions(query: string): Promise<AutocompleteResult[]> {
    try {
      const trendingCourses = await this.courseRepository
        .createQueryBuilder('course')
        .select(['course.title AS title'])
        .where('course.title ILIKE :query OR course.description ILIKE :query', { query: `%${query}%` })
        .orderBy('course.createdAt', 'DESC')
        .take(5)
        .getRawMany();

      const suggestions = trendingCourses.map((row) => ({
        title: row.title,
        type: 'trending' as const,
        metadata: { popular: true },
      }));

      if (suggestions.length > 0) {
        return suggestions.slice(0, 2);
      }

      const fallback = ['JavaScript', 'Python', 'React', 'Node.js', 'AWS'];
      return fallback
        .filter((search) => search.toLowerCase().includes(query.toLowerCase()))
        .map((search) => ({
          title: search,
          type: 'trending' as const,
          metadata: { popular: true },
        }))
        .slice(0, 2);
    } catch (err) {
      this.logger.warn(`Trending autocomplete fallback for query '${query}': ${(err as Error).message}`);
      const fallback = ['JavaScript', 'Python', 'React', 'Node.js', 'AWS'];
      return fallback
        .filter((search) => search.toLowerCase().includes(query.toLowerCase()))
        .map((search) => ({
          title: search,
          type: 'trending' as const,
          metadata: { popular: true },
        }))
        .slice(0, 2);
    }
  }

  /**
   * Deduplicate autocomplete results by title
   */
  private deduplicateResults(results: AutocompleteResult[]): AutocompleteResult[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      const key = `${result.title}:${result.type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
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
      categories: [
        'programming',
        'web-development',
        'mobile-development',
        'data-science',
        'design',
        'business',
      ],
      levels: ['beginner', 'intermediate', 'advanced'],
      languages: ['en', 'es', 'fr', 'de', 'zh'],
      priceRanges: [
        { label: 'Free', lte: 0 },
        { label: 'Under $50', gte: 0, lte: 50 },
        { label: '$50 - $100', gte: 50, lte: 100 },
        { label: 'Over $100', gte: 100 },
      ],
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

    this.logger.log(`Getting analytics for ${days} days`);
    // Analytics integration not available in this release; return a safe placeholder.
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

  /**
   * Clear autocomplete cache (useful for testing or cache invalidation)
   */
  clearAutocompleteCache(): void {
    this.autocompleteCache.clear();
    this.logger.debug('Autocomplete cache cleared');
  }

  /**
   * Get cache stats (for monitoring)
   */
  getAutocompleteCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.autocompleteCache.size,
      entries: Array.from(this.autocompleteCache.keys()),
    };
  }
}

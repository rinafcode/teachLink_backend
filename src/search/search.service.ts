import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../courses/entities/course.entity';

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
    private readonly courseRepository: Repository<Course>,
    private readonly elasticsearch: NestElasticsearchService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async search(
    query: string,
    filters?: SearchFilters,
    sort?: string,
    page = 1,
    limit: number = 20,
  ): Promise<any> {
    const safeQuery = query?.trim() ?? '';
    const cacheKey = `search:${safeQuery}:${JSON.stringify(filters)}:${sort}:${page}`;

    if (this.cacheManager) {
      const cached = await this.cacheManager.get<any>(cacheKey);
      if (cached) return cached;
    }

    // Try Elasticsearch first; fall back to PostgreSQL FTS on any failure.
    if (safeQuery && this.isElasticsearchAvailable()) {
      const esResult = await this.searchViaElasticsearch(safeQuery, filters, sort, page, limit);
      if (esResult !== null) {
        if (this.cacheManager) await this.cacheManager.set(cacheKey, esResult, 30);
        return esResult;
      }
    }

    return this.searchViaPostgres(safeQuery, filters, sort, page, limit, cacheKey);
  }

  async getAutoComplete(query: string): Promise<AutocompleteResult[]> {
    if (!query || query.length < 2) return [];

    const cached = this.autocompleteCache.get(query);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) return cached.results;

    try {
      // Prefix ILIKE (no leading wildcard) is efficiently served by the
      // existing B-tree index on course.title.
      const courses = await this.courseRepository
        .createQueryBuilder('course')
        .where('course.title ILIKE :query', { query: `${query}%` })
        .orderBy('course.enrollmentCount', 'DESC')
        .take(10)
        .select(['course.id', 'course.title'])
        .getMany();

      const results = courses.map((course: any) => ({
        title: course.title,
        type: 'course' as const,
        metadata: { courseId: course.id },
      }));

      this.autocompleteCache.set(query, { results, timestamp: Date.now() });
      return results;
    } catch (err) {
      this.logger.error(`Autocomplete failed: ${(err as Error).message}`);
      return [];
    }
  }

  async getAvailableFilters(): Promise<any> {
    return {
      categories: ['programming', 'web-development', 'data-science', 'design', 'business'],
      levels: ['beginner', 'intermediate', 'advanced'],
      languages: ['en', 'es', 'fr', 'de', 'zh'],
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns true when the injected Elasticsearch client looks like a real,
   * configured client (not an empty stub injected in tests).
   */
  private isElasticsearchAvailable(): boolean {
    return (
      !!this.elasticsearch &&
      typeof (this.elasticsearch as any).search === 'function' &&
      !!(this.elasticsearch as any).connectionPool
    );
  }

  /**
   * Attempt a full-text search via Elasticsearch.
   * Returns null if ES is unavailable or the query fails, so the caller can
   * fall back to the PostgreSQL path.
   */
  private async searchViaElasticsearch(
    query: string,
    filters: SearchFilters | undefined,
    sort: string | undefined,
    page: number,
    limit: number,
  ): Promise<any | null> {
    try {
      const mustClauses: any[] = [
        {
          multi_match: {
            query,
            fields: ['title^3', 'description'],
            type: 'best_fields',
          },
        },
      ];

      const filterClauses: any[] = [];
      if (filters?.category) {
        const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
        filterClauses.push({ terms: { category: cats } });
      }
      if (filters?.price?.gte !== undefined)
        filterClauses.push({ range: { price: { gte: filters.price.gte } } });
      if (filters?.price?.lte !== undefined)
        filterClauses.push({ range: { price: { lte: filters.price.lte } } });

      const esSort = this.buildEsSort(sort);

      const response = await this.elasticsearch.search({
        index: 'courses',
        from: (page - 1) * limit,
        size: limit,
        query: {
          bool: {
            must: mustClauses,
            ...(filterClauses.length ? { filter: filterClauses } : {}),
          },
        },
        sort: esSort,
      });

      const hits = (response as any).hits;
      const results = hits.hits.map((h: any) => ({ id: h._id, ...h._source }));
      return { results, total: hits.total?.value ?? results.length, page, limit, query };
    } catch (err) {
      this.logger.warn(
        `Elasticsearch search failed, falling back to PG FTS: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * PostgreSQL full-text search using the pre-built `search_vector` GIN-indexed
   * column added by migration 1751200000000-add-course-fts-tsvector.
   *
   * When a non-empty query is supplied:
   *   - `plainto_tsquery('english', :query)` parses natural language input
   *     safely (no injection risk, handles stop words).
   *   - `ts_rank(search_vector, tsq)` provides relevance scoring.
   *   - The `search_vector @@ tsq` predicate is served by the GIN index,
   *     resulting in a bitmap index scan instead of a sequential scan.
   *
   * When no query is supplied all courses are returned (useful for browse).
   */
  private async searchViaPostgres(
    safeQuery: string,
    filters: SearchFilters | undefined,
    sort: string | undefined,
    page: number,
    limit: number,
    cacheKey: string,
  ): Promise<any> {
    try {
      const qb = this.courseRepository.createQueryBuilder('course');

      if (safeQuery) {
        // Add the ts_rank score as a select alias so callers can consume it.
        qb.addSelect(
          "ts_rank(course.search_vector, plainto_tsquery('english', :tsQuery))",
          'relevanceScore',
        ).setParameter('tsQuery', safeQuery);

        // GIN-accelerated full-text match — replaces the old ILIKE.
        qb.where("course.search_vector @@ plainto_tsquery('english', :tsQuery)", {
          tsQuery: safeQuery,
        });
      }

      // ── Filters ─────────────────────────────────────────────────────────────
      if (filters?.category) {
        const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
        qb.andWhere('course.category IN (:...cats)', { cats });
      }

      if (filters?.price?.gte !== undefined)
        qb.andWhere('course.price >= :minPrice', { minPrice: filters.price.gte });
      if (filters?.price?.lte !== undefined)
        qb.andWhere('course.price <= :maxPrice', { maxPrice: filters.price.lte });

      // ── Sorting ──────────────────────────────────────────────────────────────
      if (sort === 'price_asc') {
        qb.orderBy('course.price', 'ASC');
      } else if (sort === 'price_desc') {
        qb.orderBy('course.price', 'DESC');
      } else if (sort === 'newest') {
        qb.orderBy('course.createdAt', 'DESC');
      } else if (safeQuery) {
        // Default when a query is present: order by relevance (ts_rank DESC).
        qb.orderBy("ts_rank(course.search_vector, plainto_tsquery('english', :tsQuery))", 'DESC');
      } else {
        qb.orderBy('course.createdAt', 'DESC');
      }

      // ── Pagination ───────────────────────────────────────────────────────────
      const skip = (page - 1) * limit;
      qb.skip(skip).take(limit);

      const [results, total] = await qb.getManyAndCount();

      const result = { results, total, page, limit, query: safeQuery };
      if (this.cacheManager) await this.cacheManager.set(cacheKey, result, 30);
      return result;
    } catch (err) {
      this.logger.error(`Search failed: ${(err as Error).message}`);
      return { results: [], total: 0, page, limit, query: safeQuery };
    }
  }

  /** Map the UI sort string to Elasticsearch sort descriptors. */
  private buildEsSort(sort?: string): any[] {
    if (sort === 'price_asc') return [{ price: { order: 'asc' } }];
    if (sort === 'price_desc') return [{ price: { order: 'desc' } }];
    if (sort === 'newest') return [{ createdAt: { order: 'desc' } }];
    return [{ _score: { order: 'desc' } }];
  }
}

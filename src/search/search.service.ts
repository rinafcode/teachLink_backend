import { Injectable, Logger, Inject, Optional, BadRequestException } from '@nestjs/common';
import { Injectable, Logger, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { LRUCache } from 'lru-cache';
import { IsolationService } from '../tenancy/isolation/isolation.service';
import { OnEvent } from '@nestjs/event-emitter';
import { CACHE_EVENTS, CACHE_TTL, CACHE_PREFIXES } from '../caching/caching.constants';
import { SEARCH_CONSTANTS } from './search.constants';
import { MetricsService } from '../utils/masking/metrics.service';

/**
 * TTL for cached search results, expressed in milliseconds to match
 * cache-manager v7's TTL semantics. 30_000 ms == 30 seconds.
 */
export const SEARCH_CACHE_TTL_MS = 30_000;

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

export interface FacetValue {
  value: string;
  count: number;
}

export interface AvailableFilters {
  categories: FacetValue[];
  levels: FacetValue[];
  languages: FacetValue[];
}

interface AutocompleteResult {
  title: string;
  type: 'course' | 'category' | 'trending';
  metadata?: Record<string, any>;
}

/** Cache key for the derived facet aggregation. */
const FACETS_CACHE_KEY = `${CACHE_PREFIXES.SEARCH}:facets`;

/**
 * Issue #814 — full-text search backed by a `tsvector` generated column with a
 * GIN index (see migration `1783000000003-add-course-full-text-search.ts`).
 *
 * `to_tsquery` is parsed and is strict about operator characters; we use
 * `plainto_tsquery` to accept anything the user types (it ignores punctuation,
 * lowercases, applies the stemming configuration, ANDs all terms).
 * `to_tsvector` is already cached in `course.search_vector`, so this is just
 * an index scan + ranking — no seq scan, even at 100k+ rows.
 *
 * Issue #999 — getAvailableFilters() now runs real GROUP BY aggregations over
 * published courses rather than returning a hardcoded literal.  Results are
 * cached (CACHE_TTL.SEARCH_RESULTS) and invalidated on COURSE_CREATED /
 * COURSE_UPDATED / COURSE_DELETED events.  Incoming SearchFilters.category
 * values are validated against the live facet set.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly AUTOCOMPLETE_LIMIT = 10;
  private readonly CACHE_TTL_MS = 300000; // 5 minutes
  private readonly AUTOCOMPLETE_CACHE_MAX_SIZE = 1000;
  private autocompleteCache: LRUCache<string, AutocompleteResult[]>;
  private isElasticsearchAvailable = false;

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    private readonly elasticsearch: NestElasticsearchService,
    private readonly metricsService: MetricsService,
    @Optional() private readonly isolationService?: IsolationService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {
    this.autocompleteCache = new LRUCache<string, AutocompleteResult[]>({
      max: this.AUTOCOMPLETE_CACHE_MAX_SIZE,
      ttl: this.CACHE_TTL_MS,
    });
  }

  async onModuleInit() {
    if (!this.elasticsearch) {
      this.logger.warn('Elasticsearch client not injected.');
      return;
    }
    try {
      const pingResult = await this.elasticsearch.ping();
      this.isElasticsearchAvailable = !!pingResult;
      if (this.isElasticsearchAvailable) {
        this.logger.log('Elasticsearch is available and will serve search queries.');
      } else {
        this.logger.warn('Elasticsearch ping failed. Falling back to DB search.');
      }
    } catch (error) {
      this.logger.warn(
        `Elasticsearch ping failed: ${(error as Error).message}. Falling back to DB search.`,
      );
      this.isElasticsearchAvailable = false;
    }
  }

  async search(
    query: string,
    filters?: SearchFilters,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sort?: string,
    page = 1,
    limit: number = 20,
  ): Promise<any> {
    const safeQuery = query?.trim() ?? '';

    // Issue #999 — validate incoming filter values against the live facet set.
    if (filters) {
      await this.validateFilters(filters);
    }

    const cacheKey = `search:${safeQuery}:${JSON.stringify(filters)}:${sort}:${page}`;
    const cacheKey = this.buildSearchCacheKey(safeQuery, filters, sort, page, limit);

    if (this.cacheManager) {
      const cached = await this.cacheManager.get<any>(cacheKey);
      if (cached) return cached;
    }

    if (this.isElasticsearchAvailable) {
      const esResults = await this.tryElasticsearch(safeQuery, filters, page, limit, sort);
      if (esResults) {
        if (this.cacheManager)
          await this.cacheManager.set(cacheKey, esResults, SEARCH_CACHE_TTL_MS);
        return esResults;
      }
      // If tryElasticsearch returned null due to an intermittent error, we fall through and record the fallback metric.
      this.metricsService.searchFallbackCounter.inc({ reason: 'error' });
    } else {
      this.metricsService.searchFallbackCounter.inc({ reason: 'unavailable' });
    }

    try {
      const qb = this.courseRepository.createQueryBuilder('course');
      if (safeQuery) {
        // PostgreSQL `plainto_tsquery` is the safest parser for arbitrary user
        // input. The match operator `@@` uses the GIN index on
        // `course.search_vector`. Ranking via `ts_rank` keeps relevance.
        qb.addSelect(
          "ts_rank(course.search_vector, plainto_tsquery('english', :query))",
          'rank',
        ).where(
          new Brackets((qb1) => {
            qb1
              .where("course.search_vector @@ plainto_tsquery('english', :query)", {
                query: safeQuery,
              })
              .orWhere('course.title ILIKE :fallback', {
                fallback: `%${safeQuery}%`,
              });
          }),
        );
      }

      if (filters?.category) {
        const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
        qb.andWhere('course.category IN (:cats)', { cats });
      }

      if (filters?.price?.gte !== undefined)
        qb.andWhere('course.price >= :minPrice', { minPrice: filters.price.gte });
      if (filters?.price?.lte !== undefined)
        qb.andWhere('course.price <= :maxPrice', { maxPrice: filters.price.lte });

      if (safeQuery) {
        // Relevance ordering when there is a query — falls through to
        // createdAt when relevance is the same across matches.
        qb.orderBy('rank', 'DESC').addOrderBy('course.createdAt', 'DESC');
      } else if (sort === 'price_asc') {
        qb.orderBy('course.price', 'ASC');
      } else if (sort === 'price_desc') {
        qb.orderBy('course.price', 'DESC');
      } else if (sort === 'newest') {
        qb.orderBy('course.createdAt', 'DESC');
      } else {
        qb.orderBy('course.createdAt', 'DESC');
      }

      const skip = (page - 1) * limit;
      qb.skip(skip).take(limit);
      const [results, total] = await qb.getManyAndCount();

      const result = { results, total, page, limit, query: safeQuery };
      if (this.cacheManager) await this.cacheManager.set(cacheKey, result, SEARCH_CACHE_TTL_MS);
      return result;
    } catch (err) {
      this.logger.error(`Search failed: ${(err as Error).message}`);
      return { results: [], total: 0, page, limit, query: safeQuery };
    }
  }

  async getAutoComplete(query: string): Promise<AutocompleteResult[]> {
    if (!query || query.length < 2) return [];

    const cached = this.autocompleteCache.get(query);
    if (cached) return cached;

    try {
      // Prefix search via `to_tsquery('simple', :q || ':*')` — the 'simple'
      // configuration skips stemming so autocomplete matches the literal
      // prefix typed by the user (no surprise plurals/synonyms).
      const tsQuery = `${this.sanitizeTsQueryTerm(query)}:*`;

      const courses = await this.courseRepository
        .createQueryBuilder('course')
        .where("course.search_vector @@ to_tsquery('simple', :tsq)", { tsq: tsQuery })
        .orderBy('course.enrollmentCount', 'DESC')
        .take(this.AUTOCOMPLETE_LIMIT)
        .select(['course.id', 'course.title'])
        .getMany();

      const results: AutocompleteResult[] = courses.map((course: any) => ({
        title: course.title,
        type: 'course' as const,
        metadata: { courseId: course.id },
      }));

      this.autocompleteCache.set(query, results);
      return results;
    } catch (err) {
      this.logger.error(`Autocomplete failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Issue #999 — derives filter facets from real published courses via GROUP BY
   * aggregations.  Results are cached under FACETS_CACHE_KEY with a short TTL
   * (CACHE_TTL.SEARCH_RESULTS = 2 min) and invalidated whenever a course is
   * created, updated, or deleted.
   *
   * Shape: `{ categories: FacetValue[], levels: FacetValue[], languages: FacetValue[] }`
   * where each FacetValue is `{ value: string; count: number }`.
   * Zero-count values are omitted — every returned facet will yield at least
   * one result when applied as a filter.
   */
  async getAvailableFilters(): Promise<AvailableFilters> {
    // Return cached result when available to avoid re-running the aggregation
    // on every facet request within the TTL window (Issue #999).
    if (this.cacheManager) {
      const cached = await this.cacheManager.get<AvailableFilters>(FACETS_CACHE_KEY);
      if (cached) return cached;
    }

    const facets = await this.aggregateFacets();

    if (this.cacheManager) {
      await this.cacheManager.set(FACETS_CACHE_KEY, facets, CACHE_TTL.SEARCH_RESULTS);
    }

    return facets;
  }

  /**
   * Runs the GROUP BY aggregations against the `course` table and assembles
   * the AvailableFilters response.  Only published courses contribute.
   */
  private async aggregateFacets(): Promise<AvailableFilters> {
    try {
      // Category facet — `category` is a real nullable column on `course`.
      const categoryRows: Array<{ category: string; count: string }> = await this.courseRepository
        .createQueryBuilder('course')
        .select('course.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .where('course.status = :status', { status: CourseStatus.PUBLISHED })
        .andWhere('course.category IS NOT NULL')
        .andWhere("course.category <> ''")
        .groupBy('course.category')
        .orderBy('count', 'DESC')
        .limit(SEARCH_CONSTANTS.AGG_CATEGORIES_SIZE)
        .getRawMany();

      const categories: FacetValue[] = categoryRows.map((row) => ({
        value: row.category,
        count: parseInt(row.count, 10),
      }));

      // `level` and `language` are not yet columns on the Course entity.
      // Return empty arrays as placeholders so the API contract is stable;
      // these will be populated once the columns are added.
      const levels: FacetValue[] = [];
      const languages: FacetValue[] = [];

      return { categories, levels, languages };
    } catch (err) {
      this.logger.error(`Facet aggregation failed: ${(err as Error).message}`);
      return { categories: [], levels: [], languages: [] };
    }
  }

  /**
   * Validates incoming SearchFilters against the live facet values.
   * Throws BadRequestException (HTTP 400) for any unknown category value.
   *
   * Issue #999 — prevents hardcoded facet lists from drifting out of sync
   * with accepted filter values.
   */
  async validateFilters(filters: SearchFilters): Promise<void> {
    if (!filters.category) return;

    const requestedCategories = Array.isArray(filters.category)
      ? filters.category
      : [filters.category];

    const facets = await this.getAvailableFilters();
    const validCategories = new Set(facets.categories.map((f) => f.value));

    const unknown = requestedCategories.filter((c) => !validCategories.has(c));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown filter value(s) for 'category': ${unknown.join(', ')}. ` +
          `Valid values are: ${[...validCategories].join(', ') || '(none — no published courses yet)'}`,
      );
    }
  }

  /**
   * Issue #999 — invalidate the facets cache whenever a course is created,
   * updated, or deleted so the next request re-runs the aggregation.
   */
  @OnEvent(CACHE_EVENTS.COURSE_CREATED)
  @OnEvent(CACHE_EVENTS.COURSE_UPDATED)
  @OnEvent(CACHE_EVENTS.COURSE_DELETED)
  async onCourseChanged(_payload: { id: string }): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.del(FACETS_CACHE_KEY);
      this.logger.debug('Facets cache invalidated after course change');
    }
  }

  buildTenantFilter(tenantId: string): { term: { tenantId: string } } {
    return { term: { tenantId } };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Build a cache key that uniquely identifies every parameter that affects
   * the search result: query, filters, sort, page, and limit. Filters are
   * serialized canonically (keys sorted recursively) so that semantically
   * identical filter objects produce the same key regardless of argument
   * order.
   */
  private buildSearchCacheKey(
    query: string,
    filters: SearchFilters | undefined,
    sort: string | undefined,
    page: number,
    limit: number,
  ): string {
    return `search:${query}:${this.canonicalize(filters)}:${sort ?? ''}:${page}:${limit}`;
  }

  /**
   * Canonical serializer that recursively sorts object keys so the resulting
   * string is independent of property order. Arrays preserve their order
   * (order is semantically meaningful for filters like `category`).
   */
  private canonicalize(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.canonicalize(v)).join(',')}]`;
    }
    if (typeof value === 'object') {
      const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
      const entries = sortedKeys.map(
        (k) => `${k}:${this.canonicalize((value as Record<string, unknown>)[k])}`,
      );
      return `{${entries.join(',')}}`;
    }
    return JSON.stringify(value);
  }

  /**
   * Attempt the Elasticsearch path; returns `null` if ES isn't available /
   * throws so the caller falls back to the DB. We never throw ES errors up
   * to the API contract.
   */
  private async tryElasticsearch(
    query: string,
    filters: SearchFilters | undefined,
    page: number,
    limit: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sort?: string,
  ): Promise<any | null> {
    if (!this.elasticsearch) return null;
    try {
      const tenantId = this.isolationService?.getTenantId() ?? '';
      const mustClauses: any[] = [];
      if (query) {
        mustClauses.push({
          multi_match: {
            query,
            fields: ['title^3', 'description', 'category^2'],
          },
        });
      } else {
        mustClauses.push({ match_all: {} });
      }

      const result = await this.elasticsearch.search({
        index: 'courses',
        from: (page - 1) * limit,
        size: limit,
        query: {
          bool: {
            must: mustClauses,
            filter: [this.buildTenantFilter(tenantId)],
          },
        },
      });
      return {
        results: result.hits?.hits?.map((h: any) => h._source) ?? [],
        total:
          typeof result.hits?.total === 'number'
            ? result.hits.total
            : (result.hits?.total?.value ?? 0),
        page,
        limit,
        query,
        source: 'elasticsearch',
      };
    } catch (err) {
      this.logger.warn(
        `Elasticsearch unavailable for query "${query}", falling back to DB: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Strip tsquery metacharacters from a single autocomplete token. The GIN
   * index will refuse to match a query that contains `& | ! ( ) : *` so we
   * replace them with spaces before building the prefix.
   */
  private sanitizeTsQueryTerm(term: string): string {
    return term.replace(/[&|!():*]/g, ' ').trim();
  }
}

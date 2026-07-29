import {
  Injectable,
  Logger,
  Inject,
  Optional,
  OnModuleInit,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, QueryFailedError } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
import { LRUCache } from 'lru-cache';
import { IsolationService } from '../tenancy/isolation/isolation.service';
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

interface AutocompleteResult {
  title: string;
  type: 'course' | 'category' | 'trending';
  metadata?: Record<string, any>;
}

/**
 * Issue #814 — full-text search backed by a `tsvector` generated column with a
 * GIN index (see migration `1783000000003-add-course-full-text-search.ts`).
 *
 * `to_tsquery` is parsed and is strict about operator characters; we use
 * `plainto_tsquery` to accept anything the user types (it ignores punctuation,
 * lowercases, applies the stemming configuration, ANDs all terms).
 * `to_tsvector` is already cached in `course.search_vector`, so this is just
 * an index scan + ranking — no seq scan, even at 100k+ rows.
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
        qb.andWhere('course.category IN (:...cats)', { cats });
      }

      if (filters?.level) {
        const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
        qb.andWhere('course.level IN (:...levels)', { levels });
      }

      if (filters?.language) {
        const languages = Array.isArray(filters.language) ? filters.language : [filters.language];
        qb.andWhere('course.language IN (:...languages)', { languages });
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
      this.handleQueryFailure(err, 'Search');
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
      this.handleQueryFailure(err, 'Autocomplete');
    }
  }

  async getAvailableFilters(): Promise<any> {
    return {
      categories: ['programming', 'web-development', 'data-science', 'design', 'business'],
      levels: ['beginner', 'intermediate', 'advanced'],
      languages: ['en', 'es', 'fr', 'de', 'zh'],
    };
  }

  buildTenantFilter(tenantId: string): { term: { tenantId: string } } {
    return { term: { tenantId } };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * A repository/driver failure during search must never look like a
   * genuine zero-result search — that hides real outages behind a 200 and
   * makes error-rate metrics blind to them (issue #997). Logs, increments
   * `search_query_failures_total` labelled by failure class, and rethrows:
   * malformed filter values the caller supplied (bad UUID, invalid enum
   * value — Postgres data-exception class '22xxx') become a 400; anything
   * else (connection errors, timeouts, unexpected driver errors) becomes a
   * 503 so the global exception filter and error-rate metrics see it.
   */
  private handleQueryFailure(err: unknown, context: string): never {
    const isCallerError = this.isCallerFilterError(err);
    const failureClass = isCallerError ? 'caller' : 'infrastructure';

    this.metricsService.searchQueryFailuresCounter.inc({ failure_class: failureClass });
    this.logger.error(`${context} failed (${failureClass}): ${(err as Error).message}`);

    if (isCallerError) {
      throw new BadRequestException('One or more search filter values are invalid');
    }
    throw new ServiceUnavailableException('Search is temporarily unavailable');
  }

  /**
   * Postgres reports malformed input (invalid UUID, invalid enum value, bad
   * numeric literal, ...) under the '22' (data exception) SQLSTATE class.
   * Those stem directly from a filter value the caller supplied, as opposed
   * to a connection failure, timeout, or a bug in our own SQL.
   */
  private isCallerFilterError(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const code = (err as QueryFailedError & { code?: string }).code;
    return typeof code === 'string' && code.startsWith('22');
  }

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

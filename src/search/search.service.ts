import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
import { LRUCache } from 'lru-cache';
import { IsolationService } from '../tenancy/isolation/isolation.service';

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
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly AUTOCOMPLETE_LIMIT = 10;
  private readonly CACHE_TTL_MS = 300000; // 5 minutes
  private readonly AUTOCOMPLETE_CACHE_MAX_SIZE = 1000;
  private autocompleteCache: LRUCache<string, AutocompleteResult[]>;

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    private readonly elasticsearch: NestElasticsearchService,
    @Optional() private readonly isolationService?: IsolationService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {
    this.autocompleteCache = new LRUCache<string, AutocompleteResult[]>({
      max: this.AUTOCOMPLETE_CACHE_MAX_SIZE,
      ttl: this.CACHE_TTL_MS,
    });
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
    const cacheKey = `search:${safeQuery}:${JSON.stringify(filters)}:${sort}:${page}`;

    if (this.cacheManager) {
      const cached = await this.cacheManager.get<any>(cacheKey);
      if (cached) return cached;
    }

    // Try the Elasticsearch fast-path first when present. Fall back to PostgreSQL FTS
    // below on any failure so the API still returns results during ES outages.
    const esResults = await this.tryElasticsearch(safeQuery, filters, page, limit, sort);
    if (esResults) {
      if (this.cacheManager) await this.cacheManager.set(cacheKey, esResults, 30);
      return esResults;
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
      if (this.cacheManager) await this.cacheManager.set(cacheKey, result, 30);
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

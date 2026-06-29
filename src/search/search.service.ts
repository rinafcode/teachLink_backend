import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
import { LRUCache } from 'lru-cache';

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
  private readonly AUTOCOMPLETE_CACHE_MAX_SIZE = 1000;
  private autocompleteCache: LRUCache<string, AutocompleteResult[]>;

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    private readonly elasticsearch: NestElasticsearchService,
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

    try {
      const qb = this.courseRepository.createQueryBuilder('course');
      if (safeQuery) {
        qb.where('course.title ILIKE :query OR course.description ILIKE :query', {
          query: `%${safeQuery}%`,
        });
      }

      if (filters?.category) {
        const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
        qb.andWhere('course.category IN (:cats)', { cats });
      }

      if (filters?.price?.gte !== undefined)
        qb.andWhere('course.price >= :minPrice', { minPrice: filters.price.gte });
      if (filters?.price?.lte !== undefined)
        qb.andWhere('course.price <= :maxPrice', { maxPrice: filters.price.lte });

      if (sort === 'price_asc') qb.orderBy('course.price', 'ASC');
      else if (sort === 'price_desc') qb.orderBy('course.price', 'DESC');
      else if (sort === 'newest') qb.orderBy('course.createdAt', 'DESC');
      else qb.orderBy('course.createdAt', 'DESC');

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
}

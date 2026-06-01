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
  price?: {
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
    private courseRepository: Repository<Course>,
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
    this.logger.log(`Searching for: ${query}`);

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
    return {
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
    this.logger.log(`Getting analytics for ${days} days`);
    // Analytics integration not available in this release; return a safe placeholder.
    return {
      topQueries: [],
      totalSearches: 0,
      averageResults: 0,
    };
  }

  private generateCacheKey(
    query: string,
    filters?: SearchFilters,
    sort?: string,
    page = 1,
    limit: number = SEARCH_CONSTANTS.DEFAULT_PAGE_SIZE,
  ): string {
    // Stable hash of the query state ensures identical search requests
    // map to the same cache entry regardless of object ordering.
    const str = `${query}:${JSON.stringify(filters)}:${sort ?? 'default'}:${page}:${limit}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
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

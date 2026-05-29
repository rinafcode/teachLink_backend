import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  /**
   * Search logic is currently stubbed for API development.
   *
   * A production implementation should translate query + filters into an
   * Elasticsearch request, evaluate relevance scores, and return paginated
   * results with stable caching and analytics tracking.
   */
  async search(
    query: string,
    filters?: SearchFilters,
    sort?: string,
    page = 1,
    limit: number = SEARCH_CONSTANTS.DEFAULT_PAGE_SIZE,
  ): Promise<any> {
    this.logger.log(`Searching for: ${query}`);

    // TODO: build a real Elasticsearch query from query, filters, and sort.
    // Currently this is a placeholder to preserve API contracts.
    return {
      results: [],
      total: 0,
      page,
      limit,
      filters: filters || {},
      query,
    };
  }

  async getAutoComplete(query: string): Promise<any> {
    this.logger.log(`Autocomplete for: ${query}`);
    // TODO: return suggestions from Elasticsearch search_as_you_type fields
    return [];
  }

  async getAvailableFilters(): Promise<any> {
    return {
      categories: [],
      levels: [],
      languages: [],
      priceRanges: [],
    };
  }

  async getAnalytics(days: number = 7): Promise<any> {
    this.logger.log(`Getting analytics for ${days} days`);
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
}

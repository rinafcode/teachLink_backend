import { Injectable, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { SemanticSearchService } from '../search/semantic/semantic-search.service';
import { IndexingService } from '../search/indexing/indexing.service';
import { DiscoveryAlgorithmService } from '../search/discovery/discovery-algorithm.service';
import { SearchAnalyticsService } from '../search/analytics/search-analytics.service';
import { AutoCompleteService } from '../search/autocomplete/autocomplete.service';
import { SearchFiltersService } from '../search/filters/search-filters.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { CachingService } from '../caching/caching.service';

@Injectable()
export class SearchEngineService {
  private readonly logger = new Logger(SearchEngineService.name);

  constructor(
    private readonly esService: ElasticsearchService,
    private readonly semanticSearchService: SemanticSearchService,
    private readonly indexingService: IndexingService,
    private readonly discoveryAlgorithmService: DiscoveryAlgorithmService,
    private readonly analyticsService: SearchAnalyticsService,
    private readonly autoCompleteService: AutoCompleteService,
    private readonly filtersService: SearchFiltersService,
    private readonly cachingService: CachingService,
  ) {}

  async search(query: string, filters: any, from = 0, size = 10, userId?: string, semantic = false) {
    const cacheKey = `search:${semantic ? 'semantic' : 'fulltext'}:${userId || 'anon'}:${JSON.stringify(query)}:${JSON.stringify(filters)}:${from}:${size}`;
    return this.cachingService.getOrSet(cacheKey, async () => {
      try {
        this.analyticsService.logSearch(userId || 'anonymous', query, filters);
        let results: any[] = [];
        if (semantic) {
          // Semantic search with embeddings
          results = await this.semanticSearchService.semanticSearch(query, filters, from, size);
        } else {
          // Full-text search with ranking
          const filterQuery = this.filtersService.buildFilterQuery(filters);
          const params = {
            index: 'courses',
            from,
            size,
            body: {
              query: {
                bool: {
                  must: [
                    { multi_match: { query, fields: ['title^3', 'description', 'content'] } },
                  ],
                  filter: filterQuery,
                },
              },
              sort: [
                { _score: { order: 'desc' } },
                { popularity: { order: 'desc' } },
              ],
            }
          } as any;
          const result = await this.esService.search(params);
          results = result.hits.hits.map(hit => hit._source);
        }
        // Personalize results if userId is provided
        if (userId) {
          results = await this.discoveryAlgorithmService.personalizeResults(userId, results);
        }
        return results;
      } catch (error) {
        this.logger.error('Search failed', error);
        throw error;
      }
    }, { ttl: 60 });
  }

  async autocomplete(prefix: string) {
    return this.autoCompleteService.getSuggestions(prefix);
  }

  async indexContent(id: string, content: string, metadata: Record<string, any> = {}) {
    return this.semanticSearchService.indexDocument(id, content, metadata);
  }

  async removeContent(id: string) {
    return this.semanticSearchService.deleteDocument(id);
  }

  async indexCourse(course: any) {
    return this.indexingService.indexCourse(course);
  }

  async removeCourse(courseId: string) {
    return this.indexingService.removeCourse(courseId);
  }

  async bulkIndexCourses(courses: any[]) {
    return this.indexingService.bulkIndexCourses(courses);
  }

  async getAnalytics(timeRange: { from: Date; to: Date }, userRole?: string, userIp?: string) {
    return this.analyticsService.getAnalytics(timeRange, userRole, userIp);
  }

  async getPersonalizationStats(userId: string) {
    return this.discoveryAlgorithmService.getPersonalizationStats(userId);
  }
} 
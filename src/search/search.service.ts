import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { AutoCompleteService } from './autocomplete/autocomplete.service';
import { SearchFiltersService } from './filters/search-filters.service';
import { SemanticSearchService } from './semantic/semantic-search.service';
import { DiscoveryAlgorithmService } from './discovery/discovery-algorithm.service';
import { SearchAnalyticsService } from './analytics/search-analytics.service';
import { SearchRequest } from '@elastic/elasticsearch/lib/api/types';

@Injectable()
export class SearchService {
  constructor(
    private readonly esService: ElasticsearchService,
    private readonly autoCompleteService: AutoCompleteService,
    private readonly filtersService: SearchFiltersService,
    private readonly semanticSearchService: SemanticSearchService,
    private readonly discoveryAlgorithmService: DiscoveryAlgorithmService,
    private readonly analyticsService: SearchAnalyticsService,
  ) {}

  async search(
    query: string,
    filters: any,
    from = 0,
    size = 10,
    userId?: string,
    semantic = false,
  ) {
    try {
      this.analyticsService.logSearch(userId || 'anonymous', query, filters);
      let results: any[] = [];
      if (semantic) {
        // Semantic search with embeddings
        results = await this.semanticSearchService.semanticSearch(
          query,
          filters,
          from,
          size,
        );
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
                  {
                    multi_match: {
                      query,
                      fields: ['title^3', 'description', 'content'],
                    },
                  },
                ],
                filter: filterQuery,
              },
            },
            sort: [
              { _score: { order: 'desc' } },
              { popularity: { order: 'desc' } },
            ],
          },
        } as any;
        const result = await this.esService.search(params);
        results = result.hits.hits.map((hit) => hit._source);
      }
      // Personalize results
      if (userId) {
        results = await this.discoveryAlgorithmService.personalizeResults(
          userId,
          results,
        );
      }
      return results;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getSuggestions(prefix: string) {
    try {
      return await this.autoCompleteService.getSuggestions(prefix);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async logClick(userId: string, resultId: string) {
    this.analyticsService.logClick(userId, resultId);
  }

  async getAnalytics() {
    return this.analyticsService.getAnalytics();
  }
}

import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { AutoCompleteService } from './autocomplete/autocomplete.service';
import { SearchFiltersService } from './filters/search-filters.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly autoCompleteService: AutoCompleteService,
    private readonly searchFiltersService: SearchFiltersService,
  ) {}

  async performSearch(query: string, filters: any, sort?: string) {
    const searchBody = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['title^2', 'description', 'content', 'tags'],
              },
            },
          ],
          filter: this.buildFilters(filters),
        },
      },
      sort: this.buildSort(sort),
      track_total_hits: true,
    };

    // Ensure sort fields are properly formatted for ES
    if (searchBody.sort && Array.isArray(searchBody.sort)) {
      searchBody.sort = searchBody.sort.map(sortItem => {
        if (typeof sortItem === 'object' && sortItem !== null) {
          // Convert object keys to proper format
          const newSortItem = {};
          for (const [key, value] of Object.entries(sortItem)) {
            if (typeof value === 'object' && value !== null) {
              newSortItem[key] = { ...value };
            } else {
              newSortItem[key] = value;
            }
          }
          return newSortItem;
        }
        return sortItem;
      });
    }

    const result = await this.elasticsearchService.search({
      index: 'courses',
      body: searchBody,
    });

    const rankedResults = this.rankResults(result.hits.hits);
    await this.logSearch(query, rankedResults.length);
    return rankedResults;
  }

  async getAutoComplete(query: string) {
    return this.autoCompleteService.getSuggestions(query);
  }

  async getAvailableFilters() {
    return this.searchFiltersService.getFilters();
  }

  private buildFilters(filters: any) {
    const esFilters = [];
    if (filters.category) {
      esFilters.push({ term: { category: filters.category } });
    }
    if (filters.level) {
      esFilters.push({ term: { level: filters.level } });
    }
    if (filters.price) {
      esFilters.push({ range: { price: filters.price } });
    }
    return esFilters;
  }

  private buildSort(sort?: string) {
    if (sort === 'relevance') {
      return ['_score'];
    } else if (sort === 'popularity') {
      return [{ 'views': { 'order': 'desc' as const } }];
    } else if (sort === 'rating') {
      return [{ 'rating': { 'order': 'desc' as const } }];
    }
    return ['_score'];
  }

  private rankResults(hits: any[]) {
    return hits.map(hit => ({
      ...hit._source,
      score: hit._score,
      relevance: hit._score * (hit._source.views || 1), // Simple ranking
    }));
  }

  private async logSearch(query: string, resultsCount: number) {
    // Simple analytics: log to console (in production, store in database)
    console.log(`Search query: "${query}", Results count: ${resultsCount}`);
  }
}

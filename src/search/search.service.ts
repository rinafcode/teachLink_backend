import { Injectable, BadRequestException } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { AutoCompleteService } from './autocomplete/autocomplete.service';
import { SearchFiltersService } from './filters/search-filters.service';
import { SearchRequest } from '@elastic/elasticsearch/lib/api/types';

@Injectable()
export class SearchService {
  constructor(
    private readonly esService: ElasticsearchService,
    private readonly autoCompleteService: AutoCompleteService,
    private readonly filtersService: SearchFiltersService,
  ) {}

  async search(query: string, filters: any, from = 0, size = 10) {
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

    try {
      const result = await this.esService.search(params);
      return result.hits.hits.map(hit => hit._source);
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
}
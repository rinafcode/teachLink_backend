import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { COURSES_INDEX } from '../search.service';
import { SEARCH_CONSTANTS } from '../search.constants';

/**
 * Provides auto Complete operations.
 */
@Injectable()
export class AutoCompleteService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  /**
   * Retrieves suggestions.
   * @param query The query value.
   * @returns The matching results.
   */
  async getSuggestions(query: string): Promise<string[]> {
    const sanitizedQuery = (query ?? '').trim().slice(0, 100);
    if (!sanitizedQuery) {
      return [];
    }

    const result = await this.elasticsearchService.search({
      index: COURSES_INDEX,
      _source: false,
      timeout: SEARCH_CONSTANTS.AUTOCOMPLETE_TIMEOUT,
      suggest: {
        title_suggest: {
          text: sanitizedQuery,
          completion: {
            field: 'title.suggest',
            skip_duplicates: true,
            size: SEARCH_CONSTANTS.AUTOCOMPLETE_SIZE,
          },
        },
      },
    });

    const options = result.suggest?.title_suggest?.[0]?.options ?? [];
    return Array.isArray(options) ? options.map((option: any) => option.text as string) : [];
  }
}

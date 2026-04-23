import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { COURSES_INDEX } from '../search.service';

@Injectable()
export class AutoCompleteService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async getSuggestions(query: string): Promise<string[]> {
    const result = await this.elasticsearchService.search({
      index: COURSES_INDEX,
      suggest: {
        title_suggest: {
          text: query,
          completion: {
            field: 'title.suggest',
            skip_duplicates: true,
            size: 10,
          },
        },
      },
    });

    const options = result.suggest?.title_suggest?.[0]?.options ?? [];
    return Array.isArray(options) ? options.map((option: any) => option.text as string) : [];
  }
}

import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class AutoCompleteService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async getSuggestions(query: string) {
    const result = await this.elasticsearchService.search({
      index: 'courses',
      body: {
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
      },
    });

    const suggestions = result.suggest.title_suggest[0].options;
    return Array.isArray(suggestions) 
      ? suggestions.map((option: any) => option.text) 
      : [];
  }
}

import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class AutoCompleteService {
  constructor(private readonly esService: ElasticsearchService) {}

  async getSuggestions(prefix: string) {
    const params = {
      index: 'courses',
      body: {
        suggest: {
          course_suggest: {
            prefix,
            completion: {
              field: 'suggest',
              fuzzy: { fuzziness: 1 },
              size: 5,
            },
          },
        },
      },
    } as any;
    const result = await this.esService.search(params);
    return (result.suggest.course_suggest[0].options as any[]).map(opt => opt.text);
  }
} 
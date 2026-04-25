import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { COURSES_INDEX } from '../search.service';
@Injectable()
export class AutoCompleteService {
    constructor(private readonly elasticsearchService: ElasticsearchService) { }
    async getSuggestions(query: string): Promise<string[]> {
        const sanitizedQuery = (query ?? '').trim().slice(0, 100);
        if (!sanitizedQuery) {
            return [];
        }
        const result = await this.elasticsearchService.search({
            index: COURSES_INDEX,
            _source: false,
            timeout: '1000ms',
            suggest: {
                title_suggest: {
                    text: sanitizedQuery,
                    completion: {
                        field: 'title.suggest',
                        skip_duplicates: true,
                        size: 10,
                    },
                },
            },
        });
        const options = result.suggest?.title_suggest?.[0]?.options ?? [];
        return Array.isArray(options) ? options.map((option: unknown) => option.text as string) : [];
    }
}

import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class SearchFiltersService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async getFilters() {
    const aggregations = await this.elasticsearchService.search({
      index: 'courses',
      body: {
        size: 0,
        aggs: {
          categories: {
            terms: { field: 'category' },
          },
          levels: {
            terms: { field: 'level' },
          },
          price_ranges: {
            range: {
              field: 'price',
              ranges: [
                { to: 50 },
                { from: 50, to: 100 },
                { from: 100, to: 200 },
                { from: 200 },
              ],
            },
          },
        },
      },
    });

    return {
      categories: aggregations.body.aggregations.categories.buckets,
      levels: aggregations.body.aggregations.levels.buckets,
      priceRanges: aggregations.body.aggregations.price_ranges.buckets,
    };
  }
}

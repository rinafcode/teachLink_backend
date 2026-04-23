import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { COURSES_INDEX } from '../search.service';

@Injectable()
export class SearchFiltersService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async getFilters() {
    const result = await this.elasticsearchService.search({
      index: COURSES_INDEX,
      size: 0,
      _source: false,
      timeout: '1500ms',
      aggs: {
        categories: { terms: { field: 'category', size: 50 } },
        levels: { terms: { field: 'level', size: 10 } },
        languages: { terms: { field: 'language', size: 30 } },
        price_stats: { stats: { field: 'price' } },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { key: 'free', to: 1 },
              { key: 'under_50', from: 1, to: 50 },
              { key: '50_to_100', from: 50, to: 100 },
              { key: '100_to_200', from: 100, to: 200 },
              { key: 'over_200', from: 200 },
            ],
          },
        },
        rating_ranges: {
          range: {
            field: 'rating',
            ranges: [
              { key: '4_and_up', from: 4 },
              { key: '3_and_up', from: 3 },
              { key: '2_and_up', from: 2 },
            ],
          },
        },
      },
    });

    const aggs = result.aggregations as any;

    return {
      categories: aggs?.categories?.buckets ?? [],
      levels: aggs?.levels?.buckets ?? [],
      languages: aggs?.languages?.buckets ?? [],
      priceStats: aggs?.price_stats ?? {},
      priceRanges: aggs?.price_ranges?.buckets ?? [],
      ratingRanges: aggs?.rating_ranges?.buckets ?? [],
    };
  }
}

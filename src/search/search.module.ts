import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TenancyModule } from '../tenancy/tenancy.module';
import { SearchElasticsearchModule } from './elasticsearch/elasticsearch.module';

import { MetricsModule } from '../utils/masking/metrics.module';

/**
 * Search module supports Elasticsearch-backed course searching,
 * facets, autocomplete, and result caching when available.
 */
@Module({
  imports: [TenancyModule, MetricsModule, SearchElasticsearchModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

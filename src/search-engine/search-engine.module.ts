import { Module, forwardRef } from '@nestjs/common';
import { SearchEngineService } from './search-engine.service';
import { SearchModule } from '../search/search.module';
import { SemanticSearchService } from '../search/semantic/semantic-search.service';
import { IndexingService } from '../search/indexing/indexing.service';
import { DiscoveryAlgorithmService } from '../search/discovery/discovery-algorithm.service';
import { SearchAnalyticsService } from '../search/analytics/search-analytics.service';
import { AutoCompleteService } from '../search/autocomplete/autocomplete.service';
import { SearchFiltersService } from '../search/filters/search-filters.service';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

@Module({
  imports: [forwardRef(() => SearchModule), ElasticsearchModule],
  providers: [
    SearchEngineService,
    SemanticSearchService,
    IndexingService,
    DiscoveryAlgorithmService,
    SearchAnalyticsService,
    AutoCompleteService,
    SearchFiltersService,
  ],
  exports: [SearchEngineService],
})
export class SearchEngineModule {}

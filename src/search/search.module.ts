import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { IndexingService } from './indexing/indexing.service';
import { AutoCompleteService } from './autocomplete/autocomplete.service';
import { SearchFiltersService } from './filters/search-filters.service';
import { SemanticSearchService } from './semantic/semantic-search.service';
import { DiscoveryAlgorithmService } from './discovery/discovery-algorithm.service';
import { DiscoveryAlgorithmEnhancedService } from './discovery/discovery-algorithm-enhanced.service';
import { SearchAnalyticsService } from './analytics/search-analytics.service';
import { SearchAnalyticsEnhancedService } from './analytics/search-analytics-enhanced.service';

@Module({
  imports: [
    ConfigModule,
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      },
      tls: process.env.ELASTICSEARCH_TLS === 'true' ? {} : undefined,
      maxRetries: 3,
      requestTimeout: 30000,
      sniffOnStart: true,
    }),
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    IndexingService,
    AutoCompleteService,
    SearchFiltersService,
    SemanticSearchService,
    DiscoveryAlgorithmService,
    DiscoveryAlgorithmEnhancedService,
    SearchAnalyticsService,
    SearchAnalyticsEnhancedService,
    // Provider for embedding model configuration
    {
      provide: 'EMBEDDING_MODEL',
      useFactory: () => {
        // This will be configured by the SemanticSearchService
        return null;
      },
    },
  ],
  exports: [
    SearchService,
    IndexingService,
    SemanticSearchService,
    DiscoveryAlgorithmEnhancedService,
    SearchAnalyticsEnhancedService,
  ],
})
export class SearchModule {}

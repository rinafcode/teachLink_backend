import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { IndexingService } from './indexing/indexing.service';
import { AutoCompleteService } from './autocomplete/autocomplete.service';
import { SearchFiltersService } from './filters/search-filters.service';
import { SearchIndexOptimizerService } from './indexing/search-index-optimizer.service';
import { createElasticsearchConfig } from '../config/elasticsearch.config';

@Module({
  imports: [
    ConfigModule,
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createElasticsearchConfig,
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService, IndexingService, AutoCompleteService, SearchFiltersService, SearchIndexOptimizerService],
  exports: [SearchService, IndexingService, AutoCompleteService, SearchFiltersService, SearchIndexOptimizerService],
})
export class SearchModule {}

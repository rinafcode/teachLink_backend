import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { IndexingService } from './indexing/indexing.service';
import { AutoCompleteService } from './autocomplete/autocomplete.service';
import { SearchFiltersService } from './filters/search-filters.service';

@Module({
  imports: [
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    }),
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    IndexingService,
    AutoCompleteService,
    SearchFiltersService,
  ],
  exports: [SearchService, IndexingService],
})
export class SearchModule {} 
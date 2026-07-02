import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { createElasticsearchConfig } from '../config/elasticsearch.config';
import { TenancyModule } from '../tenancy/tenancy.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/entities/course.entity';

/**
 * Search module supports Elasticsearch-backed course searching,
 * facets, autocomplete, and result caching when available.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Course]),
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createElasticsearchConfig,
    }),
    TenancyModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

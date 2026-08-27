import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch';
import { createElasticsearchConfig } from '../../config/elasticsearch.config';
import { ElasticsearchService } from './elasticsearch.service';

@Module({
  imports: [
    ConfigModule,
    NestElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createElasticsearchConfig,
    }),
  ],
  providers: [ElasticsearchService],
  exports: [ElasticsearchService, NestElasticsearchModule],
})
export class SearchElasticsearchModule {}
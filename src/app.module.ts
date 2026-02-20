import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MonitoringModule } from './monitoring/monitoring.module';
import { CachingModule } from './caching/caching.module';
import { SecurityModule } from './security/security.module';
import { MonitoringInterceptor } from './common/interceptors/monitoring.interceptor';
import { TypeOrmMonitoringLogger } from './monitoring/logging/typeorm-logger';
import { MetricsCollectionService } from './monitoring/metrics/metrics-collection.service';
import { SyncModule } from './sync/sync.module';
import { MediaModule } from './media/media.module';
import { BackupModule } from './backup/backup.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { DataWarehouseModule } from './data-warehouse/data-warehouse.module';
import { QueueModule } from './queues/queue.module';
import { GraphQLModule } from './graphql/graphql.module';
import { MigrationModule } from './migrations/migration.module';
import { ABTestingModule } from './ab-testing/ab-testing.module';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [MonitoringModule],
      inject: [MetricsCollectionService],
      useFactory: (metricsService: MetricsCollectionService) => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'teachlink',
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production',
        logging: true,
        logger: new TypeOrmMonitoringLogger(metricsService),
        maxQueryExecutionTime: 1000,
      }),
    }),
    MonitoringModule,
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    }),
    SyncModule,
    MediaModule,
    BackupModule,
    CollaborationModule,
    DataWarehouseModule,
    QueueModule,
    GraphQLModule,
    MigrationModule,
    ABTestingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },
  ],
})
export class AppModule {}

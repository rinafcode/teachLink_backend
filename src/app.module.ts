import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MonitoringModule } from './monitoring/monitoring.module';
import { MonitoringInterceptor } from './common/interceptors/monitoring.interceptor';
import { TypeOrmMonitoringLogger } from './monitoring/logging/typeorm-logger';
import { MetricsCollectionService } from './monitoring/metrics/metrics-collection.service';

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
        entities: [],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: true,
        logger: new TypeOrmMonitoringLogger(metricsService),
        maxQueryExecutionTime: 1000,
      }),
    }),
    MonitoringModule,
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

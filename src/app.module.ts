import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module'; // ✅ added

import { EmailModule } from './email-marketing/email.module';
import { IndexOptimizationModule } from './database/index-optimization/index-optimization.module';
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';
import { QuotaGuard } from './rate-limiting/guards/quota.guard';
import { getDatabaseConfig } from './config/database.config';
import { loadFeatureFlags } from './config/feature-flags.config';
import { SessionModule } from './session/session.module';
import { DebuggingModule } from './debugging/debugging.module';
import { DataPipelineModule } from './data-pipeline/data-pipeline.module';
import { CanaryModule } from './canary/canary.module';
import { IncidentManagementModule } from './incident-management/incident-management.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { CachingModule } from './caching/caching.module';

const featureFlags = loadFeatureFlags();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(getDatabaseConfig()),
    ScheduleModule.forRoot(),
    SessionModule,
    SearchModule,
    AnalyticsModule, // ✅ merged from feat branch
    IndexOptimizationModule,
    ...(featureFlags.ENABLE_RATE_LIMITING ? [RateLimitingModule] : []),
    DebuggingModule,
    DataPipelineModule,
    CanaryModule,
    IncidentManagementModule,
    MonitoringModule,
    ...(featureFlags.ENABLE_CACHING ? [CachingModule] : []),
  ],
  controllers: [AppController],
  providers: featureFlags.ENABLE_RATE_LIMITING
    ? [{ provide: APP_GUARD, useClass: QuotaGuard }]
    : [],
})
export class AppModule {}
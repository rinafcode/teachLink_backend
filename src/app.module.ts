import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';

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
import { RequestTimeoutInterceptor } from './common/interceptors/request-timeout.interceptor';
import { GlobalExceptionFilter } from './common/interceptors/global-exception.filter';
import { DeepLinkModule } from './deep-link/deep-link.module';
import { InvoicesModule } from './payments/invoices/invoices.module';
import { ReportingModule } from './payments/reporting/reporting.module';
import { HealthModule } from './health/health.module';

// ✅ keep BOTH modules
import { ReadReplicaModule } from './database/read-replica';
import { CachingModule } from './caching/caching.module';
import { CoursesModule } from './courses/courses.module';
import { AuthModule } from './auth/auth.module';
import { CohortsModule } from './cohorts/cohorts.module';

const featureFlags = loadFeatureFlags();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(getDatabaseConfig()),
    ScheduleModule.forRoot(),
    SessionModule,
    SearchModule,
    AnalyticsModule,
    IndexOptimizationModule,
    ...(featureFlags.ENABLE_RATE_LIMITING ? [RateLimitingModule] : []),
    DebuggingModule,
    DataPipelineModule,
    CanaryModule,
    IncidentManagementModule,
    MonitoringModule,
    DeepLinkModule,
    InvoicesModule,
    ReportingModule,
    HealthModule,

    // ✅ always include read replicas (or wrap if needed)
    ReadReplicaModule,

    // ✅ feature-flagged caching
    ...(featureFlags.ENABLE_CACHING ? [CachingModule] : []),

    // ✅ feature-flagged auth
    ...(featureFlags.ENABLE_AUTH ? [AuthModule] : []),

    // ✅ courses module with enrollment and prerequisite enforcement
    CoursesModule,
    CohortsModule,
  ],
  controllers: [AppController],
  providers: [
    ...(featureFlags.ENABLE_RATE_LIMITING ? [{ provide: APP_GUARD, useClass: QuotaGuard }] : []),
    { provide: APP_INTERCEPTOR, useClass: RequestTimeoutInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}

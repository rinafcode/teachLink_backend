import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';

import { MessagingModule } from './messaging/messaging.module';
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
import { IdempotencyModule } from './common/modules/idempotency.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { DeepLinkModule } from './deep-link/deep-link.module';
import { InvoicesModule } from './payments/invoices/invoices.module';
import { ReportingModule } from './payments/reporting/reporting.module';
import { HealthModule } from './health/health.module';
import { ModerationModule } from './moderation/moderation.module';

// ✅ keep BOTH modules
import { ReadReplicaModule } from './database/read-replica';
import { CachingModule } from './caching/caching.module';
import { SlackService } from './slack.service';
import { CoursesModule } from './courses/courses.module';
import { DataRetentionModule } from './data-retention/data-retention.module';
import { GatewayModule } from './gateway/gateway.module';

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
    IdempotencyModule,
    DeepLinkModule,
    InvoicesModule,
    ReportingModule,
    HealthModule,
    ...(featureFlags.ENABLE_MODERATION ? [ModerationModule] : []),

    // ✅ always include read replicas (or wrap if needed)
    ReadReplicaModule,

    // ✅ feature-flagged caching
    ...(featureFlags.ENABLE_CACHING ? [CachingModule] : []),

    // ✅ courses module with enrollment and prerequisite enforcement
    CoursesModule,

    // ✅ data retention: archiving and purging
    DataRetentionModule,

    // ✅ API gateway: routing, rate limiting, transformation, caching
    GatewayModule,
  ],
  controllers: [AppController],
  providers: [
    SlackService,
    ...(featureFlags.ENABLE_RATE_LIMITING ? [{ provide: APP_GUARD, useClass: QuotaGuard }] : []),
    { provide: APP_INTERCEPTOR, useClass: RequestTimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}

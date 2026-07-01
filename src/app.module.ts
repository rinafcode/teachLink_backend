import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { envValidationSchema } from './config/env.validation';

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
import { RoleVisibilityInterceptor } from './common/interceptors/role-visibility.interceptor';
import { ApiVersionMiddleware } from './common/middleware/api-version.middleware';
import { DeepLinkModule } from './deep-link/deep-link.module';
import { InvoicesModule } from './payments/invoices/invoices.module';
import { ReportingModule } from './payments/reporting/reporting.module';
import { HealthModule } from './health/health.module';

import { ReadReplicaModule } from './database/read-replica';
import { CachingModule } from './caching/caching.module';
import { CoursesModule } from './courses/courses.module';
import { AuthModule } from './auth/auth.module';
import { CohortsModule } from './cohorts/cohorts.module';
import { LoggingModule } from './logging/logging.module';
import { FeatureFlagAuditModule } from './config/feature-flag-audit.module';

const featureFlags = loadFeatureFlags();

@Module({
  imports: [
    LoggingModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
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
    ReadReplicaModule,
    ...(featureFlags.ENABLE_CACHING ? [CachingModule] : []),
    ...(featureFlags.ENABLE_AUTH ? [AuthModule] : []),
    CoursesModule,
    CohortsModule,
    FeatureFlagAuditModule,
  ],
  controllers: [AppController],
  providers: [
    ...(featureFlags.ENABLE_RATE_LIMITING ? [{ provide: APP_GUARD, useClass: QuotaGuard }] : []),
    { provide: APP_INTERCEPTOR, useClass: RequestTimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RoleVisibilityInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiVersionMiddleware).forRoutes({ path: 'v*', method: RequestMethod.ALL });
  }
}

import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnApplicationBootstrap,
  RequestMethod,
  Logger,
} from '@nestjs/common';
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
import { IdempotencyModule } from './common/modules/idempotency.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
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
import { QueueModule } from './queues/queue.module';
import { WorkersBridgeModule } from './workers/bridge/workers-bridge.module';
import { MetricsModule } from './utils/masking/metrics.module';

import { ReadReplicaModule } from './database/read-replica';
import { CachingModule } from './caching/caching.module';
import { CoursesModule } from './courses/courses.module';
import { AuthModule } from './auth/auth.module';
import { CohortsModule } from './cohorts/cohorts.module';
import { LoggingModule } from './logging/logging.module';
import { FeatureFlagAuditModule } from './config/feature-flag-audit.module';
import { UsersModule } from './users/users.module';

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
    // Issue #824 — IdempotencyModule is global so any @Idempotent() decorator
    // wired into any controller (Payments, Payouts, Subscriptions,
    // PaymentMethods, etc.) resolves a single shared IdempotencyInterceptor.
    IdempotencyModule,
    // Issue #808 — rate limiting is ON by default. Only load
    // RateLimitingModule when the operator has NOT set
    // DISABLE_RATE_LIMITING=true (legacy: ENABLE_RATE_LIMITING=false).
    ...(featureFlags.DISABLE_RATE_LIMITING ? [] : [RateLimitingModule]),
    DebuggingModule,
    DataPipelineModule,
    CanaryModule,
    IncidentManagementModule,
    MonitoringModule,
    DeepLinkModule,
    InvoicesModule,
    ReportingModule,
    HealthModule,
    QueueModule,
    WorkersBridgeModule,
    MetricsModule,

    // ✅ always include read replicas (or wrap if needed)
    ReadReplicaModule,
    ...(featureFlags.ENABLE_CACHING ? [CachingModule] : []),
    ...(featureFlags.ENABLE_AUTH ? [AuthModule] : []),
    CoursesModule,
    CohortsModule,
    UsersModule,
    FeatureFlagAuditModule,
    OrchestrationModule,
  ],
  controllers: [AppController],
  providers: [
    // Issue #808 — register QuotaGuard unless rate limiting is opted out.
    ...(featureFlags.DISABLE_RATE_LIMITING ? [] : [{ provide: APP_GUARD, useClass: QuotaGuard }]),
    { provide: APP_INTERCEPTOR, useClass: RequestTimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RoleVisibilityInterceptor },
    // Issue #824 — register the IdempotencyInterceptor GLOBALLY so every
    // @Idempotent() decorator (in any module) is handled, regardless of
    // which module owns the controller.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule, OnApplicationBootstrap {
  private readonly logger = new Logger(AppModule.name);

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiVersionMiddleware).forRoutes({ path: 'v*', method: RequestMethod.ALL });
  }

  /**
   * Issue #808 — emit a startup WARN when the operator has explicitly
   * disabled rate limiting. The warning makes it impossible to silently
   * deploy a server that is unprotected against credential stuffing or DoS.
   */
  onApplicationBootstrap(): void {
    if (featureFlags.DISABLE_RATE_LIMITING) {
      this.logger.warn(
        'Rate limiting is DISABLED via DISABLE_RATE_LIMITING. ' +
          'The API is exposed to DoS and credential-stuffing attacks. ' +
          'Remove the env var for production deployments.',
      );
    }
  }
}

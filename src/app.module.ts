import { Module, DynamicModule, Type, Logger, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MonitoringModule } from './monitoring/monitoring.module';
import { MonitoringInterceptor } from './common/interceptors/monitoring.interceptor';
import { TypeOrmMonitoringLogger } from './monitoring/logging/typeorm-logger';
import { MetricsCollectionService } from './monitoring/metrics/metrics-collection.service';
import { DatabaseModule } from './common/database/database.module';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { envValidationSchema } from './config/env.validation';
import { cacheConfig } from './config/cache.config';
import { HealthModule } from './health/health.module';
import { SessionModule } from './session/session.module';
import { createBullRedisClient } from './common/utils/bull-redis.util';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottleGuard } from './common/guards/throttle.guard';
import { loadFeatureFlags } from './config/feature-flags.config';
import { StartupLogger } from './common/lazy-loading/startup-logger.service';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { ApiVersioningModule } from './common/modules/api-versioning.module';

// Feature modules - conditionally loaded based on feature flags
import { SyncModule } from './sync/sync.module';
import { MediaModule } from './media/media.module';
import { BackupModule } from './backup/backup.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { DataWarehouseModule } from './data-warehouse/data-warehouse.module';
import { QueueModule } from './queues/queue.module';
import { WorkersModule } from './workers/workers.module';
import { GraphQLModule } from './graphql/graphql.module';
import { MigrationModule } from './migrations/migration.module';
import { ABTestingModule } from './ab-testing/ab-testing.module';
import { ObservabilityModule } from './observability/observability.module';
import { RateLimitingModule } from './rate-limiting/services/rate-limiting.module';
import { CachingModule } from './caching/caching.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SearchModule } from './search/search.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailMarketingModule } from './email-marketing/email-marketing.module';
import { GamificationModule } from './gamification/gamification.module';
import { AssessmentsModule } from './assessment/assessment.module';
import { LearningPathsModule } from './learning-paths/learning-paths.module';
import { ModerationModule } from './moderation/moderation.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { SecurityModule } from './security/security.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { CdnModule } from './cdn/cdn.module';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { LocalizationModule } from './localization/localization.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { CsrfModule } from './common/csrf/csrf.module';
import { TimeoutModule } from './common/timeout/timeout.module';
import { ShutdownStateService } from './common/services/shutdown-state.service';
import { LogShipperService } from './common/services/log-shipper.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Global()
@Module({})
export class AppModule {
  /**
   * Creates the root application module.
   * @returns The resulting dynamic module.
   */
  static async forRoot(): Promise<DynamicModule> {
    const flags = loadFeatureFlags();
    const startupLogger = new StartupLogger();

    // Core modules - always loaded
    const coreModules = [
      ConfigModule.forRoot({
        isGlobal: true,
        validationSchema: envValidationSchema,
      }),
      AuditLogModule,
      TypeOrmModule.forRootAsync({
        imports: [MonitoringModule],
        inject: [MetricsCollectionService],
        useFactory: (metricsService: MetricsCollectionService) => {
          // Tune postgres pool to avoid connection exhaustion in high-traffic workloads.
          // Values can be overridden with DATABASE_POOL_* environment variables.
          const poolMax = parseInt(process.env.DATABASE_POOL_MAX || '30', 10);
          const poolMin = parseInt(process.env.DATABASE_POOL_MIN || '5', 10);
          const poolAcquireTimeoutMs = parseInt(
            process.env.DATABASE_POOL_ACQUIRE_TIMEOUT_MS || '10000',
            10,
          );
          const poolIdleTimeoutMs = parseInt(
            process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || '30000',
            10,
          );
          const replicaPort = parseInt(process.env.DATABASE_REPLICA_PORT || '5432', 10);
          const replicaHosts = (process.env.DATABASE_REPLICA_HOSTS || '')
            .split(',')
            .map((host) => host.trim())
            .filter((host) => host.length > 0);

          // Log pool configuration at startup for observability (#274)
          const poolLogger = new Logger('DatabasePool');
          poolLogger.log(
            `DB pool config — max: ${poolMax}, min: ${poolMin}, ` +
              `acquireTimeout: ${poolAcquireTimeoutMs}ms, idleTimeout: ${poolIdleTimeoutMs}ms`,
          );

          return {
            type: 'postgres',
            replication: {
              master: {
                host: process.env.DATABASE_HOST || 'localhost',
                port: parseInt(process.env.DATABASE_PORT || '5432', 10),
              },
              slaves: replicaHosts.map((host) => ({
                host,
                port: replicaPort,
              })),
            },
            username: process.env.DATABASE_USER || 'postgres',
            password: process.env.DATABASE_PASSWORD || 'postgres',
            database: process.env.DATABASE_NAME || 'teachlink',
            autoLoadEntities: true,
            synchronize: false,
            logging: true,
            logger: new TypeOrmMonitoringLogger(metricsService),
            maxQueryExecutionTime: 1000,
            extra: {
              // pg Pool options used by TypeORM postgres driver
              max: poolMax,
              min: poolMin,
              connectionTimeoutMillis: poolAcquireTimeoutMs,
              idleTimeoutMillis: poolIdleTimeoutMs,
              // Pool event hooks for Prometheus metrics (#274).
              // pg fires these on the underlying Pool instance after each
              // acquire/release so we can track connection churn over time.
              afterPoolConnect: (_client: unknown, _eventCount: number) => {
                metricsService.dbPoolConnectionsAcquired.inc();
                metricsService.dbPoolSize.inc();
              },
              afterPoolRelease: (_client: unknown, _eventCount: number) => {
                metricsService.dbPoolConnectionsReleased.inc();
                metricsService.dbPoolSize.dec();
              },
            },
          };
        },
      }),
      MonitoringModule,
      EventEmitterModule.forRoot(),
      ScheduleModule.forRoot(),
      BullModule.forRoot({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
        createClient: createBullRedisClient,
      }),
      CacheModule.register(cacheConfig),
      SessionModule,
      ThrottlerModule.forRoot([
        {
          ttl: parseInt(process.env.THROTTLE_TTL || '60'),
          limit: parseInt(process.env.THROTTLE_LIMIT || '60'),
        },
      ]),
      ApiVersioningModule,
      HealthModule,
      DatabaseModule,
      CsrfModule,
      TimeoutModule,
    ];

    // Feature modules - conditionally loaded based on feature flags
    const featureModules: Array<DynamicModule | Type<unknown>> = [];

    // Auth Module
    if (flags.ENABLE_AUTH) {
      const startTime = Date.now();
      featureModules.push(AuthModule);
      startupLogger.recordModuleLoaded('AuthModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('AuthModule', 'ENABLE_AUTH=false');
    }

    // Payments Module
    if (flags.ENABLE_PAYMENTS) {
      const startTime = Date.now();
      featureModules.push(PaymentsModule);
      startupLogger.recordModuleLoaded('PaymentsModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('PaymentsModule', 'ENABLE_PAYMENTS=false');
    }

    // AB Testing Module
    if (flags.ENABLE_AB_TESTING) {
      const startTime = Date.now();
      featureModules.push(ABTestingModule);
      startupLogger.recordModuleLoaded('ABTestingModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('ABTestingModule', 'ENABLE_AB_TESTING=false');
    }

    // Data Warehouse Module
    if (flags.ENABLE_DATA_WAREHOUSE) {
      const startTime = Date.now();
      featureModules.push(DataWarehouseModule);
      startupLogger.recordModuleLoaded('DataWarehouseModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('DataWarehouseModule', 'ENABLE_DATA_WAREHOUSE=false');
    }

    // Collaboration Module
    if (flags.ENABLE_COLLABORATION) {
      const startTime = Date.now();
      featureModules.push(CollaborationModule);
      startupLogger.recordModuleLoaded('CollaborationModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('CollaborationModule', 'ENABLE_COLLABORATION=false');
    }

    // Media Module
    if (flags.ENABLE_MEDIA_PROCESSING) {
      const startTime = Date.now();
      featureModules.push(MediaModule);
      startupLogger.recordModuleLoaded('MediaModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('MediaModule', 'ENABLE_MEDIA_PROCESSING=false');
    }

    // Backup Module
    if (flags.ENABLE_BACKUP) {
      const startTime = Date.now();
      featureModules.push(BackupModule);
      startupLogger.recordModuleLoaded('BackupModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('BackupModule', 'ENABLE_BACKUP=false');
    }

    // GraphQL Module
    if (flags.ENABLE_GRAPHQL) {
      const startTime = Date.now();
      featureModules.push(GraphQLModule);
      startupLogger.recordModuleLoaded('GraphQLModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('GraphQLModule', 'ENABLE_GRAPHQL=false');
    }

    // Sync Module
    if (flags.ENABLE_SYNC) {
      const startTime = Date.now();
      featureModules.push(SyncModule);
      startupLogger.recordModuleLoaded('SyncModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('SyncModule', 'ENABLE_SYNC=false');
    }

    // Migration Module
    if (flags.ENABLE_MIGRATIONS) {
      const startTime = Date.now();
      featureModules.push(MigrationModule);
      startupLogger.recordModuleLoaded('MigrationModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('MigrationModule', 'ENABLE_MIGRATIONS=false');
    }

    // Rate Limiting Module
    if (flags.ENABLE_RATE_LIMITING) {
      const startTime = Date.now();
      featureModules.push(RateLimitingModule);
      startupLogger.recordModuleLoaded('RateLimitingModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('RateLimitingModule', 'ENABLE_RATE_LIMITING=false');
    }

    // Observability Module
    if (flags.ENABLE_OBSERVABILITY) {
      const startTime = Date.now();
      featureModules.push(ObservabilityModule);
      startupLogger.recordModuleLoaded('ObservabilityModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('ObservabilityModule', 'ENABLE_OBSERVABILITY=false');
    }

    // Caching Module
    if (flags.ENABLE_CACHING) {
      const startTime = Date.now();
      featureModules.push(CachingModule);
      startupLogger.recordModuleLoaded('CachingModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('CachingModule', 'ENABLE_CACHING=false');
    }

    // Feature Flags Module
    if (flags.ENABLE_FEATURE_FLAGS) {
      const startTime = Date.now();
      featureModules.push(FeatureFlagsModule);
      startupLogger.recordModuleLoaded('FeatureFlagsModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('FeatureFlagsModule', 'ENABLE_FEATURE_FLAGS=false');
    }

    // Search Module
    if (flags.ENABLE_SEARCH) {
      const startTime = Date.now();
      featureModules.push(SearchModule);
      startupLogger.recordModuleLoaded('SearchModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('SearchModule', 'ENABLE_SEARCH=false');
    }

    // Notifications Module
    if (flags.ENABLE_NOTIFICATIONS) {
      const startTime = Date.now();
      featureModules.push(NotificationsModule);
      startupLogger.recordModuleLoaded('NotificationsModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('NotificationsModule', 'ENABLE_NOTIFICATIONS=false');
    }

    // Email Marketing Module
    if (flags.ENABLE_EMAIL_MARKETING) {
      const startTime = Date.now();
      featureModules.push(EmailMarketingModule);
      startupLogger.recordModuleLoaded('EmailMarketingModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('EmailMarketingModule', 'ENABLE_EMAIL_MARKETING=false');
    }

    // Gamification Module
    if (flags.ENABLE_GAMIFICATION) {
      const startTime = Date.now();
      featureModules.push(GamificationModule);
      startupLogger.recordModuleLoaded('GamificationModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('GamificationModule', 'ENABLE_GAMIFICATION=false');
    }

    // Assessment Module
    if (flags.ENABLE_ASSESSMENT) {
      const startTime = Date.now();
      featureModules.push(AssessmentsModule);
      startupLogger.recordModuleLoaded('AssessmentModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('AssessmentModule', 'ENABLE_ASSESSMENT=false');
    }

    // Learning Paths Module
    if (flags.ENABLE_LEARNING_PATHS) {
      const startTime = Date.now();
      featureModules.push(LearningPathsModule);
      startupLogger.recordModuleLoaded('LearningPathsModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('LearningPathsModule', 'ENABLE_LEARNING_PATHS=false');
    }

    // Moderation Module
    if (flags.ENABLE_MODERATION) {
      const startTime = Date.now();
      featureModules.push(ModerationModule);
      startupLogger.recordModuleLoaded('ModerationModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('ModerationModule', 'ENABLE_MODERATION=false');
    }

    // Orchestration Module
    if (flags.ENABLE_ORCHESTRATION) {
      const startTime = Date.now();
      featureModules.push(OrchestrationModule);
      startupLogger.recordModuleLoaded('OrchestrationModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('OrchestrationModule', 'ENABLE_ORCHESTRATION=false');
    }

    // Security Module
    if (flags.ENABLE_SECURITY) {
      const startTime = Date.now();
      featureModules.push(SecurityModule);
      startupLogger.recordModuleLoaded('SecurityModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('SecurityModule', 'ENABLE_SECURITY=false');
    }

    // Tenancy Module
    if (flags.ENABLE_TENANCY) {
      const startTime = Date.now();
      featureModules.push(TenancyModule);
      startupLogger.recordModuleLoaded('TenancyModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('TenancyModule', 'ENABLE_TENANCY=false');
    }

    // CDN Module
    if (flags.ENABLE_CDN) {
      const startTime = Date.now();
      featureModules.push(CdnModule);
      startupLogger.recordModuleLoaded('CDNModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('CDNModule', 'ENABLE_CDN=false');
    }

    // Analytics Module
    if (flags.ENABLE_ANALYTICS) {
      const startTime = Date.now();
      featureModules.push(AnalyticsModule);
      startupLogger.recordModuleLoaded('AnalyticsModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('AnalyticsModule', 'ENABLE_ANALYTICS=false');
    }

    // Localization Module
    if (flags.ENABLE_LOCALIZATION) {
      const startTime = Date.now();
      featureModules.push(LocalizationModule);
      startupLogger.recordModuleLoaded('LocalizationModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('LocalizationModule', 'ENABLE_LOCALIZATION=false');
    }

    // Onboarding Module
    if (flags.ENABLE_ONBOARDING) {
      const startTime = Date.now();
      featureModules.push(OnboardingModule);
      startupLogger.recordModuleLoaded('OnboardingModule', startTime);
    } else {
      startupLogger.recordModuleSkipped('OnboardingModule', 'ENABLE_ONBOARDING=false');
    }

    // Queue Module (always loaded for Bull)
    featureModules.push(QueueModule);

    return {
      module: AppModule,
      imports: [...coreModules, ...featureModules],
      controllers: [AppController],
      providers: [
        AppService,
        StartupLogger,
        ShutdownStateService,
        LogShipperService,
        {
          provide: APP_INTERCEPTOR,
          useClass: LoggingInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: MonitoringInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: TimeoutInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: SensitiveOperationInterceptor,
        },
        {
          provide: APP_GUARD,
          useClass: CustomThrottleGuard,
        },
      ],
      exports: [ShutdownStateService, LogShipperService],
    };
  }
}

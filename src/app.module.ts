// Merged by GitHub Copilot Chat Assistant
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './users/entities/user.entity';
import { Media } from './media/entities/media.entity';
import { AssessmentsModule } from './assessments/assessments.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { UserPreference } from './recommendations/entities/user-preference.entity';
import { CourseInteraction } from './recommendations/entities/course-interaction.entity';
import { CoursesModule } from './courses/courses.module';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/entities/notification.entity';
import { PaymentsModule } from './payments/payments.module';
import { Payment } from './payments/entities/payment.entity';
import { Subscription } from './payments/entities/subscription.entity';
import { APIGatewayModule } from './api-gateway/api-gateway.module';
import { MessagingModule } from './messaging/messaging.module';
import { SearchModule } from './search/search.module';
import { ObservabilityModule } from './observability/observability.module';
import { TraceSpan } from './observability/entities/trace-span.entity';
import { LogEntry } from './observability/entities/log-entry.entity';
import { MetricEntry } from './observability/entities/metric-entry.entity';
import { AnomalyAlert } from './observability/entities/anomaly-alert.entity';
import { MLModel } from './ml-models/entities/ml-model.entity';
import { ModelVersion } from './ml-models/entities/model-version.entity';
import { ModelDeployment } from './ml-models/entities/model-deployment.entity';
import { ModelPerformance } from './ml-models/entities/model-performance.entity';
import { ABTest } from './ml-models/entities/ab-test.entity';
import { ContainerModule } from './containers/container.module';
import { MonitoringInterceptor } from './common/interceptors/monitoring.interceptor';
import { MonitoringModule } from './monitoring/monitoring.module';
import { CachingModule } from './caching/caching.module';
import { MLModelsModule } from './ml-models/ml-models.module';


import { AppController } from './app.controller';
import { AppService } from './app.service';

import { MonitoringInterceptor } from './monitoring/monitoring.interceptor';

// Modules (adjust paths if needed)
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';
import { SecurityModule } from './security/security.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MediaModule } from './media/media.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { CoursesModule } from './courses/courses.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { APIGatewayModule } from './api-gateway/api-gateway.module';
import { MessagingModule } from './messaging/messaging.module';
import { SearchEngineModule } from './search-engine/search-engine.module';
import { ObservabilityModule } from './observability/observability.module';
import { ContainerModule } from './containers/container.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { CachingModule } from './caching/caching.module';
import { MLModelsModule } from './ml-models/ml-models.module';
import { AssessmentModule } from './assessment/assessment.module';
import { TenancyModule } from './tenancy/tenancy.module';

import { GamificationModule } from './gamification/gamification.module';

/* Entities */
import { User } from './users/entities/user.entity';
import { Media } from './media/entities/media.entity';
import { UserPreference } from './recommendations/entities/user-preference.entity';
import { CourseInteraction } from './recommendations/entities/course-interaction.entity';
import { Notification } from './notifications/entities/notification.entity';
import { Payment } from './payments/entities/payment.entity';
import { Subscription } from './payments/entities/subscription.entity';
import { TraceSpan } from './observability/entities/trace-span.entity';
import { LogEntry } from './observability/entities/log-entry.entity';
import { MetricEntry } from './observability/entities/metric-entry.entity';
import { AnomalyAlert } from './observability/entities/anomaly-alert.entity';
import { MLModel } from './ml-models/entities/ml-model.entity';
import { ModelVersion } from './ml-models/entities/model-version.entity';
import { ModelDeployment } from './ml-models/entities/model-deployment.entity';
import { ModelPerformance } from './ml-models/entities/model-performance.entity';
import { ABTest } from './ml-models/entities/ab-test.entity';
import { PointTransaction } from './gamification/entities/point-transaction.entity';
import { UserProgress } from './gamification/entities/user-progress.entity';
import { Badge } from './gamification/entities/badge.entity';
import { UserBadge } from './gamification/entities/user-badge.entity';
import { Challenge } from './gamification/entities/challenge.entity';
import { UserChallenge } from './gamification/entities/user-challenge.entity';

/* Tenancy entities */
import { Tenant } from './tenancy/entities/tenant.entity';
import { TenantConfig } from './tenancy/entities/tenant-config.entity';
import { TenantBilling } from './tenancy/entities/tenant-billing.entity';
import { TenantCustomization } from './tenancy/entities/tenant-customization.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'teachlink',
      // keep synchronize false in production
      synchronize: false,
      entities: [
        User,
        Tenant,
        TenantConfig,
        TenantBilling,
        TenantCustomization,
        Media,
        UserPreference,
        CourseInteraction,
        Notification,
        Payment,
        Subscription,
        TraceSpan,
        LogEntry,
        MetricEntry,
        AnomalyAlert,
        MLModel,
        ModelVersion,
        ModelDeployment,
        ModelPerformance,
        ABTest,
        PointTransaction,
        UserProgress,
        Badge,
        UserBadge,
        Challenge,
        UserChallenge,
      ],

      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    RateLimitingModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    MediaModule,
    AssessmentsModule,
    RecommendationsModule,
    CoursesModule,
    NotificationsModule,
    PaymentsModule,
    MessagingModule,
    APIGatewayModule,
    SearchModule,
    ObservabilityModule,
    ContainerModule,
    MonitoringModule,
    CachingModule,
    MLModelsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },
  ],
      synchronize: true, // Set to false in production

    }),
    // Core and feature modules
    RateLimitingModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    MediaModule,
    AssessmentsModule,
    RecommendationsModule,
    CoursesModule,
    NotificationsModule,
    PaymentsModule,
    APIGatewayModule,
    MessagingModule,
    SearchEngineModule,
    ObservabilityModule,
    ContainerModule,
    MonitoringModule,
    CachingModule,
    MLModelsModule,
    AssessmentModule,
    TenancyModule,
    GamificationModule,
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
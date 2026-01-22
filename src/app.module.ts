import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { APP_INTERCEPTOR } from '@nestjs/core';

// Core imports
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Interceptors
import { MonitoringInterceptor } from './monitoring/monitoring.interceptor';

// Feature Modules
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
import { EmailMarketingModule } from './email-marketing/email-marketing.module';

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

/* Gamification Entities */
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

/* Email Marketing Entities */
import { Campaign } from './email-marketing/entities/campaign.entity';
import { EmailTemplate } from './email-marketing/entities/email-template.entity';
import { AutomationWorkflow } from './email-marketing/entities/automation-workflow.entity';
import { AutomationTrigger } from './email-marketing/entities/automation-trigger.entity';
import { AutomationAction } from './email-marketing/entities/automation-action.entity';
import { Segment } from './email-marketing/entities/segment.entity';
import { SegmentRule } from './email-marketing/entities/segment-rule.entity';
import { EmailEvent } from './email-marketing/entities/email-event.entity';
import { ABTest as EmailABTest } from './email-marketing/entities/ab-test.entity';
import { ABTestVariant } from './email-marketing/entities/ab-test-variant.entity';
import { CampaignRecipient } from './email-marketing/entities/campaign-recipient.entity';
import { EmailSubscription } from './email-marketing/entities/email-subscription.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'teachlink',
      synchronize: process.env.NODE_ENV !== 'production', // true for dev, false for prod
      entities: [
        // Core & Tenancy
        User,
        Tenant,
        TenantConfig,
        TenantBilling,
        TenantCustomization,
        
        // Features
        Media,
        UserPreference,
        CourseInteraction,
        Notification,
        Payment,
        Subscription,
        
        // Observability
        TraceSpan,
        LogEntry,
        MetricEntry,
        AnomalyAlert,
        
        // AI/ML
        MLModel,
        ModelVersion,
        ModelDeployment,
        ModelPerformance,
        ABTest,
        
        // Gamification
        PointTransaction,
        UserProgress,
        Badge,
        UserBadge,
        Challenge,
        UserChallenge,

        // Email Marketing
        Campaign,
        EmailTemplate,
        AutomationWorkflow,
        AutomationTrigger,
        AutomationAction,
        Segment,
        SegmentRule,
        EmailEvent,
        EmailABTest,
        ABTestVariant,
        CampaignRecipient,
        EmailSubscription,
      ],
    }),

    // Infrastructure
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
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
    EmailMarketingModule,
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
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ShardingModule } from './sharding/sharding.module';
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
import { ModerationModule } from './moderation/moderation.module';
import { IdempotencyModule } from './common/modules/idempotency.module';
import { DeepLinkModule } from './deep-link/deep-link.module';
import { InvoicesModule } from './payments/invoices/invoices.module';
import { PaymentMethodsModule } from './payments/payment-methods/payment-methods.module';
import { ReportingModule } from './payments/reporting/reporting.module';
import { PayoutsModule } from './payments/payouts/payouts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { ForumModule } from './forum/forum.module';

import { ReadReplicaModule } from './database/read-replica';
import { CachingModule } from './caching/caching.module';

import { SlackService } from './slack.service';

import { CoursesModule } from './courses/courses.module';
import { DataRetentionModule } from './data-retention/data-retention.module';
import { GatewayModule } from './gateway/gateway.module';
import { UsersModule } from './users/users.module';
import { MessagingModule } from './messaging/messaging.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

import { GamificationModule } from './gamification/gamification.module';
import { I18nModule as AppI18nModule } from './i18n/i18n.module';
import { AchievementsModule } from './achievements/achievements.module';

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
    ShardingModule,

    IdempotencyModule,
    DeepLinkModule,

    InvoicesModule,
    PaymentMethodsModule,
    ReportingModule,
    PayoutsModule,
    NotificationsModule,
    HealthModule,
    ForumModule,

    ...(featureFlags.ENABLE_MODERATION ? [ModerationModule] : []),

    // database + infra
    ReadReplicaModule,
    ...(featureFlags.ENABLE_CACHING ? [CachingModule] : []),

    // core features
    AppI18nModule,
    AchievementsModule,
    CoursesModule,
    DataRetentionModule,
    GatewayModule,
    UsersModule,
    MessagingModule,
    DashboardModule,
    RecommendationsModule,
    GamificationModule,
  ],
  controllers: [AppController],
  providers: featureFlags.ENABLE_RATE_LIMITING
    ? [{ provide: APP_GUARD, useClass: QuotaGuard }]
    : [],
})
export class AppModule {}
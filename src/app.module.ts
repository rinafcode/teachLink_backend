import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { appConfigSchema } from './config/appConfigSchema';
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';
import { SecurityModule } from './security/security.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MediaModule } from './media/media.module';
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
import { SearchEngineModule } from './search-engine/search-engine.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: appConfigSchema,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'teachlink',
      entities: [
        User,
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
    SearchEngineModule,
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
})
export class AppModule {}

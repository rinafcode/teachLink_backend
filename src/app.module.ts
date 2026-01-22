import { Module } from '@nestjs/common';
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
import { GamificationModule } from './gamification/gamification.module';
import { PointTransaction } from './gamification/entities/point-transaction.entity';
import { UserProgress } from './gamification/entities/user-progress.entity';
import { Badge } from './gamification/entities/badge.entity';
import { UserBadge } from './gamification/entities/user-badge.entity';
import { Challenge } from './gamification/entities/challenge.entity';
import { UserChallenge } from './gamification/entities/user-challenge.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'teachlink',
      entities: [
        User,
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
    GamificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

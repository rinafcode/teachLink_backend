import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'teachlink',
      entities: [User, Media, UserPreference, CourseInteraction, Notification, Payment, Subscription],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    UsersModule,
    MediaModule,
    AssessmentsModule,
    RecommendationsModule,
    CoursesModule,
    NotificationsModule,
    PaymentsModule,
  ],
})
export class AppModule {}

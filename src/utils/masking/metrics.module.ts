import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { KpiService } from './kpi.service';
import { MetricsInterceptor } from './metrics.interceptor';

import { User } from '../users/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { Payment }s '../payments/entities/payment.entity';
import { UserActivity } from '../analytics/entities/user-activity.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Course, Enrollment, Payment, UserActivity]),
    ScheduleModule.forRoot(),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    KpiService,
    MetricsInterceptor,
  ],
  exports: [MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
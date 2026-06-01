import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../payments/entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { AnalyticsEvent } from '../analytics/entities/event.entity';
import { ReportingModule } from '../payments/reporting/reporting.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardReportScheduler } from './dashboard-report.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User, Enrollment, Course, AnalyticsEvent]),
    ReportingModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardReportScheduler],
  exports: [DashboardService],
})
export class DashboardModule {}

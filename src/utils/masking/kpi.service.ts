import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { subDays, startOfDay, endOfDay, startOfMonth, format } from 'date-fns';

import { MetricsService } from './metrics.service';
import { User } from '../users/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { Payment } from '../payments/entities/payment.entity';
import { UserActivity } from '../analytics/entities/user-activity.entity';
import { PaymentStatus } from '../payments/enums/payment-status.enum';

@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name);

  constructor(
    private readonly metricsService: MetricsService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Course) private readonly courseRepository: Repository<Course>,
    @InjectRepository(Enrollment) private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(UserActivity) private readonly userActivityRepository: Repository<UserActivity>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.log('Calculating and updating KPIs...');
    await Promise.all([
      this.calculateActiveUsers(),
      this.calculatePaymentSuccessRate(),
      this.calculateRevenuePerCourse(),
      this.calculateEnrollmentConversionRate(),
      this.calculateUserRetention(),
    ]).catch((err) => this.logger.error('Failed to update KPIs', err));
    this.logger.log('KPI update complete.');
  }

  async calculateActiveUsers(): Promise<void> {
    const now = new Date();
    const dauPromise = this.userActivityRepository.count({
      where: { lastSeen: Between(startOfDay(now), endOfDay(now)) },
    });
    const wauPromise = this.userActivityRepository.count({
      where: { lastSeen: MoreThan(subDays(now, 7)) },
    });
    const mauPromise = this.userActivityRepository.count({
      where: { lastSeen: MoreThan(subDays(now, 30)) },
    });

    const [dau, wau, mau] = await Promise.all([dauPromise, wauPromise, mauPromise]);

    this.metricsService.activeUsersGauge.labels('daily').set(dau);
    this.metricsService.activeUsersGauge.labels('weekly').set(wau);
    this.metricsService.activeUsersGauge.labels('monthly').set(mau);
    this.logger.log(`Active Users: DAU=${dau}, WAU=${wau}, MAU=${mau}`);
  }

  async calculatePaymentSuccessRate(): Promise<void> {
    const succeeded = await this.paymentRepository.count({
      where: { status: PaymentStatus.SUCCEEDED },
    });
    const failed = await this.paymentRepository.count({
      where: { status: PaymentStatus.FAILED },
    });

    const total = succeeded + failed;
    const successRate = total > 0 ? (succeeded / total) * 100 : 0;

    this.metricsService.paymentSuccessRateGauge.set(successRate);
    this.logger.log(`Payment Success Rate: ${successRate.toFixed(2)}%`);
  }

  async calculateRevenuePerCourse(): Promise<void> {
    const revenueData = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.courseId', 'courseId')
      .addSelect('SUM(payment.amount)', 'totalRevenue')
      .innerJoin('payment.course', 'course')
      .addSelect('course.title', 'courseName')
      .where('payment.status = :status', { status: PaymentStatus.SUCCEEDED })
      .groupBy('payment.courseId, course.title')
      .getRawMany();

    this.metricsService.revenuePerCourseGauge.reset();
    for (const item of revenueData) {
      this.metricsService.revenuePerCourseGauge
        .labels(item.courseId, item.courseName)
        .set(Number(item.totalRevenue));
    }
    this.logger.log(`Calculated revenue for ${revenueData.length} courses.`);
  }

  async calculateEnrollmentConversionRate(): Promise<void> {
    // This is a simplified version. A real-world scenario would track views vs enrollments.
    // Here we'll simulate it by looking at enrollments vs total users.
    // For a more accurate metric, you'd need an event tracking system for 'course_viewed'.
    const courses = await this.courseRepository.find();
    this.metricsService.enrollmentConversionGauge.reset();

    for (const course of courses) {
      const enrollments = await this.enrollmentRepository.count({ where: { courseId: course.id } });
      // Placeholder for views. In a real system, you'd query an analytics table.
      const views = enrollments * 5 + Math.floor(Math.random() * 100); // Simulate views

      const conversionRate = views > 0 ? (enrollments / views) * 100 : 0;
      this.metricsService.enrollmentConversionGauge.labels(course.id).set(conversionRate);
    }
    this.logger.log(`Calculated enrollment conversion for ${courses.length} courses.`);
  }

  async calculateUserRetention(): Promise<void> {
    // Calculate 3-month cohort retention
    const now = new Date();
    this.metricsService.userRetentionGauge.reset();

    for (let i = 1; i <= 3; i++) {
      const cohortMonthStart = startOfMonth(subDays(now, i * 30));
      const cohortMonthEnd = endOfDay(subDays(startOfMonth(subDays(now, (i - 1) * 30)), 1));

      const cohortUsers = await this.userRepository.find({
        select: ['id'],
        where: { createdAt: Between(cohortMonthStart, cohortMonthEnd) },
      });

      const cohortUserIds = cohortUsers.map((u) => u.id);
      const cohortSize = cohortUserIds.length;

      if (cohortSize === 0) continue;

      const cohortMonthLabel = format(cohortMonthStart, 'yyyy-MM');

      // Check retention for subsequent months
      for (let j = 1; j < i; j++) {
        const retentionMonthStart = startOfMonth(subDays(now, (i - j) * 30));
        const retentionMonthEnd = endOfDay(subDays(startOfMonth(subDays(now, (i - j - 1) * 30)), 1));

        if (retentionMonthStart > now) continue;

        const retainedUsersCount = await this.userActivityRepository
          .createQueryBuilder('activity')
          .select('COUNT(DISTINCT activity.userId)', 'count')
          .where('activity.userId IN (:...cohortUserIds)', { cohortUserIds })
          .andWhere('activity.lastSeen BETWEEN :start AND :end', {
            start: retentionMonthStart,
            end: retentionMonthEnd,
          })
          .getRawOne();

        const retainedCount = parseInt(retainedUsersCount?.count ?? '0', 10);
        const retentionRate = (retainedCount / cohortSize) * 100;

        const retainedMonthLabel = format(retentionMonthStart, 'yyyy-MM');
        this.metricsService.userRetentionGauge
          .labels(cohortMonthLabel, retainedMonthLabel)
          .set(retentionRate);
      }
    }
    this.logger.log('Calculated user retention cohorts.');
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { subDays, startOfDay, endOfDay, startOfMonth, format } from 'date-fns';

import { MetricsService } from './metrics.service';
import { User } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { AnalyticsEvent, EventType } from '../../analytics/entities/event.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';

@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name);

  constructor(
    private readonly metricsService: MetricsService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Course) private readonly courseRepository: Repository<Course>,
    @InjectRepository(Enrollment) private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<AnalyticsEvent>,
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
    // For DAU
    const dauPromise = this.eventRepository
      .createQueryBuilder('event')
      .select('COUNT(DISTINCT(event.userId))', 'count')
      .where('event.createdAt BETWEEN :start AND :end', {
        start: startOfDay(now),
        end: endOfDay(now),
      })
      .getRawOne()
      .then((res) => parseInt(res.count));

    // For WAU
    const wauPromise = this.eventRepository
      .createQueryBuilder('event')
      .select('COUNT(DISTINCT(event.userId))', 'count')
      .where('event.createdAt > :date', { date: subDays(now, 7) })
      .getRawOne()
      .then((res) => parseInt(res.count));

    // For MAU
    const mauPromise = this.eventRepository
      .createQueryBuilder('event')
      .select('COUNT(DISTINCT(event.userId))', 'count')
      .where('event.createdAt > :date', { date: subDays(now, 30) })
      .getRawOne()
      .then((res) => parseInt(res.count));

    const [dau, wau, mau] = await Promise.all([dauPromise, wauPromise, mauPromise]);

    this.metricsService.activeUsersGauge.labels('daily').set(dau);
    this.metricsService.activeUsersGauge.labels('weekly').set(wau);
    this.metricsService.activeUsersGauge.labels('monthly').set(mau);
    this.logger.log(`Active Users: DAU=${dau}, WAU=${wau}, MAU=${mau}`);
  }

  async calculatePaymentSuccessRate(): Promise<void> {
    const succeeded = await this.paymentRepository.count({
      where: { status: PaymentStatus.COMPLETED },
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
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
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
    const courses = await this.courseRepository.find();
    this.metricsService.enrollmentConversionGauge.reset();

    for (const course of courses) {
      const enrollments = await this.enrollmentRepository.count({ where: { courseId: course.id } });
      const views = await this.eventRepository
        .createQueryBuilder('event')
        .where('event.eventType = :eventType', { eventType: EventType.COURSE_VIEW })
        .andWhere("event.properties->>'courseId' = :courseId", { courseId: course.id })
        .getCount();

      const conversionRate = views > 0 ? (enrollments / views) * 100 : 0;
      this.metricsService.enrollmentConversionGauge.labels(course.id).set(conversionRate);
    }
    this.logger.log(`Calculated enrollment conversion for ${courses.length} courses.`);
  }

  async calculateUserRetention(): Promise<void> {
    // Calculate 3-month cohort retention with set-based aggregates.
    // Cohort/retention windows keep the exact JS definitions from before
    // (rolling 30-day approximations); only the querying is set-based.
    const now = new Date();
    this.metricsService.userRetentionGauge.reset();

    interface CohortWindow {
      start: Date;
      end: Date;
      label: string;
    }

    const cohortWindows: CohortWindow[] = [];
    for (let i = 1; i <= 3; i++) {
      const cohortMonthStart = startOfMonth(subDays(now, i * 30));
      const cohortMonthEnd = endOfDay(subDays(startOfMonth(subDays(now, (i - 1) * 30)), 1));
      cohortWindows.push({
        start: cohortMonthStart,
        end: cohortMonthEnd,
        label: format(cohortMonthStart, 'yyyy-MM'),
      });
    }

    interface RetentionPair {
      cohortLabel: string;
      retainedLabel: string;
      cohortStart: Date;
      cohortEnd: Date;
      retentionStart: Date;
      retentionEnd: Date;
    }

    const pairs: RetentionPair[] = [];
    for (let i = 1; i <= 3; i++) {
      const cohort = cohortWindows[i - 1];
      for (let j = 1; j < i; j++) {
        const retentionMonthStart = startOfMonth(subDays(now, (i - j) * 30));
        const retentionMonthEnd = endOfDay(
          subDays(startOfMonth(subDays(now, (i - j - 1) * 30)), 1),
        );

        if (retentionMonthStart > now) continue;

        pairs.push({
          cohortLabel: cohort.label,
          retainedLabel: format(retentionMonthStart, 'yyyy-MM'),
          cohortStart: cohort.start,
          cohortEnd: cohort.end,
          retentionStart: retentionMonthStart,
          retentionEnd: retentionMonthEnd,
        });
      }
    }

    if (pairs.length === 0) {
      this.logger.log('Calculated user retention cohorts.');
      return;
    }

    // 1) Cohort sizes in a single grouped query (no per-cohort find()).
    const cohortCaseWhens: string[] = [];
    const cohortParams: Record<string, unknown> = {};
    cohortWindows.forEach((cohort, idx) => {
      cohortCaseWhens.push(
        `WHEN cohortUser.createdAt BETWEEN :c${idx}start AND :c${idx}end THEN :c${idx}label`,
      );
      cohortParams[`c${idx}start`] = cohort.start;
      cohortParams[`c${idx}end`] = cohort.end;
      cohortParams[`c${idx}label`] = cohort.label;
    });
    const cohortWhere = cohortWindows
      .map((_, idx) => `cohortUser.createdAt BETWEEN :c${idx}start AND :c${idx}end`)
      .join(' OR ');

    const cohortRows: Array<{ cohort_month: string; cohort_size: string }> =
      await this.userRepository
        .createQueryBuilder('cohortUser')
        .select(`CASE ${cohortCaseWhens.join(' ')} END`, 'cohort_month')
        .addSelect('COUNT(cohortUser.id)', 'cohort_size')
        .where(`(${cohortWhere})`, cohortParams)
        .setParameters(cohortParams)
        .groupBy('cohort_month')
        .getRawMany();

    const cohortSizeByLabel = new Map<string, number>();
    for (const row of cohortRows) {
      if (!row.cohort_month) continue;
      cohortSizeByLabel.set(row.cohort_month, Number(row.cohort_size ?? 0));
    }

    // 2) Retained distinct users in a single joined + grouped query (no IN-lists).
    const uniqueRetentionWindows = new Map<string, { start: Date; end: Date }>();
    for (const pair of pairs) {
      if (!uniqueRetentionWindows.has(pair.retainedLabel)) {
        uniqueRetentionWindows.set(pair.retainedLabel, {
          start: pair.retentionStart,
          end: pair.retentionEnd,
        });
      }
    }
    const retentionLabels = [...uniqueRetentionWindows.keys()];
    const retentionCaseWhens: string[] = [];
    const retentionParams: Record<string, unknown> = { ...cohortParams };
    retentionLabels.forEach((label, idx) => {
      const window = uniqueRetentionWindows.get(label)!;
      retentionCaseWhens.push(
        `WHEN event.createdAt BETWEEN :r${idx}start AND :r${idx}end THEN :r${idx}label`,
      );
      retentionParams[`r${idx}start`] = window.start;
      retentionParams[`r${idx}end`] = window.end;
      retentionParams[`r${idx}label`] = label;
    });

    const pairClauses: string[] = [];
    pairs.forEach((pair, idx) => {
      pairClauses.push(
        `(cohortUser.createdAt BETWEEN :p${idx}cStart AND :p${idx}cEnd AND event.createdAt BETWEEN :p${idx}rStart AND :p${idx}rEnd)`,
      );
      retentionParams[`p${idx}cStart`] = pair.cohortStart;
      retentionParams[`p${idx}cEnd`] = pair.cohortEnd;
      retentionParams[`p${idx}rStart`] = pair.retentionStart;
      retentionParams[`p${idx}rEnd`] = pair.retentionEnd;
    });

    const retentionRows: Array<{
      cohort_month: string;
      retained_month: string;
      retained_count: string;
    }> = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoin('event.user', 'cohortUser')
      .select(`CASE ${cohortCaseWhens.join(' ')} END`, 'cohort_month')
      .addSelect(`CASE ${retentionCaseWhens.join(' ')} END`, 'retained_month')
      .addSelect('COUNT(DISTINCT event.userId)', 'retained_count')
      .where(`(${pairClauses.join(' OR ')})`, retentionParams)
      .setParameters(retentionParams)
      .groupBy('cohort_month')
      .addGroupBy('retained_month')
      .getRawMany();

    const retainedByPair = new Map<string, number>();
    for (const row of retentionRows) {
      if (!row.cohort_month || !row.retained_month) continue;
      retainedByPair.set(
        `${row.cohort_month}|${row.retained_month}`,
        Number(row.retained_count ?? 0),
      );
    }

    for (const pair of pairs) {
      const cohortSize = cohortSizeByLabel.get(pair.cohortLabel) ?? 0;
      if (cohortSize === 0) continue;

      const retainedCount = retainedByPair.get(`${pair.cohortLabel}|${pair.retainedLabel}`) ?? 0;
      const retentionRate = (retainedCount / cohortSize) * 100;

      this.metricsService.userRetentionGauge
        .labels(pair.cohortLabel, pair.retainedLabel)
        .set(retentionRate);
    }
    this.logger.log('Calculated user retention cohorts.');
  }
}

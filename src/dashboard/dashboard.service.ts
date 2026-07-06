import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { AnalyticsEvent } from '../analytics/entities/event.entity';
import { ReportingService } from '../payments/reporting/reporting.service';

export type RevenuePeriod = 'daily' | 'weekly' | 'monthly';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsEventRepository: Repository<AnalyticsEvent>,
    private readonly reportingService: ReportingService,
  ) {}

  async getOverview() {
    const [revenue, userGrowth, coursePerformance, funnel] = await Promise.all([
      this.getRevenueMetrics('monthly'),
      this.getUserGrowthMetrics(),
      this.getCoursePerformanceMetrics(),
      this.getConversionFunnel(),
    ]);
    return {
      revenue,
      userGrowth,
      coursePerformance,
      funnel,
      generatedAt: new Date().toISOString(),
    };
  }

  async getRevenueMetrics(period: RevenuePeriod) {
    const buckets = await this.bucketRevenue(period);
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const report = await this.reportingService.generateRevenueRecognitionReport(startOfMonth, now);
    return {
      period,
      buckets,
      summary: {
        grossRevenue: report.grossRevenue,
        netRevenue: report.netRevenue,
        totalRefunds: report.totalRefunds,
        currency: report.currency,
      },
    };
  }

  async getUserGrowthMetrics() {
    const users = await this.userRepository.find({ select: ['id', 'createdAt'] });
    const byMonth = new Map<string, number>();
    for (const user of users) {
      const key = user.createdAt.toISOString().slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    const cumulative: { period: string; newUsers: number; totalUsers: number }[] = [];
    let total = 0;
    for (const [period, count] of [...byMonth.entries()].sort()) {
      total += count;
      cumulative.push({ period, newUsers: count, totalUsers: total });
    }
    return {
      totalUsers: users.length,
      monthlySignups: cumulative,
    };
  }

  async getCoursePerformanceMetrics() {
    const courses = await this.courseRepository.find({ relations: ['enrollments'] });
    return courses
      .map((course) => ({
        courseId: course.id,
        title: course.title,
        enrollments: course.enrollments?.length ?? 0,
        price: course.price,
        status: course.status,
      }))
      .sort((a, b) => b.enrollments - a.enrollments)
      .slice(0, 20);
  }

  async getConversionFunnel() {
    const totalUsers = await this.userRepository.count();
    const enrollments = await this.enrollmentRepository.count();
    const completedPayments = await this.paymentRepository.count({
      where: { status: PaymentStatus.COMPLETED },
    });
    const completedEnrollments = await this.enrollmentRepository.count({
      where: { status: 'completed' },
    });

    return {
      stages: [
        { name: 'signup', count: totalUsers },
        { name: 'enrollment_started', count: enrollments },
        { name: 'payment_completed', count: completedPayments },
        { name: 'course_completed', count: completedEnrollments },
      ],
      conversionRates: {
        signupToEnrollment: totalUsers ? enrollments / totalUsers : 0,
        enrollmentToPayment: enrollments ? completedPayments / enrollments : 0,
        paymentToCompletion: completedPayments ? completedEnrollments / completedPayments : 0,
      },
    };
  }

  async getInstructorDashboard(instructorId: string) {
    const courses = await this.courseRepository.find({
      where: { instructorId },
      relations: ['enrollments', 'modules', 'modules.lessons'],
    });

    const [revenue, videoWatchTime] = await Promise.all([
      this.getInstructorRevenueBreakdown(instructorId),
      this.getInstructorVideoWatchTime(courses),
    ]);

    return {
      instructorId,
      revenue,
      enrollmentTrends: this.calculateEnrollmentTrends(courses),
      completionRate: this.calculateCompletionRate(courses),
      videoWatchTime,
      courseSummary: courses
        .map((course) => ({
          courseId: course.id,
          title: course.title,
          enrollments: course.enrollments?.length ?? 0,
          price: course.price,
          status: course.status,
        }))
        .sort((a, b) => b.enrollments - a.enrollments)
        .slice(0, 20),
      generatedAt: new Date().toISOString(),
    };
  }

  async getInstructorRevenueBreakdown(instructorId: string) {
    const baseQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.course', 'course')
      .where('course.instructorId = :instructorId', { instructorId })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED });

    const totals = await baseQuery
      .clone()
      .select('COALESCE(SUM(payment.amount), 0)', 'totalRevenue')
      .addSelect('payment.currency', 'currency')
      .groupBy('payment.currency')
      .getRawMany();

    const byCourse = await baseQuery
      .clone()
      .select('payment.courseId', 'courseId')
      .addSelect('course.title', 'courseTitle')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'revenue')
      .groupBy('payment.courseId')
      .addGroupBy('course.title')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    const byMethod = await baseQuery
      .clone()
      .select('payment.method', 'paymentMethod')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'revenue')
      .groupBy('payment.method')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    return {
      totalRevenue: totals.reduce((sum, row) => sum + Number(row.totalRevenue), 0),
      currency: totals.length ? totals[0].currency : 'USD',
      byCourse: byCourse.map((row) => ({
        courseId: row.courseId,
        title: row.courseTitle,
        revenue: Number(row.revenue),
      })),
      byMethod: byMethod.map((row) => ({
        method: row.paymentMethod,
        revenue: Number(row.revenue),
      })),
    };
  }

  private calculateEnrollmentTrends(courses: Course[], days = 30) {
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);

    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      buckets.set(date.toISOString().slice(0, 10), 0);
    }

    const enrollments = courses.flatMap((course) => course.enrollments ?? []);
    for (const enrollment of enrollments) {
      if (!enrollment.enrolledAt || enrollment.enrolledAt < start) {
        continue;
      }
      const period = enrollment.enrolledAt.toISOString().slice(0, 10);
      buckets.set(period, (buckets.get(period) ?? 0) + 1);
    }

    return [...buckets.entries()].map(([period, count]) => ({ period, count }));
  }

  private calculateCompletionRate(courses: Course[]) {
    const enrollments = courses.flatMap((course) => course.enrollments ?? []);
    const totalEnrollments = enrollments.length;
    const completedEnrollments = enrollments.filter(
      (enrollment) => enrollment.status === 'completed',
    ).length;

    const monthlyBuckets = new Map<string, { total: number; completed: number }>();
    const now = new Date();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
      monthlyBuckets.set(key, { total: 0, completed: 0 });
    }

    for (const enrollment of enrollments) {
      const date = new Date(enrollment.enrolledAt);
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const bucket = monthlyBuckets.get(key);
      if (!bucket) {
        continue;
      }
      bucket.total += 1;
      if (enrollment.status === 'completed') {
        bucket.completed += 1;
      }
    }

    return {
      overallRate: totalEnrollments ? completedEnrollments / totalEnrollments : 0,
      totalEnrollments,
      completedEnrollments,
      monthlyTrend: [...monthlyBuckets.entries()].map(([period, bucket]) => ({
        period,
        completionRate: bucket.total ? bucket.completed / bucket.total : 0,
        totalEnrollments: bucket.total,
        completedEnrollments: bucket.completed,
      })),
    };
  }

  private async getInstructorVideoWatchTime(courses: Course[]) {
    const courseIds = courses.map((course) => course.id);
    const watchData = courseIds.length
      ? await this.analyticsEventRepository
          .createQueryBuilder('event')
          .select("event.properties->>'courseId'", 'courseId')
          .addSelect('SUM(COALESCE(event.value, 0))', 'watchSeconds')
          .where('event.category = :category', { category: 'video' })
          .andWhere('event.action = :action', { action: 'watch' })
          .andWhere("event.properties->>'courseId' IN (:...courseIds)", { courseIds })
          .groupBy("event.properties->>'courseId'")
          .getRawMany()
      : [];

    const recordedWatchMap = new Map<string, number>(
      watchData.map((row) => [row.courseId, Number(row.watchSeconds)]),
    );

    const courseStats = courses.map((course) => {
      const totalVideoSeconds = (course.modules ?? []).reduce((courseSum, module) => {
        return (
          courseSum +
          (module.lessons ?? []).reduce((lessonSum, lesson) => {
            return lessonSum + (lesson.videoUrl ? Number(lesson.durationSeconds || 0) : 0);
          }, 0)
        );
      }, 0);

      const enrollmentCount = course.enrollments?.length ?? 0;
      const progressSeconds = (course.enrollments ?? []).reduce((sum, enrollment) => {
        return (
          sum + (Math.min(Math.max(enrollment.progress ?? 0, 0), 100) / 100) * totalVideoSeconds
        );
      }, 0);

      const recordedSeconds = recordedWatchMap.get(course.id) ?? 0;
      const watchSeconds = recordedSeconds || progressSeconds;

      return {
        courseId: course.id,
        title: course.title,
        totalVideoSeconds,
        watchSeconds,
        averageWatchSecondsPerEnrollment: enrollmentCount ? watchSeconds / enrollmentCount : 0,
        enrollmentCount,
        hasRecordedWatchEvents: recordedSeconds > 0,
      };
    });

    const totalWatchSeconds = courseStats.reduce((sum, item) => sum + item.watchSeconds, 0);
    const totalVideoSeconds = courseStats.reduce(
      (sum, item) => sum + item.totalVideoSeconds * item.enrollmentCount,
      0,
    );
    const totalEnrollments = courseStats.reduce((sum, item) => sum + item.enrollmentCount, 0);

    return {
      totalWatchSeconds,
      totalVideoSeconds,
      averageWatchSecondsPerEnrollment: totalEnrollments ? totalWatchSeconds / totalEnrollments : 0,
      byCourse: courseStats,
      hasRecordedEvents: watchData.length > 0,
    };
  }

  async exportToCsv(): Promise<string> {
    const overview = await this.getOverview();
    const escapeCsv = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows: (string | number)[][] = [
      ['section', 'metric', 'value'],
      ['revenue', 'gross', overview.revenue.summary.grossRevenue],
      ['revenue', 'net', overview.revenue.summary.netRevenue],
      ['users', 'total', overview.userGrowth.totalUsers],
      ['funnel', 'signup', overview.funnel.stages[0].count],
      ['funnel', 'enrollment', overview.funnel.stages[1].count],
      ['funnel', 'payment', overview.funnel.stages[2].count],
      ['funnel', 'completion', overview.funnel.stages[3].count],
    ];

    for (const course of overview.coursePerformance) {
      rows.push(['course', course.title, course.enrollments]);
    }

    return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  }

  private async bucketRevenue(period: RevenuePeriod) {
    const payments = await this.paymentRepository.find({
      where: { status: PaymentStatus.COMPLETED },
      order: { createdAt: 'ASC' },
    });

    const bucketKey = (date: Date): string => {
      const iso = date.toISOString();
      if (period === 'daily') return iso.slice(0, 10);
      if (period === 'weekly') {
        const d = new Date(date);
        const day = d.getUTCDay();
        d.setUTCDate(d.getUTCDate() - day);
        return d.toISOString().slice(0, 10);
      }
      return iso.slice(0, 7);
    };

    const buckets = new Map<string, number>();
    for (const payment of payments) {
      const key = bucketKey(payment.createdAt);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(payment.amount));
    }

    return [...buckets.entries()]
      .map(([periodLabel, revenue]) => ({ period: periodLabel, revenue }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }
}

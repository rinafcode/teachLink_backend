import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { Course } from '../courses/entities/course.entity';
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
    private readonly reportingService: ReportingService,
  ) {}

  async getOverview() {
    const [revenue, userGrowth, coursePerformance, funnel] = await Promise.all([
      this.getRevenueMetrics('monthly'),
      this.getUserGrowthMetrics(),
      this.getCoursePerformanceMetrics(),
      this.getConversionFunnel(),
    ]);
    return { revenue, userGrowth, coursePerformance, funnel, generatedAt: new Date().toISOString() };
  }

  async getRevenueMetrics(period: RevenuePeriod) {
    const buckets = await this.bucketRevenue(period);
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const report = await this.reportingService.generateRevenueRecognitionReport(
      startOfMonth,
      now,
    );
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
        paymentToCompletion: completedPayments
          ? completedEnrollments / completedPayments
          : 0,
      },
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

    const rows: string[][] = [
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

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Refund, RefundStatus } from '../entities/refund.entity';
import { Course } from '../../courses/entities/course.entity';
import { User } from '../../users/entities/user.entity';
import { InstructorPayoutProfile } from '../entities/payout-profile.entity';
import { InstructorPayout, PayoutStatus } from '../entities/payout.entity';
import { UpdatePayoutSettingsDto } from './dto/payout.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import Decimal from 'decimal.js';

export interface RevenueBreakdownPagination {
  page?: number;
  pageSize?: number;
}

export interface RevenueBreakdownPageInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RevenueBreakdownCourseRow {
  courseId: string;
  title: string;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  salesCount: number;
}

export interface RevenueBreakdownSummary {
  totalGrossRevenue: number;
  totalRefunds: number;
  totalNetRevenue: number;
  currency: string;
}

export interface RevenueBreakdownResult {
  summary: RevenueBreakdownSummary;
  pageInfo: RevenueBreakdownPageInfo;
  courses: RevenueBreakdownCourseRow[];
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CURRENCY = 'USD';

/**
 * Convert an arbitrary numeric value (which may have arrived as a Number or
 * as a String from SQL SUM/numeric output) into a 2-decimal currency-ready
 * JavaScript number, using Decimal arithmetic to avoid IEEE-754 drift
 * (Issue #820 / fix-820). The SQL SUM result is exact; only the post-fetch
 * subtraction and Number coercion can drift, so Decimal is applied at this
 * boundary only.
 */
function toMoneyNumber(value: string | number): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(InstructorPayoutProfile)
    private readonly payoutProfileRepository: Repository<InstructorPayoutProfile>,
    @InjectRepository(InstructorPayout)
    private readonly payoutRepository: Repository<InstructorPayout>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Generates the revenue breakdown for an instructor, course-by-course.
   *
   * Uses two pre-aggregated derived subqueries (gross, refunds) joined back
   * onto the courses table, so the per-course and summary numbers are
   * computed in 3 SQL round-trips regardless of dataset size. Refunds are
   * aggregated PER PAYMENT in the subquery so a payment with multiple
   * partial refunds still contributes its gross exactly once (avoids the
   * row-multiplicity bug that direct LEFT JOIN would cause). Decimal
   * arithmetic at the JS-boundary rounding step satisfies Issue #820, and
   * pagination is added per Issue #809.
   */
  async getRevenueBreakdown(
    instructorId: string,
    pagination: RevenueBreakdownPagination = {},
  ): Promise<RevenueBreakdownResult> {
    const page = this.normalizePage(pagination.page);
    const pageSize = this.normalizePageSize(pagination.pageSize);

    const emptyResult: RevenueBreakdownResult = {
      summary: {
        totalGrossRevenue: 0,
        totalRefunds: 0,
        totalNetRevenue: 0,
        currency: DEFAULT_CURRENCY,
      },
      pageInfo: {
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      },
      courses: [],
    };

    const total = await this.countInstructorCourses(instructorId);
    if (total === 0) {
      return emptyResult;
    }

    const [courses, summary] = await Promise.all([
      this.fetchPaginatedCourseRevenue(instructorId, page, pageSize),
      this.fetchInstructorRevenueSummary(instructorId),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      summary,
      pageInfo: {
        total,
        page,
        pageSize,
        totalPages,
      },
      courses,
    };
  }

  /**
   * Fetches or lazily creates a payout profile settings for an instructor.
   */
  async getPayoutProfile(instructorId: string): Promise<InstructorPayoutProfile> {
    let profile = await this.payoutProfileRepository.findOne({
      where: { instructorId },
    });

    if (!profile) {
      profile = this.payoutProfileRepository.create({
        instructorId,
        payoutSchedule: 'monthly',
        payoutMethod: 'paypal',
        payoutDetails: '',
      });
      profile = await this.payoutProfileRepository.save(profile);
    }

    return profile;
  }

  /**
   * Updates an instructor's payout profile.
   */
  async updatePayoutProfile(
    instructorId: string,
    dto: UpdatePayoutSettingsDto,
  ): Promise<InstructorPayoutProfile> {
    const profile = await this.getPayoutProfile(instructorId);
    profile.payoutSchedule = dto.payoutSchedule;
    profile.payoutMethod = dto.payoutMethod;
    profile.payoutDetails = dto.payoutDetails;
    return this.payoutProfileRepository.save(profile);
  }

  /**
   * Returns the payout history of an instructor.
   */
  async getHistoricalPayouts(instructorId: string): Promise<InstructorPayout[]> {
    return this.payoutRepository.find({
      where: { instructorId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Processes a payout transaction for an instructor and sends a notification.
   */
  async processPayout(
    instructorId: string,
    amount: number,
    method?: string,
    details?: string,
  ): Promise<InstructorPayout> {
    const profile = await this.getPayoutProfile(instructorId);
    const payoutMethod = method ?? profile.payoutMethod;
    const payoutDetails = details ?? profile.payoutDetails;

    const payout = this.payoutRepository.create({
      instructorId,
      amount,
      currency: 'USD',
      status: PayoutStatus.COMPLETED,
      payoutMethod,
      payoutDetails,
      payoutDate: new Date(),
    });

    const savedPayout = await this.payoutRepository.save(payout);

    const instructor = await this.userRepository.findOne({
      where: { id: instructorId },
    });

    if (instructor) {
      try {
        await this.notificationsService.sendTemplated({
          userId: instructorId,
          templateName: 'instructor_payout',
          eventType: 'payout',
          context: {
            instructorName: `${instructor.firstName} ${instructor.lastName}`,
            amount: savedPayout.amount.toString(),
            currency: savedPayout.currency,
            payoutMethod: savedPayout.payoutMethod,
            payoutDetails: savedPayout.payoutDetails || 'N/A',
          },
        });
        this.logger.log(`Templated payout email sent successfully to instructor ${instructorId}`);
      } catch (err) {
        this.logger.warn(
          `Failed to send templated payout email to instructor ${instructorId}, falling back to direct notification: ${err.message}`,
        );
        try {
          await this.notificationsService.send({
            userId: instructorId,
            title: 'Your payout has been processed!',
            content: `Hello ${instructor.firstName} ${instructor.lastName},\n\nWe are pleased to inform you that your payout of ${savedPayout.amount} ${savedPayout.currency} has been successfully processed via ${savedPayout.payoutMethod}.\n\nDetails: ${savedPayout.payoutDetails || 'N/A'}\n\nThank you for teaching on TeachLink!`,
            type: NotificationType.EMAIL,
          });
          this.logger.log(
            `Direct fallback payout email sent successfully to instructor ${instructorId}`,
          );
        } catch (fallbackErr) {
          this.logger.error(
            `Failed to send direct fallback payout notification: ${fallbackErr.message}`,
          );
        }
      }
    }

    return savedPayout;
  }

  /**
   * Builds the OUTER QueryBuilder that joins per-course aggregations. The
   * pre-aggregated subqueries prevent row-multiplicity from blowing up the
   * gross/refund totals when a payment has multiple partial refunds.
   * Exposed (package-private) for unit testing convenience.
   */
  protected buildCourseRevenueQuery(instructorId: string): SelectQueryBuilder<Course> {
    const grossSubquery = this.buildPerCourseGrossSubquery();
    const refundsSubquery = this.buildPerCourseRefundsSubquery();

    return this.courseRepository
      .createQueryBuilder('course')
      .leftJoin(`(${grossSubquery.getQuery()})`, 'gross_sub', 'gross_sub.course_id = course.id')
      .leftJoin(
        `(${refundsSubquery.getQuery()})`,
        'refunds_sub',
        'refunds_sub.course_id = course.id',
      )
      .select('course.id', 'courseId')
      .addSelect('course.title', 'title')
      .addSelect('COALESCE(gross_sub.gross, 0)', 'gross')
      .addSelect('COALESCE(refunds_sub.refunds, 0)', 'refunds')
      .addSelect('COALESCE(gross_sub.sales_count, 0)', 'salesCount')
      .where('course.instructorId = :instructorId', { instructorId })
      .orderBy('course.title', 'ASC')
      .setParameters({
        ...grossSubquery.getParameters(),
        ...refundsSubquery.getParameters(),
      });
  }

  /**
   * Per-course gross aggregator: sums completed payments grouped by
   * course_id, returning one row per course.
   */
  private buildPerCourseGrossSubquery(): SelectQueryBuilder<Payment> {
    return this.paymentRepository
      .createQueryBuilder('p')
      .select('p.course_id', 'course_id')
      .addSelect('SUM(p.amount)', 'gross')
      .addSelect('COUNT(p.id)', 'sales_count')
      .where('p.status = :completedPaymentStatus', {
        completedPaymentStatus: PaymentStatus.COMPLETED,
      })
      .andWhere('p.course_id IS NOT NULL')
      .groupBy('p.course_id');
  }

  /**
   * Per-course refund aggregator: sums processed refunds grouped by their
   * payment's course_id, returning one row per course. Refunds are
   * aggregated per course_id via the inner JOIN — never duplicated across
   * payment rows.
   */
  private buildPerCourseRefundsSubquery(): SelectQueryBuilder<Refund> {
    return this.refundRepository
      .createQueryBuilder('r')
      .innerJoin(Payment, 'p', 'p.id = r.payment_id AND p.status = :completedPaymentStatus', {
        completedPaymentStatus: PaymentStatus.COMPLETED,
      })
      .select('p.course_id', 'course_id')
      .addSelect('SUM(r.amount)', 'refunds')
      .where('r.status = :processedRefundStatus', {
        processedRefundStatus: RefundStatus.PROCESSED,
      })
      .andWhere('p.course_id IS NOT NULL')
      .groupBy('p.course_id');
  }

  private normalizePage(page?: number): number {
    if (page === undefined || Number.isNaN(page) || page < 1) {
      return 1;
    }
    return Math.floor(page);
  }

  private normalizePageSize(pageSize?: number): number {
    if (pageSize === undefined || Number.isNaN(pageSize) || pageSize < 1) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(Math.floor(pageSize), MAX_PAGE_SIZE);
  }

  private async countInstructorCourses(instructorId: string): Promise<number> {
    return this.courseRepository
      .createQueryBuilder('course')
      .where('course.instructorId = :instructorId', { instructorId })
      .getCount();
  }

  private async fetchPaginatedCourseRevenue(
    instructorId: string,
    page: number,
    pageSize: number,
  ): Promise<RevenueBreakdownCourseRow[]> {
    const qb = this.buildCourseRevenueQuery(instructorId);
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const rawRows = await qb.getRawMany();
    return rawRows.map((row) => {
      const gross = toMoneyNumber(row.gross ?? 0);
      const refunds = toMoneyNumber(row.refunds ?? 0);
      return {
        courseId: row.courseId,
        title: row.title,
        grossRevenue: gross,
        refunds,
        netRevenue: toMoneyNumber(new Decimal(gross).minus(refunds)),
        salesCount: Number(row.salesCount) || 0,
      };
    });
  }

  private async fetchInstructorRevenueSummary(
    instructorId: string,
  ): Promise<RevenueBreakdownSummary> {
    const [grossRow, refundsRow] = await Promise.all([
      this.paymentRepository
        .createQueryBuilder('p')
        .innerJoin(Course, 'c', 'c.id = p.course_id AND c.instructorId = :instructorId', {
          instructorId,
        })
        .select('COALESCE(SUM(p.amount), 0)', 'totalGross')
        .where('p.status = :completedStatus', { completedStatus: PaymentStatus.COMPLETED })
        .getRawOne(),
      this.refundRepository
        .createQueryBuilder('r')
        .innerJoin(Payment, 'p', 'p.id = r.payment_id AND p.status = :completedStatus', {
          completedStatus: PaymentStatus.COMPLETED,
        })
        .innerJoin(Course, 'c', 'c.id = p.course_id AND c.instructorId = :instructorId', {
          instructorId,
        })
        .select('COALESCE(SUM(r.amount), 0)', 'totalRefunds')
        .where('r.status = :processedStatus', { processedStatus: RefundStatus.PROCESSED })
        .getRawOne(),
    ]);

    const totalGross = toMoneyNumber(grossRow?.totalGross ?? 0);
    const totalRefunds = toMoneyNumber(refundsRow?.totalRefunds ?? 0);
    return {
      totalGrossRevenue: totalGross,
      totalRefunds: totalRefunds,
      totalNetRevenue: toMoneyNumber(new Decimal(totalGross).minus(totalRefunds)),
      currency: DEFAULT_CURRENCY,
    };
  }
}

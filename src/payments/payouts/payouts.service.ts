import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Refund, RefundStatus } from '../entities/refund.entity';
import { Course } from '../../courses/entities/course.entity';
import { User } from '../../users/entities/user.entity';
import { InstructorPayoutProfile } from '../entities/payout-profile.entity';
import { InstructorPayout, PayoutStatus } from '../entities/payout.entity';
import { UpdatePayoutSettingsDto } from './dto/payout.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

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
   */
  async getRevenueBreakdown(instructorId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const qb = this.courseRepository.createQueryBuilder('course')
      .leftJoin(Payment, 'payment', 'payment.courseId = course.id AND payment.status = :paymentStatus', { paymentStatus: PaymentStatus.COMPLETED })
      .leftJoin(Refund, 'refund', 'refund.paymentId = payment.id AND refund.status = :refundStatus', { refundStatus: RefundStatus.PROCESSED })
      .where('course.instructorId = :instructorId', { instructorId })
      .select([
        'course.id AS "courseId"',
        'course.title AS "title"',
      ])
      .addSelect('COUNT(DISTINCT payment.id)', 'salesCount')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'grossRevenue')
      .addSelect('COALESCE(SUM(refund.amount), 0)', 'refunds')
      .groupBy('course.id')
      .addGroupBy('course.title')
      .orderBy('course.id', 'ASC')
      .offset(skip)
      .limit(limit);

    const summaryQb = this.courseRepository.createQueryBuilder('course')
      .leftJoin(Payment, 'payment', 'payment.courseId = course.id AND payment.status = :paymentStatus', { paymentStatus: PaymentStatus.COMPLETED })
      .leftJoin(Refund, 'refund', 'refund.paymentId = payment.id AND refund.status = :refundStatus', { refundStatus: RefundStatus.PROCESSED })
      .where('course.instructorId = :instructorId', { instructorId })
      .select([
        'COALESCE(SUM(payment.amount), 0) AS "totalGrossRevenue"',
        'COALESCE(SUM(refund.amount), 0) AS "totalRefunds"'
      ]);

    const [rawCourses, summaryRaw] = await Promise.all([
      qb.getRawMany(),
      summaryQb.getRawOne()
    ]);

    const coursesBreakdown = rawCourses.map((raw) => {
      const gross = Number(raw.grossRevenue);
      const refunded = Number(raw.refunds);
      return {
        courseId: raw.courseId,
        title: raw.title,
        grossRevenue: Number(gross.toFixed(2)),
        refunds: Number(refunded.toFixed(2)),
        netRevenue: Number((gross - refunded).toFixed(2)),
        salesCount: Number(raw.salesCount),
      };
    });

    const totalGrossRevenue = summaryRaw ? Number(summaryRaw.totalGrossRevenue) : 0;
    const totalRefunds = summaryRaw ? Number(summaryRaw.totalRefunds) : 0;

    return {
      summary: {
        totalGrossRevenue: Number(totalGrossRevenue.toFixed(2)),
        totalRefunds: Number(totalRefunds.toFixed(2)),
        totalNetRevenue: Number((totalGrossRevenue - totalRefunds).toFixed(2)),
        currency: 'USD',
      },
      courses: coursesBreakdown,
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

    // Retrieve instructor profile for name and email
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
}

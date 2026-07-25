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
import Decimal from 'decimal.js';

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
  async getRevenueBreakdown(instructorId: string) {
    const courses = await this.courseRepository.find({
      where: { instructorId },
    });

    if (courses.length === 0) {
      return {
        summary: {
          totalGrossRevenue: 0.0,
          totalRefunds: 0.0,
          totalNetRevenue: 0.0,
          currency: 'USD',
        },
        courses: [],
      };
    }

    const courseIds = courses.map((c) => c.id);

    // Fetch all completed payments for instructor's courses
    const payments = await this.paymentRepository.find({
      where: {
        courseId: In(courseIds),
        status: PaymentStatus.COMPLETED,
      },
    });

    const paymentIds = payments.map((p) => p.id);

    // Fetch all processed refunds for those payments
    const refunds =
      paymentIds.length > 0
        ? await this.refundRepository.find({
            where: {
              paymentId: In(paymentIds),
              status: RefundStatus.PROCESSED,
            },
          })
        : [];

    // Map payments and refunds to courses
    let totalGrossRevenue = new Decimal(0);
    let totalRefunds = new Decimal(0);

    const coursesBreakdown = courses.map((course) => {
      const coursePayments = payments.filter((p) => p.courseId === course.id);
      const coursePaymentIds = coursePayments.map((p) => p.id);
      const courseRefunds = refunds.filter((r) => coursePaymentIds.includes(r.paymentId));

      const gross = coursePayments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
      const refunded = courseRefunds.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));
      const net = gross.minus(refunded);

      totalGrossRevenue = totalGrossRevenue.plus(gross);
      totalRefunds = totalRefunds.plus(refunded);

      return {
        courseId: course.id,
        title: course.title,
        grossRevenue: gross.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        refunds: refunded.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        netRevenue: net.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        salesCount: coursePayments.length,
      };
    });

    return {
      summary: {
        totalGrossRevenue: totalGrossRevenue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        totalRefunds: totalRefunds.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        totalNetRevenue: totalGrossRevenue
          .minus(totalRefunds)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber(),
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

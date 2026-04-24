import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from './entities/payment.entity';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { User } from '../users/entities/user.entity';
import { Refund, RefundStatus } from './entities/refund.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { RefundDto } from './dto/refund.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { TransactionService } from '../common/database/transaction.service';
import { Transactional } from '../common/database/transactional.decorator';
import { ensureUserExists } from '../common/utils/user.utils';
import { ProviderFactoryService } from './providers/provider-factory.service';
import {
  ICreatePaymentIntentResult,
  ICreateSubscriptionResult,
  IProcessRefundResult,
  ISubscriptionWebhookEvent,
  IRefundWebhookData,
} from './interfaces/payment-provider.interface';

/**
 * Provides payment operations.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly transactionService: TransactionService,
    private readonly providerFactory: ProviderFactoryService,
  ) {}

  /**
   * Create a payment intent with a provider and record the pending payment.
   *
   * Supports idempotency via an optional key: if a non-failed payment already
   * exists for the given key, the original result is replayed without hitting
   * the payment provider again. This prevents duplicate charges on network
   * retries or accidental double-submissions.
   *
   * Uses @Transactional for consistent transaction management with retry logic.
   * The unique DB constraint on idempotencyKey acts as a last-resort guard
   * against concurrent requests that bypass the Redis-layer lock.
   */
  @Transactional()
  async createPaymentIntent(
    userId: string,
    createPaymentDto: CreatePaymentDto,
    idempotencyKey?: string,
  ): Promise<ICreatePaymentIntentResult> {
    const { courseId, amount, currency, provider, metadata } = createPaymentDto;

    // Check for an existing payment with the same idempotency key before doing
    // any provider I/O. Non-failed payments are replayed as-is.
    if (idempotencyKey) {
      const existing = await this.paymentRepository.findOne({
        where: { idempotencyKey },
      });

      if (existing) {
        if (existing.status !== PaymentStatus.FAILED) {
          this.logger.log(
            `Replaying idempotent payment response for key ${idempotencyKey} (payment ${existing.id})`,
          );
          return {
            paymentId: existing.id,
            clientSecret: (existing.metadata?._clientSecret as string) ?? '',
            requiresAction: Boolean(existing.metadata?._requiresAction),
          };
        }
        // Failed payments are allowed to retry — fall through to create a new one.
        this.logger.warn(
          `Previous payment ${existing.id} for key ${idempotencyKey} failed; allowing retry`,
        );
      }
    }

    // Verify user exists
    const userOrNull = await this.userRepository.findOne({
      where: { id: userId },
    });
    const user = ensureUserExists(userOrNull);

    // Get payment provider
    const paymentProvider = this.providerFactory.getProvider(provider ?? 'stripe');

    // Create payment intent with provider
    const paymentIntent = await paymentProvider.createPaymentIntent(amount, currency ?? 'USD', {
      ...metadata,
      userId,
      courseId,
    });

    // Store the clientSecret in metadata so idempotent replays can return it
    // without hitting the provider again.
    const paymentMetadata: Record<string, unknown> = {
      ...(metadata ?? {}),
      _clientSecret: paymentIntent.clientSecret,
      _requiresAction: paymentIntent.requiresAction ?? false,
    };

    // Create payment record
    const payment = this.paymentRepository.create({
      amount,
      currency,
      method: PaymentMethod.CREDIT_CARD,
      provider,
      providerPaymentId: paymentIntent.paymentIntentId,
      status: PaymentStatus.PENDING,
      metadata: paymentMetadata,
      user,
      userId,
      courseId,
      idempotencyKey: idempotencyKey ?? null,
    });

    await this.paymentRepository.save(payment);

    return {
      paymentId: payment.id,
      clientSecret: paymentIntent.clientSecret,
      requiresAction: paymentIntent.requiresAction,
    };
  }

  /**
   * Creates subscription.
   * @param userId The user identifier.
   * @param createSubscriptionDto The request payload.
   * @returns The resulting create subscription result.
   */
  async createSubscription(
    userId: string,
    createSubscriptionDto: CreateSubscriptionDto,
    _idempotencyKey?: string,
  ): Promise<ICreateSubscriptionResult> {
    const { interval } = createSubscriptionDto;

    // Verify user exists
    const userOrNull = await this.userRepository.findOne({
      where: { id: userId },
    });

    ensureUserExists(userOrNull);

    // Get payment provider
    // const paymentProvider = this.providerFactory.getProvider(provider);

    // Create subscription record
    const subscription = this.subscriptionRepository.create({
      providerSubscriptionId: `sub_${Math.random().toString(36).substr(2, 9)}`,
      status: SubscriptionStatus.ACTIVE,
      interval,
      amount: 0, // Would come from priceId
      currency: 'USD',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      user: { id: userId } as User,
      userId,
    });

    await this.subscriptionRepository.save(subscription);

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  /**
   * Process a refund for a completed payment.
   *
   * Supports idempotency via an optional key: if a refund already exists for
   * the given key, its result is replayed immediately without hitting the
   * payment provider again. This prevents duplicate refunds caused by client
   * retries or webhook re-deliveries.
   *
   * Uses @Transactional to ensure the payment status update and refund record
   * creation always succeed or fail together.
   */
  @Transactional()
  async processRefund(
    refundDto: RefundDto,
    idempotencyKey?: string,
  ): Promise<IProcessRefundResult> {
    const { paymentId, amount, reason } = refundDto;

    // Return an already-processed refund for the same idempotency key without
    // any side-effects — safe to call any number of times.
    if (idempotencyKey) {
      const existingRefund = await this.refundRepository.findOne({
        where: { idempotencyKey },
      });

      if (existingRefund) {
        this.logger.log(
          `Replaying idempotent refund response for key ${idempotencyKey} (refund ${existingRefund.id})`,
        );
        return {
          refundId: existingRefund.id,
          status: existingRefund.status,
          amount: existingRefund.amount,
        };
      }
    }

    // Find payment
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    // Guard against refunding a payment that was already refunded through a
    // different code path (e.g. webhook), without an idempotency key.
    const duplicate = await this.refundRepository.findOne({
      where: { paymentId: payment.id, status: RefundStatus.PROCESSED },
    });
    if (duplicate && !idempotencyKey) {
      throw new ConflictException(
        `Payment ${paymentId} has already been refunded (refund ${duplicate.id}). ` +
          'Provide an X-Idempotency-Key header to safely retry.',
      );
    }

    // Get provider
    const paymentProvider = this.providerFactory.getProvider(payment.provider);

    // Process refund with provider
    const refundResult = await paymentProvider.refundPayment(payment.providerPaymentId, amount);

    // Update payment status
    payment.status = PaymentStatus.REFUNDED;
    await this.paymentRepository.save(payment);

    // Create refund record
    const refund = this.refundRepository.create({
      paymentId: payment.id,
      amount: amount || payment.amount,
      reason,
      refundMethod: 'original_method',
      providerRefundId: refundResult.refundId,
      status: RefundStatus.PROCESSED,
      idempotencyKey: idempotencyKey ?? null,
    });

    await this.refundRepository.save(refund);

    return {
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
    };
  }

  /**
   * Retrieves user Payments.
   * @param userId The user identifier.
   * @param limit The maximum number of results.
   * @param page The page number.
   * @returns The matching results.
   */
  async getUserPayments(userId: string, limit: number, page: number): Promise<Payment[]> {
    const skip = (page - 1) * limit;

    return await this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
  }

  /**
   * Retrieves user Subscriptions.
   * @param userId The user identifier.
   * @returns The matching results.
   */
  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return await this.subscriptionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get or generate an invoice for a payment.
   * Uses @Transactional to prevent race conditions during invoice generation.
   */
  @Transactional()
  async getInvoice(paymentId: string, userId: string): Promise<Invoice> {
    // Find payment
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check if invoice already exists
    let invoice = await this.invoiceRepository.findOne({
      where: { paymentId: payment.id },
    });

    if (!invoice) {
      // Generate new invoice
      invoice = this.invoiceRepository.create({
        paymentId: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        items: [
          {
            description: 'Payment for course',
            amount: payment.amount,
            quantity: 1,
          },
        ],
        taxAmount: 0,
        totalAmount: payment.amount,
        status: InvoiceStatus.PAID,
      });

      await this.invoiceRepository.save(invoice);
    }

    return invoice;
  }

  /**
   * Updates payment Status.
   * @param paymentId The payment identifier.
   * @param status The status value.
   * @param metadata The data to process.
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.paymentRepository.update(
      { providerPaymentId: paymentId },
      { status, ...(metadata ? { metadata: metadata as Record<string, any> } : {}) },
    );
  }

  async handleSubscriptionEvent(event: ISubscriptionWebhookEvent): Promise<void> {
    // Handle subscription events from webhook
    const subscriptionId = event.data.object.id;
    const status = event.data.object.status;

    // Update subscription in database
    await this.subscriptionRepository.update(
      { providerSubscriptionId: subscriptionId },
      { status: status as SubscriptionStatus },
    );
  }

  /**
   * Process refund triggered by a webhook
   * Uses @Transactional to ensure atomicity between refund record creation and payment status update.
   */
  @Transactional()
  async processRefundFromWebhook(
    paymentIntentId: string,
    refundData: IRefundWebhookData,
  ): Promise<void> {
    // Find payment by provider ID
    const payment = await this.paymentRepository.findOne({
      where: { providerPaymentId: paymentIntentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Create refund record
    const refund = this.refundRepository.create({
      paymentId: payment.id,
      amount: refundData.amount,
      reason: 'webhook_refund',
      refundMethod: 'original_method',
      providerRefundId: refundData.id,
      status: RefundStatus.PROCESSED,
    });

    await this.refundRepository.save(refund);

    // Update payment status
    payment.status = PaymentStatus.REFUNDED;
    await this.paymentRepository.save(payment);
  }
}

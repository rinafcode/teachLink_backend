import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { User } from '../users/entities/user.entity';
import { Refund } from './entities/refund.entity';
import { Invoice } from './entities/invoice.entity';
import { RefundDto } from './dto/refund.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class PaymentsService {
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
  ) {}

  private getProvider(provider: string) {
    // Placeholder implementation - in a real app you would have a provider factory
    // Return a mock provider or throw an error for unsupported providers
    return {
      createPaymentIntent: async (amount: number, currency: string, metadata: any) => {
        return {
          paymentIntentId: `pi_${Math.random().toString(36).substr(2, 9)}`,
          clientSecret: `cs_${Math.random().toString(36).substr(2, 9)}`,
          requiresAction: false,
        };
      },
      refundPayment: async (paymentId: string, amount?: number) => {
        return {
          refundId: `re_${Math.random().toString(36).substr(2, 9)}`,
          status: 'succeeded',
        };
      },
      handleWebhook: async (payload: any, signature: string) => {
        return payload;
      },
    };
  }

  async createPaymentIntent(userId: string, createPaymentDto: CreatePaymentDto) {
    const { courseId, amount, currency, provider, metadata } = createPaymentDto;

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get payment provider
    const paymentProvider = this.getProvider(provider);

    // Create payment intent
    const paymentIntent = await paymentProvider.createPaymentIntent(
      amount,
      currency,
      {
        ...metadata,
        userId,
        courseId,
      },
    );

    // Create payment record
    const payment = this.paymentRepository.create({
      amount,
      currency,
      method: PaymentMethod.CREDIT_CARD,
      provider,
      providerPaymentId: paymentIntent.paymentIntentId,
      status: PaymentStatus.PENDING,
      metadata,
      user,
      userId,
      courseId,
    });

    await this.paymentRepository.save(payment);

    return {
      paymentId: payment.id,
      clientSecret: paymentIntent.clientSecret,
      requiresAction: paymentIntent.requiresAction,
    };
  }

  async createSubscription(userId: string, createSubscriptionDto: CreateSubscriptionDto) {
    const { courseId, interval, provider, priceId, metadata } = createSubscriptionDto;

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get payment provider
    const paymentProvider = this.getProvider(provider);

    // Create subscription record
    const subscription = this.subscriptionRepository.create({
      providerSubscriptionId: `sub_${Math.random().toString(36).substr(2, 9)}`,
      status: 'ACTIVE' as any, // Temporary workaround for enum mismatch
      interval,
      amount: 0, // Would come from priceId
      currency: 'USD',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      user: { id: userId },
      userId,
    });

    await this.subscriptionRepository.save(subscription);

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  async processRefund(refundDto: RefundDto) {
    const { paymentId, amount, reason } = refundDto;

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

    // Get provider
    const paymentProvider = this.getProvider(payment.provider);

    // Process refund with provider
    const refundResult = await paymentProvider.refundPayment(
      payment.providerPaymentId,
      amount,
    );

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
      status: 'PROCESSED' as any,
    });

    await this.refundRepository.save(refund);

    return {
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
    };
  }

  async getUserPayments(userId: string, limit: number, page: number) {
    const skip = (page - 1) * limit;
    
    return await this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
  }

  async getUserSubscriptions(userId: string) {
    return await this.subscriptionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getInvoice(paymentId: string, userId: string) {
    // Find payment
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId }
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check if invoice already exists
    let invoice = await this.invoiceRepository.findOne({
      where: { paymentId: payment.id }
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
            description: `Payment for course`,
            amount: payment.amount,
            quantity: 1,
          },
        ],
        taxAmount: 0,
        totalAmount: payment.amount,
        status: 'paid',
      });

      await this.invoiceRepository.save(invoice);
    }

    return invoice;
  }

  async updatePaymentStatus(paymentId: string, status: string, metadata?: any) {
    await this.paymentRepository.update(
      { providerPaymentId: paymentId },
      { status: status as PaymentStatus, metadata }
    );
  }

  async handleSubscriptionEvent(event: any) {
    // Handle subscription events from webhook
    const subscriptionId = event.data.object.id;
    const status = event.data.object.status;

    // Update subscription in database
    await this.subscriptionRepository.update(
      { providerSubscriptionId: subscriptionId },
      { status }
    );
  }

  async processRefundFromWebhook(paymentIntentId: string, refundData: any) {
    // Find payment by provider ID
    const payment = await this.paymentRepository.findOne({
      where: { providerPaymentId: paymentIntentId }
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
      status: 'PROCESSED' as any,
    });

    await this.refundRepository.save(refund);

    // Update payment status
    payment.status = PaymentStatus.REFUNDED;
    await this.paymentRepository.save(payment);
  }
}
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

  ) {}

  async createPaymentIntent(userId: string, createPaymentDto: CreatePaymentDto) {
    const { courseId, amount, currency, provider, metadata } = createPaymentDto;

    // Verify course exists
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get payment provider
    const paymentProvider = this.providerFactory.getProvider(provider);

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
      course,
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

    // Verify course exists and is subscription-based
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
      relations: ['subscriptionPlans'],
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!course.isSubscription) {
      throw new BadRequestException('Course does not support subscriptions');
    }

    // Get payment provider
    const paymentProvider = this.providerFactory.getProvider(provider);

    // Get or create customer
    const customerId = await this.getOrCreateCustomer(userId, provider);

    // Create subscription with provider
    const subscriptionData = await paymentProvider.createSubscription(
      customerId,
      priceId,
      {
        ...metadata,
        userId,
        courseId,
      },
    );

    // Create subscription record
    const subscription = this.subscriptionRepository.create({
      providerSubscriptionId: subscriptionData.subscriptionId,
      status: subscriptionData.status,
      interval,
      amount: course.subscriptionPrice,
      currency: 'USD',
      currentPeriodStart: new Date(),
      currentPeriodEnd: subscriptionData.currentPeriodEnd,
      user: { id: userId },
      course: { id: courseId },
      userId,
      courseId,
    });

    await this.subscriptionRepository.save(subscription);

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  async processWebhook(provider: string, payload: any, signature: string) {
    const paymentProvider = this.providerFactory.getProvider(provider);
    const event = await paymentProvider.handleWebhook(payload, signature);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data);
        break;
      case 'invoice.payment_succeeded':
        await this.handleSubscriptionPayment(event.data);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancellation(event.data);
        break;
    }

    return { received: true };
  }

  private async handlePaymentSuccess(paymentData: any) {
    // Update payment status
    await this.paymentRepository.update(
      { providerPaymentId: paymentData.id },
      { status: PaymentStatus.COMPLETED },
    );

    // Grant course access to user
    const payment = await this.paymentRepository.findOne({
      where: { providerPaymentId: paymentData.id },
      relations: ['user', 'course'],
    });

    if (payment && payment.course) {
      // Add user to course enrollment
      // This depends on your course enrollment system
      // Implement based on your existing logic
    }

    // Generate invoice
    await this.generateInvoice(payment);
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
    const paymentProvider = this.providerFactory.getProvider(payment.provider);

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
      payment,
      amount: amount || payment.amount,
      reason,
      providerRefundId: refundResult.refundId,
      status: refundResult.status,
    });

    await this.refundRepository.save(refund);

    return {
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
    };
  }

  async generateInvoice(payment: Payment) {
    const invoice = this.invoiceRepository.create({
      payment,
      user: payment.user,
      amount: payment.amount,
      currency: payment.currency,
      invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      items: [
        {
          description: `Course: ${payment.course?.title || 'Unknown'}`,
          amount: payment.amount,
          quantity: 1,
        },
      ],
      taxAmount: 0,
      totalAmount: payment.amount,
      status: 'paid',
    });

    return await this.invoiceRepository.save(invoice);
  }

  private async getOrCreateCustomer(userId: string, provider: string): Promise<string> {
    // Implementation depends on provider-specific customer management
    // For Stripe, you would create/retrieve a Stripe Customer
    return userId; // Placeholder - implement based on provider
  }
}
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from './entities/payment.entity';
import { StripeService } from './providers/stripe.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly stripeService: StripeService,
  ) {}

  async createPayment(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    try {
      const { userId, courseId, amount, currency, paymentMethod, description, metadata } = createPaymentDto;

      // Create payment record
      const payment = this.paymentRepo.create({
        userId,
        courseId,
        amount,
        currency,
        paymentMethod,
        status: PaymentStatus.PENDING,
        description,
        metadata,
      });

      const savedPayment = await this.paymentRepo.save(payment);

      // Create payment intent with provider
      if (paymentMethod === PaymentMethod.STRIPE) {
        const paymentIntent = await this.stripeService.createPaymentIntent(amount, currency, {
          paymentId: savedPayment.id,
          userId,
          courseId,
          ...metadata,
        });

        savedPayment.providerPaymentIntentId = paymentIntent.id;
        savedPayment.status = PaymentStatus.PROCESSING;
        return await this.paymentRepo.save(savedPayment);
      }

      return savedPayment;
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`);
      throw new BadRequestException('Failed to create payment');
    }
  }

  async confirmPayment(paymentId: string, paymentIntentId?: string): Promise<Payment> {
    const payment = await this.getPayment(paymentId);

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment is already completed');
    }

    try {
      if (payment.paymentMethod === PaymentMethod.STRIPE && paymentIntentId) {
        const paymentIntent = await this.stripeService.confirmPayment(paymentIntentId);
        
        payment.status = PaymentStatus.COMPLETED;
        payment.providerTransactionId = paymentIntent.id;
        payment.receiptUrl = (paymentIntent as any).charges?.data[0]?.receipt_url;
        
        return await this.paymentRepo.save(payment);
      }

      throw new BadRequestException('Invalid payment method or missing payment intent');
    } catch (error) {
      this.logger.error(`Failed to confirm payment: ${error.message}`);
      payment.status = PaymentStatus.FAILED;
      await this.paymentRepo.save(payment);
      throw new BadRequestException('Failed to confirm payment');
    }
  }

  async getPayment(id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['user', 'course'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async getUserPayments(userId: string): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { userId },
      relations: ['course'],
      order: { createdAt: 'DESC' },
    });
  }

  async refundPayment(paymentId: string, amount?: number): Promise<Payment> {
    const payment = await this.getPayment(paymentId);

    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Payment is already refunded');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    try {
      if (payment.paymentMethod === PaymentMethod.STRIPE && payment.providerPaymentIntentId) {
        await this.stripeService.createRefund(payment.providerPaymentIntentId, amount);
        
        payment.status = PaymentStatus.REFUNDED;
        return await this.paymentRepo.save(payment);
      }

      throw new BadRequestException('Invalid payment method for refund');
    } catch (error) {
      this.logger.error(`Failed to refund payment: ${error.message}`);
      throw new BadRequestException('Failed to refund payment');
    }
  }

  async getPaymentAnalytics(): Promise<{
    totalPayments: number;
    totalAmount: number;
    byStatus: Record<PaymentStatus, number>;
    byMethod: Record<PaymentMethod, number>;
  }> {
    const payments = await this.paymentRepo.find();
    
    const totalPayments = payments.length;
    const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    
    const byStatus: Record<PaymentStatus, number> = {} as Record<PaymentStatus, number>;
    const byMethod: Record<PaymentMethod, number> = {} as Record<PaymentMethod, number>;
    
    payments.forEach(payment => {
      byStatus[payment.status] = (byStatus[payment.status] || 0) + 1;
      byMethod[payment.paymentMethod] = (byMethod[payment.paymentMethod] || 0) + 1;
    });

    return { totalPayments, totalAmount, byStatus, byMethod };
  }

  async updatePaymentStatus(paymentId: string, status: PaymentStatus, metadata?: any): Promise<Payment> {
    const payment = await this.getPayment(paymentId);
    payment.status = status;
    if (metadata) {
      payment.metadata = { ...payment.metadata, ...metadata };
    }
    return await this.paymentRepo.save(payment);
  }
} 
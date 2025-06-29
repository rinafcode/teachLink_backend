import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentStatus, PaymentMethod } from './enums';
import { StripeService } from './providers/stripe.service';
import { Repository } from 'typeorm';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let repo: jest.Mocked<Repository<Payment>>;
  let stripe: jest.Mocked<StripeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {
            createPaymentIntent: jest.fn(),
            confirmPayment: jest.fn(),
            createRefund: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    repo = module.get(getRepositoryToken(Payment));
    stripe = module.get(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a payment and payment intent', async () => {
    // Arrange
    const paymentObj = {
      id: 'p1',
      status: PaymentStatus.PENDING,
      providerPaymentIntentId: undefined,
    } as Payment;
    repo.create.mockReturnValue(paymentObj);
    repo.save.mockImplementation(async (p) => ({ ...p, id: 'p1' } as Payment));
    stripe.createPaymentIntent.mockResolvedValue({ id: 'pi_123' } as any);

    // Act
    const result = await service.createPayment({
      userId: 'u1',
      amount: 10,
      currency: 'usd',
      paymentMethod: PaymentMethod.STRIPE,
    } as any);

    // Assert
    expect(result).toHaveProperty('providerPaymentIntentId', 'pi_123');
    expect(result.status).toBe(PaymentStatus.PROCESSING);
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it('should confirm a payment', async () => {
    // Arrange
    const paymentObj = {
      id: 'p1',
      status: PaymentStatus.PROCESSING,
      paymentMethod: PaymentMethod.STRIPE,
      providerTransactionId: undefined,
      receiptUrl: undefined,
    } as Payment;
    repo.findOne.mockResolvedValue(paymentObj);
    stripe.confirmPayment.mockResolvedValue({ id: 'pi_123', charges: { data: [{ receipt_url: 'url' }] } } as any);
    repo.save.mockImplementation(async (p) => ({ ...p, id: 'p1' } as Payment));

    // Act
    const result = await service.confirmPayment('p1', 'pi_123');

    // Assert
    expect(result.status).toBe(PaymentStatus.COMPLETED);
    expect(result.providerTransactionId).toBe('pi_123');
    expect(result.receiptUrl).toBe('url');
  });

  it('should refund a payment', async () => {
    // Arrange
    const paymentObj = {
      id: 'p1',
      status: PaymentStatus.COMPLETED,
      paymentMethod: PaymentMethod.STRIPE,
      providerPaymentIntentId: 'pi_123',
    } as Payment;
    repo.findOne.mockResolvedValue(paymentObj);
    stripe.createRefund.mockResolvedValue({ id: 'r1' } as any);
    repo.save.mockImplementation(async (p) => ({ ...p, id: 'p1', status: PaymentStatus.REFUNDED } as Payment));

    // Act
    const result = await service.refundPayment('p1');

    // Assert
    expect(result.status).toBe(PaymentStatus.REFUNDED);
  });
});
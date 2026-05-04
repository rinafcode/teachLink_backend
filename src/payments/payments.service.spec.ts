import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { Subscription } from './entities/subscription.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';
import { User } from '../users/entities/user.entity';
import { TransactionService } from '../common/database/transaction.service';
import { ProviderFactoryService } from './providers/provider-factory.service';
import { expectNotFound, expectUnauthorized, expectValidationFailure } from '../../test/utils';
type RepoMock = {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
};
function createRepositoryMock(): RepoMock {
    return {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        update: jest.fn(),
    };
}
describe('PaymentsService', () => {
    let service: PaymentsService;
    let paymentRepository: RepoMock;
    let userRepository: RepoMock;
    let refundRepository: RepoMock;
    let invoiceRepository: RepoMock;
    let providerFactoryMock: {
        getProvider: jest.Mock;
    };
    const baseCreatePaymentDto: CreatePaymentDto = {
        courseId: 'course-1',
        amount: 100,
        currency: 'USD',
        provider: 'stripe',
        metadata: { source: 'test' },
    };
    beforeEach(async () => {
        const paymentRepoMock = createRepositoryMock();
        const subscriptionRepoMock = createRepositoryMock();
        const userRepoMock = createRepositoryMock();
        const refundRepoMock = createRepositoryMock();
        const invoiceRepoMock = createRepositoryMock();
        const mockTransactionService = {
            runWithRetry: jest.fn(<T>(operation: (manager: {
                create: jest.Mock;
                save: jest.Mock;
            }) => Promise<T>) => operation({
                create: jest.fn((_Entity: unknown, data: Record<string, unknown>) => ({
                    id: 'payment-1',
                    ...data,
                })),
                save: jest.fn().mockResolvedValue(undefined),
            })),
        };
        providerFactoryMock = { getProvider: jest.fn() };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentsService,
                {
                    provide: getRepositoryToken(Payment),
                    useValue: paymentRepoMock,
                },
                {
                    provide: getRepositoryToken(Subscription),
                    useValue: subscriptionRepoMock,
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: userRepoMock,
                },
                {
                    provide: getRepositoryToken(Refund),
                    useValue: refundRepoMock,
                },
                {
                    provide: getRepositoryToken(Invoice),
                    useValue: invoiceRepoMock,
                },
                {
                    provide: TransactionService,
                    useValue: mockTransactionService,
                },
                {
                    provide: ProviderFactoryService,
                    useValue: providerFactoryMock,
                },
            ],
        }).compile();
        service = module.get<PaymentsService>(PaymentsService);
        paymentRepository = module.get(getRepositoryToken(Payment));
        userRepository = module.get(getRepositoryToken(User));
        refundRepository = module.get(getRepositoryToken(Refund));
        invoiceRepository = module.get(getRepositoryToken(Invoice));
    });
    it('creates payment intent for valid user', async () => {
        userRepository.findOne.mockResolvedValue({ id: 'user-1' });
        paymentRepository.create.mockReturnValue({
            id: 'payment-1',
            ...baseCreatePaymentDto,
            status: PaymentStatus.PENDING,
        });
        paymentRepository.save.mockResolvedValue(undefined);
        const provider = {
            createPaymentIntent: jest.fn().mockResolvedValue({
                paymentIntentId: 'pi_123',
                clientSecret: 'cs_123',
                requiresAction: false,
            }),
        };
        providerFactoryMock.getProvider.mockReturnValue(provider);
        await expect(service.createPaymentIntent('user-1', baseCreatePaymentDto)).resolves.toMatchObject({
            paymentId: 'payment-1',
            clientSecret: 'cs_123',
            requiresAction: false,
        });
    });
    it('returns not found when user does not exist', async () => {
        userRepository.findOne.mockResolvedValue(null);
        await expectNotFound(() => service.createPaymentIntent('missing-user', baseCreatePaymentDto));
    });
    it('returns not found when refund payment does not exist', async () => {
        paymentRepository.findOne.mockResolvedValue(null);
        await expectNotFound(() => service.processRefund({ paymentId: 'missing', reason: 'duplicate' }));
    });
    it('returns validation failure when refunding non-completed payment', async () => {
        paymentRepository.findOne.mockResolvedValue({
            id: 'payment-1',
            provider: 'stripe',
            status: PaymentStatus.PENDING,
        });
        await expectValidationFailure(() => service.processRefund({ paymentId: 'payment-1', reason: 'duplicate' }));
    });
    it('returns not found when invoice payment is missing', async () => {
        paymentRepository.findOne.mockResolvedValue(null);
        await expectNotFound(() => service.getInvoice('payment-1', 'user-1'));
    });
    it('supports unauthorized flow when provider rejects a request', async () => {
        userRepository.findOne.mockResolvedValue({ id: 'user-1' });
        providerFactoryMock.getProvider.mockReturnValue({
            createPaymentIntent: jest
                .fn()
                .mockRejectedValue(new UnauthorizedException('Invalid provider token')),
        });
        await expectUnauthorized(() => service.createPaymentIntent('user-1', baseCreatePaymentDto));
    });
    it('uses pagination offset for user payment history', async () => {
        paymentRepository.find.mockResolvedValue([]);
        await service.getUserPayments('user-1', 20, 3);
        expect(paymentRepository.find).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId: 'user-1' },
            skip: 40,
            take: 20,
        }));
    });
    it('throws business validation error type for non-completed refund', async () => {
        paymentRepository.findOne.mockResolvedValue({
            id: 'payment-2',
            provider: 'stripe',
            status: PaymentStatus.PENDING,
        });
        await expect(service.processRefund({ paymentId: 'payment-2', reason: 'duplicate' })).rejects.toBeInstanceOf(BadRequestException);
    });
    it('throws not found type when user is missing', async () => {
        userRepository.findOne.mockResolvedValue(null);
        await expect(service.createPaymentIntent('missing-user', baseCreatePaymentDto)).rejects.toBeInstanceOf(NotFoundException);
    });

    await expect(
      service.processRefund({ paymentId: 'payment-2', reason: 'duplicate' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found type when user is missing', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.createPaymentIntent('missing-user', baseCreatePaymentDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('idempotency', () => {
    const idempotencyKey = 'idem-key-abc123';

    it('replays existing pending payment without hitting the provider', async () => {
      const existingPayment = {
        id: 'payment-existing',
        status: PaymentStatus.PENDING,
        metadata: { _clientSecret: 'cs_replayed', _requiresAction: false },
      };
      paymentRepository.findOne.mockResolvedValue(existingPayment);

      const provider = { createPaymentIntent: jest.fn() };
      providerFactoryMock.getProvider.mockReturnValue(provider);

      const result = await service.createPaymentIntent(
        'user-1',
        baseCreatePaymentDto,
        idempotencyKey,
      );

      expect(result).toMatchObject({
        paymentId: 'payment-existing',
        clientSecret: 'cs_replayed',
        requiresAction: false,
      });
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('replays existing completed payment without hitting the provider', async () => {
      const existingPayment = {
        id: 'payment-done',
        status: PaymentStatus.COMPLETED,
        metadata: { _clientSecret: 'cs_done', _requiresAction: true },
      };
      paymentRepository.findOne.mockResolvedValue(existingPayment);

      const provider = { createPaymentIntent: jest.fn() };
      providerFactoryMock.getProvider.mockReturnValue(provider);

      const result = await service.createPaymentIntent(
        'user-1',
        baseCreatePaymentDto,
        idempotencyKey,
      );

      expect(result.paymentId).toBe('payment-done');
      expect(result.requiresAction).toBe(true);
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('allows retry when previous payment with the same key has failed', async () => {
      // First findOne call (idempotency check) returns a failed payment
      // Second findOne call (user lookup) returns the user
      paymentRepository.findOne
        .mockResolvedValueOnce({
          id: 'payment-failed',
          status: PaymentStatus.FAILED,
          metadata: {},
        })
        .mockResolvedValueOnce(undefined);

      userRepository.findOne.mockResolvedValue({ id: 'user-1' });
      paymentRepository.create.mockReturnValue({
        id: 'payment-retry',
        ...baseCreatePaymentDto,
        status: PaymentStatus.PENDING,
      });
      paymentRepository.save.mockResolvedValue(undefined);

      const provider = {
        createPaymentIntent: jest.fn().mockResolvedValue({
          paymentIntentId: 'pi_retry',
          clientSecret: 'cs_retry',
          requiresAction: false,
        }),
      };
      providerFactoryMock.getProvider.mockReturnValue(provider);

      const result = await service.createPaymentIntent(
        'user-1',
        baseCreatePaymentDto,
        idempotencyKey,
      );

      expect(result.paymentId).toBe('payment-retry');
      expect(provider.createPaymentIntent).toHaveBeenCalledTimes(1);
    });

    it('creates a new payment without idempotency key (no DB pre-check)', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'user-1' });
      paymentRepository.create.mockReturnValue({
        id: 'payment-new',
        ...baseCreatePaymentDto,
        status: PaymentStatus.PENDING,
      });
      paymentRepository.save.mockResolvedValue(undefined);

      const provider = {
        createPaymentIntent: jest.fn().mockResolvedValue({
          paymentIntentId: 'pi_new',
          clientSecret: 'cs_new',
          requiresAction: false,
        }),
      };
      providerFactoryMock.getProvider.mockReturnValue(provider);

      await service.createPaymentIntent('user-1', baseCreatePaymentDto);

      // findOne should only be called once (user lookup), not for idempotency
      expect(paymentRepository.findOne).not.toHaveBeenCalled();
      expect(provider.createPaymentIntent).toHaveBeenCalledTimes(1);
    });

    it('replays an already-processed refund without re-refunding', async () => {
      const existingRefund = {
        id: 'refund-existing',
        status: 'processed',
        amount: 50,
      };
      refundRepository.findOne.mockResolvedValue(existingRefund);

      const provider = { refundPayment: jest.fn() };
      providerFactoryMock.getProvider.mockReturnValue(provider);

      const result = await service.processRefund(
        { paymentId: 'payment-1', reason: 'duplicate' },
        idempotencyKey,
      );

      expect(result).toMatchObject({
        refundId: 'refund-existing',
        status: 'processed',
        amount: 50,
      });
      expect(provider.refundPayment).not.toHaveBeenCalled();
    });

    it('stores the idempotency key on the new payment record', async () => {
      paymentRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue({ id: 'user-1' });

      const captured: any = {};
      paymentRepository.create.mockImplementation((data: any) => {
        Object.assign(captured, data);
        return { id: 'payment-keyed', ...data };
      });
      paymentRepository.save.mockResolvedValue(undefined);

      const provider = {
        createPaymentIntent: jest.fn().mockResolvedValue({
          paymentIntentId: 'pi_keyed',
          clientSecret: 'cs_keyed',
          requiresAction: false,
        }),
      };
      providerFactoryMock.getProvider.mockReturnValue(provider);

      await service.createPaymentIntent('user-1', baseCreatePaymentDto, 'my-unique-key');

      expect(captured.idempotencyKey).toBe('my-unique-key');
      expect(captured.metadata?._clientSecret).toBe('cs_keyed');
    });

    it('stores the idempotency key on the new refund record', async () => {
      refundRepository.findOne.mockResolvedValueOnce(null); // idempotency check
      refundRepository.findOne.mockResolvedValueOnce(null); // duplicate check

      paymentRepository.findOne.mockResolvedValue({
        id: 'payment-1',
        provider: 'stripe',
        providerPaymentId: 'pi_1',
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });

      const captured: any = {};
      refundRepository.create.mockImplementation((data: any) => {
        Object.assign(captured, data);
        return { id: 'refund-new', status: 'processed', amount: 100, ...data };
      });
      refundRepository.save.mockResolvedValue(undefined);
      paymentRepository.save.mockResolvedValue(undefined);

      const provider = {
        refundPayment: jest.fn().mockResolvedValue({ refundId: 're_1', status: 'succeeded' }),
      };
      providerFactoryMock.getProvider.mockReturnValue(provider);

      await service.processRefund(
        { paymentId: 'payment-1', reason: 'requested_by_customer' },
        'refund-idem-key',
      );

      expect(captured.idempotencyKey).toBe('refund-idem-key');
    });

    it('throws ConflictException when refunding an already-refunded payment without an idempotency key', async () => {
      paymentRepository.findOne.mockResolvedValue({
        id: 'payment-1',
        provider: 'stripe',
        providerPaymentId: 'pi_1',
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });
      refundRepository.findOne.mockResolvedValue({
        id: 'refund-old',
        status: 'processed',
        amount: 100,
      });

      await expect(
        service.processRefund({ paymentId: 'payment-1', reason: 'duplicate' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

import {
  BadRequestException,
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
import {
  expectNotFound,
  expectUnauthorized,
  expectValidationFailure,
} from '../../test/utils';

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

  const baseCreatePaymentDto: CreatePaymentDto = {
    courseId: 'course-1',
    amount: 100,
    currency: 'USD',
    provider: 'stripe',
    metadata: { source: 'test' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: createRepositoryMock(),
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: createRepositoryMock(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createRepositoryMock(),
        },
        {
          provide: getRepositoryToken(Refund),
          useValue: createRepositoryMock(),
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: createRepositoryMock(),
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
    jest.spyOn(service as any, 'getProvider').mockReturnValue(provider);

    await expect(
      service.createPaymentIntent('user-1', baseCreatePaymentDto),
    ).resolves.toMatchObject({
      paymentId: 'payment-1',
      clientSecret: 'cs_123',
      requiresAction: false,
    });
  });

  it('returns not found when user does not exist', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expectNotFound(() =>
      service.createPaymentIntent('missing-user', baseCreatePaymentDto),
    );
  });

  it('returns not found when refund payment does not exist', async () => {
    paymentRepository.findOne.mockResolvedValue(null);

    await expectNotFound(() =>
      service.processRefund({ paymentId: 'missing', reason: 'duplicate' }),
    );
  });

  it('returns validation failure when refunding non-completed payment', async () => {
    paymentRepository.findOne.mockResolvedValue({
      id: 'payment-1',
      provider: 'stripe',
      status: PaymentStatus.PENDING,
    });

    await expectValidationFailure(() =>
      service.processRefund({ paymentId: 'payment-1', reason: 'duplicate' }),
    );
  });

  it('returns not found when invoice payment is missing', async () => {
    paymentRepository.findOne.mockResolvedValue(null);

    await expectNotFound(() => service.getInvoice('payment-1', 'user-1'));
  });

  it('supports unauthorized flow when provider rejects a request', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1' });
    jest.spyOn(service as any, 'getProvider').mockReturnValue({
      createPaymentIntent: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('Invalid provider token')),
    });

    await expectUnauthorized(() =>
      service.createPaymentIntent('user-1', baseCreatePaymentDto),
    );
  });

  it('uses pagination offset for user payment history', async () => {
    paymentRepository.find.mockResolvedValue([]);

    await service.getUserPayments('user-1', 20, 3);

    expect(paymentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        skip: 40,
        take: 20,
      }),
    );
  });

  it('throws business validation error type for non-completed refund', async () => {
    paymentRepository.findOne.mockResolvedValue({
      id: 'payment-2',
      provider: 'stripe',
      status: PaymentStatus.PENDING,
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
});

import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus, BillingInterval } from '../enums';
import { StripeService } from '../providers/stripe.service';
import { Repository } from 'typeorm';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let repo: jest.Mocked<Repository<Subscription>>;
  let stripe: jest.Mocked<StripeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            }),
          },
        },
        {
          provide: StripeService,
          useValue: {
            createCustomer: jest.fn(),
            createSubscription: jest.fn(),
            cancelSubscription: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    repo = module.get(getRepositoryToken(Subscription));
    stripe = module.get(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a subscription', async () => {
    stripe.createCustomer.mockResolvedValue({ id: 'cus_123' } as any);
    service['createPriceId'] = jest.fn().mockResolvedValue('price_123');
    stripe.createSubscription.mockResolvedValue({
      id: 'sub_123',
      current_period_start: 1,
      current_period_end: 2,
    } as any);
    repo.create.mockReturnValue({} as any);
    repo.save.mockResolvedValue({
      id: 's1',
      status: SubscriptionStatus.ACTIVE,
    } as any);
    const result = await service.createSubscription({
      userId: 'u1',
      amount: 10,
      currency: 'usd',
      billingInterval: BillingInterval.MONTHLY,
    } as any);
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('should cancel a subscription', async () => {
    repo.findOne.mockResolvedValue({
      id: 's1',
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: 'sub_123',
    } as any);
    stripe.cancelSubscription.mockResolvedValue({ id: 'sub_123' } as any);
    repo.save.mockResolvedValue({
      id: 's1',
      status: SubscriptionStatus.CANCELLED,
    } as any);
    service.getSubscription = jest.fn().mockResolvedValue({
      id: 's1',
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: 'sub_123',
    } as any);
    const result = await service.cancelSubscription('s1');
    expect(result.status).toBe(SubscriptionStatus.CANCELLED);
  });
});

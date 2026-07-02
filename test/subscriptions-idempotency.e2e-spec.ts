import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SubscriptionsController } from '../src/payments/subscriptions/subscriptions.controller';
import { SubscriptionsService } from '../src/payments/subscriptions/subscriptions.service';
import {
  DowngradeSubscriptionDto,
  UpgradeSubscriptionDto,
} from '../src/payments/subscriptions/dto/subscription-action.dto';
import { IdempotencyInterceptor } from '../src/common/interceptors/idempotency.interceptor';
import { IdempotencyModule } from '../src/common/modules/idempotency.module';
import { IDEMPOTENCY_REDIS_CLIENT } from '../src/common/constants/idempotency.constants';
import { IdempotencyService } from '../src/common/services/idempotency.service';

class InMemoryRedisClient {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null> {
    const normalizedArgs = args.map((arg) => String(arg));
    const nxIndex = normalizedArgs.indexOf('NX');
    const exIndex = normalizedArgs.indexOf('EX');
    const pxIndex = normalizedArgs.indexOf('PX');

    if (nxIndex >= 0 && this.store.has(key)) {
      const existing = await this.get(key);
      if (existing !== null) {
        return null;
      }
    }

    let expiresAt: number | null = null;
    if (exIndex >= 0) {
      expiresAt = Date.now() + Number(normalizedArgs[exIndex + 1]) * 1000;
    } else if (pxIndex >= 0) {
      expiresAt = Date.now() + Number(normalizedArgs[pxIndex + 1]);
    }

    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      count += this.store.delete(key) ? 1 : 0;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const matcher = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return [...this.store.keys()].filter((key) => matcher.test(key));
  }
}

describe('Idempotency (alternative coverage)', () => {
  let app: INestApplication;
  let redis: InMemoryRedisClient;

  const mockSubscriptionsService = {
    upgradeSubscription: jest.fn(),
    downgradeSubscription: jest.fn(),
    pauseSubscription: jest.fn(),
    resumeSubscription: jest.fn(),
    getSubscription: jest.fn(),
    getUserSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
  };

  beforeAll(async () => {
    redis = new InMemoryRedisClient();

    mockSubscriptionsService.upgradeSubscription.mockImplementation(async () => {
      return {
        id: 'sub-1',
        status: 'active',
        currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
        cancelAtPeriodEnd: false,
        amount: 19.99,
        currency: 'USD',
        interval: 'monthly',
      };
    });

    mockSubscriptionsService.downgradeSubscription.mockImplementation(async () => {
      return {
        id: 'sub-1',
        status: 'active',
        currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
        cancelAtPeriodEnd: false,
        amount: 9.99,
        currency: 'USD',
        interval: 'monthly',
      };
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), IdempotencyModule],
      controllers: [SubscriptionsController],
      providers: [
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
      ],
    })
      // ensure idempotency interceptor uses in-memory redis
      .overrideProvider(IDEMPOTENCY_REDIS_CLIENT)
      .useValue(redis)
      // reduce ttl/no-op env reads
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'IDEMPOTENCY_TTL_SECONDS') {
            return 86400;
          }
          return defaultValue;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Wire idempotency interceptor for this test app
    const idempotencyService = moduleFixture.get(IdempotencyService);
    const reflector = moduleFixture.get<any>('Reflector');
    app.useGlobalInterceptors(new IdempotencyInterceptor(idempotencyService, reflector));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deduplicates repeated POST upgrade requests with same Idempotency-Key', async () => {
    const route = '/subscriptions/sub-xyz/upgrade';
    const dto: UpgradeSubscriptionDto = { planId: 'plan-basic', billingCycle: 'monthly' };

    const first = await request(app.getHttpServer())
      .post(route)
      .set('Idempotency-Key', 'idem-upgrade-1')
      .send(dto)
      .expect(200);

    const second = await request(app.getHttpServer())
      .post(route)
      .set('Idempotency-Key', 'idem-upgrade-1')
      .send(dto)
      .expect(200);

    expect(first.body).toEqual(second.body);
    expect(second.header['x-idempotent-replayed']).toBe('true');
    expect(mockSubscriptionsService.upgradeSubscription).toHaveBeenCalledTimes(1);
  });

  it('deduplicates repeated POST downgrade requests with same Idempotency-Key', async () => {
    const route = '/subscriptions/sub-xyz/downgrade';
    const dto: DowngradeSubscriptionDto = { planId: 'plan-basic', billingCycle: 'monthly' };

    const first = await request(app.getHttpServer())
      .post(route)
      .set('Idempotency-Key', 'idem-downgrade-1')
      .send(dto)
      .expect(200);

    const second = await request(app.getHttpServer())
      .post(route)
      .set('Idempotency-Key', 'idem-downgrade-1')
      .send(dto)
      .expect(200);

    expect(first.body).toEqual(second.body);
    expect(second.header['x-idempotent-replayed']).toBe('true');
    expect(mockSubscriptionsService.downgradeSubscription).toHaveBeenCalledTimes(1);
  });
});


import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { QuotaGuard } from '../src/rate-limiting/guards/quota.guard';
import { Reflector } from '@nestjs/core';
import { QuotaTrackingService, QuotaCheckResult } from '../src/rate-limiting/services/quota-tracking.service';
import supertest from 'supertest';

@Controller('rate-test')
class RateLimitTestController {
  @Get('endpoint')
  getEndpoint() {
    return { success: true, message: 'Request succeeded' };
  }

  @Post('endpoint')
  postEndpoint() {
    return { success: true, message: 'POST request succeeded' };
  }
}

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RateLimitTestController],
      providers: [
        Reflector,
        {
          provide: QuotaTrackingService,
          useValue: {
            checkAndIncrement: jest.fn().mockImplementation(async (): Promise<QuotaCheckResult> => ({
              allowed: true,
              remaining: { minute: 4, hour: 29, day: 99 },
              limit: { minute: 5, hour: 30, day: 100 },
            })),
          },
        },
        {
          provide: APP_GUARD,
          useClass: QuotaGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should have RateLimitingModule loaded when DISABLE_RATE_LIMITING is not set', async () => {
    const response = await supertest(app.getHttpServer()).get('/rate-test/endpoint');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return rate limit headers on responses', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/rate-test/endpoint')
      .set('X-Forwarded-For', '192.168.1.100');

    expect(response.status).toBe(200);
    expect(response.headers).toHaveProperty('x-ratelimit-limit-minute');
    expect(response.headers).toHaveProperty('x-ratelimit-limit-hour');
    expect(response.headers).toHaveProperty('x-ratelimit-limit-day');
  });
});

describe('Rate Limiting - Over Limit (e2e)', () => {
  let appOverLimit: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RateLimitTestController],
      providers: [
        Reflector,
        {
          provide: QuotaTrackingService,
          useValue: {
            checkAndIncrement: jest.fn().mockImplementation(async (): Promise<QuotaCheckResult> => ({
              allowed: false,
              remaining: { minute: 0, hour: 0, day: 0 },
              limit: { minute: 5, hour: 30, day: 100 },
              retryAfter: 30,
            })),
          },
        },
        {
          provide: APP_GUARD,
          useClass: QuotaGuard,
        },
      ],
    }).compile();

    appOverLimit = moduleFixture.createNestApplication();
    await appOverLimit.init();
  });

  afterAll(async () => {
    if (appOverLimit) {
      await appOverLimit.close();
    }
  });

  it('should return 429 when rate limit is exceeded', async () => {
    const response = await supertest(appOverLimit.getHttpServer())
      .get('/rate-test/endpoint')
      .set('X-Forwarded-For', '192.168.1.200');

    expect(response.status).toBe(429);
  });
});
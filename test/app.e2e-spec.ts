import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { TestHttpClient } from './utils/test-http-client';
import { TestRetryHelper } from './utils/test-retry-helper';

describe('App (e2e)', () => {
  let app: INestApplication;
  let httpClient: TestHttpClient;
  let retryHelper: TestRetryHelper;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    httpClient = new TestHttpClient(app.getHttpServer());
    retryHelper = new TestRetryHelper();
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  describe('Health Check', () => {
    it('should return app status with retries', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.get('/');
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('message', 'TeachLink API is running');
          expect(response.body).toHaveProperty('timestamp');
        },
        {
          maxAttempts: 3,
          delayMs: 1000,
          backoffMultiplier: 2,
        },
      );
    }, 10000);
  });

  describe('API Endpoints', () => {
    it('should handle concurrent requests stably', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          retryHelper.withRetry(() => httpClient.get('/search?q=javascript'), {
            maxAttempts: 3,
            delayMs: 200,
          }),
        );

      const results = await Promise.all(requests);

      results.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('query', 'javascript');
      });
    }, 30000);

    it('should return autocomplete suggestions endpoint', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.get('/search/autocomplete?q=java');
          expect(response.status).toBe(200);
          expect(Array.isArray(response.body)).toBe(true);
        },
        {
          maxAttempts: 2,
          delayMs: 1000,
        },
      );
    }, 10000);
  });
});

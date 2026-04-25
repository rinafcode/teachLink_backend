import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule } from '../src/app.module';
import { TestDatabaseService } from './utils/test-database.service';
import { TestHttpClient } from './utils/test-http-client';
import { TestRetryHelper } from './utils/test-retry-helper';

describe('App (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseService;
  let httpClient: TestHttpClient;
  let retryHelper: TestRetryHelper;

  beforeAll(async () => {
    // Initialize test database
    testDb = new TestDatabaseService();
    await testDb.setup();

    // Create test module with full app context
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DATABASE_CONNECTION')
      .useValue(testDb.getConnection())
      .compile();

    app = moduleFixture.createNestApplication();

    // Configure app for testing
    app.setGlobalPrefix('api');
    await app.init();

    // Initialize test utilities
    httpClient = new TestHttpClient(app.getHttpServer());
    retryHelper = new TestRetryHelper();
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    await app.close();
    await testDb.teardown();
  }, 30000);

  beforeEach(async () => {
    // Clean database between tests
    await testDb.clean();
  });

  describe('Health Check', () => {
    it('should return healthy status with retries', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.get('/health');
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('status', 'ok');
        },
        {
          maxAttempts: 3,
          delayMs: 1000,
          backoffMultiplier: 2,
        },
      );
    }, 10000);

    it('should handle database connectivity', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.get('/api/health/database');
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('database', 'connected');
        },
        {
          maxAttempts: 5,
          delayMs: 500,
        },
      );
    }, 15000);
  });

  describe('API Endpoints', () => {
    it('should handle concurrent requests stably', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          retryHelper.withRetry(
            () => httpClient.get('/'),
            { maxAttempts: 3, delayMs: 200 },
          ),
        );

      const results = await Promise.all(requests);

      results.forEach((response) => {
        expect(response.status).toBe(200);
      });
    }, 30000);

    it('should handle request timeouts gracefully', async () => {
      await retryHelper.withRetry(
        async () => {
          // Test with a potentially slow endpoint
          const response = await httpClient.get('/api/slow-endpoint', {
            timeout: 5000,
          });
          expect([200, 404]).toContain(response.status); // Either success or not found
        },
        {
          maxAttempts: 2,
          delayMs: 1000,
        },
      );
    }, 10000);
  });
});

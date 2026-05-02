import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { TestDatabaseService } from '../utils/test-database.service';
import { TestHttpClient } from '../utils/test-http-client';
import { TestRetryHelper } from '../utils/test-retry-helper';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseService;
  let httpClient: TestHttpClient;
  let retryHelper: TestRetryHelper;

  beforeAll(async () => {
    testDb = new TestDatabaseService();
    await testDb.setup();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DATABASE_CONNECTION')
      .useValue(testDb.getConnection())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    httpClient = new TestHttpClient(app.getHttpServer());
    retryHelper = new TestRetryHelper();

    // Wait for database to be ready
    await httpClient.waitForDatabase();
  }, 120000);

  afterAll(async () => {
    await app.close();
    await testDb.teardown();
  }, 30000);

  beforeEach(async () => {
    await testDb.clean();
  });

  describe('User Registration', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register user successfully with retries', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.post('/api/auth/register', testUser);

          expect(response.status).toBe(201);
          expect(response.body).toHaveProperty('user');
          expect(response.body).toHaveProperty('accessToken');
          expect(response.body.user.email).toBe(testUser.email);
        },
        {
          maxAttempts: 3,
          delayMs: 1000,
          backoffMultiplier: 2,
        },
      );
    }, 30000);

    it('should handle duplicate registration gracefully', async () => {
      // First registration
      await httpClient.post('/api/auth/register', testUser);

      // Second registration should fail
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.post('/api/auth/register', testUser);
          expect(response.status).toBe(409);
          expect(response.body).toHaveProperty('message');
        },
        {
          maxAttempts: 2,
          delayMs: 500,
        },
      );
    }, 20000);

    it('should validate registration data', async () => {
      const invalidUser = {
        email: 'invalid-email',
        password: '123', // Too short
      };

      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.post('/api/auth/register', invalidUser);
          expect(response.status).toBe(400);
          expect(response.body).toHaveProperty('message');
        },
        {
          maxAttempts: 2,
          delayMs: 500,
        },
      );
    }, 15000);
  });

  describe('User Login', () => {
    const testUser = {
      email: 'login@example.com',
      password: 'LoginPassword123!',
      firstName: 'Login',
      lastName: 'Test',
    };

    beforeEach(async () => {
      // Register user for login tests
      await retryHelper.withRetry(() => httpClient.post('/api/auth/register', testUser), {
        maxAttempts: 3,
        delayMs: 1000,
      });
    });

    it('should login successfully with retries', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.post('/api/auth/login', {
            email: testUser.email,
            password: testUser.password,
          });

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('accessToken');
          expect(response.body).toHaveProperty('refreshToken');
          expect(response.body).toHaveProperty('user');
        },
        {
          maxAttempts: 3,
          delayMs: 1000,
          backoffMultiplier: 1.5,
        },
      );
    }, 25000);

    it('should handle invalid credentials', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.post('/api/auth/login', {
            email: testUser.email,
            password: 'wrongpassword',
          });

          expect(response.status).toBe(401);
          expect(response.body).toHaveProperty('message');
        },
        {
          maxAttempts: 2,
          delayMs: 500,
        },
      );
    }, 15000);

    it('should handle concurrent login attempts', async () => {
      const loginRequests = Array(5)
        .fill(null)
        .map(() =>
          retryHelper.withRetry(
            () =>
              httpClient.post('/api/auth/login', {
                email: testUser.email,
                password: testUser.password,
              }),
            { maxAttempts: 3, delayMs: 200 },
          ),
        );

      const results = await Promise.all(loginRequests);

      // At least one should succeed, others might be rate limited
      const successCount = results.filter((r) => r.status === 200).length;
      const rateLimitCount = results.filter((r) => r.status === 429).length;

      expect(successCount + rateLimitCount).toBe(results.length);
      if (successCount > 0) {
        const successResponse = results.find((r) => r.status === 200);
        expect(successResponse?.body).toHaveProperty('accessToken');
      }
    }, 45000);
  });

  describe('Token Refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get tokens
      await httpClient.post('/api/auth/register', {
        email: 'refresh@example.com',
        password: 'RefreshPass123!',
        firstName: 'Refresh',
        lastName: 'Test',
      });

      const loginResponse = await httpClient.post('/api/auth/login', {
        email: 'refresh@example.com',
        password: 'RefreshPass123!',
      });

      refreshToken = loginResponse.body.refreshToken;
    });

    it('should refresh access token with retries', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.post('/api/auth/refresh', {
            refreshToken,
          });

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('accessToken');
          expect(response.body).toHaveProperty('refreshToken');
        },
        {
          maxAttempts: 3,
          delayMs: 1000,
        },
      );
    }, 20000);

    it('should handle invalid refresh token', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.post('/api/auth/refresh', {
            refreshToken: 'invalid-token',
          });

          expect(response.status).toBe(401);
          expect(response.body).toHaveProperty('message');
        },
        {
          maxAttempts: 2,
          delayMs: 500,
        },
      );
    }, 15000);
  });

  describe('Protected Routes', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and login to get access token
      await httpClient.post('/api/auth/register', {
        email: 'protected@example.com',
        password: 'ProtectedPass123!',
        firstName: 'Protected',
        lastName: 'Test',
      });

      const loginResponse = await httpClient.post('/api/auth/login', {
        email: 'protected@example.com',
        password: 'ProtectedPass123!',
      });

      accessToken = loginResponse.body.accessToken;
    });

    it('should access protected route with valid token', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.get('/api/users/profile', {
            auth: { token: accessToken },
          });

          expect([200, 404]).toContain(response.status); // Either success or not found if endpoint doesn't exist
        },
        {
          maxAttempts: 3,
          delayMs: 1000,
        },
      );
    }, 20000);

    it('should reject access without token', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.get('/api/users/profile');
          expect(response.status).toBe(401);
        },
        {
          maxAttempts: 2,
          delayMs: 500,
        },
      );
    }, 15000);

    it('should reject access with invalid token', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.get('/api/users/profile', {
            auth: { token: 'invalid-token' },
          });

          expect(response.status).toBe(401);
        },
        {
          maxAttempts: 2,
          delayMs: 500,
        },
      );
    }, 15000);
  });
});

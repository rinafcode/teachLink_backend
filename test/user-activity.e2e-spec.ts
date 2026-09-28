import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { TestHttpClient } from './utils/test-http-client';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

/**
 * E2E tests for the User Activity Timeline feature.
 * Verifies that users can securely access and export their own activity logs.
 */
describe('User Activity Timeline (e2e)', () => {
  let app: INestApplication;
  let httpClient: TestHttpClient;
  const mockUserId = 'test-user-id';
  const mockUserEmail = 'test@example.com';

  beforeAll(async () => {
    // Create testing module with JwtAuthGuard overridden to simulate an authenticated user
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          // Inject mock user into the request object
          req.user = { id: mockUserId, email: mockUserEmail };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    httpClient = new TestHttpClient(app.getHttpServer());
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  describe('GET /users/me/activities', () => {
    it('should return a paginated activity timeline for the authenticated user', async () => {
      const response = await httpClient.get('/users/me/activities');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 20);
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should respect the limit query parameter', async () => {
      const limit = 5;
      const response = await httpClient.get(`/users/me/activities?limit=${limit}`);

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(limit);
    });

    it('should cap the limit at 100', async () => {
      const response = await httpClient.get('/users/me/activities?limit=500');

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(100);
    });

    it('should filter by activity type when provided', async () => {
      const response = await httpClient.get('/users/me/activities?type=LOGIN');

      expect(response.status).toBe(200);
      // All returned logs should be of type LOGIN (if any exist)
      response.body.logs.forEach((log) => {
        expect(log.action).toBe('LOGIN');
      });
    });
  });

  describe('GET /users/me/activities/export', () => {
    it('should return a CSV file containing the user activity history', async () => {
      const response = await httpClient.get('/users/me/activities/export');

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toContain('text/csv');
      expect(response.header['content-disposition']).toContain(
        'attachment; filename=activity-history.csv',
      );

      // Verify CSV headers are present
      expect(response.text).toContain('timestamp,userId,userEmail,action,category,severity');
    });

    it('should apply filters to the export', async () => {
      const response = await httpClient.get('/users/me/activities/export?type=DATA_CREATED');

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toContain('text/csv');

      // If there are rows, they should contain DATA_CREATED (hard to test text-based CSV reliably without parsing)
      if (response.text.split('\n').length > 1) {
        expect(response.text).toContain('DATA_CREATED');
      }
    });
  });
});
